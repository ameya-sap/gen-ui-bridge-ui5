from main import app
import json

# Initialize the OpenAPI schema
schema = app.openapi()

# Extract the components schemas
components = schema.get('components', {}).get('schemas', {})
run_agent_input = components.get('RunAgentInput', {})
print(json.dumps(run_agent_input, indent=2))
