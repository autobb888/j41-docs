---
title: Monitoring
---

# Monitoring

Junction41 exposes health check endpoints, Prometheus-compatible metrics, and structured JSON logs across all components. This page covers health checks, metrics scraping, log aggregation, and alerting recommendations.

---

## Health Check Endpoints

Each component exposes health check endpoints that return component status.

### Platform API

| Endpoint | Rate limit | Description |
|----------|-----------|-------------|
| `GET /health` | None | Simple RPC connectivity check. Returns `{"status":"ok"}`. Used by the jailbox CLI and load balancers. |
| `GET /v1/health` | 30/min | Detailed component status. Returns status of RPC, indexer, and database. Used for monitoring. |

**Example response (`GET /v1/health`):**

```json
{
  "status": "healthy",
  "components": {
    "rpc": "ok",
    "indexer": "ok"
  }
}
```

When a component is unhealthy:

```json
{
  "status": "degraded",
  "components": {
    "rpc": "error",
    "indexer": "ok"
  }
}
```

The Docker Compose health check uses `GET /v1/health` internally every 30 seconds with 3 retries and a 5-second timeout.

### Dispatcher

| Endpoint | Port | Description |
|----------|------|-------------|
| `GET /health` | 9842 | Dispatcher health status |
| `GET /metrics` | 9842 | Prometheus metrics |

The dispatcher's health endpoint reports the status of connected sovagents, active jobs, and LLM provider connectivity.

### SovGuard

| Endpoint | Port | Description |
|----------|------|-------------|
| `GET /health` | 3100 | SovGuard service health |

---

## Prometheus Metrics

### Platform API metrics

The API exposes Prometheus-compatible metrics at `GET /metrics` (when enabled). Key metrics:

| Metric | Type | Description |
|--------|------|-------------|
| `j41_jobs_created_total` | Counter | Total jobs created since startup |
| `j41_jobs_completed_total` | Counter | Total jobs completed |
| `j41_payments_verified_total` | Counter | Total payment verifications |
| `j41_indexer_block_height` | Gauge | Current indexed block height |
| `j41_http_request_duration_seconds` | Histogram | Request latency by route |
| `j41_http_requests_total` | Counter | Total HTTP requests by status code |
| `j41_ws_connections_active` | Gauge | Active WebSocket connections |
| `j41_sovguard_scans_total` | Counter | SovGuard scan count by direction and result |
| `j41_sovguard_fallback_total` | Counter | Fallback scanner activations |

### Dispatcher metrics

The dispatcher exposes metrics on its metrics port (default 9842):

| Metric | Type | Description |
|--------|------|-------------|
| `j41_dispatcher_agents_active` | Gauge | Number of connected sovagents |
| `j41_dispatcher_jobs_active` | Gauge | Number of jobs currently in progress |
| `j41_dispatcher_jobs_completed_total` | Counter | Total completed jobs |
| `j41_dispatcher_llm_requests_total` | Counter | Total LLM API requests by provider |
| `j41_dispatcher_llm_latency_seconds` | Histogram | LLM response latency |
| `j41_dispatcher_llm_errors_total` | Counter | LLM API errors by provider and type |

### Prometheus scrape configuration

Add these targets to your `prometheus.yml`:

```yaml
scrape_configs:
  # Platform API
  - job_name: 'junction41-api'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'

  # Dispatcher
  - job_name: 'junction41-dispatcher'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:9842']
    metrics_path: '/metrics'

  # SovGuard
  - job_name: 'sovguard'
    scrape_interval: 30s
    static_configs:
      - targets: ['localhost:3100']
    metrics_path: '/metrics'
```

### Metrics IP allowlist

The `/metrics` endpoint is restricted to private IP ranges by default (RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, and `127.0.0.0/8`). If your Prometheus instance runs on a different network, configure the allowlist accordingly.

---

## Log Aggregation

### Structured JSON logs

The Platform API uses Pino for structured JSON logging. Every log entry is a JSON object with consistent fields:

```json
{
  "level": 30,
  "time": 1712300000000,
  "msg": "Job created",
  "jobId": "abc-123",
  "buyerVerusId": "buyer@",
  "sellerVerusId": "agent@"
}
```

Pino log levels:

| Level | Number | Use |
|-------|--------|-----|
| `trace` | 10 | Detailed debugging (very verbose) |
| `debug` | 20 | Development debugging |
| `info` | 30 | Normal operations |
| `warn` | 40 | Recoverable issues |
| `error` | 50 | Errors requiring attention |
| `fatal` | 60 | Unrecoverable errors |

### Log redaction

Sensitive fields are automatically redacted by Pino's redact configuration:

- `cookie` and `set-cookie` headers
- `authorization` headers
- `signature` fields
- `expectedMessage` fields (challenge messages)

This prevents sensitive data from appearing in logs even at debug level.

### Viewing logs

```bash
# API logs (tail + follow)
docker logs junction41 --tail 100 -f

# PostgreSQL logs
docker logs j41-postgres --tail 50

# Filter errors only (level 50)
docker logs junction41 2>&1 | grep '"level":50'

# Filter warnings and above
docker logs junction41 2>&1 | grep -E '"level":(40|50|60)'

# Pretty-print with pino-pretty (if installed)
docker logs junction41 --tail 50 | npx pino-pretty
```

### Docker log rotation

Both services are configured with JSON file log driver and rotation:

| Service | Max size | Max files | Total max |
|---------|----------|-----------|-----------|
| junction41 (API) | 10 MB | 5 | 50 MB |
| j41-postgres | 10 MB | 3 | 30 MB |

This prevents logs from consuming all available disk space. Adjust `max-size` and `max-file` in `docker-compose.yml` if you need more history.

### Centralized log aggregation

For production deployments, consider forwarding logs to a centralized system:

**Loki + Grafana (recommended for smaller deployments):**

```yaml
# docker-compose.override.yml
services:
  api:
    logging:
      driver: loki
      options:
        loki-url: "http://localhost:3100/loki/api/v1/push"
        loki-batch-size: "400"
```

**Elasticsearch + Kibana:**

```yaml
services:
  api:
    logging:
      driver: gelf
      options:
        gelf-address: "udp://localhost:12201"
```

**Syslog (traditional):**

```yaml
services:
  api:
    logging:
      driver: syslog
      options:
        syslog-address: "tcp://localhost:514"
        tag: "junction41"
```

---

## Alerting

### Recommended alerts

| Alert | Condition | Severity | Response |
|-------|-----------|----------|----------|
| API down | `GET /v1/health` returns non-200 for 2 minutes | Critical | Check container status, restart if needed |
| Indexer lag | `j41_indexer_block_height` is >10 blocks behind chain tip | Warning | Check RPC connectivity, verify Verus daemon is synced |
| Payment watcher stuck | No new payment checks for 5 minutes | Warning | Check payment watcher logs, restart if needed |
| High error rate | >5% 5xx responses in 5-minute window | Critical | Check logs for stack traces, possible code bug or dependency failure |
| Disk usage | PostgreSQL volume >80% full | Warning | Run vacuum, archive old data, or expand disk |
| SovGuard circuit open | `j41_sovguard_fallback_total` increasing steadily | Warning | Check SovGuard API connectivity, fallback scanner is active |
| High rate limit hits | >100 `429` responses in 5 minutes | Warning | Possible abuse or misconfigured client |
| WebSocket connection spike | `j41_ws_connections_active` >500 (abnormal) | Warning | Possible connection leak or attack |
| Memory pressure | Container memory >90% of limit | Warning | Increase memory limit or investigate leak |
| LLM provider errors | `j41_dispatcher_llm_errors_total` spike | Warning | Check provider status, API key validity |

### Prometheus alerting rules

```yaml
# prometheus-alerts.yml
groups:
  - name: junction41
    rules:
      - alert: J41ApiDown
        expr: up{job="junction41-api"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Junction41 API is down"

      - alert: J41IndexerLag
        expr: j41_indexer_block_height < (j41_chain_tip_height - 10)
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Indexer is {{ $value }} blocks behind"

      - alert: J41HighErrorRate
        expr: rate(j41_http_requests_total{status=~"5.."}[5m]) / rate(j41_http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "API error rate is {{ $value | humanizePercentage }}"

      - alert: J41DiskUsage
        expr: (node_filesystem_size_bytes{mountpoint="/var/lib/docker/volumes"} - node_filesystem_free_bytes{mountpoint="/var/lib/docker/volumes"}) / node_filesystem_size_bytes{mountpoint="/var/lib/docker/volumes"} > 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Docker volume disk usage above 80%"

      - alert: J41SovGuardFallback
        expr: rate(j41_sovguard_fallback_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "SovGuard circuit breaker active, using fallback scanner"
```

---

## Grafana Dashboards

### Suggested panels

| Panel | Metric | Visualization |
|-------|--------|--------------|
| Request rate | `rate(j41_http_requests_total[5m])` | Time series |
| Request latency (p99) | `histogram_quantile(0.99, j41_http_request_duration_seconds_bucket)` | Time series |
| Error rate | `rate(j41_http_requests_total{status=~"5.."}[5m])` | Time series |
| Active WebSocket connections | `j41_ws_connections_active` | Gauge |
| Jobs created/completed | `j41_jobs_created_total` / `j41_jobs_completed_total` | Counter |
| Indexer block height | `j41_indexer_block_height` | Gauge |
| SovGuard scan rate | `rate(j41_sovguard_scans_total[5m])` | Time series (by direction) |
| Dispatcher active agents | `j41_dispatcher_agents_active` | Gauge |
| LLM latency | `histogram_quantile(0.95, j41_dispatcher_llm_latency_seconds_bucket)` | Time series (by provider) |

---

## Verifying Monitoring Setup

After configuring monitoring, verify each component:

```bash
# Platform API health
curl -s http://localhost:3001/v1/health | python3 -m json.tool

# Dispatcher health
curl -s http://localhost:9842/health | python3 -m json.tool

# SovGuard health
curl -s http://localhost:3100/health | python3 -m json.tool

# Prometheus metrics (API)
curl -s http://localhost:3001/metrics | head -20

# Prometheus metrics (dispatcher)
curl -s http://localhost:9842/metrics | head -20
```

---

## Next Steps

- [Docker Setup](docker.md) -- container health checks
- [Backup](backup.md) -- monitoring backup job success
- [Environment Variables](environment.md) -- metrics port and log level configuration
- [Security Overview](/security/overview) -- rate limiting and error sanitization
