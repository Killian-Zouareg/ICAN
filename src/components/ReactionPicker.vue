<template>
  <div class="reaction-picker" @click.stop>
    <button
      v-for="emoji in emojis"
      :key="emoji"
      class="picker-emoji"
      @click="$emit('pick', emoji)"
      :title="emoji"
    >{{ emoji }}</button>
  </div>
</template>

<script setup>
import { REACTION_EMOJIS } from '../stores/reactions'

defineEmits(['pick'])

const emojis = REACTION_EMOJIS
</script>

<style scoped src="./ReactionPicker.css"></style>
