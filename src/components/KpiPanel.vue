<template>
  <section class="card kpi-panel glass">
    <h2>Live Business Impact</h2>
    <div class="kpi-grid">
      <article v-for="kpi in kpis" :key="kpi.label">
        <span>{{ kpi.label }}</span>
        <h3>{{ kpi.value }}</h3>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useDashboardStore } from '../stores/dashboard'

const store = useDashboardStore()

const kpis = computed(() => [
  { label: 'Revenue Protected', value: `$${Math.round(store.revenue).toLocaleString()}` },
  { label: 'Stockout Risk', value: `${Math.round(store.stockout)}%` },
  { label: 'Autonomous Actions', value: store.actions },
  { label: 'Customer Sentiment', value: Math.round(store.sentiment) }
])
</script>

<style scoped>
.kpi-panel {
  grid-column: 1 / 2;
  grid-row: 1 / 2;
}

.kpi-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.kpi-grid article {
  padding: 10px;
  border-radius: 12px;
  border: 1px solid rgba(0, 200, 149, 0.28);
  background: linear-gradient(145deg, rgba(9, 59, 95, 0.55), rgba(3, 33, 59, 0.7));
}

.kpi-grid span {
  color: var(--muted);
  font-size: 0.78rem;
}

.kpi-grid h3 {
  margin: 6px 0 0;
  font-size: 1.34rem;
  color: var(--solace-bright);
}
</style>
