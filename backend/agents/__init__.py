"""
DVT Talent AI — Swarm Agents Package
Exports all core recruiter agents and orchestrator with cross-environment path and module resolution.
"""
import os
import sys

# Automatically ensure backend and repository root are on sys.path
_current_dir = os.path.dirname(os.path.abspath(__file__))
_backend_dir = os.path.dirname(_current_dir)
_root_dir = os.path.dirname(_backend_dir)

for _path in (_backend_dir, _root_dir):
    if _path not in sys.path:
        sys.path.insert(0, _path)

def sync_agent_submodule(module_name: str):
    """Ensures module_name exists under both 'agents.*' and 'backend.agents.*'."""
    if module_name.startswith("backend.agents."):
        short_name = module_name.replace("backend.agents.", "agents.")
        if module_name in sys.modules:
            sys.modules[short_name] = sys.modules[module_name]
    elif module_name.startswith("agents."):
        full_name = "backend." + module_name
        if module_name in sys.modules:
            sys.modules[full_name] = sys.modules[module_name]

def _sync_agent_namespaces():
    """Synchronize module entries so 'agents.*' and 'backend.agents.*' point to identical module objects."""
    if "agents" in sys.modules and "backend.agents" not in sys.modules:
        sys.modules["backend.agents"] = sys.modules["agents"]
    elif "backend.agents" in sys.modules and "agents" not in sys.modules:
        sys.modules["agents"] = sys.modules["backend.agents"]

    submodules = (
        "pydantic_config",
        "discovery_pydantic",
        "sourcing_pydantic",
        "outreach_pydantic",
        "screening_pydantic",
        "critic_pydantic",
        "analytics_pydantic",
        "swarm_memory",
        "orchestrator",
    )
    for name in submodules:
        short_k = f"agents.{name}"
        full_k = f"backend.agents.{name}"
        if short_k in sys.modules and full_k not in sys.modules:
            sys.modules[full_k] = sys.modules[short_k]
        elif full_k in sys.modules and short_k not in sys.modules:
            sys.modules[short_k] = sys.modules[full_k]

_sync_agent_namespaces()
