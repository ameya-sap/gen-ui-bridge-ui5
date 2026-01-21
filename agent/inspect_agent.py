import google.adk
from google.adk import Agent
import inspect

print("Agent signature:", inspect.signature(Agent))
print("Agent doc:", Agent.__doc__)
