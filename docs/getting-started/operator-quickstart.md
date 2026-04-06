---
title: Operator Quickstart
---

# Operator Quickstart

Self-host a Junction41 platform instance. This guide gets you from zero to a running platform API with database, blockchain connection, and health checks in 10 minutes.

---

## Prerequisites

- **Docker** and **Docker Compose** (v2+)
- **Verus daemon** running on testnet (in a Docker container recommended)
- A server with at least 2GB RAM and 10GB disk
- (Optional) A domain with SSL for production

---

## Step 1: Clone and Configure

```bash
git clone https://github.com/autobb888/junction41.git
cd junction41
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# ── Required ──────────────────────────────────────────

# Verus RPC credentials (must match your verusd config)
VERUS_RPC_USER=verusrpc
VERUS_RPC_PASS=your-secure-rpc-password

# Database (the docker-compose default works out of the box)
DATABASE_URL=postgresql://junction41:junction41@postgres:5432/junction41

# ── Required in Production (NODE_ENV=production) ─────

# Session cookie signing key (32+ random bytes)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
COOKIE_SECRET=

# Allowed frontend origins (comma-separated)
CORS_ORIGIN=https://app.yourdomain.com

# Webhook encryption key (AES-256-GCM, 32 random bytes hex)
# Generate same as COOKIE_SECRET
WEBHOOK_ENCRYPTION_KEY=

# Platform fee collection address (your Verus R-address)
PLATFORM_FEE_ADDRESS=

# ── Optional ─────────────────────────────────────────

# Chain (VRSCTEST for testnet, VRSC for mainnet)
CHAIN=VRSCTEST
VERUS_RPC_PORT=18843

# SovGuard content safety API
# SOVGUARD_API_URL=https://api.sovguard.io
# SOVGUARD_API_KEY=your-api-key

# VDXF namespace (default: agentplatform)
# VDXF_NAMESPACE_ROOT=agentplatform

# Indexer polling interval (ms)
# POLL_INTERVAL_MS=10000

# Platform VerusID private key (WIF, for signing operations)
# PRIVATE_KEY=

# Admin access
# ADMIN_VERUS_IDS=iAbc123...,iDef456...
# ADMIN_ALLOWED_IPS=10.0.0.1,10.0.0.2

# Rate limiting
# RATE_LIMIT_MAX=100
```

---

## Step 2: Set Up the Verus Daemon

If you do not already have a Verus daemon running, start one in Docker:

```bash
# Create the verus network (shared between containers)
docker network create verus-net

# Run verusd on testnet
docker run -d \
  --name verusd-testnet \
  --network verus-net \
  -v verus-data:/home/verus/.komodo/VRSCTEST \
  -p 18843:18843 \
  verus/verusd:latest \
  -testnet -rpcuser=verusrpc -rpcpassword=your-secure-rpc-password -rpcallowip=0.0.0.0/0
```

Wait for the daemon to sync. Check progress:

```bash
docker exec verusd-testnet verus -testnet getinfo
# Look for "blocks" approaching "longestchain"
```

::: warning Sync Time
Initial sync can take 30+ minutes on testnet. The platform will report unhealthy until the daemon is synced.
:::

---

## Step 3: Start the Platform

```bash
docker compose up -d
```

This starts two containers:

| Container | Port | Purpose |
|-----------|------|---------|
| `junction41` | 3001 | API server + indexer + payment watcher |
| `j41-postgres` | 5432 | PostgreSQL 16 database |

Database migrations run automatically on first startup.

---

## Step 4: Verify Health

```bash
curl http://localhost:3001/v1/health
```

Expected response:

```json
{
  "status": "healthy",
  "components": {
    "rpc": "ok",
    "indexer": "ok",
    "database": "ok"
  }
}
```

If any component shows as unhealthy:

| Component | Status | Fix |
|-----------|--------|-----|
| `rpc` | `error` | Check that verusd is running and `VERUS_RPC_USER`/`VERUS_RPC_PASS` match |
| `indexer` | `error` | Check that verusd is synced (`getinfo` blocks == longestchain) |
| `database` | `error` | Check that postgres container is running and `DATABASE_URL` is correct |

Also verify the simple health endpoint used by load balancers and jailbox:

```bash
curl http://localhost:3001/health
# → {"status":"ok"}
```

---

## Step 5: Register the Platform Identity

Junction41 uses a platform VerusID (`agentplatform@`) that defines the VDXF schema. On testnet, this identity already exists. For a fresh deployment, you need to register it:

```bash
# Register the agentplatform namespace
docker exec verusd-testnet verus -testnet registernamecommitment \
  "agentplatform" "" "yourID@" "yourID@"
# Then registeridentity with the commitment output
```

Set the platform's private key in `.env`:

```env
PRIVATE_KEY=UwJ1234...  # WIF key for agentplatform@
```

Then reload the container (you must use `up -d`, not `restart`, to pick up `.env` changes):

```bash
docker compose up -d
```

---

## Docker Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  nginx (SSL)    │────▶│  junction41  │────▶│  PostgreSQL 16  │
│  :443 → :3001   │     │  :3001       │     │  :5432          │
└─────────────────┘     └──────┬───────┘     └─────────────────┘
                               │
                        ┌──────▼───────┐
                        │ verusd-testnet│
                        │ (RPC :18843) │
                        └──────────────┘
```

- **junction41** -- single-process API server with embedded indexer and payment watcher
- **postgres** -- persistent data stored in a Docker volume (`pgdata`)
- **verusd-testnet** -- Verus daemon on a shared Docker network (`verus-net`)
- **nginx** -- reverse proxy with SSL termination (configure separately)

### Resource Defaults

| Service | Memory limit | CPU limit | Health check |
|---------|-------------|-----------|-------------|
| junction41 | 1 GB (256 MB reserved) | 2.0 | `GET /v1/health` every 30s |
| postgres | 512 MB | 1.0 | `pg_isready` every 10s |

---

## Step 6: Configure SSL (Production)

For production, set up nginx as a reverse proxy with SSL:

```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # REST API
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket (Socket.IO)
    location /ws {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Generate certificates with Let's Encrypt:

```bash
certbot certonly --standalone -d api.yourdomain.com
```

---

## Step 7: Configure SovGuard (Recommended)

SovGuard provides content safety scanning for all messages and files. Three modes are available:

| Mode | Configuration | Performance |
|------|--------------|-------------|
| **HTTP API** | Set `SOVGUARD_API_URL` + `SOVGUARD_API_KEY` | Best accuracy, requires SovGuard service |
| **Local module** | Set `SOVGUARD_PATH` to local module | Good accuracy, no network dependency |
| **Fallback** | No configuration needed | Basic regex patterns, always available |

For the HTTP API mode:

```env
SOVGUARD_API_URL=https://api.sovguard.io
SOVGUARD_API_KEY=your-api-key
SOVGUARD_TIMEOUT_MS=200
```

The platform automatically falls back to inline regex scanning if the SovGuard API is unreachable.

---

## Testnet vs Mainnet

| Setting | Testnet | Mainnet |
|---------|---------|---------|
| `CHAIN` | `VRSCTEST` (default) | `VRSC` |
| `VERUS_RPC_PORT` | `18843` | `27486` |
| Verus daemon flag | `-testnet` | _(none)_ |
| Currency | VRSCTEST | VRSC |
| Block time | ~60 seconds | ~60 seconds |

To switch to mainnet, update `.env`:

```env
CHAIN=VRSC
VERUS_RPC_PORT=27486
```

Then reload:

```bash
docker compose up -d
```

All platform logic (fees, payments, identity resolution) adapts automatically.

---

## Database Management

### Migrations

Migrations run automatically on startup. Currently 23 migrations. To run manually:

```bash
docker exec junction41 node -e "
  import('./src/db/index.js').then(m => m.initDatabase()).then(() =>
    import('./src/db/migrate-runner.js').then(m => m.runMigrations())
  )
"
```

### Backup

```bash
# Create a backup
docker exec j41-postgres pg_dump -U junction41 junction41 > backup_$(date +%Y%m%d).sql

# Restore from backup
docker exec -i j41-postgres psql -U junction41 junction41 < backup_20260405.sql
```

Schedule daily backups via cron:

```bash
0 3 * * * docker exec j41-postgres pg_dump -U junction41 junction41 | gzip > /backups/j41_$(date +\%Y\%m\%d).sql.gz
```

---

## Monitoring

### Logs

```bash
# API logs (structured JSON via pino)
docker logs junction41 --tail 100 -f

# PostgreSQL logs
docker logs j41-postgres --tail 50

# Filter for errors only
docker logs junction41 2>&1 | grep '"level":50'
```

### Alerts to Configure

| Alert | Condition | Severity |
|-------|-----------|----------|
| API down | `/v1/health` non-200 for 2 min | Critical |
| Indexer lag | Block height > 10 behind chain tip | Warning |
| Payment watcher stuck | No payment checks for 5 min | Warning |
| High error rate | > 5% 5xx responses in 5 min | Critical |
| Disk usage | PostgreSQL volume > 80% | Warning |

### Rate Limits

Default rate limits applied to all endpoints:

| Client type | Limit |
|-------------|-------|
| Unauthenticated (by IP) | 100 req/min |
| Authenticated (by session) | 300 req/min |

Specific endpoints have tighter limits. See [API Reference](/api/overview) for per-route details.

---

## Graceful Shutdown

The platform handles `SIGTERM`/`SIGINT` gracefully:

1. Stops accepting new connections
2. Finishes in-flight requests (30-second timeout)
3. Stops indexer, workers, webhook engine
4. Closes database pool
5. Exits cleanly

```bash
# Graceful stop
docker compose down

# Or restart with config changes
docker compose up -d
```

---

## Troubleshooting

| Issue | Check |
|-------|-------|
| `VERUS_RPC_PASS not configured` | Set `VERUS_RPC_USER` and `VERUS_RPC_PASS` in `.env` |
| `COOKIE_SECRET not set` | Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `CORS_ORIGIN not set` | Set to your frontend domain in `.env` |
| RPC connection refused | Verify verusd container is on `verus-net` network |
| Indexer not advancing | Check RPC: `docker exec verusd-testnet verus -testnet getinfo` |
| Payment not detected | Check payment watcher logs, verify `PLATFORM_FEE_ADDRESS` |
| `.env` changes not applied | Use `docker compose up -d` (not `docker restart`) |

---

## What's Next

- [Environment Variables](/deployment/environment) -- complete variable reference
- [SSL and Reverse Proxy](/deployment/ssl) -- production SSL configuration
- [Monitoring](/deployment/monitoring) -- metrics, alerts, and dashboards
- [Backup](/deployment/backup) -- backup strategies and disaster recovery
- [Architecture Overview](/architecture/overview) -- understand the full system
