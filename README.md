# Demothon-26 — Retail Produce Demo
## SAM + LangGraph Real-Time Personalisation

A stage demo showing Solace Agent Mesh (SAM) as the real-time orchestrator
and LangGraph as the reasoning specialist. A customer scans a produce item
via a PWA on their phone → SAM orchestrates data lookups from MySQL → delegates
to a LangGraph Personalisation Agent via A2A → personalised result appears on
both the phone and the stage dashboard via the Solace event mesh.

---

## Architecture
<img width="1200" height="675" alt="image" src="https://github.com/user-attachments/assets/3dfb8310-4262-42bc-860d-b626fc6c238f" />


```
PWA (phone browser)
  └─ scans banana PLU 4011
  └─ POST /api/scan → PWA backend
       └─ publishes store/langgraph/C001/4011 → Solace broker
            └─ SAM Event Mesh Gateway picks up instantly
                 └─ SAM Produce Scan Agent:
                      ├─ fetches customer profile from MySQL
                      ├─ fetches product details from MySQL
                      ├─ fetches purchase history from MySQL
                      └─ builds sam_context string from findings
                           └─ delegates to LangGraph Personalisation Agent via A2A Proxy:
                                └─ LangGraph ReAct graph:
                                     └─ reasons over customer context
                                     └─ returns personalised JSON recommendation
                 └─ publishes store/result/C001 → Solace broker
                      ├─ PWA backend SSE relay → phone screen updates
                      └─ Stage dashboard SSE relay → big screen updates
```

---

## Prerequisites

- Minikube running with SAM Enterprise 1.24.11 deployed
- Docker Desktop running
- kubectl and Helm installed
- Python 3.10+
- MySQL running locally with `demo` database
- Solace broker (cloud) — credentials in .env
- `langgraph-cli[inmem]` — `pip install "langgraph-cli[inmem]"`

---

## Quick Start

### Step 1 — Configure (2 min)

```bash
cd ~/demothon26
cp .env.example .env
nano .env
```

### Step 2 — Install Python dependencies (3 min)

```bash
pip install -r requirements.txt --break-system-packages
pip install "langgraph-cli[inmem]" --break-system-packages
```

### Step 3 — Seed the database (1 min)

```bash
mysql -u root -p demo < db/seed.sql
```

Verify:
```bash
mysql -u root -p demo -e "SELECT customer_id, name, loyalty_tier FROM customers;"
```

### Step 4 — Test LangGraph agent locally (5 min)

```bash
python -m agent.langgraph_agent
```

You should see the ReAct loop running tool calls and returning structured JSON.

### Step 5 — Start the LangGraph dev server (Terminal 1)

```bash
cd ~/demothon26
langgraph dev --port 10002 --host $(ipconfig getifaddr en0) --no-browser
```

> **Important:** Always use `--host $(ipconfig getifaddr en0)` not `--host 0.0.0.0`.
> LangGraph puts the host value directly in the agent card URL. `0.0.0.0` is
> unreachable from Minikube — your Mac's real IP is required.

Get the assistant ID:
```bash
curl -s -X POST http://localhost:10002/assistants/search \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -m json.tool | grep assistant_id
```

Update `configs/agents/a2a_proxy_config_langgraph.yaml`:
```yaml
proxied_agents:
  - name: "LangGraphPersonalisationAgent"
    url: http://<YOUR_MAC_IP>:10002/a2a/<YOUR_ASSISTANT_ID>
```

### Step 6 — Start the PWA backend (Terminal 2)

```bash
cd ~/demothon26 && python3.11 pwa/server.py
```

PWA: http://localhost:3000  
Dashboard: http://localhost:3000/dashboard

### Step 7 — Deploy the A2A proxy

```bash
cd ~/demothon26
PROXY_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
echo $PROXY_ID > sam-proxy-langgraph-id.txt

helm install sam-agent-$PROXY_ID \
  https://solaceproducts.github.io/solace-agent-mesh-helm-quickstart/sam-agent-1.1.0.tgz \
  --set agentId=$PROXY_ID \
  --set-file config.agentYaml=$HOME/demothon26/configs/agents/a2a_proxy_config_langgraph.yaml \
  --set solaceBroker.url=$(grep SOLACE_HOST .env | cut -d= -f2) \
  --set solaceBroker.vpn=$(grep SOLACE_VPN .env | cut -d= -f2) \
  --set solaceBroker.username=$(grep SOLACE_USERNAME .env | cut -d= -f2) \
  --set solaceBroker.password=$(grep SOLACE_PASSWORD .env | cut -d= -f2) \
  --set llmService.generalModelName=$(grep LLM_MODEL .env | cut -d= -f2) \
  --set llmService.endpoint=$(grep OPENAI_API_BASE .env | cut -d= -f2) \
  --set llmService.apiKey=$(grep OPENAI_API_KEY .env | cut -d= -f2) \
  --set image.repository=solace-agent-mesh-enterprise \
  --set image.tag=1.24.11 \
  --set image.pullPolicy=Never \
  --set global.persistence.namespaceId=sam-local
```

Confirm discovery:
```bash
kubectl logs -f deploy/sam-agent-$PROXY_ID
# Look for: Published initially discovered card for agent 'LangGraphPersonalisationAgent'
```

### Step 8 — Deploy the SAM Produce Scan Agent

```bash
AGENT_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
echo $AGENT_ID > sam-agent-id.txt

helm install sam-agent-$AGENT_ID \
  https://solaceproducts.github.io/solace-agent-mesh-helm-quickstart/sam-agent-1.1.0.tgz \
  --set agentId=$AGENT_ID \
  --set-file config.agentYaml=$HOME/demothon26/configs/agents/produce_scan_agent_a2a.yaml \
  --set solaceBroker.url=$(grep SOLACE_HOST .env | cut -d= -f2) \
  --set solaceBroker.vpn=$(grep SOLACE_VPN .env | cut -d= -f2) \
  --set solaceBroker.username=$(grep SOLACE_USERNAME .env | cut -d= -f2) \
  --set solaceBroker.password=$(grep SOLACE_PASSWORD .env | cut -d= -f2) \
  --set llmService.generalModelName=$(grep LLM_MODEL .env | cut -d= -f2) \
  --set llmService.endpoint=$(grep OPENAI_API_BASE .env | cut -d= -f2) \
  --set llmService.apiKey=$(grep OPENAI_API_KEY .env | cut -d= -f2) \
  --set image.repository=solace-agent-mesh-enterprise \
  --set image.tag=1.24.11 \
  --set image.pullPolicy=Never \
  --set global.persistence.namespaceId=sam-local
```

### Step 9 — Apply the gateway UUID fix

Required once per container lifecycle. See bug fix section for details.

```bash
unset DOCKER_HOST && docker exec sam-event-mesh-gateway \
  sed -i 's/f"event-mesh-session-{uuid.uuid4().hex}"/str(uuid.uuid4())/g' \
  /usr/local/lib/python3.11/site-packages/sam_event_mesh_gateway/component.py

unset DOCKER_HOST && docker restart sam-event-mesh-gateway
```

### Step 10 — End-to-end test

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"anna@email.com","password":"demo123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

curl -s -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\",\"plu\":\"4011\",\"use_langgraph\":true}"
```

Watch the LangGraph dev server terminal. Dashboard should update within 5-10 seconds.

---

## On Stage — Demo Script

### Setup (night before)
1. Complete all steps above
2. Open stage dashboard fullscreen: http://localhost:3000/dashboard
3. On your phone: navigate to http://\<your-laptop-ip\>:3000
4. Test all three personas end to end with the LangGraph toggle on
5. Print QR code for http://\<your-laptop-ip\>:3000

### Demo flow

**Step 1** — Show the stage dashboard (blank)
> "This is our real-time event dashboard. It's subscribed to the Solace
> event mesh. Nothing is polling. The moment something happens in-store,
> this screen reacts."

**Step 2** — Open PWA, quick-login as Anna
> "This is the customer app — PWA, no install needed, just a URL.
> Anna is a Gold Circle member. You can see her recent purchases —
> she consistently buys organic produce. The app knows this."

**Step 3** — Confirm LangGraph toggle is green on the scanner screen
> "We're routing this through our LangGraph personalisation agent —
> a reasoning graph running on my laptop, connected to SAM via A2A."

**Step 4** — Enter PLU 4011
> "I'm in the produce aisle. I scan a bunch of conventional bananas."

**Step 5** — Result appears on both screens
> "Watch the dashboard."

Point at the big screen.
> "Same moment — Anna's phone and this screen. One event, two subscribers,
> zero polling. That's the Solace event mesh."

> "SAM fetched Anna's profile, product details, and purchase history from
> MySQL. That's the structured pipeline work. Then it handed everything to
> the LangGraph agent which looked at 10 weeks of history and made an inference."

> "This sentence —" (point at personalised text) "— came from graph reasoning,
> not a template. No rule said if organic > 3 then recommend organic.
> The graph saw the pattern and drew the conclusion."

**Step 6** — Login as James, scan same PLU
> "Same banana. Different customer."

> "James has never bought organic. The graph saw that, gave him a freshness
> tip instead. Same pipeline, same event, completely different output."

---

## Startup Order

```bash
# 1. MySQL
mysql.server start

# 2. Minikube
minikube start

# 3. LangGraph dev server (Terminal 1)
cd ~/demothon26
langgraph dev --port 10002 --host $(ipconfig getifaddr en0) --no-browser

# 4. PWA backend (Terminal 2)
cd ~/demothon26 && python3.11 pwa/server.py &

# 5. Event Mesh Gateway
unset DOCKER_HOST && docker start sam-event-mesh-gateway
# Re-apply UUID fix if container was recreated (Step 9)

# 6. Confirm pods running
kubectl get pods | grep sam-agent
```

---

## Log Commands

```bash
# Produce Scan Agent
kubectl logs -f deploy/sam-agent-$(cat ~/demothon26/sam-agent-id.txt)

# A2A Proxy
kubectl logs -f deploy/sam-agent-$(cat ~/demothon26/sam-proxy-langgraph-id.txt)

# Event Mesh Gateway
unset DOCKER_HOST && docker logs sam-event-mesh-gateway --tail=30
```

---

## Database Schema

```sql
CREATE TABLE customers (
  customer_id   VARCHAR(20)  PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  loyalty_tier  VARCHAR(20)  NOT NULL,
  points        INT          DEFAULT 0,
  discount_pct  INT          DEFAULT 0
);

CREATE TABLE products (
  plu              VARCHAR(10)  PRIMARY KEY,
  name             VARCHAR(150) NOT NULL,
  category         VARCHAR(50),
  price_per_lb     DECIMAL(5,2),
  organic          BOOLEAN      DEFAULT FALSE,
  conventional_plu VARCHAR(10),
  stock_store      INT          DEFAULT 0,
  stock_online     BOOLEAN      DEFAULT TRUE,
  aisle            VARCHAR(10)
);

CREATE TABLE purchase_history (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  customer_id  VARCHAR(20),
  product_plu  VARCHAR(10),
  product_name VARCHAR(150),
  organic      BOOLEAN,
  purchased_at DATE,
  quantity_lb  DECIMAL(4,2)
);
```

### Seed data

**Customers**

| customer_id | name  | tier   | discount | points |
|-------------|-------|--------|----------|--------|
| C001        | Anna  | Gold   | 18%      | 2840   |
| C002        | James | Silver | 11%      | 1120   |
| C003        | Maya  | New    | 0%       | 0      |

**Products**

| PLU   | Name                    | Price/lb | Organic | Aisle |
|-------|-------------------------|----------|---------|-------|
| 4011  | Bananas — Conventional  | $0.79    | No      | A2    |
| 94011 | Bananas — Organic       | $0.95    | Yes     | A2    |
| 4053  | Broccoli — Conventional | $1.29    | No      | A4    |
| 94053 | Broccoli — Organic      | $1.79    | Yes     | A4    |
| 3000  | Kale Bunch — Organic    | $2.49    | Yes     | A3    |
| 4046  | Avocado — Conventional  | $1.09    | No      | A5    |
| 94046 | Avocado — Organic       | $1.39    | Yes     | A5    |

**Purchase history**

| Customer    | Pattern                                          |
|-------------|--------------------------------------------------|
| Anna (C001) | 10 organic purchases — bananas, avocado, kale, broccoli |
| James (C002)| 6 conventional purchases — bananas, broccoli, avocado   |
| Maya (C003) | No history — new customer                        |

---

## Bug Fix: Gateway UUID Format

### Problem

The SAM Event Mesh Gateway generates session IDs as `event-mesh-session-{hex}`
(e.g. `event-mesh-session-a1b2c3d4...`). LangGraph uses this as a thread ID
and requires strict UUID format (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`),
returning `422 Invalid thread ID` otherwise.

### Fix

**File:** `/usr/local/lib/python3.11/site-packages/sam_event_mesh_gateway/component.py` line 737

```python
# Before
a2a_session_id = f"event-mesh-session-{uuid.uuid4().hex}"

# After
a2a_session_id = str(uuid.uuid4())
```

**Status:** Bug reported to Solace SAM team — JIRA ticket open.

---

## Project Structure

```
demothon26/
├── .env.example
├── requirements.txt
├── langgraph.json                          # LangGraph dev server config
├── agent/
│   ├── agent.py                            # LangChain ReAct agent (reference)
│   ├── langgraph_agent.py                  # LangGraph ReAct graph (active)
│   └── tools/mysql_tools.py
├── bridge/
│   ├── langchain_mcp_bridge.py             # MCP bridge (reference)
│   └── langchain_a2a_server.py             # a2a-sdk server (alternative)
├── configs/agents/
│   ├── produce_scan_agent.yaml             # SAM agent — MCP version (reference)
│   ├── produce_scan_agent_a2a.yaml         # SAM agent — A2A version (active)
│   ├── a2a_proxy_config.yaml               # Proxy for langchain_a2a_server
│   └── a2a_proxy_config_langgraph.yaml     # Proxy for LangGraph (active)
├── db/seed.sql
├── pwa/
│   ├── server.py
│   └── static/
│       ├── index.html                      # PWA with MCP/LangGraph toggle
│       └── manifest.json
└── dashboard/index.html
```

---

## Personas

| Email | Password | ID | Tier | Discount |
|-------|----------|----|------|----------|
| anna@email.com | demo123 | C001 | Gold | 18% |
| james@email.com | demo123 | C002 | Silver | 11% |
| maya@email.com | demo123 | C003 | New | 0% |
