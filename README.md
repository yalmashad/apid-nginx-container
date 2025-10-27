# API Discovery & Telemetry Side-Car (NGINX + NJS + Fluent Bit + Docker)

This setup demonstrates an **API discovery and telemetry pipeline** built around:
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

In this version:
- NGINX no longer writes logs to files inside the container.
- All telemetry JSON is written to **stdout** (`/dev/stdout` / `stderr`).
- Fluent Bit runs as a sidecar to **collect, filter, and ship logs**.
- Obelix simply receives and prints them to confirm end-to-end flow.

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

## 3. HOW EACH COMPONENT WORKS

### 🔹 NGINX + NJS
- Handles `/public-api/` traffic (port 18082).
- NJS samples requests (via `$sample_rate`) and logs structured JSON:
  ```json
  {"req_headers": {...}, "rsp_status":200, "url":"http://localhost:18082/public-api/", ...}
  ```
- Logs are written to **stdout**:
  ```nginx
  access_log /dev/stdout;
  error_log  /dev/stderr info;
  ```

### 🔹 Fluent Bit
- Tails Docker JSON log files for all containers (`/var/lib/docker/containers/*/*-json.log`).
- Parses them using the built-in Docker JSON parser.
- Filters to only include records whose `log` field contains `LOG-PAYLOAD`.
- Forwards those to Obelix via HTTP POST.

Excerpt from `fluent-bit.conf`:
```ini
[INPUT]
    Name              tail
    Path              /var/lib/docker/containers/*/*-json.log
    Parser            docker
    Tag               nginx.*
    DB                /fluent-bit/logs.db
    Refresh_Interval  5
    Skip_Long_Lines   On

[FILTER]
    Name    grep
    Match   nginx.*
    Regex   log ^.*LOG-PAYLOAD.*$

[OUTPUT]
    Name   http
    Match  nginx.*
    Host   obelix
    Port   18093
    URI    /logs/third_party_application/access
    Format json
```

### 🔹 Obelix
A simple Python Flask app that prints everything it receives at
`/logs/third_party_application/access`.

---

## 4. RUNNING THE DOCKER DEMO

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

## 5. DOCKER COMPOSE SUMMARY

`docker-compose.yml` defines three services on the shared bridge network `tele-net`:

| Service    | Purpose                        | Ports                   |
|-------------|--------------------------------|--------------------------|
| **nginx**   | API proxy & telemetry tap      | 18082 → public, 8000 internal |
| **obelix**  | Mock telemetry receiver (Flask)| 18093                   |
| **fluentbit** | Log collector & shipper      | — (internal only)        |

Fluent Bit mounts:
```yaml
volumes:
  - ./fluentbit/fluent-bit.conf:/fluent-bit/etc/fluent-bit.conf:ro
  - ./fluentbit/parsers.conf:/fluent-bit/etc/parsers.conf:ro
  - /var/lib/docker/containers:/var/lib/docker/containers:ro,rslave
```

---

## 6. KEY CONFIGURATION NOTES

- **Logs are streamed, not stored.**
  - All NGINX logs go to stdout/stderr.
  - Fluent Bit handles persistence & shipping.
- **Sampling:** set `$sample_rate` in `nginx.conf` to control request sampling.
- **HTTP only:** mTLS disabled for Docker simplicity.
- **Security:** no tokens or certificates are required locally.

---

## 7. CLEANUP

```bash
docker-compose down -v
```

This removes containers, networks, and any temporary Fluent Bit state DB.

---

## 8. NEXT STEPS

For production:
- Replace HTTP with HTTPS + mTLS for Obelix.
- Deploy Fluent Bit or Fluent d as a **DaemonSet** on Kubernetes.
- Send logs to a centralized collector (e.g., Loki, Elasticsearch, or Obelix Cloud).

---

**Author:** Demo environment maintained for API telemetry validation.
