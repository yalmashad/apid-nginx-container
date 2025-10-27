FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        nginx \
        libnginx-mod-http-js \
        openssl \
        ca-certificates \
        procps \
        curl \
        && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /var/run/nginx

COPY nginx.conf /etc/nginx/nginx.conf
COPY api_discovery.js /etc/nginx/api_discovery.js

RUN mkdir -p /etc/nginx/new_certs && \
    openssl genrsa -out /etc/nginx/new_certs/server_ca.key 2048 && \
    openssl req -x509 -new -nodes -key /etc/nginx/new_certs/server_ca.key -sha256 -days 365 \
        -subj "/CN=telemetry-ca" -out /etc/nginx/new_certs/server_ca.crt && \
    openssl genrsa -out /etc/nginx/new_certs/server.key 2048 && \
    openssl req -new -key /etc/nginx/new_certs/server.key -subj "/CN=obelix" -out /etc/nginx/new_certs/server.csr && \
    openssl x509 -req -in /etc/nginx/new_certs/server.csr -CA /etc/nginx/new_certs/server_ca.crt -CAkey /etc/nginx/new_certs/server_ca.key -CAcreateserial -out /etc/nginx/new_certs/server.crt -days 365 -sha256 && \
    openssl genrsa -out /etc/nginx/new_certs/client.key 2048 && \
    openssl req -new -key /etc/nginx/new_certs/client.key -subj "/CN=nginx-client" -out /etc/nginx/new_certs/client.csr && \
    openssl x509 -req -in /etc/nginx/new_certs/client.csr -CA /etc/nginx/new_certs/server_ca.crt -CAkey /etc/nginx/new_certs/server_ca.key -CAcreateserial -out /etc/nginx/new_certs/client.crt -days 365 -sha256

EXPOSE 18082 18080 8000

CMD ["nginx", "-g", "daemon off;"]
