<template>
  <div class="mention-input-wrapper">
    <component
      :is="tag"
      ref="inputRef"
      :value="modelValue"
      @input="onInput"
      @keydown="onKeydown"
      v-bind="$attrs"
    />
    <div v-if="showDropdown && suggestions.length > 0" class="mention-dropdown" :style="dropdownStyle">
      <div
        v-for="(user, i) in suggestions"
        :key="user.id"
        class="mention-item"
        :class="{ active: i === activeIndex }"
        @mousedown.prevent="selectUser(user)"
      >
        <UserAvatar :url="user.avatar_url" :name="user.display_name || user.username" :size="24" />
        <div class="mention-item-info">
          <span class="mention-item-name">{{ user.display_name }}</span>
          <span class="mention-item-handle">@{{ user.username }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { supabase } from '../lib/supabase'
import UserAvatar from './UserAvatar.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  modelValue: { type: String, default: '' },
  tag: { type: String, default: 'textarea' },
})

const emit = defineEmits(['update:modelValue'])

const inputRef = ref(null)

defineExpose({
  focus: () => inputRef.value?.focus(),
})

const showDropdown = ref(false)
const suggestions = ref([])
const activeIndex = ref(0)
const mentionStart = ref(-1)
const dropdownStyle = ref({})
let searchTimeout = null

function onInput(e) {
  const value = e.target.value
  emit('update:modelValue', value)

  const pos = e.target.selectionStart
  const textBefore = value.slice(0, pos)

  // Find the last @ that starts a mention (preceded by space, newline, or start of string)
  const match = textBefore.match(/(?:^|[\s])@([a-zA-Z0-9_]*)$/)

  if (match) {
    const query = match[1]
    mentionStart.value = pos - query.length - 1 // position of @
    activeIndex.value = 0
    if (query.length > 0) {
      searchUsers(query)
    } else {
      showDropdown.value = false
    }
  } else {
    showDropdown.value = false
    suggestions.value = []
  }
}

function searchUsers(query) {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(async () => {
    const term = `${query}%`
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .or(`username.ilike.${term},display_name.ilike.%${query}%`)
      .limit(6)
    suggestions.value = data || []
    showDropdown.value = suggestions.value.length > 0
    if (showDropdown.value) positionDropdown()
  }, 200)
}

function positionDropdown() {
  nextTick(() => {
    const el = inputRef.value
    if (!el) return
    dropdownStyle.value = {
      left: '0px',
      top: (el.offsetHeight + 4) + 'px',
    }
  })
}

function selectUser(user) {
  const el = inputRef.value
  if (!el) return

  const value = props.modelValue
  const before = value.slice(0, mentionStart.value)
  const after = value.slice(el.selectionStart)
  const newValue = before + '@' + user.username + ' ' + after

  emit('update:modelValue', newValue)
  showDropdown.value = false
  suggestions.value = []

  nextTick(() => {
    const cursorPos = mentionStart.value + user.username.length + 2 // @ + username + space
    el.focus()
    el.setSelectionRange(cursorPos, cursorPos)
  })
}

function onKeydown(e) {
  if (!showDropdown.value || suggestions.value.length === 0) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % suggestions.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + suggestions.value.length) % suggestions.value.length
  } else if (e.key === 'Enter' && showDropdown.value) {
    e.preventDefault()
    selectUser(suggestions.value[activeIndex.value])
  } else if (e.key === 'Escape') {
    showDropdown.value = false
  }
}
</script>

<style scoped>
.mention-input-wrapper {
  position: relative;
  flex: 1;
  display: flex;
}

.mention-input-wrapper textarea,
.mention-input-wrapper input {
  width: 100%;
}

.mention-dropdown {
  position: absolute;
  left: 0;
  right: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  z-index: 100;
  max-height: 200px;
  overflow-y: auto;
}

.mention-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.75rem;
  cursor: pointer;
  transition: background 0.1s;
}

.mention-item:first-child {
  border-radius: 10px 10px 0 0;
}

.mention-item:last-child {
  border-radius: 0 0 10px 10px;
}

.mention-item:only-child {
  border-radius: 10px;
}

.mention-item.active,
.mention-item:hover {
  background: var(--bg-hover);
}

.mention-item-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.mention-item-name {
  font-size: 0.85rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mention-item-handle {
  font-size: 0.75rem;
  color: var(--text-secondary);
}
</style>
