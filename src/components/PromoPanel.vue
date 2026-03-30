<template>
  <section class="card promo-panel glass">
    <h2>Real-Time Promo Engine</h2>
    <ul class="coupon-list">
      <li v-for="item in store.couponItems" :key="item.id">
        <span class="tag fix">COUPON</span>
        <strong>{{ item.code }}</strong> {{ item.text }}
      </li>
    </ul>
  </section>
</template>

<script setup>
import { useDashboardStore } from '../stores/dashboard'
const store = useDashboardStore()
</script>

<style scoped>
.promo-panel {
  grid-column: 3 / 4;
  grid-row: 2 / 3;
}

.coupon-list {
  max-height: calc(100% - 36px);
  overflow: auto;
}

.coupon-list li {
  padding: 10px;
  margin-bottom: 8px;
  border-radius: 10px;
  border-color: rgba(0, 200, 149, 0.42);
  background: linear-gradient(140deg, rgba(0, 200, 149, 0.16), rgba(9, 59, 95, 0.3));
  border: 1px solid rgba(0, 200, 149, 0.42);
  font-size: 0.8rem;
}
</style>
