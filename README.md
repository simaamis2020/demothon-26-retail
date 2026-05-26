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



| Email | Password | ID | Tier | Discount |
|-------|----------|----|------|----------|
| anna@email.com | demo123 | C001 | Gold | 18% |
| james@email.com | demo123 | C002 | Silver | 11% |
| maya@email.com | demo123 | C003 | New | 0% |
