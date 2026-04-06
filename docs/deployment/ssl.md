---
title: SSL and Reverse Proxy
---

# SSL and Reverse Proxy

Junction41 requires TLS for production deployments. The API server listens on an internal port (3000) and should never be exposed directly to the internet. This page covers three approaches to SSL termination: Let's Encrypt with nginx, Cloudflare Tunnels, and a combined approach.

---

## Option 1: Let's Encrypt with nginx

This is the standard approach for self-hosted deployments. nginx handles SSL termination and reverse proxies to the Junction41 container.

### Install certbot

```bash
# Ubuntu/Debian
sudo apt install certbot python3-certbot-nginx

# CentOS/RHEL
sudo dnf install certbot python3-certbot-nginx
```

### Obtain certificates

```bash
# API domain
sudo certbot certonly --nginx -d api.yourdomain.com

# Dashboard domain (if separate)
sudo certbot certonly --nginx -d yourdomain.com
```

Certbot automatically sets up renewal via systemd timer. Verify:

```bash
sudo certbot renew --dry-run
```

### nginx configuration

Create `/etc/nginx/sites-available/junction41`:

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name api.yourdomain.com yourdomain.com;
    return 301 https://$host$request_uri;
}

# API server
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # Modern TLS configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;

    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";

    # REST API and general routes
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Request size limit (for file uploads)
        client_max_body_size 15m;
    }

    # WebSocket (Socket.IO)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket timeouts
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}

# Dashboard (if served separately)
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    add_header Strict-Transport-Security "max-age=63072000" always;

    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API proxy (for same-origin API calls from the dashboard)
    location /auth/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /v1/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 15m;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

Enable the site and reload nginx:

```bash
sudo ln -s /etc/nginx/sites-available/junction41 /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Key nginx settings explained

| Setting | Value | Why |
|---------|-------|-----|
| `ssl_protocols TLSv1.2 TLSv1.3` | Modern TLS only | TLS 1.0 and 1.1 have known vulnerabilities |
| `proxy_read_timeout 86400s` | 24 hours for WebSocket | Socket.IO connections are long-lived |
| `client_max_body_size 15m` | 15 MB | Slightly above the 10 MB per-file upload limit |
| `X-Forwarded-Proto $scheme` | Protocol forwarding | API uses this to determine if the connection is HTTPS |
| `X-Real-IP` | Client IP forwarding | Rate limiting uses this to identify clients behind the proxy |
| HSTS | 2-year max-age | Browsers remember to always use HTTPS |

---

## Option 2: Cloudflare Tunnels

Cloudflare Tunnels provide SSL termination without exposing any ports to the internet. This is the approach used by Junction41's production deployment.

### How Cloudflare Tunnels work

```
Internet ──HTTPS──▶ Cloudflare edge ──tunnel──▶ cloudflared ──HTTP──▶ localhost:3001
```

The `cloudflared` daemon creates an outbound connection to Cloudflare's edge. No inbound ports need to be open on the server. Cloudflare handles SSL certificates, DDoS protection, and caching.

### Tunnel configuration

Tunnels are configured via a YAML file. Each route maps a hostname to a local service:

```yaml
# ~/.cloudflared/junction41-tunnel.yml
tunnel: 2dd3cdb9-679c-4cf7-82b5-a88463b58b15
credentials-file: /etc/cloudflared/junction41-tunnel.json

ingress:
  # API
  - hostname: api.junction41.io
    service: http://localhost:3001

  # Dashboard API proxy routes
  - hostname: junction41.io
    path: /auth/*
    service: http://localhost:3001

  - hostname: junction41.io
    path: /v1/*
    service: http://localhost:3001

  - hostname: junction41.io
    path: /socket.io/*
    service: http://localhost:3001

  # Dashboard
  - hostname: junction41.io
    service: http://localhost:5173

  # Login (served by API)
  - hostname: login.junction41.io
    service: http://localhost:3001

  # SovGuard
  - hostname: sovguard.io
    service: http://localhost:3100

  - hostname: api.sovguard.io
    service: http://localhost:3100

  # Catch-all
  - service: http_status:404
```

### Running the tunnel as a systemd service

```bash
# Create systemd service
sudo cloudflared service install

# Or manually create the service file
sudo tee /etc/systemd/system/junction41-tunnel.service << 'EOF'
[Unit]
Description=Junction41 Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=bigbox
ExecStart=/usr/local/bin/cloudflared tunnel --config /home/bigbox/.cloudflared/junction41-tunnel.yml run
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable junction41-tunnel
sudo systemctl start junction41-tunnel
```

### DNS setup for Cloudflare Tunnels

Domains must have CNAME records pointing to the tunnel:

```
api.junction41.io    CNAME  2dd3cdb9-679c-4cf7-82b5-a88463b58b15.cfargotunnel.com
junction41.io        CNAME  2dd3cdb9-679c-4cf7-82b5-a88463b58b15.cfargotunnel.com
login.junction41.io  CNAME  2dd3cdb9-679c-4cf7-82b5-a88463b58b15.cfargotunnel.com
```

DNS records must be created in the Cloudflare dashboard for each zone.

### Credentials security

```bash
# Tunnel credentials should be restricted
chmod 600 /etc/cloudflared/junction41-tunnel.json
chown bigbox:bigbox /etc/cloudflared/junction41-tunnel.json
```

---

## Option 3: Combined (nginx + Cloudflare)

For additional control, you can run nginx behind Cloudflare. Cloudflare handles external SSL, and nginx handles internal routing and additional security headers.

```
Internet ──HTTPS──▶ Cloudflare ──tunnel──▶ cloudflared ──▶ nginx ──▶ junction41
```

This is useful if you want nginx features like request buffering, advanced logging, or serving static files that Cloudflare Tunnels do not provide natively.

---

## WebSocket Configuration

WebSocket connections (Socket.IO) require special handling regardless of which SSL approach you use.

### Requirements

| Requirement | Why |
|-------------|-----|
| HTTP/1.1 upgrade support | WebSocket protocol requires HTTP upgrade headers |
| Long read timeouts | Socket.IO connections persist for the duration of a job |
| Connection header forwarding | The `Upgrade` and `Connection` headers must be forwarded |

### Cloudflare WebSocket support

Cloudflare Tunnels support WebSocket natively. No additional configuration is needed. Socket.IO's long-polling fallback also works through Cloudflare.

### nginx WebSocket support

The `/socket.io/` location block in the nginx configuration above handles WebSocket upgrades. The key headers are:

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

### Testing WebSocket connectivity

After configuring SSL, verify WebSocket connections work:

```bash
# Using wscat
npx wscat -c wss://api.yourdomain.com/socket.io/?EIO=4&transport=websocket
```

You should see a Socket.IO handshake response. If the connection drops immediately, check the `Upgrade` header forwarding in your proxy configuration.

---

## CORS Configuration

The `CORS_ORIGIN` environment variable must match your SSL domain configuration.

| Deployment | `CORS_ORIGIN` value |
|------------|-------------------|
| Single domain (API + dashboard) | `https://junction41.io` |
| Separate API domain | `https://junction41.io,https://api.junction41.io` |
| Development | `http://localhost:5173` |

If CORS is misconfigured, the dashboard will fail to make API requests with browser console errors like `Access-Control-Allow-Origin missing`.

---

## Certificate Renewal

### Let's Encrypt (certbot)

Certbot sets up automatic renewal via systemd timer. Verify it is working:

```bash
# Check timer status
sudo systemctl status certbot.timer

# Test renewal
sudo certbot renew --dry-run
```

Certificates renew 30 days before expiration. No manual intervention is needed.

### Cloudflare Tunnels

Cloudflare manages certificates automatically. No renewal process is needed.

---

## Verifying SSL Configuration

After setup, verify your configuration:

```bash
# Check SSL certificate
curl -vI https://api.yourdomain.com/v1/health 2>&1 | grep -E "SSL|subject|expire"

# Check security headers
curl -sI https://api.yourdomain.com/v1/health | grep -E "Strict-Transport|X-Content|X-Frame"

# Check WebSocket
curl -sI -H "Upgrade: websocket" -H "Connection: upgrade" \
  https://api.yourdomain.com/socket.io/?EIO=4&transport=websocket
```

---

## Next Steps

- [Docker Setup](docker.md) -- container networking that SSL proxies connect to
- [Environment Variables](environment.md) -- `CORS_ORIGIN` and `PUBLIC_URL` configuration
- [Monitoring](monitoring.md) -- monitoring SSL certificate expiration
- [Security Overview](/security/overview) -- how SSL fits into the security model
