# API Discovery & Telemetry Side-Car (NGINX + NJS + Fluent Bit + Docker)

- **NGINX + NJS** — captures sampled API transactions and emits structured JSON logs to `stdout`.
- **Fluent Bit** — tails NGINX container logs, filters telemetry payloads, and forwards them to a mock telemetry collector (*Obelix*).
- **Obelix** — a simple Python/Flask app that receives and prints the telemetry payloads.

---

## 1. OVERVIEW

### Architecture

```
Client
  │
  ▼
NGINX (port 18082)
  │
  ├─► NJS builds telemetry JSON (LOG-PAYLOAD)
  │     └─ writes to stdout
  │
  ▼
Fluent Bit
  │
  └─► Filters for LOG-PAYLOAD lines
        └─► Forwards to Obelix (http://obelix:18093)
```

---

## 2. FILE STRUCTURE

```
docker-compose.yml
nginx/
 ├── nginx.conf          # Main NGINX configuration
 ├── api_discovery.js    # NJS logic (sampling, buffering, POSTing)
fluentbit/
 ├── fluent-bit.conf     # Input, filter, and output configuration
 ├── parsers.conf        # JSON parser definition for Docker logs
obelix/
 └── app.py              # Mock Telemetry Receiver (Flask)
```

---

## 3. HOW COMPONENTS WORKS

### 🔹 NGINX + NJS
- Handles `/public-api/` traffic (port 18082).
- NJS samples requests (via `$sample_rate`) and logs structured JSON:
- Logs are written to **stdout**:

### 🔹 Fluent Bit
- Tails Docker JSON log files for all containers (`/var/lib/docker/containers/*/*-json.log`).
- Parses them using the built-in Docker JSON parser.
- Filters to only include records whose `log` field contains `LOG-PAYLOAD`.
- Forwards those to Obelix via HTTP POST.


### 🔹 Obelix
A simple Python Flask app that prints everything it receives at
`/logs/third_party_application/access`.

---

## 4. RUNNING THE DEMO

```bash
docker-compose up --build
```

### Test the flow
```bash
curl http://localhost:18082/public-api/
```

Expected client response:
```json
{"message": "Hello from the backend!"}
```

Expected console output (in `obelix` logs):
```
----- Received telemetry @ 2025-10-27T03:04:26 -----
Headers: {'Content-Type': 'application/json', ...}
Body: {"req_headers": {...}, "rsp_status": 200, "url": "http://localhost:18082/public-api/"}
---------------------------------------------------
```

---

## 5. CONFIGURATION NOTES

- **Sampling:** set `$sample_rate` in `nginx.conf` to control request sampling.
- **HTTP only:** mTLS disabled for Docker simplicity.
- **Security:** no tokens or certificates are required locally.

---

## 6. CLEANUP

```bash
docker-compose down -v
```

---
