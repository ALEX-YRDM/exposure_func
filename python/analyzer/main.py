"""JSON-RPC stdin/stdout server for the call chain analyzer."""
import sys
import json
import os
import traceback

_this_dir = os.path.dirname(os.path.abspath(__file__))
_python_dir = os.path.dirname(_this_dir)
vendor_dir = os.path.join(_python_dir, 'vendor')

if os.path.isdir(vendor_dir):
    sys.path.insert(0, vendor_dir)
sys.path.insert(0, _python_dir)

from analyzer.jedi_resolver import analyze, expand_node


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            req = json.loads(line)
        except json.JSONDecodeError as e:
            response = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": -32700, "message": f"Parse error: {e}"}
            }
            sys.stdout.write(json.dumps(response) + "\n")
            sys.stdout.flush()
            continue

        req_id = req.get("id")
        method = req.get("method", "")
        params = req.get("params", {})

        try:
            if method == "analyze":
                result = analyze(**params)
            elif method == "expand":
                result = expand_node(**params)
            elif method == "ping":
                result = {"status": "ok"}
            else:
                response = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {"code": -32601, "message": f"Unknown method: {method}"}
                }
                sys.stdout.write(json.dumps(response) + "\n")
                sys.stdout.flush()
                continue

            response = {"jsonrpc": "2.0", "id": req_id, "result": result}
        except Exception as e:
            response = {
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {"code": -32000, "message": str(e), "data": traceback.format_exc()}
            }

        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
