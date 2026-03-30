<template>
  <EventCanvas />
  <TopBar />
  <main class="grid">
    <KpiPanel />
    <StoreMap />
    <EventStream />
    <AgentMesh />
    <PromoPanel />
  </main>
  <BottomBar />
</template>

<script setup>
import { onMounted } from 'vue'
import { useDashboardStore } from './stores/dashboard'
import EventCanvas from './components/EventCanvas.vue'
import TopBar from './components/TopBar.vue'
import BottomBar from './components/BottomBar.vue'
import KpiPanel from './components/KpiPanel.vue'
import StoreMap from './components/StoreMap.vue'
import EventStream from './components/EventStream.vue'
import AgentMesh from './components/AgentMesh.vue'
import PromoPanel from './components/PromoPanel.vue'

const store = useDashboardStore()

onMounted(() => {
  store.startSimulation()
})
</script>

<style>
.grid {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: 1.1fr 1.5fr 1fr;
  grid-template-rows: 0.9fr 1.1fr;
  gap: 14px;
  padding: 0 14px;
  height: calc(100vh - 178px);
}

.card {
  border-radius: 16px;
  padding: 14px;
  overflow: hidden;
}

.card h2 {
  margin: 0 0 12px;
  font-size: 0.94rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-family: 'Space Mono', monospace;
  color: var(--solace-spring);
}

@media (max-width: 1100px) {
  body { overflow: auto; }
  .grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
    height: auto;
    padding-bottom: 14px;
  }
  .card {
    min-height: 260px;
  }
}
</style>
