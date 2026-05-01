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
      <!-- User mentions (@) -->
      <template v-if="mentionMode === 'user'">
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
      </template>
      <!-- Location mentions (<) -->
      <template v-else-if="mentionMode === 'location'">
        <div
          v-for="(loc, i) in suggestions"
          :key="loc.id"
          class="mention-item"
          :class="{ active: i === activeIndex }"
          @mousedown.prevent="selectLocation(loc)"
        >
          <span class="loc-emoji" :style="{ background: getCatColor(loc.category) + '30', color: getCatColor(loc.category) }">
            {{ getCatEmoji(loc.category) }}
          </span>
          <div class="mention-item-info">
            <span class="mention-item-name">{{ loc.name }}</span>
            <span class="mention-item-handle">{{ getCatLabel(loc.category) }}</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { supabase } from '../lib/supabase'
import { useMapLocationsStore } from '../stores/mapLocations'
import UserAvatar from './UserAvatar.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  modelValue: { type: String, default: '' },
  tag: { type: String, default: 'textarea' },
  dropdownPosition: { type: String, default: 'bottom' }, // 'bottom' | 'top'
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
const mentionMode = ref(null) // 'user' | 'location' | null
const dropdownStyle = ref({})
let searchTimeout = null

const mapStore = useMapLocationsStore()

function getCatColor(cat) {
  return mapStore.CATEGORIES[cat]?.color || '#8899a6'
}
function getCatEmoji(cat) {
  return mapStore.CATEGORIES[cat]?.emoji || '📍'
}
function getCatLabel(cat) {
  return mapStore.CATEGORIES[cat]?.label || 'Autre'
}

function onInput(e) {
  const value = e.target.value
  emit('update:modelValue', value)

  const pos = e.target.selectionStart
  const textBefore = value.slice(0, pos)

  // Check for @ user mention
  const userMatch = textBefore.match(/(?:^|[\s])@([a-zA-Z0-9_]*)$/)
  if (userMatch) {
    mentionMode.value = 'user'
    const query = userMatch[1]
    mentionStart.value = pos - query.length - 1 // position of @
    activeIndex.value = 0
    if (query.length > 0) {
      searchUsers(query)
    } else {
      showDropdown.value = false
    }
    return
  }

  // Check for < location mention
  const locMatch = textBefore.match(/(?:^|[\s])<([^>\s]*)$/)
  if (locMatch) {
    mentionMode.value = 'location'
    const query = locMatch[1]
    mentionStart.value = pos - query.length - 1 // position of <
    activeIndex.value = 0
    searchLocations(query)
    return
  }

  showDropdown.value = false
  suggestions.value = []
  mentionMode.value = null
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

function searchLocations(query) {
  // Ensure locations are loaded
  if (mapStore.locations.length === 0) {
    mapStore.fetchLocations().then(() => filterLocations(query))
  } else {
    filterLocations(query)
  }
}

function filterLocations(query) {
  const q = query.toLowerCase()
  suggestions.value = mapStore.locations
    .filter(l => l.name.toLowerCase().includes(q))
    .slice(0, 6)
  showDropdown.value = suggestions.value.length > 0
  if (showDropdown.value) positionDropdown()
}

function positionDropdown() {
  nextTick(() => {
    const el = inputRef.value
    if (!el) return
    if (props.dropdownPosition === 'top') {
      dropdownStyle.value = {
        left: '0px',
        bottom: (el.offsetHeight + 4) + 'px',
      }
    } else {
      dropdownStyle.value = {
        left: '0px',
        top: (el.offsetHeight + 4) + 'px',
      }
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
  closeDropdown()

  nextTick(() => {
    const cursorPos = mentionStart.value + user.username.length + 2 // @ + username + space
    el.focus()
    el.setSelectionRange(cursorPos, cursorPos)
  })
}

function selectLocation(loc) {
  const el = inputRef.value
  if (!el) return

  const value = props.modelValue
  const before = value.slice(0, mentionStart.value)
  const after = value.slice(el.selectionStart)
  const newValue = before + '<' + loc.name + '> ' + after

  emit('update:modelValue', newValue)
  closeDropdown()

  nextTick(() => {
    const cursorPos = mentionStart.value + loc.name.length + 3 // < + name + > + space
    el.focus()
    el.setSelectionRange(cursorPos, cursorPos)
  })
}

function closeDropdown() {
  showDropdown.value = false
  suggestions.value = []
  mentionMode.value = null
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
    const selected = suggestions.value[activeIndex.value]
    if (mentionMode.value === 'location') {
      selectLocation(selected)
    } else {
      selectUser(selected)
    }
  } else if (e.key === 'Escape') {
    closeDropdown()
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

.loc-emoji {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  font-size: 0.85rem;
  flex-shrink: 0;
}
</style>
