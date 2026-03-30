"""
agent/tools/mysql_tools.py
MySQL tools used by the LangChain agent.
"""

import subprocess
from langchain.tools import tool


# ── Input cleaning ─────────────────────────────────────────────

def _clean(value: str) -> str:
    """Remove quotes, whitespace, and labels from tool input."""
    if value is None:
        return ""

    v = str(value).strip()

    # Remove common LLM formatting mistakes
    v = v.replace('"', "").replace("'", "")
    v = v.replace("Customer ID:", "").replace("PLU:", "")
    v = v.strip()

    return v


# ── MySQL query helper ─────────────────────────────────────────

def _query(sql):
    """Run a query via mysql CLI."""
    cmd = [
        '/usr/local/mysql/bin/mysql',
        '-u', 'admin',
        '-padmin',
        'demo',
        '--batch',
        '--skip-column-names',
        '-e', sql
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print("MYSQL ERROR:", result.stderr)
        return []

    lines = [l for l in result.stdout.strip().split('\n') if l]
    return lines


# ── Tools ─────────────────────────────────────────────────────

@tool
def get_customer_profile(customer_id: str) -> str:
    """Fetch customer profile."""
    customer_id = _clean(customer_id)

    print("DEBUG cleaned customer_id =", repr(customer_id))

    rows = _query(
        f"SELECT name, loyalty_tier, points, discount_pct "
        f"FROM customers WHERE customer_id = '{customer_id}'"
    )

    print("DEBUG rows =", rows)

    if not rows:
        return "Customer not found"

    parts = rows[0].split("\t")

    return str({
        "name": parts[0],
        "loyalty_tier": parts[1],
        "points": parts[2],
        "discount_pct": parts[3]
    })


@tool
def get_purchase_history(customer_id: str) -> str:
    """Fetch last 12 produce purchases."""
    customer_id = _clean(customer_id)

    rows = _query(
        f"SELECT product_name, organic, purchased_at "
        f"FROM purchase_history "
        f"WHERE customer_id = '{customer_id}' "
        f"ORDER BY purchased_at DESC LIMIT 12"
    )

    if not rows:
        return "No purchase history — new customer"

    result = []

    for r in rows:
        parts = r.split("\t")
        result.append({
            "product_name": parts[0],
            "organic": parts[1] == "1",
            "purchased_at": parts[2]
        })

    return str(result)


@tool
def get_product_details(plu: str) -> str:
    """Fetch product details by PLU."""
    plu = _clean(plu)

    print("DEBUG cleaned plu =", repr(plu))

    rows = _query(
        f"SELECT name, category, price_per_lb, organic, stock_store, aisle "
        f"FROM products WHERE plu = '{plu}'"
    )

    print("DEBUG rows =", rows)

    if not rows:
        return f"Product PLU {plu} not found"

    parts = rows[0].split("\t")

    return str({
        "name": parts[0],
        "category": parts[1],
        "price_per_lb": parts[2],
        "organic": parts[3] == "1",
        "stock_store": parts[4],
        "aisle": parts[5]
    })


@tool
def get_organic_alternative(conventional_plu: str) -> str:
    """Return organic alternative if available."""
    conventional_plu = _clean(conventional_plu)

    rows = _query(
        f"SELECT plu, name, price_per_lb, stock_store, aisle "
        f"FROM products "
        f"WHERE conventional_plu = '{conventional_plu}' "
        f"AND organic = 1 AND stock_store > 0"
    )

    if not rows:
        return "No organic alternative in stock"

    parts = rows[0].split("\t")

    return str({
        "plu": parts[0],
        "name": parts[1],
        "price_per_lb": parts[2],
        "stock_store": parts[3],
        "aisle": parts[4]
    })