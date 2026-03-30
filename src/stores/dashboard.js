import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  scenarios,
  behaviorEvents,
  couponOffers,
  initialAgents
} from '../data/scenarios'

export const useDashboardStore = defineStore('dashboard', () => {
  // KPI state
  const revenue = ref(42000)
  const stockout = ref(12)
  const actions = ref(0)
  const sentiment = ref(88)
  const flowRate = ref('1,250 events/s')

  // Scenario state
  const currentScenario = ref('normal')
  const scenarioLabel = computed(() => scenarios[currentScenario.value]?.label ?? 'Normal Ops')
  const eta = computed(() => scenarios[currentScenario.value]?.eta ?? 'Stable')

  // Agents
  const agents = ref(initialAgents.map(a => ({ ...a })))

  // Event & timeline lists (max 5 items each)
  const eventItems = ref([
    { id: Date.now(), tag: '', tagClass: '', text: 'Retail Pulse initialized and connected to Solace topics' }
  ])
  const timelineItems = ref([
    { id: Date.now() + 1, tag: 'SYSTEM', tagClass: 'fix', text: 'Agent Mesh online. Micro-Integration connectors healthy' }
  ])
  const couponItems = ref([])

  // Map state
  const activeZone = ref(null)
  const alertZones = ref([])
  const zoneScale = ref(1)
  const zoneTx = ref(0)
  const zoneTy = ref(0)
  const areaTitle = ref('Area Detail')
  const areaImage = ref('')
  const areaHint = ref('Click a zone to zoom in and inspect.')
  const imageZoom = ref(1)

  // Popups (ephemeral, managed separately in component)
  const popups = ref([])

  function addEvent(text, tagClass, tag) {
    eventItems.value.unshift({ id: Date.now() + Math.random(), tag, tagClass, text })
    if (eventItems.value.length > 5) eventItems.value.pop()
  }

  function addTimeline(text, tagClass, tag) {
    timelineItems.value.unshift({ id: Date.now() + Math.random(), tag, tagClass, text })
    if (timelineItems.value.length > 5) timelineItems.value.pop()
  }

  function addCoupon(coupon) {
    couponItems.value.unshift({ id: Date.now() + Math.random(), ...coupon })
    if (couponItems.value.length > 4) couponItems.value.pop()
  }

  function spawnPopup(text, zone, type) {
    const popup = { id: Date.now() + Math.random(), text, zone, type }
    popups.value.push(popup)
    setTimeout(() => {
      popups.value = popups.value.filter(p => p.id !== popup.id)
    }, 3200)
  }

  function setAgentState(agentId, state, note) {
    const agent = agents.value.find(a => a.id === agentId)
    if (!agent) return
    agent.state = state
    agent.note = note
    setTimeout(() => {
      agent.state = 'idle'
    }, 2400)
  }

  function updateZoneAlerts() {
    if (currentScenario.value === 'normal') {
      alertZones.value = []
      return
    }
    const sc = scenarios[currentScenario.value]
    alertZones.value = [...new Set(sc.incidentEvents.map(e => e.zone))]
  }

  function focusZone(zoneName) {
    activeZone.value = zoneName
    zoneScale.value = 1.32
    // offset is computed in the component using element refs
  }

  function resetZoom() {
    activeZone.value = null
    zoneScale.value = 1
    zoneTx.value = 0
    zoneTy.value = 0
    imageZoom.value = 1
    areaTitle.value = 'Area Detail'
    areaHint.value = 'Click a zone to zoom in and inspect.'
  }

  function updateAreaPanel(zoneName) {
    const zoneImages = {
      Entrance: 'https://mir-s3-cdn-cf.behance.net/project_modules/max_1200/71538e16365273.562a8c333f1a2.jpg',
      'Promo Aisle': 'https://mir-s3-cdn-cf.behance.net/project_modules/max_1200/4f7c9416365273.562a8c333deac.jpg',
      'Cold Storage': 'https://mir-s3-cdn-cf.behance.net/project_modules/max_1200/8e0c4716365273.562a8c333e6f5.jpg',
      Checkout: 'https://mir-s3-cdn-cf.behance.net/project_modules/max_1200/4f7c9416365273.562a8c333deac.jpg'
    }
    areaTitle.value = `${zoneName} Detail`
    areaHint.value = 'Use +/- to zoom the photo.'
    areaImage.value = zoneImages[zoneName] || zoneImages['Promo Aisle']
    imageZoom.value = 1
  }

  function setScenario(nextScenario) {
    currentScenario.value = nextScenario
    updateZoneAlerts()
    addTimeline(`Scenario switched to ${scenarios[nextScenario].label}`, 'fix', 'SYSTEM')
    if (nextScenario !== 'normal') {
      const focusZoneName = scenarios[nextScenario].incidentEvents[0].zone
      focusZone(focusZoneName)
      updateAreaPanel(focusZoneName)
      spawnPopup(`Scenario: ${scenarios[nextScenario].label}`, focusZoneName, 'alert')
    } else {
      resetZoom()
    }
  }

  function runScenarioTick() {
    const scenario = scenarios[currentScenario.value]
    const incident = scenario.incidentEvents[Math.floor(Math.random() * scenario.incidentEvents.length)]
    const isAlert = currentScenario.value !== 'normal'
    addEvent(`${incident.text} (${incident.zone})`, isAlert ? 'hot' : '', isAlert ? 'ALERT' : 'EVENT')
    spawnPopup(incident.text, incident.zone, isAlert ? 'alert' : '')

    if (scenario.reactions.length && Math.random() > 0.38) {
      const reaction = scenario.reactions[Math.floor(Math.random() * scenario.reactions.length)]
      const agentName = agents.value.find(a => a.id === reaction.agent)?.name || 'Agent'
      addTimeline(`${agentName}: ${reaction.text} (${reaction.zone})`, 'fix', 'AGENT')
      setAgentState(reaction.agent, 'action', reaction.text)
      spawnPopup(reaction.text, reaction.zone, 'agent')
      actions.value += 1
      revenue.value += Math.floor(700 + Math.random() * 1600)
      stockout.value = Math.max(3, stockout.value - Math.random() * 1.1)
      sentiment.value = Math.min(97, sentiment.value + Math.random() * 0.4)
    } else {
      revenue.value -= Math.floor(Math.random() * 240)
      stockout.value = Math.min(48, stockout.value + Math.random() * 0.9)
      sentiment.value = Math.max(62, sentiment.value - Math.random() * 0.35)
    }

    flowRate.value = currentScenario.value === 'normal'
      ? `${(280 + Math.random() * 140).toFixed(0)} events/s`
      : `${(520 + Math.random() * 240).toFixed(0)} events/s`
  }

  function runBehaviorTick() {
    const behavior = behaviorEvents[Math.floor(Math.random() * behaviorEvents.length)]
    addEvent(`${behavior.text} (${behavior.persona})`, '', 'BUY')
    setAgentState('customer', 'working', `Analyzing ${behavior.persona}`)
    if (Math.random() > 0.45) {
      const offer = couponOffers[behavior.persona] || '5% off your next basket'
      const code = `SAVE-${Math.floor(1000 + Math.random() * 8999)}`
      const coupon = { code, text: `${offer} (${behavior.persona})`, zone: behavior.zone }
      addCoupon(coupon)
      setAgentState('pricing', 'action', `Issued ${code}`)
      spawnPopup(`Coupon ${code}`, coupon.zone, 'agent')
    }
    revenue.value += behavior.spend
  }

  function startSimulation() {
    setInterval(() => {
      runScenarioTick()
    }, 4300)
    setInterval(() => {
      if (Math.random() > 0.55) runBehaviorTick()
    }, 7800)
  }

  return {
    revenue,
    stockout,
    actions,
    sentiment,
    flowRate,
    currentScenario,
    scenarioLabel,
    eta,
    agents,
    eventItems,
    timelineItems,
    couponItems,
    popups,
    activeZone,
    alertZones,
    zoneScale,
    zoneTx,
    zoneTy,
    areaTitle,
    areaImage,
    areaHint,
    imageZoom,
    setScenario,
    focusZone,
    resetZoom,
    updateAreaPanel,
    spawnPopup,
    startSimulation
  }
})
