<template>
  <section class="card agent-panel glass">
    <h2>Agent Mesh Reactivity</h2>
    <div class="agent-grid">
      <div
        v-for="agent in store.agents"
        :key="agent.id"
        class="agent-card"
        :class="agent.state"
      >
        <strong>{{ agent.name }}</strong>
        <span>{{ agent.note }}</span>
      </div>
    </div>
    <ul class="timeline-list">
      <li v-for="item in store.timelineItems" :key="item.id">
        <span v-if="item.tag" class="tag" :class="item.tagClass">{{ item.tag }}</span>
        {{ item.text }}
      </li>
    </ul>
  </section>
</template>

<script setup>
import { useDashboardStore } from '../stores/dashboard'
const store = useDashboardStore()
</script>

<style scoped>
.agent-panel {
  grid-column: 1 / 2;
  grid-row: 2 / 3;
}

.agent-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 10px;
}

.agent-card {
  padding: 8px;
  border-radius: 10px;
  border: 1px solid rgba(194, 247, 255, 0.22);
  background: rgba(3, 33, 59, 0.5);
  font-size: 0.74rem;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}
.agent-card strong {
  display: block;
  margin-bottom: 4px;
  font-size: 0.74rem;
}
.agent-card.idle { border-color: rgba(194, 247, 255, 0.23); }
.agent-card.working {
  border-color: rgba(255, 247, 194, 0.75);
  box-shadow: 0 0 14px rgba(255, 247, 194, 0.2);
}
.agent-card.action {
  border-color: rgba(0, 200, 149, 0.75);
  box-shadow: 0 0 14px rgba(0, 200, 149, 0.22);
}

.timeline-list {
  max-height: calc(100% - 160px);
  overflow: auto;
}
.timeline-list li {
  padding: 10px;
  margin-bottom: 8px;
  border-radius: 10px;
  border: 1px solid rgba(194, 247, 255, 0.24);
  background: rgba(3, 33, 59, 0.45);
  font-size: 0.8rem;
}
</style>
