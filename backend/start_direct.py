import os
import sys
import traceback

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

print("STEP 1: Starting direct runner...", flush=True)

try:
    print("STEP 2: Importing main...", flush=True)
    import main
    print("STEP 3: Imported main successfully!", flush=True)
    print("STEP 4: Initializing uvicorn...", flush=True)
    import uvicorn
    uvicorn.run(main.app, host="127.0.0.1", port=8000, log_level="info")
except Exception as e:
    print("ERROR DURING STARTUP:", flush=True)
    traceback.print_exc()
    sys.exit(1)
