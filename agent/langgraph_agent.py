"""
agent/langgraph_agent.py
LangGraph ReAct graph — drop-in replacement for the LangChain ReAct agent.

Uses LangGraph's prebuilt create_react_agent which produces a proper
StateGraph with a messages field in state. This lets the LangGraph dev
server expose it via the native A2A endpoint at /a2a/{assistant_id}.

Same tools, same LLM, same business logic as agent/agent.py.
Only the graph structure changes.
"""
import os
import json
from dotenv import load_dotenv
load_dotenv()

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.prebuilt import create_react_agent

from agent.tools.mysql_tools import (
    get_customer_profile,
    get_purchase_history,
    get_product_details,
    get_organic_alternative,
)

# ── LLM ───────────────────────────────────────────────────────────────────────
# model hardcoded — LiteLLM key only permits azure-* models on this Mac
llm = ChatOpenAI(
    model="azure-gpt-4o",
    base_url=os.getenv("OPENAI_API_BASE"),
    api_key=os.getenv("OPENAI_API_KEY"),
    temperature=0.2
)

# ── Tools ──────────────────────────────────────────────────────────────────────
tools = [
    get_customer_profile,
    get_purchase_history,
    get_product_details,
    get_organic_alternative,
]

# ── System prompt ──────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are a personalisation reasoning agent for a retail grocery app.
A customer has scanned a produce item in-store. Your job is to reason
about their purchase history and return a personalised result as JSON.

The user message will contain: customer_id, plu, and sam_context.
Extract these and use your tools to reason about the customer.

Your final response MUST be a valid JSON object with these exact keys:
  - personalised_text: string (1-2 sentences, personal and specific, NOT a template)
  - show_organic_alternative: boolean
  - organic_alternative: object or null — {plu, name, price_per_lb, aisle}
  - also_like: array of 3 objects — [{name, price}]
  - discount_applied: boolean
  - discount_pct: number
  - final_price_per_lb: number (price after discount, 2 decimal places)
  - loyalty_tier: string
  - points_if_purchased: number (assume 1 point per $0.10 spent on 1lb)

Rules for personalised_text:
- If customer has 3+ organic purchases in history: mention the pattern, surface the organic alternative warmly
- If customer is conventional with no organic history: give a freshness or usage tip instead
- If new customer with no history: welcome them and mention Circle membership benefit
- Never use the word "template". Sound like a knowledgeable produce staff member.

Return ONLY the JSON object, no markdown fences, no explanation."""

# ── LangGraph ReAct graph ──────────────────────────────────────────────────────
# create_react_agent from langgraph.prebuilt builds a StateGraph with:
#   - MessagesState (has 'messages' field — required by LangGraph A2A server)
#   - tool-calling loop
#   - system prompt injected via prompt parameter
graph = create_react_agent(
    model=llm,
    tools=tools,
    prompt=SYSTEM_PROMPT,
)

# ── Local test helper ──────────────────────────────────────────────────────────
def run_local(customer_id: str, plu: str, sam_context: str = "") -> dict:
    """
    Test the graph locally without the LangGraph server.
    Equivalent to reason_and_personalise() in agent.py.
    """
    user_message = (
        f"customer_id={customer_id} plu={plu} sam_context={sam_context}"
    )
    result = graph.invoke({
        "messages": [HumanMessage(content=user_message)]
    })

    # Last message from the graph is the final answer
    last_message = result["messages"][-1]
    raw = last_message.content

    # Strip markdown fences if LLM wraps output
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {
            "personalised_text": raw,
            "show_organic_alternative": False,
            "organic_alternative": None,
            "also_like": [],
            "discount_applied": False,
            "discount_pct": 0,
            "final_price_per_lb": 0,
            "loyalty_tier": "Unknown",
            "points_if_purchased": 0
        }


if __name__ == "__main__":
    result = run_local("C001", "4011")
    print(json.dumps(result, indent=2))
