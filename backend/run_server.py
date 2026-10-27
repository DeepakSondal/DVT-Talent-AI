import os
import sys

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.environ["PYTHONPATH"] = f"{backend_dir};."

import main
import uvicorn

if __name__ == "__main__":
    print("STARTING_UVICORN_NOW", flush=True)
    uvicorn.run(main.app, host="127.0.0.1", port=8000, reload=False)

