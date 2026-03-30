"""
agent/agent.py
LangChain ReAct agent — reasoning specialist for Demothon-26.
Called by the MCP bridge when SAM delegates the personalisation step.
"""
import os
import json
from dotenv import load_dotenv
load_dotenv()

from langchain_openai import ChatOpenAI
from langchain.agents import create_react_agent, AgentExecutor
from langchain_core.prompts import PromptTemplate
from agent.tools.mysql_tools import (
    get_customer_profile,
    get_purchase_history,
    get_product_details,
    get_organic_alternative,
)

# ── LLM ──────────────────────────────────────────────────────────────────────
llm = ChatOpenAI(
    model="azure-gpt-4o",
    base_url=os.getenv("OPENAI_API_BASE"),
    api_key=os.getenv("OPENAI_API_KEY"),
    temperature=0.2
)

# ── Tools ─────────────────────────────────────────────────────────────────────
tools = [
    get_customer_profile,
    get_purchase_history,
    get_product_details,
    get_organic_alternative,
]

# ── ReAct prompt ──────────────────────────────────────────────────────────────
REACT_PROMPT = PromptTemplate.from_template("""
You are a personalisation reasoning agent for a retail grocery app.
A customer has scanned a produce item in-store. Your job is to reason
about their purchase history and return a personalised result as JSON.

You have access to the following tools:
{tools}

Use this format strictly:
Thought: think about what to do
Action: tool name (one of [{tool_names}])
Action Input: the input to the tool
Observation: the tool result
... (repeat Thought/Action/Action Input/Observation as needed)
Thought: I now have enough information to produce the final answer
Final Answer: a valid JSON object with these exact keys:
  - personalised_text: string (1-2 sentences, personal and specific, NOT a template)
  - show_organic_alternative: boolean
  - organic_alternative: object or null — {{plu, name, price_per_lb, aisle}}
  - also_like: array of 3 objects — [{{name, price}}]
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

Begin!

Customer ID: {customer_id}
Scanned PLU: {plu}
Context from SAM: {sam_context}

{agent_scratchpad}
""")

# ── Agent executor ────────────────────────────────────────────────────────────
agent = create_react_agent(llm=llm, tools=tools, prompt=REACT_PROMPT)

agent_executor = AgentExecutor(
    agent=agent,
    tools=tools,
    verbose=True,
    handle_parsing_errors=True,
    max_iterations=10,
    return_intermediate_steps=False
)


def reason_and_personalise(customer_id: str, plu: str, sam_context: str = "") -> dict:
    """
    Entry point called by the MCP bridge.
    Returns a structured dict ready to publish to Solace.
    """
    result = agent_executor.invoke({
        "customer_id": customer_id,
        "plu": plu,
        "sam_context": sam_context,
    })

    raw = result.get("output", "{}")

    # Strip markdown code fences if LLM wraps output
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Fallback — return raw text wrapped in a safe structure
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
    # Quick local test — run: python -m agent.agent
    result = reason_and_personalise("C001", "4011")
    import json as j
    print(j.dumps(result, indent=2))
