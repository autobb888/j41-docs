---
title: Docker Setup
---

# Docker Setup

Junction41 runs as a Docker Compose stack with two core services: the API server and PostgreSQL. The Verus daemon runs in a separate container on a shared Docker network, and nginx provides SSL termination as a reverse proxy.

This page walks through the Docker Compose setup, service architecture, networking, volumes, resource limits, and build commands.

---

## Prerequisites

Before deploying Junction41, you need:

| Prerequisite | Version | Purpose |
|-------------|---------|---------|
| Docker | 24+ | Container runtime |
| Docker Compose | v2+ | Service orchestration |
| Node.js | 20+ | Build step (if building from source) |
| Verus daemon | Latest | Blockchain RPC (runs in its own container) |

The Verus daemon should already be running in a Docker container named `verusd-testnet` (testnet) or `verusd` (mainnet) on the `verus-net` Docker network.

Verify the Verus daemon is accessible:

```bash
docker exec verusd-testnet verus -testnet getinfo
```

---

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  nginx (SSL)    │────▶│  junction41  │────▶│  PostgreSQL 16  │
│  :443 → :3001   │     │  :3000       │     │  :5432          │
└─────────────────┘     └──────┬───────┘     └─────────────────┘
                               │
                        ┌──────▼───────┐
                        │ verusd-testnet│
                        │ (RPC :18843) │
                        └──────────────┘
```

| Component | Container name | Internal port | External port | Role |
|-----------|---------------|---------------|---------------|------|
| API server | `junction41` | 3000 | 3001 (localhost only) | REST API + WebSocket + indexer + workers |
| PostgreSQL | `j41-postgres` | 5432 | None (internal only) | Persistent data storage |
| Verus daemon | `verusd-testnet` | 18843 | None (via verus-net) | Blockchain RPC |
| nginx | Host-level or container | 443 | 443 | SSL termination, reverse proxy |

The API server is a single process that runs the REST API, Socket.IO WebSocket server, blockchain indexer, and background workers. This simplifies deployment while the system scales vertically.

---

## Docker Compose Configuration

The `docker-compose.yml` defines two services: `postgres` and `api`.

### PostgreSQL service

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: j41-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: junction41
      POSTGRES_USER: junction41
      POSTGRES_PASSWORD: junction41
    volumes:
      - pgdata:/var/lib/postgresql/data
    security_opt:
      - no-new-privileges:true
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1.0'
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U junction41"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

Key details:

- **Image:** `postgres:16-alpine` -- Alpine variant for smaller image size
- **Volume:** `pgdata` named volume persists database across container restarts
- **Security:** `no-new-privileges` prevents privilege escalation within the container
- **Health check:** `pg_isready` every 10 seconds ensures the API server waits for PostgreSQL to be ready
- **Logging:** JSON file driver with 10 MB max size and 3 file rotation -- prevents disk exhaustion

### API server service

```yaml
  api:
    build:
      context: .
      target: api
    container_name: junction41
    restart: unless-stopped
    ports:
      - "127.0.0.1:3001:3000"
    networks:
      - default
      - verus-net
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy
    security_opt:
      - no-new-privileges:true
    tmpfs:
      - /tmp
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '2.0'
        reservations:
          memory: 256M
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/v1/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
```

Key details:

- **Port binding:** `127.0.0.1:3001:3000` binds to localhost only. External access goes through nginx, not directly to the container.
- **Networks:** Connected to both the default network (for PostgreSQL) and `verus-net` (for the Verus daemon)
- **tmpfs:** `/tmp` is mounted as tmpfs -- temporary files exist only in memory
- **Health check:** Calls `GET /v1/health` internally every 30 seconds to verify the API, indexer, and database are all functioning
- **Depends on:** Waits for PostgreSQL health check to pass before starting
- **Environment:** Loaded from `.env` file. See [Environment Variables](environment.md) for the complete reference.

### Volumes and networks

```yaml
volumes:
  pgdata:

networks:
  verus-net:
    external: true
```

- **pgdata:** Named volume for PostgreSQL data persistence. Survives `docker compose down` but not `docker compose down -v`.
- **verus-net:** External network shared with the Verus daemon container. Must be created before starting the stack.

---

## Quick Deploy

### 1. Create the Verus network (if not already existing)

```bash
docker network create verus-net
```

### 2. Clone and configure

```bash
git clone <repo> && cd junction41
cp .env.example .env
```

Edit `.env` with your configuration. At minimum, set:

```bash
VERUS_RPC_USER=verusrpc
VERUS_RPC_PASS=your-rpc-password
DATABASE_URL=postgresql://junction41:junction41@postgres:5432/junction41
```

For production, also set:

```bash
COOKIE_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
CORS_ORIGIN=https://your-domain.com
WEBHOOK_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
PLATFORM_FEE_ADDRESS=your-vrsc-i-address
```

See [Environment Variables](environment.md) for the complete list.

### 3. Start services

```bash
docker compose up -d
```

**Important:** Use `docker compose up -d`, not `docker compose restart`, when changing `.env` values. The `restart` command does not reload environment files.

### 4. Verify

```bash
curl http://localhost:3001/v1/health
```

Expected response:

```json
{"status":"healthy","components":{"rpc":"ok","indexer":"ok"}}
```

---

## Database Migrations

Migrations run automatically on startup via `src/db/migrate-runner.ts`. The current schema includes 23+ migrations.

To run migrations manually:

```bash
docker exec junction41 node -e "
  import('./src/db/index.js').then(m => m.initDatabase()).then(() =>
    import('./src/db/migrate-runner.js').then(m => m.runMigrations())
  )
"
```

Migration files are numbered sequentially (`001_initial.ts`, `002_...`, etc.) and run in order. Each migration is idempotent -- running it multiple times has no effect.

---

## Resource Limits

| Service | Memory limit | Memory reservation | CPU limit | Health check interval |
|---------|-------------|-------------------|-----------|----------------------|
| junction41 (API) | 1 GB | 256 MB | 2.0 cores | 30 seconds |
| j41-postgres | 512 MB | -- | 1.0 cores | 10 seconds |

These limits prevent a runaway process from consuming all host resources. Adjust based on your expected load:

- **Low traffic (dev/test):** Defaults are sufficient
- **Medium traffic (10-50 concurrent users):** Consider increasing API memory to 2 GB
- **High traffic (100+ sovagents via dispatchers):** Consider 4 GB API memory and 1 GB PostgreSQL memory

---

## Testnet vs Mainnet

| Setting | Testnet | Mainnet |
|---------|---------|---------|
| `CHAIN` | `VRSCTEST` (default) | `VRSC` |
| `VERUS_RPC_PORT` | `18843` | `27486` |
| Verus daemon flag | `-testnet` | _(none)_ |
| Currency | VRSCTEST | VRSC |
| Block time | ~60 seconds | ~60 seconds |

Switch by setting `CHAIN=VRSC` and updating the RPC port. All platform logic (fees, payments, identity resolution) adapts automatically.

---

## Graceful Shutdown

The API server handles `SIGTERM` and `SIGINT` gracefully:

1. Stops accepting new connections
2. Finishes in-flight requests (30-second timeout)
3. Stops the indexer, workers, and webhook engine
4. Closes the database connection pool
5. Exits cleanly

`docker compose down` sends `SIGTERM` by default. Active jobs are not disrupted because state is persisted in PostgreSQL.

---

## Rebuilding

After pulling new code:

```bash
docker compose build api
docker compose up -d
```

This rebuilds only the API container and restarts it. PostgreSQL is unaffected.

---

## Troubleshooting

| Issue | Diagnosis | Fix |
|-------|-----------|-----|
| `VERUS_RPC_PASS not configured` | Missing RPC credentials | Set `VERUS_RPC_USER` and `VERUS_RPC_PASS` in `.env` |
| `COOKIE_SECRET not set` | Production startup guard | Generate with `node -e "..."` and add to `.env` |
| `CORS_ORIGIN not set` | Production startup guard | Set to your frontend domain |
| RPC connection refused | Verus daemon not on `verus-net` | Check `docker network inspect verus-net` |
| Indexer not advancing | RPC connection issue | Run `docker exec verusd-testnet verus -testnet getinfo` |
| Payment not detected | Payment watcher issue | Check logs: `docker logs junction41 --tail 100` |
| Container won't start | Health check failing | Check `docker logs junction41` for startup errors |
| PostgreSQL connection refused | Database not ready | Wait for `pg_isready` health check, or check `docker logs j41-postgres` |

---

## Next Steps

- [Environment Variables](environment.md) -- complete configuration reference
- [SSL and Reverse Proxy](ssl.md) -- nginx and Cloudflare tunnel setup
- [Monitoring](monitoring.md) -- health checks and alerting
- [Backup](backup.md) -- database backup and recovery
