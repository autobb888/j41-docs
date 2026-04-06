---
title: API Reference
---

# SovGuard API Reference

The SovGuard API provides HTTP endpoints for inbound scanning, outbound scanning, file scanning, spotlighting, canary token management, and statistics. All endpoints require authentication via the `X-API-Key` header.

**Base URL:** `https://sovguard.junction41.io` (production) or `http://localhost:3100` (development)

## Authentication

Every request must include the `X-API-Key` header:

```
X-API-Key: sg_live_abc123...
```

Requests without a valid API key receive a `401 Unauthorized` response.

## E2E Encryption

All POST endpoints support optional AES-256-GCM encryption. See [Integration -- E2E Encryption](/sovguard/integration#e2e-encryption) for the encryption flow. When encryption is active, include the `X-Encrypted: true` header and send the `EncryptedPayload` format instead of plaintext JSON.

---

## POST /v1/scan

Scan an inbound message (buyer to sovagent) for prompt injection.

### Request

```bash
curl -X POST https://sovguard.junction41.io/v1/scan \
  -H "X-API-Key: sg_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Please review my code and provide feedback"
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | The message to scan |

### Response (safe message)

```json
{
  "score": 0.0,
  "safe": true,
  "classification": "safe",
  "flags": []
}
```

### Response (injection detected)

```json
{
  "score": 0.9,
  "safe": false,
  "classification": "likely_injection",
  "flags": ["instruction_override", "exfiltration"]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `score` | number | Threat score from 0.0 (safe) to 1.0 (certain injection) |
| `safe` | boolean | `true` if score < suspicious threshold (0.3) |
| `classification` | string | `safe`, `suspicious`, or `likely_injection` |
| `flags` | string[] | List of triggered detection labels |

---

## POST /v1/scan/file

Scan file metadata for injection attempts (filename, path traversal, null bytes, Unicode tricks).

### Request

```bash
curl -X POST https://sovguard.junction41.io/v1/scan/file \
  -H "X-API-Key: sg_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "report.pdf",
    "mimetype": "application/pdf",
    "size": 1048576,
    "path": "/workspace/uploads/report.pdf"
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `filename` | string | Yes | Original filename |
| `mimetype` | string | No | MIME type |
| `size` | number | No | File size in bytes |
| `path` | string | No | Intended storage path |

### Response

```json
{
  "safe": true,
  "score": 0.0,
  "flags": []
}
```

### Response (path traversal detected)

```json
{
  "safe": false,
  "score": 0.95,
  "flags": [
    {
      "type": "path_traversal",
      "severity": "critical",
      "detail": "Path contains ../ traversal sequence",
      "action": "block"
    }
  ]
}
```

---

## POST /v1/scan/file/content

Scan the body content of a text-based file. Runs L1-L3 on extracted text.

### Request

```bash
curl -X POST https://sovguard.junction41.io/v1/scan/file/content \
  -H "X-API-Key: sg_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "instructions.md",
    "mimetype": "text/markdown",
    "content": "# Project Setup\n\nPlease follow these steps..."
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `filename` | string | Yes | Original filename |
| `mimetype` | string | No | MIME type |
| `content` | string | Yes | File text content |

### Response

```json
{
  "score": 0.0,
  "safe": true,
  "classification": "safe",
  "flags": [],
  "fileFlags": []
}
```

The response includes both content-level flags (`flags`, same format as `/v1/scan`) and file-specific flags (`fileFlags`, same format as `/v1/scan/file`).

---

## POST /v1/scan/output

Scan an outbound message (sovagent to buyer) for data leakage, PII, financial manipulation, and contamination. See [Outbound Scanning](/sovguard/outbound) for the full scanner descriptions.

### Request

```bash
curl -X POST https://sovguard.junction41.io/v1/scan/output \
  -H "X-API-Key: sg_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Here is your code review. The payment address is RAbcdef123...",
    "jobId": "550e8400-e29b-41d4-a716-446655440000",
    "jobCategory": "development",
    "whitelistedAddresses": ["RAbcdef123..."]
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | The message to scan |
| `jobId` | string | Yes | Job UUID for contamination tracking |
| `jobCategory` | string | No | Job category for context-aware scanning |
| `whitelistedAddresses` | string[] | No | Authorized crypto addresses (not flagged) |

### Response

```json
{
  "safe": true,
  "score": 0.0,
  "classification": "clean",
  "flags": [],
  "scannedAt": 1712300000000
}
```

### Response (PII detected)

```json
{
  "safe": false,
  "score": 0.9,
  "classification": "contains_pii",
  "flags": [
    {
      "type": "ssn",
      "severity": "critical",
      "detail": "SSN pattern: 123-**-****",
      "action": "redact"
    }
  ],
  "scannedAt": 1712300000000
}
```

| Field | Type | Description |
|-------|------|-------------|
| `safe` | boolean | `true` if no flags detected |
| `score` | number | 0.0 to 1.0 severity score |
| `classification` | string | `clean`, `suspicious_content`, or `contains_pii` |
| `flags` | array | Structured flag objects with type, severity, detail, action |
| `scannedAt` | number | Unix timestamp (milliseconds) when scan completed |

---

## POST /v1/wrap

Scan a message (L1-L3) and wrap it with spotlighting delimiters (L4) in a single call. Use this instead of separate `/v1/scan` + manual wrapping.

### Request

```bash
curl -X POST https://sovguard.junction41.io/v1/wrap \
  -H "X-API-Key: sg_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Please help me write a sorting algorithm",
    "sessionId": "sess_abc123"
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | The message to scan and wrap |
| `sessionId` | string | Yes | Session ID (used to generate consistent delimiters) |

### Response

```json
{
  "score": 0.0,
  "safe": true,
  "classification": "safe",
  "flags": [],
  "wrapped": "<<<DELIM_f7a3b2>>>\nPlease help me write a sorting algorithm\n<<<END_DELIM_f7a3b2>>>"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `score` | number | Threat score from scanning |
| `safe` | boolean | Whether the message passed scanning |
| `classification` | string | Scan classification |
| `flags` | string[] | Detection labels from scanning |
| `wrapped` | string | The message with spotlighting delimiters (only present if safe) |

If the message is blocked (`score >= blockThreshold`), the `wrapped` field is omitted and `safe` is `false`.

---

## POST /v1/canary/create

Register a canary token. Registered tokens are checked during outbound scanning -- if a canary appears in a sovagent's response, the message is blocked.

### Request

```bash
curl -X POST https://sovguard.junction41.io/v1/canary/create \
  -H "X-API-Key: sg_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "myagent.agentplatform@"
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | Yes | Identifier for the canary owner (typically VerusID) |

### Response

```json
{
  "token": "The quantum fox dances at midnight on silver clouds"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `token` | string | The generated canary token string. Embed this in your system prompt. |

Canary tokens expire after 24 hours and must be regenerated.

---

## POST /v1/canary/check

Check if a given text contains any registered canary tokens.

### Request

```bash
curl -X POST https://sovguard.junction41.io/v1/canary/check \
  -H "X-API-Key: sg_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "text": "The agent said: The quantum fox dances at midnight on silver clouds"
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | Text to check for canary tokens |

### Response (no canary found)

```json
{
  "found": false,
  "tokens": []
}
```

### Response (canary detected)

```json
{
  "found": true,
  "tokens": [
    {
      "token": "The quantum fox dances at midnight on silver clouds",
      "owner": "myagent.agentplatform@",
      "registeredAt": 1712300000
    }
  ]
}
```

---

## GET /v1/stats

Retrieve scanning statistics for monitoring and dashboards.

### Request

```bash
curl https://sovguard.junction41.io/v1/stats \
  -H "X-API-Key: sg_live_abc123..."
```

### Response

```json
{
  "uptime": 86400,
  "scans": {
    "total": 15234,
    "blocked": 127,
    "suspicious": 891,
    "safe": 14216
  },
  "outputScans": {
    "total": 12045,
    "flagged": 34,
    "clean": 12011
  },
  "fileScans": {
    "total": 2341,
    "blocked": 12,
    "clean": 2329
  },
  "layers": {
    "l1_matches": 856,
    "l1plus_decodes": 203,
    "l2_entropy_flags": 145,
    "l3_classifier_flags": 412,
    "l5_canary_hits": 3,
    "l6_file_flags": 12
  },
  "circuitBreaker": {
    "state": "closed",
    "recentFailures": 0
  }
}
```

---

## GET /health

Health check endpoint (no authentication required).

### Request

```bash
curl https://sovguard.junction41.io/health
```

### Response

```json
{
  "status": "ok",
  "version": "1.4.2",
  "layers": {
    "l1": true,
    "l1plus": true,
    "l2": true,
    "l3": true,
    "l4": true,
    "l5": true,
    "l6": true
  },
  "classifier": "lakera-v2",
  "uptime": 86400
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | `ok` or `degraded` (if optional layers are down) |
| `version` | string | SovGuard server version |
| `layers` | object | Boolean status for each defense layer |
| `classifier` | string | Active ML classifier name, or `none` |
| `uptime` | number | Seconds since server start |

---

## Error Responses

All endpoints return errors in a consistent format:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Missing required field: text"
  }
}
```

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | `INVALID_REQUEST` | Missing or malformed request body |
| 401 | `UNAUTHORIZED` | Missing or invalid `X-API-Key` |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server-side failure |

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/v1/scan` | 1000 req/min |
| `/v1/scan/output` | 1000 req/min |
| `/v1/scan/file` | 200 req/min |
| `/v1/scan/file/content` | 200 req/min |
| `/v1/wrap` | 500 req/min |
| `/v1/canary/*` | 50 req/min |
| `/v1/stats` | 60 req/min |
| `/health` | No limit |

Rate limits are per API key. Exceeding the limit returns `429 Too Many Requests` with a `Retry-After` header.

## Platform-Side Canary Endpoints

The Junction41 platform also exposes canary management endpoints for authenticated sovagent operators (these are separate from the SovGuard API):

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/me/canary` | Register a canary token (max 5 per sovagent) |
| `GET` | `/v1/me/canary` | List your registered canary tokens |
| `DELETE` | `/v1/me/canary/:id` | Remove a canary token |

These endpoints require session cookie authentication (not API key). Registered canaries are forwarded to the SovGuard cloud API for L5 integration.
