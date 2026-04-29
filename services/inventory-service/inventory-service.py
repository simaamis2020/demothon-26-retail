#!/usr/bin/env python3

from flask import Flask, request, jsonify
import pymysql
import json
import logging
from datetime import datetime
from contextlib import contextmanager

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database configuration
DB_CONFIG = {
    'host': 'host.minikube.internal',
    'port': 3306,
    'user': 'admin',
    'password': 'admin',
    'database': 'demo',
    'autocommit': True  # Force autocommit for all connections
}

@contextmanager
def get_db_connection():
    """Database connection with proper transaction handling"""
    conn = None
    try:
        conn = pymysql.connect(**DB_CONFIG)
        logger.info(f"Database connection established, autocommit: {conn.get_autocommit()}")
        yield conn
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Database error: {e}")
        raise
    finally:
        if conn:
            conn.close()

def extract_plu_from_customer_data(customer_data):
    """Extract PLU from customer preference data"""
    try:
        # Look for organic banana preference
        if "organic" in customer_data.get("personalised_text", "").lower() and \
           "banana" in customer_data.get("personalised_text", "").lower():
            return "94011"  # Organic bananas PLU
        
        # Default fallback - could be enhanced with more logic
        return "4011"  # Regular bananas PLU
    except:
        return "4011"

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            return {"status": "healthy", "database": "connected"}, 200
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}, 500

@app.route('/inventory/update', methods=['POST'])
def update_inventory():
    """Main inventory update endpoint"""
    try:
        data = request.get_json()
        logger.info(f"Processing inventory update: {data}")
        
        # Extract PLU from customer data
        customer_data = data.get('customer_data', {})
        plu = extract_plu_from_customer_data(customer_data)
        
        # Process inventory update
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Step 1: Get current stock
            cursor.execute("SELECT stock_level, name FROM products WHERE plu = %s", (plu,))
            result = cursor.fetchone()
            
            if not result:
                return {"error": f"Product with PLU {plu} not found"}, 404
            
            old_stock, product_name = result
            new_stock = old_stock - 1
            
            # Step 2: Update stock with explicit transaction
            cursor.execute("UPDATE products SET stock_level = %s WHERE plu = %s", 
                          (new_stock, plu))
            
            if cursor.rowcount != 1:
                raise Exception(f"Stock update failed for PLU {plu}")
                
            logger.info(f"Stock updated: PLU {plu}, {old_stock} → {new_stock}")
            
            # Step 3: Calculate inventory alert
            alert = new_stock <= 5
            
            # Step 4: Get organic trends
            cursor.execute("SELECT COUNT(*) FROM purchase_history WHERE organic=1")
            organic_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM purchase_history WHERE organic=0")  
            conventional_count = cursor.fetchone()[0]
            
            # Step 5: Determine scan type and update counts
            scan_type = "organic" if plu.startswith('9') else "conventional"
            
            if scan_type == "organic":
                new_organic_count = organic_count + 1
                new_conventional_count = conventional_count
            else:
                new_organic_count = organic_count
                new_conventional_count = conventional_count + 1
                
            total_scans = new_organic_count + new_conventional_count
            organic_percentage = (new_organic_count / total_scans * 100) if total_scans > 0 else 0
            
            # Step 6: Prepare response
            response = {
                "inventory": {
                    "alert": alert,
                    "plu": plu,
                    "product_name": product_name,
                    "old_stock": old_stock,
                    "new_stock": new_stock,
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                },
                "organic_trends": {
                    "organic_count": new_organic_count,
                    "conventional_count": new_conventional_count,
                    "total_scans": total_scans,
                    "organic_percentage": round(organic_percentage, 1),
                    "last_scan_type": scan_type,
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                }
            }
            
            logger.info(f"Inventory update successful: {response}")
            return response, 200
            
    except Exception as e:
        logger.error(f"Inventory update failed: {e}")
        return {"error": str(e)}, 500

@app.route('/inventory/status/<plu>', methods=['GET'])
def get_inventory_status(plu):
    """Get current inventory status for a PLU"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT plu, name, stock_level FROM products WHERE plu = %s", (plu,))
            result = cursor.fetchone()
            
            if not result:
                return {"error": f"Product with PLU {plu} not found"}, 404
                
            return {
                "plu": result[0],
                "name": result[1], 
                "stock_level": result[2],
                "alert": result[2] <= 5
            }, 200
            
    except Exception as e:
        logger.error(f"Status check failed: {e}")
        return {"error": str(e)}, 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
