from flask import Flask, request, jsonify
import sys, json
from datetime import datetime

app = Flask(__name__)

@app.route("/", methods=["GET"])
def hello():
    return jsonify({"message": "obelix alive", "time": datetime.utcnow().isoformat()})

@app.route("/logs/third_party_application/access", methods=["POST", "GET"])
def ingest():
    try:
        payload = request.get_json(force=False, silent=True)
    except Exception:
        payload = None

    print("----- Received telemetry @", datetime.utcnow().isoformat(), "-----", file=sys.stdout)
    print("Headers:", dict(request.headers), file=sys.stdout)
    print("Body:", request.get_data(as_text=True), file=sys.stdout)
    print("---------------------------------------------------", file=sys.stdout, flush=True)

    return jsonify({"status": "ok", "received_at": datetime.utcnow().isoformat()}), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=18093)
