const stores = [
  {
    key: 'DE-101',
    id: '101',
    country: 'DE',
    countryName: 'Germany',
    name: 'Store 101',
    subscriptions: [
      'acmeretail/mdm/*/*/storein/all/all/>',
      'acmeretail/mdm/*/*/storein/de/*/>',
      'acmeretail/mdm/*/*/storein/de/101/>'
    ]
  },
  {
    key: 'CA-102',
    id: '102',
    country: 'CA',
    countryName: 'Canada',
    name: 'Store 102',
    subscriptions: [
      'acmeretail/mdm/*/*/storein/all/all/>',
      'acmeretail/mdm/*/*/storein/ca/*/>',
      'acmeretail/mdm/*/*/storein/ca/102/>'
    ]
  },
  {
    key: 'FR-103',
    id: '103',
    country: 'FR',
    countryName: 'France',
    name: 'Store 103',
    subscriptions: [
      'acmeretail/mdm/*/*/storein/all/all/>',
      'acmeretail/mdm/*/*/storein/fr/*/>',
      'acmeretail/mdm/*/*/storein/fr/103/>'
    ]
  },
  {
    key: 'AU-104',
    id: '104',
    country: 'AU',
    countryName: 'Australia',
    name: 'Store 104',
    subscriptions: [
      'acmeretail/mdm/*/*/storein/all/all/>',
      'acmeretail/mdm/*/*/storein/au/*/>',
      'acmeretail/mdm/*/*/storein/au/104/>'
    ]
  }
];
const cacheClient = { id: 'PRODUCT-CACHE', name: 'Master Data Distribution MI', subscription: 'acmeretail/mdm/*/*/storein/*/>' };
const PRODUCT_CACHE_STATUS_SUBSCRIPTION = 'acmeretail/productCache/replayStatus/v1/>';
const STORE_SUBSCRIPTION_LABELS = ['all/all', 'country/all', 'country/storeId'];
const STORE_DASHBOARD_URL = 'http://35.173.254.209/dashboard.html';
const SAVED_CONNECTIONS_KEY = 'solaceBrokerSavedConnections';
const LAST_CONNECTION_KEY = 'solaceBrokerLastConnection';

const els = {
  protocol: document.getElementById('protocol'),
  tlsToggle: document.getElementById('tlsToggle'),
  demoToggle: document.getElementById('demoToggle'),
  host: document.getElementById('host'),
  port: document.getElementById('port'),
  vpn: document.getElementById('vpn'),
  username: document.getElementById('username'),
  password: document.getElementById('password'),
  topic: document.getElementById('topic'),
  savedConnectionSelect: document.getElementById('savedConnectionSelect'),
  saveConnectionBtn: document.getElementById('saveConnectionBtn'),
  deleteConnectionBtn: document.getElementById('deleteConnectionBtn'),
  urlPreview: document.getElementById('urlPreview'),
  connectBtn: document.getElementById('connectBtn'),
  subscribeBtn: document.getElementById('subscribeBtn'),
  disconnectBtn: document.getElementById('disconnectBtn'),
  clearBtn: document.getElementById('clearBtn'),
  status: document.getElementById('status'),
  voiceTopic: document.getElementById('voiceTopic'),
  voiceTranscript: document.getElementById('voiceTranscript'),
  replayCommand: document.getElementById('replayCommand'),
  replayPattern: document.getElementById('replayPattern'),
  replayRateLimit: document.getElementById('replayRateLimit'),
  replayDestinationSuffix: document.getElementById('replayDestinationSuffix'),
  replayCorrelationId: document.getElementById('replayCorrelationId'),
  replayIncludeHeaders: document.getElementById('replayIncludeHeaders'),
  publishVoiceBtn: document.getElementById('publishVoiceBtn'),
  voiceStatus: document.getElementById('voiceStatus'),
  routeSubscriptions: document.getElementById('routeSubscriptions'),
  stage: document.getElementById('stage'),
  storeTopology: document.getElementById('storeTopology'),
  masterDataCount: document.getElementById('masterDataCount'),
  priceUpdateCount: document.getElementById('priceUpdateCount'),
  storesReachedCount: document.getElementById('storesReachedCount'),
  cacheUpdateCount: document.getElementById('cacheUpdateCount'),
  lastActionTitle: document.getElementById('lastActionTitle'),
  lastActionBody: document.getElementById('lastActionBody'),
  insightStatus: document.getElementById('insightStatus'),
  insightList: document.getElementById('insightList'),
  eventCount: document.getElementById('eventCount'),
  lastStore: document.getElementById('lastStore')
};

let session = null;
let subscribedTopic = null;
let activeSubscriptions = [];
let eventCount = 0;
let roundRobinIndex = 0;
let useTls = true;
let selectedStoreId = null;
let demoMode = false;
let demoInterval = null;
let demoSequence = 0;
const metrics = {
  masterData: 0,
  priceUpdates: 0,
  storesReached: 0,
  cacheUpdates: 0
};


function storeLabel(store) {
  return `${store.countryName} · ${store.id}`;
}

function storeKeyFromParts(country, storeId) {
  return country && storeId ? `${String(country).toUpperCase()}-${storeId}` : '';
}

function findStoreByKey(key) {
  return stores.find((store) => store.key === key) || null;
}

function resolveStoreContext(topic, payload = '') {
  const parsed = parseJsonPayload(payload);
  const topicLevels = topic.split('/').filter(Boolean);
  const markerIndex = topicLevels.indexOf('storein');
  const country = (parsed && (parsed.country || parsed.city || parsed.location)) || (markerIndex >= 0 ? topicLevels[markerIndex + 1] || '' : '');
  const storeId = (parsed && String(parsed.storeId || '')) || (markerIndex >= 0 ? topicLevels[markerIndex + 2] || '' : '');
  const key = storeKeyFromParts(country, storeId);
  return { country, storeId, key };
}

function iconSvg(type) {
  if (type === 'broker') {
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" fill="none" stroke="#00c895" stroke-width="3"/><rect x="17" y="24" width="30" height="16" rx="8" fill="#ffffff" stroke="#2f5f84" stroke-width="2"/><text x="32" y="35.5" text-anchor="middle" font-size="8" font-family="Verdana, sans-serif" font-weight="700" fill="#11324d">BROKER</text><circle cx="32" cy="14" r="3" fill="#ffffff" stroke="#2f5f84" stroke-width="1.5"/><circle cx="14" cy="30" r="3" fill="#ffffff" stroke="#2f5f84" stroke-width="1.5"/><circle cx="50" cy="30" r="3" fill="#ffffff" stroke="#2f5f84" stroke-width="1.5"/><circle cx="22" cy="50" r="3" fill="#ffffff" stroke="#2f5f84" stroke-width="1.5"/><circle cx="42" cy="50" r="3" fill="#ffffff" stroke="#2f5f84" stroke-width="1.5"/><path d="M32 17v7M17 30h-3m36 0h-3M24 47l-3-8m19 8l3-8" stroke="#2f5f84" stroke-width="1.8" stroke-linecap="round"/></svg>';
  }
  if (type === 'pos') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="16" rx="2"></rect><path d="M8 8h8M8 12h8M8 16h5"></path></svg>';
  }
  if (type === 'esl') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="10" rx="2"></rect><path d="M7 10h10M7 14h6"></path></svg>';
  }
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="12" height="14" rx="2"></rect><path d="M9 9h6M9 13h4"></path><circle cx="16.5" cy="7.5" r="1.5"></circle></svg>';
}

function setStatus(text, type = '') {
  els.status.textContent = text;
  els.status.className = `status ${type}`.trim();
}

function setVoiceStatus(text, type = '') {
  els.voiceStatus.textContent = text;
  els.voiceStatus.className = `voice-status ${type}`.trim();
}

function readSavedConnections() {
  try {
    return JSON.parse(window.localStorage.getItem(SAVED_CONNECTIONS_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeSavedConnections(connections) {
  window.localStorage.setItem(SAVED_CONNECTIONS_KEY, JSON.stringify(connections));
}

function buildConnectionProfile() {
  return {
    id: `${els.host.value.trim()}|${els.vpn.value.trim()}|${els.username.value.trim()}`.toLowerCase(),
    host: els.host.value.trim(),
    port: els.port.value.trim(),
    vpn: els.vpn.value.trim(),
    username: els.username.value.trim(),
    useTls
  };
}

function connectionProfileLabel(profile) {
  const userPart = profile.username ? ` · ${profile.username}` : '';
  return `${profile.host} · ${profile.vpn}${userPart}`;
}

function renderSavedConnections(selectedId = '') {
  const connections = readSavedConnections();
  els.savedConnectionSelect.innerHTML = `
    <option value="">Select a saved connection</option>
    ${connections.map((profile) => `<option value="${escapeHtml(profile.id)}">${escapeHtml(connectionProfileLabel(profile))}</option>`).join('')}
  `;
  if (selectedId) {
    els.savedConnectionSelect.value = selectedId;
  }
}

function applyConnectionProfile(profile) {
  els.host.value = profile.host || '';
  els.port.value = profile.port || (profile.useTls ? '443' : '80');
  els.vpn.value = profile.vpn || '';
  els.username.value = profile.username || '';
  els.password.value = '';
  if (useTls !== Boolean(profile.useTls)) {
    toggleTls();
  } else {
    updateUrlPreview();
  }
}

function saveCurrentConnection() {
  const profile = buildConnectionProfile();
  if (!profile.host || !profile.vpn) {
    setStatus('Host and Message VPN are required before saving a connection.', 'error');
    return;
  }
  const connections = readSavedConnections().filter((entry) => entry.id !== profile.id);
  connections.unshift(profile);
  writeSavedConnections(connections.slice(0, 12));
  window.localStorage.setItem(LAST_CONNECTION_KEY, profile.id);
  renderSavedConnections(profile.id);
  setStatus(`Saved connection ${connectionProfileLabel(profile)} locally in this browser.`, 'ok');
}

function deleteSavedConnection() {
  const selectedId = els.savedConnectionSelect.value;
  if (!selectedId) {
    setStatus('Choose a saved connection before deleting it.', 'error');
    return;
  }
  const connections = readSavedConnections().filter((entry) => entry.id !== selectedId);
  writeSavedConnections(connections);
  if (window.localStorage.getItem(LAST_CONNECTION_KEY) === selectedId) {
    window.localStorage.removeItem(LAST_CONNECTION_KEY);
  }
  renderSavedConnections();
  setStatus('Saved connection removed from this browser.', 'ok');
}

function restoreLastConnection() {
  const connections = readSavedConnections();
  const lastId = window.localStorage.getItem(LAST_CONNECTION_KEY) || '';
  renderSavedConnections(lastId);
  if (!lastId) return;
  const match = connections.find((entry) => entry.id === lastId);
  if (!match) return;
  applyConnectionProfile(match);
}

function buildReplayPayload() {
  const command = els.replayCommand.value.trim();
  const pattern = els.replayPattern.value.trim();
  const options = {};

  if (els.replayRateLimit.value.trim()) {
    options.rateLimit = Number.parseInt(els.replayRateLimit.value.trim(), 10);
  }
  if (els.replayDestinationSuffix.value.trim()) {
    options.destinationSuffix = els.replayDestinationSuffix.value.trim();
  }
  if (els.replayCorrelationId.value.trim()) {
    options.correlationId = els.replayCorrelationId.value.trim();
  }
  options.includeOriginalHeaders = els.replayIncludeHeaders.value === 'true';

  const payload = { command, pattern };
  if (Object.keys(options).length) payload.options = options;
  return payload;
}

function refreshReplayPreview() {
  els.voiceTranscript.value = JSON.stringify(buildReplayPayload(), null, 2);
}

function setDemoMode(active) {
  demoMode = active;
  els.demoToggle.textContent = active ? 'On' : 'Off';
  els.demoToggle.classList.toggle('is-on', active);
  els.demoToggle.setAttribute('aria-pressed', String(active));
}

function stopDemoStream() {
  if (demoInterval) {
    window.clearInterval(demoInterval);
    demoInterval = null;
  }
}

function parseJsonPayload(payload) {
  if (typeof payload !== 'string') return null;
  const trimmed = payload.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value.toFixed(2);
  return String(value);
}

function buildConsumeSummary(topic, payload) {
  const parsed = parseJsonPayload(payload);
  const priceValue = parsed && (parsed.price ?? parsed.newPrice ?? parsed.unitPrice ?? parsed.amount);
  const stockValue = parsed && (parsed.stock ?? parsed.quantity ?? parsed.level);

  if (/\/price\//i.test(topic)) {
    const formattedPrice = formatValue(priceValue) || (String(payload).match(/\d+[.,]\d{1,2}/) || [])[0];
    return formattedPrice ? `Price updated to ${formattedPrice}` : 'Price updated';
  }
  if (/\/stock\//i.test(topic)) {
    const formattedStock = formatValue(stockValue);
    return formattedStock ? `Stock now at ${formattedStock}` : 'Stock event consumed';
  }
  if (/\/command\//i.test(topic)) {
    const command = parsed && parsed.command ? parsed.command : 'command';
    const pattern = parsed && parsed.pattern ? String(parsed.pattern) : '';
    return pattern ? `${command.replaceAll('_', ' ')} for ${pattern}` : `${command.replaceAll('_', ' ')} requested`;
  }

  const levels = topic.split('/').filter(Boolean);
  const noun = levels[2] || 'event';
  const verb = levels[3] || 'received';
  return `${capitalize(noun)} ${verb.replace(/([A-Z])/g, ' $1').trim()}`;
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}

function buildLastAction(topic, payload, matchedStores, cacheMatched) {
  const parsed = parseJsonPayload(payload);
  const storeNames = matchedStores.length ? matchedStores.map((store) => store.name).join(', ') : 'no store match';
  const sku = parsed && parsed.sku ? parsed.sku : topic.split('/').filter(Boolean).at(-1) || 'unknown SKU';

  if (/\/price\//i.test(topic)) {
    const priceValue = parsed && (parsed.price ?? parsed.newPrice ?? parsed.unitPrice);
    const priceText = formatValue(priceValue);
    return {
      title: `Price update for ${sku}`,
      body: `${priceText ? `Updated to ${priceText}. ` : ''}Distributed to ${storeNames}${cacheMatched ? ' and Master Data Distribution MI' : ''}.`
    };
  }

  if (/\/stock\//i.test(topic)) {
    return {
      title: `Inventory signal for ${sku}`,
      body: `Routed to ${storeNames}${cacheMatched ? ' with Master Data Distribution MI refresh' : ''}.`
    };
  }

  if (/\/command\//i.test(topic)) {
    const command = parsed && parsed.command ? String(parsed.command).replaceAll('_', ' ') : 'replay command';
    const pattern = parsed && parsed.pattern ? String(parsed.pattern) : 'the selected pattern';
    return {
      title: `${capitalize(command.toLowerCase())} published`,
      body: `Triggered for ${pattern}. Sent through the same Solace session${matchedStores.length ? ` and routed to ${storeNames}` : ''}.`
    };
  }

  return {
    title: buildConsumeSummary(topic, payload),
    body: `Routed to ${storeNames}${cacheMatched ? ' and Master Data Distribution MI' : ''}.`
  };
}

function isProductCacheStatusTopic(topic) {
  return topicMatchesSubscription(PRODUCT_CACHE_STATUS_SUBSCRIPTION, topic);
}

function resolveStoreIdFromStatus(topic, payload) {
  const parsed = parseJsonPayload(payload);
  const levels = topic.split('/').filter(Boolean);
  const storeId = parsed && parsed.storeId ? String(parsed.storeId) : (levels.at(-1) || '');
  const country = parsed && (parsed.country || parsed.city || parsed.location) ? String(parsed.country || parsed.city || parsed.location) : '';
  if (country) {
    const key = storeKeyFromParts(country, storeId);
    return findStoreByKey(key) ? key : null;
  }
  const match = stores.find((store) => store.id === storeId);
  return match ? match.key : null;
}

function inferStoreIdFromCommand(topic, payload) {
  const context = resolveStoreContext(topic, payload);
  if (context.key && findStoreByKey(context.key)) return context.key;
  if (selectedStoreId) return selectedStoreId;
  return stores[0].key;
}

function buildReplayStatusMessage(topic, payload, fallbackStoreId = '') {
  const parsed = parseJsonPayload(payload);
  if (parsed && parsed.message) return String(parsed.message);
  const storeId = (parsed && parsed.storeId) || fallbackStoreId || 'target store';
  const action = parsed && parsed.action ? String(parsed.action) : 'REPLAY_PRICES';
  const status = parsed && parsed.status ? String(parsed.status).toUpperCase() : 'SUCCESS';
  if (status === 'SUCCESS') {
    return action === 'REPLAY_PRICES'
      ? `Replay of prices to store ${storeId} successful`
      : `Replay to store ${storeId} successful`;
  }
  return parsed && parsed.error
    ? String(parsed.error)
    : `Replay to store ${storeId} failed`;
}

function showStoreToast(storeId, title, message, tone = 'default') {
  const storeEl = document.querySelector(`[data-store="${storeId}"]`);
  if (!storeEl) return;

  const previous = els.stage.querySelector(`.consume-toast[data-store-toast="${storeId}"]`);
  if (previous) previous.remove();

  const stageRect = els.stage.getBoundingClientRect();
  const storeRect = storeEl.getBoundingClientRect();
  const toast = document.createElement('div');
  toast.className = `consume-toast ${tone}`.trim();
  toast.dataset.storeToast = storeId;
  toast.style.left = `${storeRect.left - stageRect.left + (storeRect.width / 2)}px`;
  toast.style.top = `${storeRect.top - stageRect.top - 14}px`;
  toast.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
  els.stage.appendChild(toast);

  window.setTimeout(() => toast.remove(), 2600);
}

function showNodeToast(nodeSelector, toastKey, title, message, tone = 'default') {
  const nodeEl = els.stage.querySelector(nodeSelector);
  if (!nodeEl) return;

  const previous = els.stage.querySelector(`.consume-toast[data-node-toast="${toastKey}"]`);
  if (previous) previous.remove();

  const stageRect = els.stage.getBoundingClientRect();
  const nodeRect = nodeEl.getBoundingClientRect();
  const toast = document.createElement('div');
  toast.className = `consume-toast ${tone}`.trim();
  toast.dataset.nodeToast = toastKey;
  toast.style.left = `${nodeRect.left - stageRect.left + (nodeRect.width / 2)}px`;
  toast.style.top = `${nodeRect.top - stageRect.top - 16}px`;
  toast.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
  els.stage.appendChild(toast);

  window.setTimeout(() => toast.remove(), 3000);
}

function visualizeReplayCommand(topic, payload) {
  const parsed = parseJsonPayload(payload) || {};
  const command = parsed.command ? String(parsed.command).replaceAll('_', ' ') : 'Replay command';
  const pattern = parsed.pattern ? String(parsed.pattern) : 'no pattern specified';
  const destinationSuffix = parsed.options && parsed.options.destinationSuffix ? ` → ${parsed.options.destinationSuffix}` : '';
  const summary = `${pattern}${destinationSuffix}`;

  animateToProductCache();
  showNodeToast('[data-cache="PRODUCT-CACHE"]', 'replay-command', 'Replay triggered', `${command} for ${summary}`, 'success');
  els.lastActionTitle.textContent = `${capitalize(command.toLowerCase())} triggered`;
  els.lastActionBody.textContent = `Replay requested for ${pattern}${destinationSuffix}. Master Data Distribution MI is preparing the replay flow.`;
  els.insightStatus.textContent = 'Triggered';
  els.insightList.innerHTML = `
    <li>
      <strong>Distribution Agent</strong>
      <p>${escapeHtml(`Replay request sent for ${pattern}. Matching store subscriptions will receive the compacted state.`)}</p>
    </li>
    <li>
      <strong>Pricing Agent</strong>
      <p>${escapeHtml(`Replay command ${command} was triggered to refresh the selected master data scope.`)}</p>
    </li>
    <li>
      <strong>Cache Agent</strong>
      <p>${escapeHtml(`Master Data Distribution MI received the replay trigger for ${pattern}${destinationSuffix}.`)}</p>
    </li>
  `;
}

function handleProductCacheStatus(topic, payload) {
  const storeId = resolveStoreIdFromStatus(topic, payload);
  const message = buildReplayStatusMessage(topic, payload, storeId || 'target store');
  const parsed = parseJsonPayload(payload);
  const status = parsed && parsed.status ? String(parsed.status).toUpperCase() : 'SUCCESS';
  const success = status !== 'FAILED' && status !== 'ERROR';

  eventCount += 1;
  els.eventCount.textContent = eventCount;
  els.lastStore.textContent = storeId || 'cache-status';
  metrics.cacheUpdates += 1;
  els.cacheUpdateCount.textContent = String(metrics.cacheUpdates);
  els.lastActionTitle.textContent = success ? 'Master data replay completed' : 'Master data replay failed';
  els.lastActionBody.textContent = message;
  els.insightStatus.textContent = success ? 'Confirmed' : 'Attention';
  els.insightList.innerHTML = `
    <li>
      <strong>Distribution Agent</strong>
      <p>${escapeHtml(storeId ? `Store ${storeId} reported replay status back to the Event Mesh.` : 'A replay status event arrived from Master Data Distribution MI.')}</p>
    </li>
    <li>
      <strong>Pricing Agent</strong>
      <p>${escapeHtml(message)}</p>
    </li>
    <li>
      <strong>Cache Agent</strong>
      <p>${escapeHtml(success ? 'Latest price state has been replayed successfully.' : 'Replay needs attention before downstream systems are fully current.')}</p>
    </li>
  `;

  if (storeId) {
    animateToProductCache();
    showStoreToast(storeId, success ? 'Replay successful' : 'Replay issue', message, success ? 'success' : 'error');
    const storeEl = document.querySelector(`[data-store="${storeId}"]`);
    if (storeEl) {
      storeEl.classList.add('hit');
      window.setTimeout(() => storeEl.classList.remove('hit'), 1100);
    }
  }
}

function scheduleDemoReplayStatus(commandTopic, commandPayload) {
  const storeKey = inferStoreIdFromCommand(commandTopic, commandPayload);
  const store = findStoreByKey(storeKey) || stores[0];
  const statusTopic = `acmeretail/productCache/replayStatus/v1/${store.country}/${store.id}`;
  const statusPayload = JSON.stringify({
    country: store.country.toLowerCase(),
    storeId: store.id,
    status: 'SUCCESS',
    action: 'REPLAY_PRICES',
    message: `Replay of prices to store ${store.country}-${store.id} successful`
  });

  window.setTimeout(() => handleIncomingEvent(statusTopic, statusPayload), 900);
}

function buildInsights(topic, payload, matchedStores, cacheMatched) {
  const parsed = parseJsonPayload(payload);
  const sku = parsed && parsed.sku ? parsed.sku : topic.split('/').filter(Boolean).at(-1) || 'the current item';
  const storeNames = matchedStores.length ? matchedStores.map((store) => store.name).join(', ') : 'no matching stores';
  const priceValue = parsed && (parsed.price ?? parsed.newPrice ?? parsed.unitPrice);
  const insights = [
    {
      title: 'Distribution Agent',
      body: matchedStores.length
        ? `${matchedStores.length} store${matchedStores.length > 1 ? 's' : ''} matched the active subscriptions: ${storeNames}.`
        : 'No store subscription matched this event. Distribution stayed idle.'
    },
    {
      title: 'Pricing Agent',
      body: /\/price\//i.test(topic)
        ? `${sku} triggered a price change${formatValue(priceValue) ? ` to ${formatValue(priceValue)}` : ''}. Downstream pricing systems can refresh locally.`
        : 'Watching for the next price-sensitive master data change.'
    },
    {
      title: 'Cache Agent',
      body: cacheMatched
        ? `Master Data Distribution MI accepted the latest state for ${sku}. Replay remains current.`
        : 'Master Data Distribution MI was not updated by this event.'
    }
  ];
  return insights;
}

function updateOperationsPanel(topic, payload, matchedStores, cacheMatched) {
  metrics.masterData += 1;
  if (/\/price\//i.test(topic)) metrics.priceUpdates += 1;
  metrics.storesReached += matchedStores.length;
  if (cacheMatched) metrics.cacheUpdates += 1;

  els.masterDataCount.textContent = String(metrics.masterData);
  els.priceUpdateCount.textContent = String(metrics.priceUpdates);
  els.storesReachedCount.textContent = String(metrics.storesReached);
  els.cacheUpdateCount.textContent = String(metrics.cacheUpdates);

  const action = buildLastAction(topic, payload, matchedStores, cacheMatched);
  els.lastActionTitle.textContent = action.title;
  els.lastActionBody.textContent = action.body;

  const insights = buildInsights(topic, payload, matchedStores, cacheMatched);
  els.insightStatus.textContent = matchedStores.length || cacheMatched ? 'Active' : 'Observing';
  els.insightList.innerHTML = insights.map((insight) => `
    <li>
      <strong>${escapeHtml(insight.title)}</strong>
      <p>${escapeHtml(insight.body)}</p>
    </li>
  `).join('');
}

function handleIncomingEvent(topic, payload) {
  if (isProductCacheStatusTopic(topic)) {
    handleProductCacheStatus(topic, payload);
    return;
  }

  const matchedStores = resolveStores(topic, payload);
  const cacheMatched = topicMatchesSubscription(cacheClient.subscription, topic);
  const consumeSummary = buildConsumeSummary(topic, payload);

  eventCount += 1;
  els.eventCount.textContent = eventCount;
  els.lastStore.textContent = matchedStores.length
    ? matchedStores.map((store) => `${store.country}-${store.id}`).join(', ')
    : cacheMatched ? 'cache-only' : '-';

  updateOperationsPanel(topic, payload, matchedStores, cacheMatched);
  matchedStores.forEach((store) => {
    animateToStore(store.key);
    showStoreToast(store.key, 'Consumed', consumeSummary);
  });
  if (cacheMatched) animateToProductCache();
}

function getDemoEvents() {
  return [
    {
      topic: 'acmeretail/mdm/price/updated/storein/de/101/SKU-48291',
      payload: JSON.stringify({ country: 'de', storeId: '101', sku: 'SKU-48291', price: 3.49, currency: 'EUR' })
    },
    {
      topic: 'acmeretail/mdm/product/updated/storein/ca/102/SKU-77102',
      payload: JSON.stringify({ country: 'ca', storeId: '102', sku: 'SKU-77102', stock: 8, currency: 'USD' })
    },
    {
      topic: 'acmeretail/mdm/price/updated/storein/fr/103/SKU-11802',
      payload: JSON.stringify({ country: 'fr', storeId: '103', sku: 'SKU-11802', price: 1.99, currency: 'EUR' })
    },
    {
      topic: 'acmeretail/mdm/product/updated/storein/au/104/SKU-66119',
      payload: JSON.stringify({ country: 'au', storeId: '104', sku: 'SKU-66119', stock: 42, currency: 'USD' })
    }
  ];
}

function emitDemoEvent() {
  const events = getDemoEvents();
  const activeSubscription = subscribedTopic || els.topic.value.trim() || 'acmeretail/mdm/*/*/storein/*/>';

  for (let offset = 0; offset < events.length; offset += 1) {
    const candidate = events[(demoSequence + offset) % events.length];
    if (topicMatchesSubscription(activeSubscription, candidate.topic)) {
      demoSequence = (demoSequence + offset + 1) % events.length;
      handleIncomingEvent(candidate.topic, candidate.payload);
      return;
    }
  }

  const fallback = events[demoSequence % events.length];
  demoSequence = (demoSequence + 1) % events.length;
  handleIncomingEvent(fallback.topic, fallback.payload);
}

function startDemoStream() {
  stopDemoStream();
  emitDemoEvent();
  demoInterval = window.setInterval(emitDemoEvent, 2800);
}

function publishVoiceTranscript() {
  const topic = els.voiceTopic.value.trim();
  const payload = buildReplayPayload();
  const serializedPayload = JSON.stringify(payload);

  if (!session) {
    setVoiceStatus('Connect to the broker first. Then we can publish the replay request.', 'error');
    return;
  }
  if (!topic) {
    setVoiceStatus('Command topic is required.', 'error');
    return;
  }
  if (!payload.command || !payload.pattern) {
    setVoiceStatus('Command and pattern are required.', 'error');
    return;
  }

  try {
    visualizeReplayCommand(topic, serializedPayload);
    if (session.isDemoSession) {
      handleIncomingEvent(topic, serializedPayload);
      scheduleDemoReplayStatus(topic, serializedPayload);
      setVoiceStatus(`Published replay request to ${topic} in UI demo mode`, 'ok');
      return;
    }

    const message = solace.SolclientFactory.createMessage();
    message.setDestination(solace.SolclientFactory.createTopicDestination(topic));
    message.setBinaryAttachment(serializedPayload);
    message.setDeliveryMode(solace.MessageDeliveryModeType.DIRECT);
    session.send(message);
    setVoiceStatus(`Published replay request to ${topic}`, 'ok');
  } catch (error) {
    setVoiceStatus(`Publish failed: ${error.message}`, 'error');
  }
}

function initSolace() {
  if (!window.solace) {
    throw new Error('Solace JavaScript client not loaded.');
  }
  const factoryProps = new solace.SolclientFactoryProperties();
  factoryProps.profile = solace.SolclientFactoryProfiles.version10;
  solace.SolclientFactory.init(factoryProps);
  solace.SolclientFactory.setLogLevel(solace.LogLevel.WARN);
}

function buildBrokerUrl() {
  const host = els.host.value.trim().replace(/^wss?:\/\//, '').replace(/\/$/, '');
  const port = els.port.value.trim();
  const scheme = useTls ? 'wss' : 'ws';
  if (!host) throw new Error('Broker host is required.');
  return port ? `${scheme}://${host}:${port}` : `${scheme}://${host}`;
}

function updateUrlPreview() {
  try {
    els.urlPreview.textContent = buildBrokerUrl();
  } catch {
    els.urlPreview.textContent = useTls ? 'wss://' : 'ws://';
  }
}

function shortSubscription(topic) {
  return topic.length > 24 ? `${topic.slice(0, 22)}...` : topic;
}

function routeClassName(targetId) {
  if (targetId === 'PRODUCT-CACHE') return 'route-sub-cache';
  if (targetId === 'DE-101') return 'route-sub-ham';
  if (targetId === 'CA-102') return 'route-sub-ber';
  if (targetId === 'FR-103') return 'route-sub-muc';
  return 'route-sub-cgn';
}

function summarizeSubscription(subscription) {
  const levels = subscription.split('/').filter(Boolean);
  if (levels.length < 7) return subscription;
  if (levels.at(-1) === '>' && levels.at(-2) === '*') return 'all/all';
  const country = levels.at(-3) || '*';
  const storeId = levels.at(-2) || '*';
  if (country === 'all' && storeId === 'all') return 'all/all';
  if (country !== '*' && storeId === '*') return `${country}/all`;
  if (country !== '*' && storeId !== '>') return `${country}/${storeId}`;
  return subscription;
}

function routeSummaryText(target) {
  if (target.id === cacheClient.id) return summarizeSubscription(target.subscription);
  return `${target.subscriptions.length} scopes active`;
}

function renderRouteSubscriptions() {
  const storeMarkup = stores.map((store) => `
    <div class="route-sub ${routeClassName(store.key)}" data-route-box="${store.key}">
      <div class="route-sub-head">
        <span>${storeLabel(store)}</span>
        <button class="route-sub-edit" type="button" data-toggle-route="${store.key}">Edit</button>
      </div>
      <button class="route-sub-summary" type="button" data-toggle-route="${store.key}">${routeSummaryText(store)}</button>
      <div class="route-sub-editor">
        ${store.subscriptions.map((subscription, index) => `
          <label class="route-sub-row">
            <em>${STORE_SUBSCRIPTION_LABELS[index]}</em>
            <input type="text" data-store-sub="${store.key}" data-sub-index="${index}" value="${subscription}" autocomplete="off" />
          </label>
        `).join('')}
      </div>
    </div>
  `).join('');

  const cacheMarkup = `
    <div class="route-sub ${routeClassName(cacheClient.id)}" data-route-box="${cacheClient.id}">
      <div class="route-sub-head">
        <span>${cacheClient.name}</span>
        <button class="route-sub-edit" type="button" data-toggle-route="${cacheClient.id}">Edit</button>
      </div>
      <button class="route-sub-summary" type="button" data-toggle-route="${cacheClient.id}">${routeSummaryText(cacheClient)}</button>
      <div class="route-sub-editor">
        <label class="route-sub-row">
          <em>subscription</em>
          <input type="text" data-store-sub="${cacheClient.id}" value="${cacheClient.subscription}" autocomplete="off" />
        </label>
      </div>
    </div>
  `;

  els.routeSubscriptions.innerHTML = storeMarkup + cacheMarkup;
}

function topicMatchesSubscription(subscription, topic) {
  const subLevels = subscription.split('/').filter(Boolean);
  const topicLevels = topic.split('/').filter(Boolean);

  for (let index = 0; index < subLevels.length; index += 1) {
    const subPart = subLevels[index];
    const topicPart = topicLevels[index];

    if (subPart === '>') return true;
    if (topicPart === undefined) return false;
    if (subPart === '*') continue;
    if (subPart !== topicPart) return false;
  }

  return subLevels.length === topicLevels.length;
}

function connect() {
  try {
    window.localStorage.setItem(LAST_CONNECTION_KEY, buildConnectionProfile().id);
    if (demoMode) {
      stopDemoStream();
      session = { isDemoSession: true };
      subscribedTopic = null;
      setStatus('UI demo mode active. Subscribe to start the local event stream.', 'ok');
      els.connectBtn.disabled = true;
      els.subscribeBtn.disabled = false;
      els.disconnectBtn.disabled = false;
      return;
    }

    initSolace();
    const brokerUrl = buildBrokerUrl();
    session = solace.SolclientFactory.createSession({
      url: brokerUrl,
      vpnName: els.vpn.value.trim(),
      userName: els.username.value.trim(),
      password: els.password.value
    });

    session.on(solace.SessionEventCode.UP_NOTICE, () => {
      setStatus('Connected. Choose a topic and subscribe.', 'ok');
      els.connectBtn.disabled = true;
      els.subscribeBtn.disabled = false;
      els.disconnectBtn.disabled = false;
    });

    session.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, (event) => {
      setStatus(`Connection failed: ${event.infoStr || 'unknown error'}`, 'error');
      cleanupSession();
    });

    session.on(solace.SessionEventCode.DISCONNECTED, () => {
      setStatus('Disconnected.', '');
      cleanupSession();
    });

    session.on(solace.SessionEventCode.SUBSCRIPTION_OK, () => {
      setStatus(`Subscribed to ${subscribedTopic}`, 'ok');
    });

    session.on(solace.SessionEventCode.SUBSCRIPTION_ERROR, (event) => {
      setStatus(`Subscription failed: ${event.infoStr || 'unknown error'}`, 'error');
    });

    session.on(solace.SessionEventCode.MESSAGE, onMessage);
    setStatus(`Connecting to ${brokerUrl}...`, '');
    session.connect();
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

function toggleTls() {
  useTls = !useTls;
  els.tlsToggle.textContent = useTls ? 'On' : 'Off';
  els.tlsToggle.classList.toggle('is-on', useTls);
  els.tlsToggle.setAttribute('aria-pressed', String(useTls));
  if (els.port.value === '443' && !useTls) els.port.value = '80';
  else if (els.port.value === '80' && useTls) els.port.value = '443';
  updateUrlPreview();
}

function subscribe() {
  if (!session) return;
  const topic = els.topic.value.trim();
  if (!topic) {
    setStatus('Topic subscription is required.', 'error');
    return;
  }
  try {
    subscribedTopic = topic;
    if (session.isDemoSession) {
      startDemoStream();
      setStatus(`UI demo mode subscribed to ${topic}`, 'ok');
      return;
    }

    activeSubscriptions = [topic, PRODUCT_CACHE_STATUS_SUBSCRIPTION];
    activeSubscriptions.forEach((subscriptionTopic, index) => {
      session.subscribe(
        solace.SolclientFactory.createTopicDestination(subscriptionTopic),
        true,
        `${subscriptionTopic}-${index}`,
        10000
      );
    });
    setStatus(`Subscribing to ${topic} and master data replay status...`, '');
  } catch (error) {
    setStatus(`Subscribe error: ${error.message}`, 'error');
  }
}

function disconnect() {
  if (!session) return;
  try {
    if (session.isDemoSession) {
      stopDemoStream();
      setStatus('UI demo mode disconnected.', '');
      cleanupSession();
      return;
    }
    session.disconnect();
  } catch (error) {
    setStatus(`Disconnect error: ${error.message}`, 'error');
  }
}

function cleanupSession() {
  stopDemoStream();
  session = null;
  subscribedTopic = null;
  activeSubscriptions = [];
  els.connectBtn.disabled = false;
  els.subscribeBtn.disabled = true;
  els.disconnectBtn.disabled = true;
}

function onMessage(message) {
  const destination = message.getDestination();
  const topic = destination && destination.getName ? destination.getName() : 'unknown/topic';
  const payload = readPayload(message);
  handleIncomingEvent(topic, payload);
}

function readPayload(message) {
  try {
    const binaryAttachment = message.getBinaryAttachment && message.getBinaryAttachment();
    if (binaryAttachment) return binaryAttachment;
    const xmlContent = message.getXmlContent && message.getXmlContent();
    if (xmlContent) return xmlContent;
  } catch (error) {
    return `Unable to decode payload: ${error.message}`;
  }
  return '';
}

function resolveStores(topic, payload = '') {
  const matches = stores.filter((store) => store.subscriptions.some((subscription) => topicMatchesSubscription(subscription, topic)));
  if (matches.length) return matches;

  const context = resolveStoreContext(topic, payload);
  if (context.key) {
    const direct = findStoreByKey(context.key);
    if (direct) return [direct];
  }

  if (!`${topic} ${payload}`.trim()) {
    const fallback = stores[roundRobinIndex % stores.length];
    roundRobinIndex += 1;
    return [fallback];
  }
  return [];
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function trimPayload(payload) {
  const text = typeof payload === 'string' ? payload : String(payload);
  return text.length > 900 ? `${text.slice(0, 900)}...` : text;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function animateToStore(storeId) {
  const route = document.querySelector(`[data-route="${storeId}"]`);
  const storeEl = document.querySelector(`[data-store="${storeId}"]`);
  if (!storeEl) return;

  if (route) route.classList.add('active');
  storeEl.classList.add('hit');

  const stageRect = els.stage.getBoundingClientRect();
  const storeRect = storeEl.getBoundingClientRect();
  const packet = document.createElement('span');
  packet.className = 'packet';
  packet.style.setProperty('--tx', `${storeRect.left + storeRect.width / 2 - (stageRect.left + stageRect.width / 2)}px`);
  packet.style.setProperty('--ty', `${storeRect.top + storeRect.height / 2 - (stageRect.top + stageRect.height / 2)}px`);
  els.stage.appendChild(packet);

  setTimeout(() => {
    if (route) route.classList.remove('active');
    storeEl.classList.remove('hit');
    packet.remove();
  }, 1100);
}

function animateToProductCache() {
  const route = document.querySelector('[data-route="PRODUCT-CACHE"]');
  const cacheEl = document.querySelector('[data-cache="PRODUCT-CACHE"]');
  if (!cacheEl) return;

  if (route) route.classList.add('cache-active');
  cacheEl.classList.add('hit');

  const stageRect = els.stage.getBoundingClientRect();
  const cacheRect = cacheEl.getBoundingClientRect();
  const packet = document.createElement('span');
  packet.className = 'packet cache';
  packet.style.setProperty('--tx', `${cacheRect.left + cacheRect.width / 2 - (stageRect.left + stageRect.width / 2)}px`);
  packet.style.setProperty('--ty', `${cacheRect.top + cacheRect.height / 2 - (stageRect.top + stageRect.height / 2)}px`);
  els.stage.appendChild(packet);

  setTimeout(() => {
    if (route) route.classList.remove('cache-active');
    cacheEl.classList.remove('hit');
    packet.remove();
  }, 1100);
}

function renderStoreTopology(storeId) {
  const store = findStoreByKey(storeId);
  const storeEl = document.querySelector(`[data-store="${storeId}"]`);
  if (!store || !storeEl) return;

  const stageRect = els.stage.getBoundingClientRect();
  const storeRect = storeEl.getBoundingClientRect();
  const topologyWidth = Math.min(304, Math.max(220, stageRect.width - 24));
  const topologyHeight = 244;
  const centerX = storeRect.left - stageRect.left + storeRect.width / 2;
  const centerY = storeRect.top - stageRect.top + storeRect.height / 2;
  const placeOnRight = centerX < stageRect.width / 2;
  const left = Math.max(12, Math.min(stageRect.width - topologyWidth - 12, centerX + (placeOnRight ? 56 : -(topologyWidth + 16))));
  const preferBelow = (storeRect.top - stageRect.top) < 150;
  const top = preferBelow
    ? Math.max(12, Math.min(stageRect.height - topologyHeight - 12, centerY + 38))
    : Math.max(12, Math.min(stageRect.height - topologyHeight - 12, centerY - 126));

  els.storeTopology.hidden = false;
  els.storeTopology.style.left = `${left}px`;
  els.storeTopology.style.top = `${top}px`;
  els.storeTopology.innerHTML = `
    <div class="topology-header">
      <div>
        <span>${store.country}-${store.id}</span>
        <strong>${store.countryName} · ${store.name}</strong>
        <div class="topology-subscription">${store.subscriptions.map((subscription, index) => `<div><strong>${STORE_SUBSCRIPTION_LABELS[index]}:</strong> ${subscription}</div>`).join('')}</div>
      </div>
      <button class="topology-close" type="button" aria-label="Close store systems">Close</button>
    </div>
    <div class="topology-canvas">
      <div class="topology-node broker-node">
        <div class="node-icon broker">${iconSvg('broker')}</div>
        <strong>Store Broker</strong>
      </div>
      <div class="topology-node pos-a">
        <div class="node-icon pos">${iconSvg('pos')}</div>
        <strong>POS 1</strong>
      </div>
      <div class="topology-node pos-b">
        <div class="node-icon pos">${iconSvg('pos')}</div>
        <strong>POS 2</strong>
      </div>
      <div class="topology-node pos-c">
        <div class="node-icon pos">${iconSvg('pos')}</div>
        <strong>POS 3</strong>
      </div>
      <div class="topology-node esl-node">
        <div class="node-icon esl">${iconSvg('esl')}</div>
        <strong>ESL</strong>
      </div>
      <div class="topology-node scanner-node">
        <div class="node-icon scanner">${iconSvg('scanner')}</div>
        <strong>Scanner</strong>
      </div>
      <span class="topology-link link-pos-a"></span>
      <span class="topology-link link-pos-b"></span>
      <span class="topology-link link-pos-c"></span>
      <span class="topology-link link-esl"></span>
      <span class="topology-link link-scanner"></span>
    </div>
  `;
}

function openStoreDashboard(storeId) {
  window.location.href = STORE_DASHBOARD_URL;
}

function toggleStoreTopology(storeId) {
  document.querySelectorAll('.store').forEach((entry) => entry.classList.toggle('selected', entry.dataset.store === storeId && selectedStoreId !== storeId));
  if (selectedStoreId === storeId) {
    selectedStoreId = null;
    els.storeTopology.hidden = true;
    els.storeTopology.innerHTML = '';
    els.stage.classList.remove('topology-open');
    document.querySelectorAll('.store').forEach((entry) => entry.classList.remove('selected'));
    return;
  }
  selectedStoreId = storeId;
  els.stage.classList.add('topology-open');
  document.querySelectorAll('.store').forEach((entry) => entry.classList.toggle('selected', entry.dataset.store === storeId));
  renderStoreTopology(storeId);
}

function clearEvents() {
  eventCount = 0;
  els.eventCount.textContent = '0';
  els.lastStore.textContent = '-';
  metrics.masterData = 0;
  metrics.priceUpdates = 0;
  metrics.storesReached = 0;
  metrics.cacheUpdates = 0;
  els.masterDataCount.textContent = '0';
  els.priceUpdateCount.textContent = '0';
  els.storesReachedCount.textContent = '0';
  els.cacheUpdateCount.textContent = '0';
  els.lastActionTitle.textContent = 'No live traffic yet';
  els.lastActionBody.textContent = 'Connect to a broker or use UI demo mode to watch master data updates move through the retail mesh.';
  els.insightStatus.textContent = 'Observing';
  els.insightList.innerHTML = `
    <li><strong>Distribution Agent</strong><p>Waiting for the next routed event.</p></li>
    <li><strong>Pricing Agent</strong><p>Watching for price changes across the store mesh.</p></li>
    <li><strong>Cache Agent</strong><p>Standing by for the next master data distribution refresh.</p></li>
  `;
}

els.connectBtn.addEventListener('click', connect);
els.subscribeBtn.addEventListener('click', subscribe);
els.disconnectBtn.addEventListener('click', disconnect);
els.clearBtn.addEventListener('click', clearEvents);
els.tlsToggle.addEventListener('click', toggleTls);
els.demoToggle.addEventListener('click', () => setDemoMode(!demoMode));
els.host.addEventListener('input', updateUrlPreview);
els.port.addEventListener('input', updateUrlPreview);
els.publishVoiceBtn.addEventListener('click', publishVoiceTranscript);
els.saveConnectionBtn.addEventListener('click', saveCurrentConnection);
els.deleteConnectionBtn.addEventListener('click', deleteSavedConnection);
els.savedConnectionSelect.addEventListener('change', () => {
  const selectedId = els.savedConnectionSelect.value;
  if (!selectedId) return;
  const profile = readSavedConnections().find((entry) => entry.id === selectedId);
  if (!profile) return;
  applyConnectionProfile(profile);
  window.localStorage.setItem(LAST_CONNECTION_KEY, selectedId);
  setStatus(`Loaded saved connection ${connectionProfileLabel(profile)}.`, 'ok');
});
['replayCommand', 'replayPattern', 'replayRateLimit', 'replayDestinationSuffix', 'replayCorrelationId', 'replayIncludeHeaders'].forEach((key) => {
  els[key].addEventListener('input', refreshReplayPreview);
  els[key].addEventListener('change', refreshReplayPreview);
});
els.routeSubscriptions.addEventListener('input', (event) => {
  const input = event.target.closest('input[data-store-sub]');
  if (!input) return;
  const targetId = input.dataset.storeSub;
  if (targetId === cacheClient.id) {
    cacheClient.subscription = input.value.trim();
    return;
  }
  const store = findStoreByKey(targetId);
  if (!store) return;
  const index = Number.parseInt(input.dataset.subIndex || '0', 10);
  store.subscriptions[index] = input.value.trim();
  if (selectedStoreId === store.key) renderStoreTopology(store.key);
});
els.routeSubscriptions.addEventListener('change', (event) => {
  const input = event.target.closest('input[data-store-sub]');
  if (!input) return;
  renderRouteSubscriptions();
});
els.routeSubscriptions.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-toggle-route]');
  if (!toggle) return;
  const targetId = toggle.dataset.toggleRoute;
  const targetBox = els.routeSubscriptions.querySelector(`[data-route-box="${targetId}"]`);
  if (!targetBox) return;
  const shouldOpen = !targetBox.classList.contains('is-open');
  els.routeSubscriptions.querySelectorAll('[data-route-box].is-open').forEach((entry) => entry.classList.remove('is-open'));
  if (shouldOpen) targetBox.classList.add('is-open');
});
document.addEventListener('click', (event) => {
  if (event.target.closest('#routeSubscriptions')) return;
  els.routeSubscriptions.querySelectorAll('[data-route-box].is-open').forEach((entry) => entry.classList.remove('is-open'));
});
document.querySelectorAll('.store').forEach((storeEl) => {
  storeEl.addEventListener('click', () => openStoreDashboard(storeEl.dataset.store));
});
els.storeTopology.addEventListener('click', (event) => {
  if (event.target.closest('.topology-close')) {
    toggleStoreTopology(selectedStoreId);
  }
});
updateUrlPreview();
restoreLastConnection();
renderRouteSubscriptions();
refreshReplayPreview();

if (window.location.hash.startsWith('#store=')) {
  const hashStoreId = decodeURIComponent(window.location.hash.slice(7));
  if (stores.some((entry) => entry.key === hashStoreId)) {
    toggleStoreTopology(hashStoreId);
  }
}
