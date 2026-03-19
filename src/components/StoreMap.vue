<template>
  <section class="card map-panel glass">
    <div class="card-head">
      <h2>Store Digital Twin</h2>
      <div class="scenario-controls">
        <button
          v-for="(sc, key) in scenarioOptions"
          :key="key"
          :class="{ active: store.currentScenario === key }"
          @click="store.setScenario(key)"
        >
          {{ sc }}
        </button>
      </div>
    </div>

    <div class="store-map" ref="mapEl">
      <div class="store-viewport">
        <div
          class="store-world"
          ref="worldEl"
          :style="{
            '--zw-scale': store.zoneScale,
            '--zw-tx': store.zoneTx + 'px',
            '--zw-ty': store.zoneTy + 'px'
          }"
        >
          <!-- Departments -->
          <div class="dept d1">Milk</div>
          <div class="dept d2">Deli</div>
          <div class="dept d3">Bakery</div>
          <div class="dept d4">Fruit &amp; Veg</div>
          <div class="dept d5">Flowers</div>
          <div class="dept d6">Tobacco</div>

          <!-- Aisles -->
          <div class="aisle a1"><span>A1</span></div>
          <div class="aisle a2"><span>A2</span></div>
          <div class="aisle a3"><span>A3</span></div>
          <div class="aisle a4"><span>A4</span></div>
          <div class="aisle a5"><span>A5</span></div>
          <div class="aisle a6"><span>A6</span></div>

          <!-- Checkout lanes -->
          <div class="checkout-lane c1" />
          <div class="checkout-lane c2" />
          <div class="checkout-lane c3" />
          <div class="checkout-lane c4" />
          <div class="checkout-lane c5" />

          <!-- Zones -->
          <div
            v-for="zone in zones"
            :key="zone.name"
            class="zone"
            :class="[
              zone.cssClass,
              { alert: store.alertZones.includes(zone.name), active: store.activeZone === zone.name }
            ]"
            @click="onZoneClick(zone.name)"
          >
            <span>{{ zone.name }}</span>
          </div>

          <!-- Animated pulses -->
          <div class="pulse p1" />
          <div class="pulse p2" />
          <div class="pulse p3" />
        </div>

        <!-- Event popups -->
        <div class="event-popups" ref="popupsEl">
          <div
            v-for="popup in visiblePopups"
            :key="popup.id"
            class="event-popup"
            :class="popup.type"
            :style="{ left: popup.x + 'px', top: popup.y + 'px' }"
          >
            {{ popup.zone }}: {{ popup.text }}
          </div>
        </div>
      </div>
    </div>

    <!-- Area detail panel -->
    <div class="area-detail glass">
      <div class="area-head">
        <strong>{{ store.areaTitle }}</strong>
        <button @click="store.resetZoom()">Reset View</button>
      </div>
      <div class="area-image-wrap">
        <img
          v-if="store.areaImage"
          :src="store.areaImage"
          alt="Area detail"
          :style="{ '--img-zoom': store.imageZoom }"
        />
      </div>
      <div class="area-controls">
        <span class="area-hint">{{ store.areaHint }}</span>
        <div>
          <button @click="zoomOut">-</button>
          <button @click="zoomIn">+</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useDashboardStore } from '../stores/dashboard'

const store = useDashboardStore()
const mapEl = ref(null)
const worldEl = ref(null)
const popupsEl = ref(null)

const scenarioOptions = {
  stockout: 'Stockout',
  fraud: 'Fraud',
  coldchain: 'Cold Chain',
  delay: 'Delivery Delay',
  normal: 'Reset'
}

const zones = [
  { name: 'Entrance', cssClass: 'z1' },
  { name: 'Promo Aisle', cssClass: 'z2' },
  { name: 'Cold Storage', cssClass: 'z3' },
  { name: 'Checkout', cssClass: 'z4' }
]

// Compute zone anchor positions for popups
function getZoneAnchor(zoneName) {
  if (!mapEl.value) return null
  const zoneEl = mapEl.value.querySelector(`.zone[data-zone-name="${zoneName}"]`)
  if (!zoneEl) {
    // fallback: find by class matching zone name
    const allZones = mapEl.value.querySelectorAll('.zone')
    for (const el of allZones) {
      if (el.textContent.trim() === zoneName) {
        const mapRect = mapEl.value.getBoundingClientRect()
        const zoneRect = el.getBoundingClientRect()
        return {
          x: zoneRect.left - mapRect.left + zoneRect.width / 2,
          y: zoneRect.top - mapRect.top + zoneRect.height * 0.22
        }
      }
    }
    return null
  }
  const mapRect = mapEl.value.getBoundingClientRect()
  const zoneRect = zoneEl.getBoundingClientRect()
  return {
    x: zoneRect.left - mapRect.left + zoneRect.width / 2,
    y: zoneRect.top - mapRect.top + zoneRect.height * 0.22
  }
}

// Enrich store popups with pixel positions for rendering
const visiblePopups = computed(() => {
  return store.popups.map(p => {
    const anchor = getZoneAnchor(p.zone)
    return { ...p, x: anchor?.x ?? 50, y: anchor?.y ?? 50 }
  })
})

// Watch for activeZone to apply zoom transforms
watch(() => store.activeZone, async (zoneName) => {
  if (!zoneName || !worldEl.value || !mapEl.value) return
  await nextTick()
  const allZones = mapEl.value.querySelectorAll('.zone')
  let zoneEl = null
  for (const el of allZones) {
    if (el.textContent.trim() === zoneName) { zoneEl = el; break }
  }
  if (!zoneEl) return
  const worldRect = worldEl.value.getBoundingClientRect()
  const zoneRect = zoneEl.getBoundingClientRect()
  const dx = worldRect.left + worldRect.width / 2 - (zoneRect.left + zoneRect.width / 2)
  const dy = worldRect.top + worldRect.height / 2 - (zoneRect.top + zoneRect.height / 2)
  store.zoneTx = dx * 0.5
  store.zoneTy = dy * 0.5
})

function onZoneClick(zoneName) {
  store.focusZone(zoneName)
  store.updateAreaPanel(zoneName)
  store.spawnPopup('Inspecting area', zoneName, 'agent')
}

function zoomIn() {
  store.imageZoom = Math.min(2.4, store.imageZoom + 0.2)
}

function zoomOut() {
  store.imageZoom = Math.max(1, store.imageZoom - 0.2)
}
</script>

<style scoped>
.map-panel {
  grid-column: 2 / 3;
  grid-row: 1 / 3;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.scenario-controls {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.scenario-controls button.active {
  box-shadow: 0 0 0 2px rgba(194, 247, 255, 0.75), 0 0 18px rgba(0, 200, 149, 0.5);
}

/* Map container */
.store-map {
  margin-top: 10px;
  height: calc(100% - 280px);
  border-radius: 14px;
  border: 1px solid rgba(194, 247, 255, 0.25);
  background: linear-gradient(180deg, rgba(9, 59, 95, 0.32), rgba(3, 33, 59, 0.65));
  position: relative;
  overflow: hidden;
}

.store-viewport {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.store-world {
  --zw-tx: 0px;
  --zw-ty: 0px;
  --zw-scale: 1;
  position: absolute;
  inset: 4% 3.5% 6.5% 3.5%;
  transform: translate(var(--zw-tx), var(--zw-ty)) scale(var(--zw-scale));
  transition: transform 0.65s ease;
  border-radius: 12px;
  border: 2px solid rgba(194, 247, 255, 0.75);
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.06) 0 1px, transparent 1px 7.7%),
    linear-gradient(rgba(255, 255, 255, 0.06) 0 1px, transparent 1px 10%),
    linear-gradient(165deg, var(--gray-13), var(--gray-14));
  box-shadow: inset 0 0 0 1px rgba(9, 59, 95, 0.18), 0 18px 40px rgba(0, 0, 0, 0.36);
}

/* Departments */
.dept {
  position: absolute;
  padding: 6px 10px;
  border-radius: 7px;
  border: 1px solid rgba(9, 59, 95, 0.35);
  background: rgba(255, 255, 255, 0.88);
  color: var(--solace-dark-blue);
  font-size: 0.7rem;
  font-family: 'Space Mono', monospace;
  text-transform: uppercase;
}
.d1 { left: 3%; top: 2.5%; }
.d2 { left: 33%; top: 2.5%; }
.d3 { right: 3%; top: 2.5%; }
.d4 { right: 7%; top: 47%; }
.d5 { right: 22%; bottom: 15%; }
.d6 { right: 3%; bottom: 23%; }

/* Aisles */
.aisle {
  position: absolute;
  width: 12.8%;
  height: 31%;
  border-radius: 8px;
  border: 1px solid rgba(9, 59, 95, 0.25);
  background: linear-gradient(160deg, #ffffff, #f4f4f4);
  box-shadow: inset 0 -10px 0 rgba(3, 33, 59, 0.03);
}
.aisle span {
  position: absolute;
  top: 6px;
  right: 7px;
  color: var(--solace-deep-blue);
  font-size: 0.64rem;
  font-family: 'Space Mono', monospace;
}
.a1 { left: 6%; top: 20%; }
.a2 { left: 23%; top: 20%; }
.a3 { left: 40%; top: 20%; }
.a4 { left: 57%; top: 20%; }
.a5 { left: 74%; top: 20%; }
.a6 { left: 74%; top: 57%; height: 24%; }

/* Checkout lanes */
.checkout-lane {
  position: absolute;
  width: 10.5%;
  height: 15%;
  bottom: 8%;
  border-radius: 7px;
  border: 1px solid rgba(9, 59, 95, 0.25);
  background: linear-gradient(145deg, #ffffff, #eaeaea);
}
.c1 { left: 6%; }
.c2 { left: 18%; }
.c3 { left: 30%; }
.c4 { left: 42%; }
.c5 { left: 54%; }

/* Zones */
.zone {
  position: absolute;
  border-radius: 999px;
  border: 2px solid var(--solace-deep-blue);
  background: rgba(0, 200, 149, 0.2);
  color: var(--solace-dark-blue);
  min-width: 78px;
  height: 78px;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  font-size: 0.71rem;
  font-family: 'Space Mono', monospace;
  cursor: pointer;
  transition: transform 0.22s ease, box-shadow 0.22s ease;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.55);
}
.zone span { padding: 0 8px; }
.zone:hover { transform: translateY(-2px) scale(1.03); }
.zone.alert {
  background: rgba(252, 168, 41, 0.38);
  border-color: #FCA829;
  box-shadow: 0 0 0 3px rgba(255, 247, 194, 0.72), 0 0 20px rgba(252, 168, 41, 0.45);
}
.zone.active {
  background: rgba(171, 255, 136, 0.42);
  border-color: var(--solace-green);
  box-shadow: 0 0 0 3px rgba(194, 247, 255, 0.82), 0 0 20px rgba(0, 200, 149, 0.45);
}

.z1 { right: 15%; bottom: 6%; }
.z2 { left: 42%; top: 52%; }
.z3 { left: 56%; top: 44%; }
.z4 { left: 30%; bottom: 14%; }

/* Pulse dots */
.pulse {
  position: absolute;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--solace-dark-green);
  box-shadow: 0 0 10px rgba(0, 145, 147, 0.8);
  animation: drift 9s linear infinite;
}
.p1 { left: 8%; top: 16%; }
.p2 { left: 48%; top: 80%; animation-duration: 11s; }
.p3 { right: 8%; top: 38%; animation-duration: 8s; }

@keyframes drift {
  0%   { transform: translate(0, 0); opacity: 0.95; }
  50%  { transform: translate(55px, -26px); opacity: 0.4; }
  100% { transform: translate(110px, 18px); opacity: 0.1; }
}

/* Event popups overlay */
.event-popups {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.event-popup {
  position: absolute;
  min-width: 170px;
  max-width: 240px;
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 0.74rem;
  line-height: 1.25;
  border: 1px solid rgba(194, 247, 255, 0.58);
  background: rgba(3, 33, 59, 0.92);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5);
  transform: translate(-50%, -50%);
  animation: popInOut 2.6s ease forwards;
}
.event-popup.alert {
  border-color: rgba(252, 168, 41, 0.95);
  box-shadow: 0 12px 26px rgba(252, 168, 41, 0.3);
}
.event-popup.agent {
  border-color: rgba(0, 200, 149, 0.95);
  box-shadow: 0 12px 26px rgba(0, 200, 149, 0.28);
}

@keyframes popInOut {
  0%   { opacity: 0; transform: translate(-50%, -10%) scale(0.9); }
  14%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  78%  { opacity: 1; transform: translate(-50%, -68%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -92%) scale(0.97); }
}

/* Area detail */
.area-detail {
  margin-top: 10px;
  border-radius: 12px;
  padding: 10px;
  border: 1px solid rgba(194, 247, 255, 0.25);
}
.area-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.area-image-wrap {
  width: 100%;
  height: 160px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(194, 247, 255, 0.25);
  background: rgba(0, 0, 0, 0.35);
}
.area-image-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(var(--img-zoom, 1));
  transform-origin: center center;
  transition: transform 0.2s ease;
}
.area-controls {
  margin-top: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.area-hint {
  font-size: 0.73rem;
  color: var(--muted);
}
</style>
