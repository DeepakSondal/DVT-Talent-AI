"""
DVT Talent AI — Services Package
"""
import sys

if "services" in sys.modules and "backend.services" not in sys.modules:
    sys.modules["backend.services"] = sys.modules["services"]
elif "backend.services" in sys.modules and "services" not in sys.modules:
    sys.modules["services"] = sys.modules["backend.services"]

