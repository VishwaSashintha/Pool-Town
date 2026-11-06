import multiprocessing
import os
import sys
import traceback

if sys.stdout is None:
    sys.stdout = open(os.devnull, "w", encoding="utf-8")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w", encoding="utf-8")

if __name__ == "__main__":
    multiprocessing.freeze_support()
    data_dir = os.environ.get("POOL_TOWN_DATA_DIR", "./data")
    os.makedirs(data_dir, exist_ok=True)
    log_path = os.path.join(data_dir, "server.log")

    try:
        with open(log_path, "a", encoding="utf-8") as log:
            log.write("Server starting...\n")
        import uvicorn
        from app.main import app
        host = os.environ.get("POOL_TOWN_HOST", "127.0.0.1")
        port = int(os.environ.get("POOL_TOWN_PORT", "8000"))
        with open(log_path, "a", encoding="utf-8") as log:
            log.write(f"Binding to {host}:{port}\n")
        uvicorn.run(app, host=host, port=port, log_level="warning", access_log=False)
    except Exception as e:
        with open(log_path, "a", encoding="utf-8") as log:
            log.write(f"Fatal error: {e}\n")
            traceback.print_exc(file=log)
        sys.exit(1)
