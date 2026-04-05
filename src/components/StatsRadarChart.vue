<template>
  <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" class="radar-chart">
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
      r="3.5"
      class="radar-dot"
    />

    <!-- Labels -->
    <g v-for="(key, i) in statKeys" :key="'label-' + i">
      <text
        :x="labelX(i)"
        :y="labelY(i) - 6"
        :text-anchor="labelAnchor(i)"
        class="radar-label-name"
      >{{ statLabels[key] }}</text>
      <text
        :x="labelX(i)"
        :y="labelY(i) + 10"
        :text-anchor="labelAnchor(i)"
        class="radar-label-value"
      >{{ stats[key] || 0 }}</text>
    </g>
  </svg>
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
const radius = computed(() => props.size * 0.30)

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

function labelX(i) {
  const offset = radius.value + 18
  return cx.value + offset * Math.cos(angle(i))
}

function labelY(i) {
  const offset = radius.value + 18
  return cy.value + offset * Math.sin(angle(i))
}

function labelAnchor(i) {
  const a = angle(i)
  const cos = Math.cos(a)
  if (cos > 0.3) return 'start'
  if (cos < -0.3) return 'end'
  return 'middle'
}
</script>

<style scoped>
.radar-chart {
  display: block;
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

.radar-label-name {
  font-size: 9px;
  font-weight: 600;
  fill: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.radar-label-value {
  font-size: 11px;
  font-weight: 700;
  fill: var(--accent);
}
</style>
