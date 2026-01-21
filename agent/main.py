import os
import json
import logging
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from google.adk import Agent
from ag_ui_adk import add_adk_fastapi_endpoint
from tools import get_product_info

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging Middleware to see requests
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Start Request: {request.method} {request.url}")
    try:
        if request.url.path == "/api/copilotkit":
             body = await request.body()
             logger.info(f"Request Body: {body.decode()}")
    except Exception as e:
        logger.error(f"Error reading body: {e}")
    
    response = await call_next(request)
    logger.info(f"Response Status: {response.status_code}")
    return response

# Define System Prompt with A2UI Specs
SYSTEM_PROMPT = """
You are a helpful inventory assistant for 'StockTrack'.
You have access to product inventory data.

**A2UI Rendering Rules:**
When the user asks for product details or status, you must NOT just reply with text.
You MUST return a JSON object strictly following this A2UI format to render UI components:

1. **Product Card** (For general details):
```json
{
  "type": "render",
  "component": "ProductCard",
  "props": {
    "title": "ProductName",
    "description": "Category: ... | Price: ...",
    "stockStatus": "Success" | "Warning" | "Error",
    "price": "99.99 EUR"
  }
}
```

2. **Product Alert** (For warnings/errors like Out of Stock or Low Stock):
```json
{
  "type": "render",
  "component": "ProductAlert",
  "props": {
    "level": "Warning" | "Error" | "Success",
    "text": "Detailed alert message here"
  }
}
```

If you use a tool to look up a product, use the result to populate these components.
Always prefer sending a UI component over plain text for product queries.
"""

from ag_ui_adk.adk_agent import ADKAgent

# Create the Google ADK Agent
adk_agent = Agent(
    name="stocktrack_agent",
    model="gemini-2.5-flash",
    instruction=SYSTEM_PROMPT,
    tools=[get_product_info]
)

# Wrap it with AG-UI ADK Agent
# This adapter handles the AG-UI protocol and session management
ag_ui_agent = ADKAgent(
    adk_agent=adk_agent,
    app_name="stocktrack"
)

# Integrate with AG-UI
# This adds the /api/copilotkit endpoint
add_adk_fastapi_endpoint(app, ag_ui_agent, "/api/copilotkit")

if __name__ == "__main__":
    import uvicorn
    # Use 127.0.0.1 to match frontend fetch
    uvicorn.run(app, host="127.0.0.1", port=8001)
