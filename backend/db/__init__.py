"""
DVT Talent AI — Database Package
"""
import sys

if "db" in sys.modules and "backend.db" not in sys.modules:
    sys.modules["backend.db"] = sys.modules["db"]
elif "backend.db" in sys.modules and "db" not in sys.modules:
    sys.modules["db"] = sys.modules["backend.db"]

