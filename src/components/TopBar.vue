<template>
  <header class="top-bar glass">
    <div class="brand">
      <div class="dot" />
      <h1>Retail Pulse Arena</h1>
      <p>Solace Platform Demo</p>
    </div>
    <div class="pill-wrap">
      <div class="pill">Agent Mesh: <strong>ACTIVE</strong></div>
      <div class="pill">Micro-Integration: <strong>SYNCED</strong></div>
      <div class="pill warning">Scenario: <strong>{{ store.scenarioLabel }}</strong></div>
    </div>
  </header>
</template>

<script setup>
import { useDashboardStore } from '../stores/dashboard'
const store = useDashboardStore()
</script>

<style scoped>
.top-bar {
  position: relative;
  z-index: 2;
  margin: 14px;
  border-radius: 16px;
  padding: 14px 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.brand h1 {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: 0.01em;
}
.brand p {
  margin: 0;
  font-size: 0.84rem;
  color: var(--muted);
  font-family: 'Space Mono', monospace;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--solace-green);
  box-shadow: 0 0 12px rgba(0, 200, 149, 0.9);
  align-self: center;
}

.pill-wrap {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.pill {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.18);
  font-size: 0.78rem;
}
.pill strong { color: var(--solace-bright); }
.pill.warning strong { color: var(--solace-yellow); }
</style>
