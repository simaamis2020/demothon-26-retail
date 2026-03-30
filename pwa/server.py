"""
pwa/server.py
PWA backend — handles:
  1. Customer login (returns session token)
  2. Product scan → publishes event to Solace
  3. SSE relay — subscribes to Solace result topic and streams to browser

Start: python pwa/server.py
"""
import os
import sys
import json
import time
import asyncio
import threading
import queue
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import mysql.connector

# Solace Python API
from solace.messaging.messaging_service import MessagingService
from solace.messaging.resources.topic import Topic
from solace.messaging.resources.topic_subscription import TopicSubscription
from solace.messaging.receiver.message_receiver import MessageHandler

app = FastAPI(title="Demothon-26 PWA Backend")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Result queues per customer (for SSE relay) ────────────────────────────────
result_queues: dict[str, queue.Queue] = {}

# ── Solace setup ──────────────────────────────────────────────────────────────
SOLACE_PROPS = {
    "solace.messaging.transport.host": os.getenv("SOLACE_HOST"),
    "solace.messaging.service.vpn-name": os.getenv("SOLACE_VPN"),
    "solace.messaging.authentication.scheme.basic.username": os.getenv("SOLACE_USERNAME"),
    "solace.messaging.authentication.scheme.basic.password": os.getenv("SOLACE_PASSWORD"),

    # TEMP ONLY for local debugging/demo if needed
    "solace.messaging.tls.cert-validated": False,
    "solace.messaging.tls.cert-validated-date": False,
    
}
trust_store = os.getenv("SOLACE_TRUST_STORE")
if trust_store:
    SOLACE_PROPS["solace.messaging.tls.trust-store-path"] = trust_store
print("SOLACE_HOST =", os.getenv("SOLACE_HOST"))
print("SOLACE_VPN =", os.getenv("SOLACE_VPN"))
print("SOLACE_USERNAME =", os.getenv("SOLACE_USERNAME"))
print("SOLACE_TRUST_STORE =", os.getenv("SOLACE_TRUST_STORE"))
print("SOLACE_PROPS =", SOLACE_PROPS)
messaging_service = MessagingService.builder().from_properties(SOLACE_PROPS).build()
messaging_service.connect()

publisher = messaging_service.create_direct_message_publisher_builder().build()
publisher.start()

# ── Subscribe to store/result/> and fan out to per-customer queues ────────────
class ResultHandler(MessageHandler):
    def on_message(self, message):
        topic = str(message.get_destination_name())
        # topic format: store/result/{customer_id}
        parts = topic.split("/")
        if len(parts) >= 3:
            customer_id = parts[2]
            payload = message.get_payload_as_string() or message.get_payload_as_bytes().decode("utf-8", errors="replace")
            print(f"RESULT ARRIVED for {customer_id}: {payload[:200]}")
            # Unwrap double-encoded JSON and strip markdown
            import json, re
            try:
                parsed = json.loads(payload)
                if isinstance(parsed, str):
                    payload = parsed
            except Exception:
                pass
            payload = re.sub(r'^```json\s*', '', payload.strip())
            payload = re.sub(r'^```\s*', '', payload.strip())
            payload = re.sub(r'\s*```$', '', payload.strip())
            print(f"CLEANED PAYLOAD: {payload[:100]}")
            if customer_id in result_queues:
                # Ensure single-line JSON for SSE
                try:
                    payload = json.dumps(json.loads(payload.strip()))
                except Exception:
                    payload = payload.strip().replace("\n", " ")
                result_queues[customer_id].put(payload)

receiver = (
    messaging_service.create_direct_message_receiver_builder()
    .with_subscriptions([TopicSubscription.of("store/result/>")])
    .build()
)
receiver.start()
receiver.receive_async(ResultHandler())

# ── MySQL helper ──────────────────────────────────────────────────────────────
def db():
    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        port=int(os.getenv("MYSQL_PORT", 3306)),
        database=os.getenv("MYSQL_DB", "demo"),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", "")
    )

# ── Simple in-memory session store (demo only) ────────────────────────────────
sessions: dict[str, dict] = {}

# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/api/login")
async def login(request: Request):
    body = await request.json()
    email = body.get("email", "").lower()
    password = body.get("password", "")

    conn = db()
    cur = conn.cursor(dictionary=True)
    cur.execute(
        "SELECT customer_id, name, loyalty_tier, points, discount_pct "
        "FROM customers WHERE email = %s AND password_hash = %s",
        (email, password)
    )
    customer = cur.fetchone()

    # Fetch recent purchases for home screen
    if customer:
        cur.execute(
            "SELECT product_name, organic, purchased_at "
            "FROM purchase_history WHERE customer_id = %s "
            "ORDER BY purchased_at DESC LIMIT 5",
            (customer["customer_id"],)
        )
        customer["recent_purchases"] = cur.fetchall()
        # Convert dates to strings
        for p in customer["recent_purchases"]:
            p["purchased_at"] = str(p["purchased_at"])

    conn.close()

    if not customer:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = f"tok_{customer['customer_id']}_{int(time.time())}"
    sessions[token] = customer

    return {"token": token, "customer": customer}


@app.post("/api/scan")
async def scan(request: Request):
    """Called by PWA when customer scans a barcode."""
    body = await request.json()
    token = body.get("token", "")
    plu = body.get("plu", "")

    customer = sessions.get(token)
    if not customer:
        raise HTTPException(status_code=401, detail="Not logged in")

    customer_id = customer["customer_id"]

    # Ensure a queue exists for this customer
    if customer_id not in result_queues:
        result_queues[customer_id] = queue.Queue()
    else:
        # Clear any old results
        while not result_queues[customer_id].empty():
            result_queues[customer_id].get_nowait()

    # Publish scan event to Solace
    payload = json.dumps({"customer_id": customer_id, "plu": plu})
    topic = f"store/scan/{customer_id}/{plu}"
    msg = messaging_service.message_builder().build(payload)
    publisher.publish(msg, Topic.of(topic))

    return {"status": "published", "topic": topic}


@app.get("/api/result/stream")
async def result_stream(token: str, request: Request):
    """SSE endpoint — browser subscribes here to receive the result."""
    customer = sessions.get(token)
    if not customer:
        raise HTTPException(status_code=401, detail="Not logged in")

    customer_id = customer["customer_id"]
    if customer_id not in result_queues:
        result_queues[customer_id] = queue.Queue()

    async def event_generator():
        yield "data: {\"status\": \"waiting\"}\n\n"
        timeout = 120  # seconds
        start = time.time()
        while time.time() - start < timeout:
            if await request.is_disconnected():
                break
            try:
                result = result_queues[customer_id].get_nowait()
                yield f"data: {result}\n\n"
                break
            except queue.Empty:
                await asyncio.sleep(0.3)
        yield "data: {\"status\": \"timeout\"}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/api/dashboard/stream")
async def dashboard_stream(request: Request):
    """SSE endpoint for the stage dashboard — receives all scan results."""
    dashboard_queue = queue.Queue()

    class DashboardHandler(MessageHandler):
        def on_message(self, message):
            payload = message.get_payload_as_string() or message.get_payload_as_bytes().decode("utf-8", errors="replace")
            import json, re
            try:
                parsed = json.loads(payload)
                if isinstance(parsed, str):
                    payload = parsed
            except Exception:
                pass
            payload = re.sub(r'^```json\s*', '', payload.strip())
            payload = re.sub(r'^```\s*', '', payload.strip())
            payload = re.sub(r'\s*```$', '', payload.strip())
            try:
                payload = json.dumps(json.loads(payload.strip()))
            except Exception:
                pass
            dashboard_queue.put(payload)

    dash_receiver = (
        messaging_service.create_direct_message_receiver_builder()
        .with_subscriptions([TopicSubscription.of("store/result/>")])
        .build()
    )
    dash_receiver.start()
    dash_receiver.receive_async(DashboardHandler())

    async def event_generator():
        yield "data: {\"status\": \"waiting\"}\n\n"
        while not await request.is_disconnected():
            try:
                result = dashboard_queue.get_nowait()
                yield f"data: {result}\n\n"
            except queue.Empty:
                await asyncio.sleep(0.3)
        dash_receiver.terminate()

    return StreamingResponse(event_generator(), media_type="text/event-stream")


app.mount("/", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static"), html=True), name="static")

if __name__ == "__main__":
    port = int(os.getenv("PWA_BACKEND_PORT", 3000))
    print(f"Demothon-26 PWA backend running at http://localhost:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
