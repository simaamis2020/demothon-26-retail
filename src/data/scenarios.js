export const scenarios = {
  normal: {
    label: 'Normal Ops',
    eta: 'Stable',
    incidentEvents: [
      { text: 'POS transactions flowing normally', zone: 'Checkout' },
      { text: 'Shelf sensor heartbeat received', zone: 'Promo Aisle' },
      { text: 'Delivery ETA on time', zone: 'Entrance' }
    ],
    reactions: []
  },
  stockout: {
    label: 'Stockout Threat',
    eta: '9 min to stable',
    incidentEvents: [
      { text: 'Demand spike: carbonated drinks +320%', zone: 'Promo Aisle' },
      { text: 'Shelf availability dropped below 18%', zone: 'Promo Aisle' },
      { text: 'Predicted stockout in 14 minutes', zone: 'Promo Aisle' }
    ],
    reactions: [
      { agent: 'inventory', text: 'Reallocated inventory from Store 23', zone: 'Promo Aisle' },
      { agent: 'logistics', text: 'Expedited replenishment truck rerouted', zone: 'Entrance' },
      { agent: 'pricing', text: 'Substitution bundle offer activated', zone: 'Promo Aisle' }
    ]
  },
  fraud: {
    label: 'Checkout Fraud',
    eta: '6 min to stable',
    incidentEvents: [
      { text: 'Checkout basket mismatch detected', zone: 'Checkout' },
      { text: 'Unusual refund velocity at lane 4', zone: 'Checkout' },
      { text: 'High-risk payment signature flagged', zone: 'Checkout' }
    ],
    reactions: [
      { agent: 'fraud', text: 'Escalated suspicious lane to manual review', zone: 'Checkout' },
      { agent: 'customer', text: 'Protected genuine customer flow on adjacent lanes', zone: 'Checkout' },
      { agent: 'ops', text: 'Opened additional checkout lane', zone: 'Checkout' }
    ]
  },
  coldchain: {
    label: 'Cold Chain Incident',
    eta: '12 min to stable',
    incidentEvents: [
      { text: 'Cold storage temperature at 9.2°C', zone: 'Cold Storage' },
      { text: 'Perishables quality risk threshold breached', zone: 'Cold Storage' },
      { text: 'Potential waste exposure rising', zone: 'Cold Storage' }
    ],
    reactions: [
      { agent: 'ops', text: 'Dispatching maintenance technician', zone: 'Cold Storage' },
      { agent: 'inventory', text: 'Isolated affected SKU batches', zone: 'Cold Storage' },
      { agent: 'customer', text: 'Adjusted promised delivery windows', zone: 'Entrance' }
    ]
  },
  delay: {
    label: 'Inbound Delay',
    eta: '10 min to stable',
    incidentEvents: [
      { text: 'Supplier truck delayed by 47 minutes', zone: 'Entrance' },
      { text: 'Next replenishment slot at risk', zone: 'Entrance' },
      { text: 'Dependent promo campaign impacted', zone: 'Promo Aisle' }
    ],
    reactions: [
      { agent: 'logistics', text: 'Switched to alternate carrier route', zone: 'Entrance' },
      { agent: 'pricing', text: 'Dynamic promo cadence adjusted', zone: 'Promo Aisle' },
      { agent: 'inventory', text: 'Safety stock release approved', zone: 'Promo Aisle' }
    ]
  }
}

export const behaviorEvents = [
  { text: 'Customer bought cereal + milk + fruit', persona: 'Family Basket', zone: 'Promo Aisle', spend: 31 },
  { text: 'Customer bought sports drink + protein bar', persona: 'Fitness Shopper', zone: 'Promo Aisle', spend: 18 },
  { text: 'Customer bought ready meal + dessert', persona: 'Quick Dinner', zone: 'Checkout', spend: 22 },
  { text: 'Customer bought baby wipes + formula', persona: 'Parent Shopper', zone: 'Checkout', spend: 44 }
]

export const couponOffers = {
  'Family Basket': '10% off dairy + cereal combo',
  'Fitness Shopper': 'Buy 2 sports drinks, get protein bar free',
  'Quick Dinner': '15% off fresh salad add-on',
  'Parent Shopper': '$5 off next baby essentials purchase'
}

export const zoneImages = {
  Entrance: 'https://mir-s3-cdn-cf.behance.net/project_modules/max_1200/71538e16365273.562a8c333f1a2.jpg',
  'Promo Aisle': 'https://mir-s3-cdn-cf.behance.net/project_modules/max_1200/4f7c9416365273.562a8c333deac.jpg',
  'Cold Storage': 'https://mir-s3-cdn-cf.behance.net/project_modules/max_1200/8e0c4716365273.562a8c333e6f5.jpg',
  Checkout: 'https://mir-s3-cdn-cf.behance.net/project_modules/max_1200/4f7c9416365273.562a8c333deac.jpg'
}

export const initialAgents = [
  { id: 'inventory', name: 'Inventory Agent', state: 'idle', note: 'Monitoring shelf velocity' },
  { id: 'fraud', name: 'Fraud Agent', state: 'idle', note: 'Watching checkout anomalies' },
  { id: 'pricing', name: 'Pricing Agent', state: 'idle', note: 'Tuning promo elasticity' },
  { id: 'ops', name: 'Ops Agent', state: 'idle', note: 'Tracking cold chain health' },
  { id: 'customer', name: 'Customer Agent', state: 'idle', note: 'Personalizing offers' },
  { id: 'logistics', name: 'Logistics Agent', state: 'idle', note: 'Watching inbound ETA' }
]
