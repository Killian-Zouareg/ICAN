<template>
  <div class="radar-chart-wrapper">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`">
      <!-- Grid levels (33%, 66%, 100%) -->
      <polygon
        v-for="level in [0.33, 0.66, 1]"
        :key="level"
        :points="gridPoints(level)"
        class="radar-grid"
      />

      <!-- Axis lines from center to vertices -->
      <line
        v-for="(_, i) in statKeys"
        :key="'axis-' + i"
        :x1="cx"
        :y1="cy"
        :x2="vertexX(i, 1)"
        :y2="vertexY(i, 1)"
        class="radar-axis"
      />

      <!-- Data polygon -->
      <polygon :points="dataPoints" class="radar-data" />

      <!-- Data points (dots) -->
      <circle
        v-for="(key, i) in statKeys"
        :key="'dot-' + i"
        :cx="vertexX(i, (stats[key] || 0) / 20)"
        :cy="vertexY(i, (stats[key] || 0) / 20)"
        r="4"
        class="radar-dot"
      />
    </svg>

    <!-- Labels positioned around the chart -->
    <div
      v-for="(key, i) in statKeys"
      :key="'label-' + i"
      class="radar-label"
      :style="labelStyle(i)"
    >
      <span class="radar-label-name">{{ statLabels[key] }}</span>
      <span class="radar-label-value">{{ stats[key] || 0 }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  stats: {
    type: Object,
    default: () => ({ force: 0, defense: 0, endurance: 0, intellect: 0, charisme: 0 }),
  },
  size: {
    type: Number,
    default: 280,
  },
})

const statKeys = ['force', 'defense', 'endurance', 'intellect', 'charisme']
const statLabels = {
  force: 'Force',
  defense: 'Défense',
  endurance: 'Endurance',
  intellect: 'Intellect',
  charisme: 'Charisme',
}

const cx = computed(() => props.size / 2)
const cy = computed(() => props.size / 2)
const radius = computed(() => props.size * 0.35)

function angle(i) {
  return -Math.PI / 2 + (2 * Math.PI * i) / 5
}

function vertexX(i, scale) {
  return cx.value + scale * radius.value * Math.cos(angle(i))
}

function vertexY(i, scale) {
  return cy.value + scale * radius.value * Math.sin(angle(i))
}

function gridPoints(scale) {
  return statKeys
    .map((_, i) => `${vertexX(i, scale)},${vertexY(i, scale)}`)
    .join(' ')
}

const dataPoints = computed(() =>
  statKeys
    .map((key, i) => {
      const val = Math.max(0, Math.min(20, props.stats[key] || 0)) / 20
      return `${vertexX(i, val)},${vertexY(i, val)}`
    })
    .join(' ')
)

function labelStyle(i) {
  const labelRadius = radius.value + 32
  const x = cx.value + labelRadius * Math.cos(angle(i))
  const y = cy.value + labelRadius * Math.sin(angle(i))
  return {
    left: `${x}px`,
    top: `${y}px`,
    transform: 'translate(-50%, -50%)',
  }
}
</script>

<style scoped>
.radar-chart-wrapper {
  position: relative;
  display: inline-block;
}

.radar-grid {
  fill: none;
  stroke: var(--border);
  stroke-width: 1;
}

.radar-axis {
  stroke: var(--border);
  stroke-width: 1;
  opacity: 0.5;
}

.radar-data {
  fill: rgba(29, 161, 242, 0.25);
  stroke: var(--accent);
  stroke-width: 2;
  transition: all 0.3s ease;
}

.radar-dot {
  fill: var(--accent);
  stroke: var(--bg-primary);
  stroke-width: 2;
  transition: all 0.3s ease;
}

.radar-label {
  position: absolute;
  text-align: center;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.radar-label-name {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.radar-label-value {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--accent);
}
</style>
