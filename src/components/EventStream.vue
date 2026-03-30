<template>
  <section class="card stream-panel glass">
    <h2>Event Stream</h2>
    <ul class="event-list">
      <li v-for="item in store.eventItems" :key="item.id">
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
.stream-panel {
  grid-column: 3 / 4;
  grid-row: 1 / 2;
}

.event-list {
  max-height: calc(100% - 36px);
  overflow: auto;
}

.event-list li {
  padding: 10px;
  margin-bottom: 8px;
  border-radius: 10px;
  border: 1px solid rgba(194, 247, 255, 0.24);
  background: rgba(3, 33, 59, 0.45);
  font-size: 0.8rem;
}
</style>
