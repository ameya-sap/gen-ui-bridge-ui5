import json
import os

PRODUCTS_FILE = os.path.join(os.path.dirname(__file__), "../webapp/model/products.json")

def get_product_info(product_name_query: str):
    """
    Searches for a product by name and returns its details.
    """
    try:
        with open(PRODUCTS_FILE, "r") as f:
            data = json.load(f)
            products = data.get("Products", [])
            
        # Simple case-insensitive search
        query = product_name_query.lower()
        results = [p for p in products if query in p.get("ProductName", "").lower()]
        
        if not results:
            return {"error": "Product not found"}
            
        return results[0] # Return the first match
    except Exception as e:
        return {"error": str(e)}
