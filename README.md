# Demothon-26 — Retail Produce Demo
## SAM + LangChain Real-Time Personalisation

A stage demo showing Solace Agent Mesh (SAM) as the real-time orchestrator
and LangChain as the reasoning specialist. A customer scans a produce item
via a PWA on their phone → SAM orchestrates parallel data lookups → LangChain
infers their organic preference from purchase history → personalised result
appears on both the phone and the stage dashboard via the Solace event mesh.

---

## Architecture

```
PWA (phone browser)
  └─ scans banana PLU 4011
  └─ POST /api/scan → PWA backend
       └─ publishes store/scan/C001/4011 → Solace broker
            └─ SAM Event Mesh Gateway picks up instantly
                 └─ SAM produce-scan-agent:
                      ├─ fetches customer profile from MySQL
                      ├─ fetches product details from MySQL
                      └─ calls LangChain via MCP → personalise_product_scan
                           └─ LangChain ReAct agent:
                                ├─ get_purchase_history(C001)
                                ├─ get_product_details(4011)
                                ├─ get_organic_alternative(4011)
                                └─ returns structured JSON
                 └─ publishes store/result/C001 → Solace broker
                      ├─ PWA backend SSE relay → phone screen updates
                      └─ Stage dashboard SSE relay → big screen updates
```

---

## Prerequisites (already running from SAM setup)

- Minikube running with SAM Enterprise 1.24.11 deployed
- Docker Desktop running
- kubectl and Helm installed
- Python 3.10+
- Node.js / npm (for Helm)
- MySQL running locally with `demo` database
- Solace broker (cloud) — credentials in .env

---

## Quick Start (under 30 minutes)

### Step 1 — Clone and configure (2 min)

```bash
cd ~/
cp -r demothon26 ~/demothon26
cd ~/demothon26

# Copy env file and fill in your MySQL password
cp .env.example .env
# Edit .env — only MYSQL_PASSWORD needs changing for most setups
nano .env
```

### Step 2 — Install Python dependencies (3 min)

```bash
pip install -r requirements.txt --break-system-packages
```

### Step 3 — Seed the database (1 min)

```bash
mysql -u root -p demo < db/seed.sql
```

Verify:
```bash
mysql -u root -p demo -e "SELECT customer_id, name, loyalty_tier FROM customers;"
```

Expected output:
```
+-------------+-------+--------------+
| customer_id | name  | loyalty_tier |
+-------------+-------+--------------+
| C001        | Anna  | Gold         |
| C002        | James | Silver       |
| C003        | Maya  | New          |
+-------------+-------+--------------+
```

### Step 4 — Test LangChain agent locally (5 min)

Before deploying to SAM, verify LangChain works standalone:

```bash
# From project root
python -m agent.agent
```

You should see the ReAct loop reasoning through:
```
Thought: I need to check the customer's purchase history...
Action: get_purchase_history
Action Input: C001
Observation: [{'product_name': 'Bananas — Organic', 'organic': True, ...}]
...
Final Answer: {"personalised_text": "You always buy organic...", ...}
```

### Step 5 — Start the LangChain MCP bridge (Terminal 1)

```bash
python bridge/langchain_mcp_bridge.py
```

Verify:
```bash
curl http://localhost:8767/health
# → {"status":"ok","service":"demothon26-langchain-bridge","port":"8767"}
```

Keep this terminal running.

### Step 6 — Start the PWA backend (Terminal 2)

```bash
python pwa/server.py
```

The PWA is now live at: http://localhost:3000
Stage dashboard at:     http://localhost:3000/dashboard

Open the stage dashboard in a full-screen browser on your presentation laptop.

Verify PWA loads:
```bash
open http://localhost:3000
```

### Step 7 — Deploy the SAM agent (Terminal 3)

```bash
cd ~/demothon26

# Save agent ID for later cleanup
AGENT_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
echo $AGENT_ID > sam-agent-id.txt

helm install sam-agent-$AGENT_ID \
  https://solaceproducts.github.io/solace-agent-mesh-helm-quickstart/sam-agent-1.1.0.tgz \
  --set agentId=$AGENT_ID \
  --set-file config.agentYaml=$HOME/demothon26/configs/agents/produce_scan_agent.yaml \
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

Check pod is running:
```bash
kubectl get pods | grep $AGENT_ID
# Should show: Running
```

Check logs to confirm MCP bridge connection:
```bash
kubectl logs $(kubectl get pods | grep $(cat sam-agent-id.txt | cut -c1-8) | awk '{print $1}') --tail=20
```

### Step 8 — End-to-end test (2 min)

```bash
# Quick test — scan banana as Anna
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"anna@email.com","password":"demo123"}' | python -m json.tool

# Copy the token from above, then:
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"token":"<paste-token-here>","plu":"4011"}'
```

Watch the MCP bridge terminal — you should see the LangChain ReAct loop running.
Watch the stage dashboard — result should appear within 4-5 seconds.

---

## On Stage — Demo Script

### Setup (night before)
1. Run all 5 steps above
2. Open stage dashboard fullscreen: http://localhost:3000/dashboard
3. On your phone: navigate to http://<your-laptop-ip>:3000
4. Test all three personas end to end
5. Print QR code for http://<your-laptop-ip>:3000 so audience can scan

### Demo flow (on stage)

**Step 1** — Show the stage dashboard (blank, "waiting for scan")
> "This is our real-time event dashboard. It's subscribed to the Solace
> event mesh. Nothing is polling. The moment something happens in-store,
> this screen reacts."

**Step 2** — Pick up your phone, open the PWA
> "This is the customer app — it's a PWA, no install needed, just a URL.
> I'm going to log in as Anna, one of our loyalty members."

Quick-login as Anna. Show the home screen briefly.
> "Anna's a Gold Circle member. You can see her recent purchases — she
> consistently buys organic produce. The app knows this."

**Step 3** — Tap Scan produce, hold phone over the banana QR/PLU
> "I'm in the produce aisle. I pick up a bunch of conventional bananas
> and scan the PLU code."

**Step 4** — Wait 3-5 seconds. Result appears on both screens.
> "Watch the dashboard."

Point at the big screen as the result fades in.
> "Same moment — Anna's phone and this screen. One event, two subscribers,
> zero polling. That's the Solace event mesh."

> "Now — SAM fetched the price, stock, and Anna's profile in parallel.
> That's the fast structured work. But this sentence —" (point at the
> personalised text) "— 'You always buy organic, the organic option is
> just 30 cents more' — that came from LangChain reading 10 weeks of
> purchase history and making an inference. No template. No rule. Just
> reasoning."

**Step 5** — Quick-login as James, scan same banana
> "Same banana. Different customer."

Show the result — freshness tip, no organic push.
> "James has never bought organic. LangChain saw that, gave him a
> freshness tip instead. Same pipeline, same event, completely different
> output."

---

## Cleanup

```bash
# Stop MCP bridge (Ctrl+C in Terminal 1)
# Stop PWA backend (Ctrl+C in Terminal 2)

# Remove SAM agent
helm uninstall sam-agent-$(cat sam-agent-id.txt)

# Drop demo tables (optional)
mysql -u root -p demo -e "DROP TABLE IF EXISTS purchase_history, products, customers;"
```

---

## Project Structure

```
demothon26/
├── .env.example          # Environment variables template
├── requirements.txt      # Python dependencies
├── agent/
│   ├── __init__.py
│   ├── agent.py          # LangChain ReAct agent (reasoning core)
│   └── tools/
│       ├── __init__.py
│       └── mysql_tools.py  # LangChain tools — DB queries
├── bridge/
│   └── langchain_mcp_bridge.py  # MCP SSE bridge (exposes LangChain to SAM)
├── configs/
│   └── agents/
│       └── produce_scan_agent.yaml  # SAM agent config
├── db/
│   └── seed.sql          # MySQL tables + demo data
├── pwa/
│   ├── server.py         # PWA backend (FastAPI, Solace pub/sub, SSE relay)
│   └── static/
│       ├── index.html    # PWA — 4-screen mobile app
│       └── manifest.json # PWA manifest (enables Add to Home Screen)
└── dashboard/
    └── index.html        # Stage dashboard — big screen display
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| MCP bridge not reached by SAM pod | Verify `host.minikube.internal:8767` resolves — run `minikube ssh 'curl http://host.minikube.internal:8767/health'` |
| LangChain agent hangs | Check LLM endpoint is reachable: `curl $OPENAI_API_BASE/models -H "Authorization: Bearer $OPENAI_API_KEY"` |
| MySQL connection refused | Confirm MySQL is running: `mysql -u root -p demo -e "SELECT 1"` |
| PWA camera not working | Serve over HTTPS or localhost only — camera API requires secure context |
| Result not appearing on dashboard | Check `store/result/>` subscription in PWA backend logs |
| SAM pod CrashLoopBackOff | Check logs: `kubectl logs <pod-name> --previous` — usually a YAML field name issue |
| No MCP calls in bridge terminal | Restart the SAM agent pod: `kubectl rollout restart deployment sam-agent-$(cat sam-agent-id.txt)` |
