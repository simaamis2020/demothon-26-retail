#!/usr/bin/env python3
"""
bridge/langchain_mcp_bridge.py
MCP SSE bridge — exposes the LangChain personalisation agent as an MCP tool.
Uses the same HTTPServer pattern as the working Hawkeye bridge.
Runs on port 8767.
"""
import json
import uuid
import queue
import threading
import os
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from socketserver import ThreadingMixIn

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()

from agent.agent import reason_and_personalise

PORT = int(os.environ.get("BRIDGE_PORT", "8767"))

sessions = {}

TOOLS_LIST = [
    {
        "name": "personalise_product_scan",
        "description": (
            "Reasons over a customer's produce purchase history and returns "
            "a personalised recommendation including organic alternatives, "
            "pricing with loyalty discount, and you-might-also-like items. "
            "Pass customer_id, plu (product PLU code), and optional sam_context."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "customer_id": {"type": "string", "description": "Customer ID e.g. C001"},
                "plu": {"type": "string", "description": "PLU code of scanned product e.g. 4011"},
                "sam_context": {"type": "string", "description": "Optional context pre-fetched by SAM agent"},
            },
            "required": ["customer_id", "plu"],
        },
    }
]


def handle_jsonrpc(req):
    method = req.get("method", "")
    req_id = req.get("id")

    if method == "initialize":
        return {
            "jsonrpc": "2.0", "id": req_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "langchain-mcp-bridge", "version": "1.0.0"},
            },
        }
    elif method == "tools/list":
        return {"jsonrpc": "2.0", "id": req_id, "result": {"tools": TOOLS_LIST}}
    elif method == "tools/call":
        params = req.get("params", {})
        tool_name = params.get("name")
        args = params.get("arguments", {})
        if tool_name == "personalise_product_scan":
            try:
                result = reason_and_personalise(
                    customer_id=args.get("customer_id", ""),
                    plu=args.get("plu", ""),
                    sam_context=args.get("sam_context", ""),
                )
                return {
                    "jsonrpc": "2.0", "id": req_id,
                    "result": {"content": [{"type": "text", "text": json.dumps(result)}]},
                }
            except Exception as e:
                return {
                    "jsonrpc": "2.0", "id": req_id,
                    "error": {"code": -32000, "message": str(e)},
                }
        else:
            return {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": "Tool not found"}}
    else:
        return {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": f"Unknown method: {method}"}}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, format, *args):
        print(f"[{self.command}] {self.path}")

    def do_GET(self):
        if self.path.startswith("/sse"):
            self.handle_sse()
        elif self.path == "/health":
            body = json.dumps({"status": "ok"}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_error(404)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/messages":
            self.handle_messages()
        else:
            self.send_error(404)

    def handle_sse(self):
        session_id = str(uuid.uuid4()).replace("-", "")
        sessions[session_id] = {"responses": queue.Queue()}

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        endpoint = f"/messages?session_id={session_id}"
        self.wfile.write(f"event: endpoint\ndata: {endpoint}\n\n".encode())
        self.wfile.flush()
        print(f"✓ SSE session: {session_id}")

        try:
            while True:
                try:
                    response = sessions[session_id]["responses"].get(timeout=1)
                    event_data = json.dumps(response)
                    self.wfile.write(f"event: message\ndata: {event_data}\n\n".encode())
                    self.wfile.flush()
                except queue.Empty:
                    self.wfile.write(": ping\n\n".encode())
                    self.wfile.flush()
        except Exception as e:
            print(f"✗ SSE closed: {e}")
        finally:
            sessions.pop(session_id, None)

    def handle_messages(self):
        parsed = urlparse(self.path)
        query_params = parse_qs(parsed.query)
        session_id = query_params.get("session_id", [""])[0]

        if not session_id or session_id not in sessions:
            self.send_error(400, "Invalid session")
            return

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode()

        try:
            req = json.loads(body)
            print(f"→ MCP Request: {req.get('method')} (id={req.get('id')})")

            response = handle_jsonrpc(req)
            # Don't send response for notifications (no id)
            if response and req.get("id") is not None:
                sessions[session_id]["responses"].put(response)

            self.send_response(202)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", "0")
            self.end_headers()
            print(f"✓ Handled: {req.get('method')}")

        except Exception as e:
            print(f"✗ Error: {e}")
            import traceback; traceback.print_exc()
            self.send_error(500)


class ThreadedServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True


if __name__ == "__main__":
    server = ThreadedServer(("0.0.0.0", PORT), Handler)
    print(f"\nDemothon-26 LangChain MCP Bridge")
    print(f"SSE endpoint: http://localhost:{PORT}/sse")
    print(f"Health check: http://localhost:{PORT}/health")
    print(f"SAM URL:      http://host.minikube.internal:{PORT}/sse\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()
