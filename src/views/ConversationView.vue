<template>
  <div></div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

// Redirect to the unified messages page with the conversation ID
onMounted(() => {
  router.replace(`/messages/${route.params.id}`)
})
</script>
