"""
bridge/langchain_a2a_server.py
Exposes the LangChain reasoning agent as an A2A-compliant agent.
The A2A proxy in Minikube discovers this and registers it with SAM.

Start: python3.11 bridge/langchain_a2a_server.py
"""
import os
import sys
import json
import uvicorn

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.expanduser("~/demothon26/.env"))

from a2a.server.apps import A2AStarletteApplication
from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.events import EventQueue
from a2a.types import (
    AgentCard, AgentCapabilities, AgentSkill,
    TaskStatusUpdateEvent, TaskStatus, TaskState,
    Message, TextPart, Role, Task
)
from a2a.utils import new_agent_text_message, new_task

from agent.agent import reason_and_personalise

HOST = os.getenv("A2A_HOST", "0.0.0.0")
PORT = int(os.getenv("A2A_PORT", 10001))
AGENT_URL = os.getenv("AGENT_URL", f"http://host.minikube.internal:{PORT}")


def get_agent_card() -> AgentCard:
    return AgentCard(
        name="LangChainPersonalisationAgent",
        description=(
            "Personalisation reasoning agent for retail produce scanning. "
            "Given a customer_id, PLU code, and SAM context, reasons over "
            "purchase history to return personalised recommendations including "
            "organic alternatives, loyalty discounts, and you-might-also-like items."
        ),
        url=AGENT_URL,
        version="1.0.0",
        defaultInputModes=["text"],
        defaultOutputModes=["text"],
        capabilities=AgentCapabilities(
            streaming=False,
            push_notifications=False,
        ),
        skills=[
            AgentSkill(
                id="personalise_produce_scan",
                name="Personalise Produce Scan",
                description="Takes customer_id, plu, and sam_context. Returns personalised product recommendation as JSON.",
                tags=["personalisation", "produce", "retail"],
                examples=[
                    "customer_id=C001 plu=4011 sam_context=Customer: Anna, Gold, 18% discount. Product: Bananas $0.79/lb. History: 10 organic purchases."
                ]
            )
        ]
    )


class LangChainAgentExecutor(AgentExecutor):
    """Bridges the A2A protocol to the LangChain ReAct agent."""

    async def execute(self, context: RequestContext, event_queue: EventQueue):
        query = context.get_user_input()
        task = context.current_task or new_task(context.message)

        if not context.current_task:
            await event_queue.enqueue_event(task)

        # Parse customer_id, plu, sam_context from the query
        # Query format from SAM gateway instruction:
        # "Customer C001 scanned product PLU 4011. customer_id=C001 plu=4011"
        customer_id = ""
        plu = ""
        sam_context = ""

        for part in query.split():
            if part.startswith("customer_id="):
                customer_id = part.split("=", 1)[1]
            elif part.startswith("plu="):
                plu = part.split("=", 1)[1]

        # sam_context is everything after "sam_context="
        if "sam_context=" in query:
            sam_context = query.split("sam_context=", 1)[1].strip()

        # Fallback: try to extract from topic-style message
        if not customer_id or not plu:
            import re
            cid = re.search(r'customer[_\s]id[=:\s]+([A-Z0-9]+)', query, re.IGNORECASE)
            p = re.search(r'plu[=:\s]+([0-9]+)', query, re.IGNORECASE)
            if cid:
                customer_id = cid.group(1)
            if p:
                plu = p.group(1)

        print(f"[LangChain A2A] customer_id={customer_id} plu={plu}")
        print(f"[LangChain A2A] sam_context={sam_context[:100]}...")

        try:
            result = reason_and_personalise(customer_id, plu, sam_context)
            result["customer_id"] = customer_id
            final_text = json.dumps(result)
            final_state = TaskState.completed
        except Exception as e:
            print(f"[LangChain A2A] Error: {e}")
            final_text = json.dumps({"error": str(e), "customer_id": customer_id})
            final_state = TaskState.failed

        await event_queue.enqueue_event(
            TaskStatusUpdateEvent(
                status=TaskStatus(
                    state=final_state,
                    message=new_agent_text_message(
                        final_text,
                        task.context_id,
                        task.id
                    ),
                ),
                final=True,
                context_id=task.context_id,
                task_id=task.id,
            )
        )

    async def cancel(self, context: RequestContext, event_queue: EventQueue):
        pass


if __name__ == "__main__":
    print(f"Starting LangChain A2A server on {HOST}:{PORT}")
    print(f"Agent URL (from Minikube): {AGENT_URL}")
    print(f"Agent card: http://localhost:{PORT}/.well-known/agent.json")

    executor = LangChainAgentExecutor()
    app = A2AStarletteApplication(
        agent_card=get_agent_card(),
        http_handler=executor,
    ).build()

    uvicorn.run(app, host=HOST, port=PORT)
