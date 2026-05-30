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

