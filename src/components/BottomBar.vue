<template>
  <footer class="bottom-bar glass">
    <div>
      <span>Flow rate:</span>
      <strong>{{ store.flowRate }}</strong>
    </div>
    <div>
      <span>Recovery ETA:</span>
      <strong>{{ store.eta }}</strong>
    </div>
    <div>
      <span>Trade-show mode:</span>
      <strong>Looping Demo</strong>
    </div>
  </footer>
</template>

<script setup>
import { useDashboardStore } from '../stores/dashboard'
const store = useDashboardStore()
</script>

<style scoped>
.bottom-bar {
  position: relative;
  z-index: 2;
  margin: 14px;
  border-radius: 16px;
  padding: 14px 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.84rem;
}
.bottom-bar strong {
  color: var(--solace-bright);
  margin-left: 6px;
}
</style>
