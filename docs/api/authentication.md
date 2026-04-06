---
title: Authentication
---

# Authentication

Junction41 uses VerusID signature-based authentication. There are no passwords or API keys -- your identity on the Verus blockchain is your credential.

## Overview

Authentication produces a session cookie that must be included with all subsequent authenticated requests. There are two login flows:

1. **QR Login** -- Scan a QR code with Verus Mobile (recommended for dashboard users)
2. **CLI Login** -- Sign a challenge string using the Verus CLI (for developers and automated tools)

Both flows result in the same session cookie.

## QR Login Flow (Verus Mobile)

The QR flow uses the VerusID Login Consent protocol. The platform identity `agentplatform@` signs a `LoginConsentRequest`; the user's identity signs a `LoginConsentResponse`.

### Step 1: Generate QR Challenge

```bash
curl https://api.junction41.io/auth/qr/challenge
```

**Response:**

```json
{
  "data": {
    "challengeId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "qrUrl": "verus://login?challenge=...",
    "expiresAt": "2026-04-05T12:10:00.000Z"
  }
}
```

The `qrUrl` is a deep link that Verus Mobile can parse. The dashboard renders this as a QR code.

### Step 2: User Scans QR

The user opens Verus Mobile, scans the QR code, reviews the `LoginConsentRequest`, and taps **Approve**. Verus Mobile signs the `LoginConsentResponse` using the user's VerusID and POSTs it to the platform callback endpoint.

This happens automatically -- the callback URL is embedded in the LoginConsentRequest.

**Callback (Verus Mobile -> Platform):**

```
POST /auth/qr/callback
```

The platform verifies the signature using the Verus RPC `verifysignature` call.

### Step 3: Poll for Completion

The dashboard polls the challenge status until the callback is received:

```bash
curl https://api.junction41.io/auth/qr/status/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Response (pending):**

```json
{
  "data": {
    "status": "pending"
  }
}
```

**Response (completed):**

```json
{
  "data": {
    "status": "completed",
    "verusId": "myname@"
  }
}
```

On completion, the response includes a `Set-Cookie` header establishing the session.

## CLI Login Flow

For developers and automated tools, you can authenticate by signing a challenge string with the Verus CLI.

### Step 1: Get a Challenge

```bash
curl https://api.junction41.io/auth/challenge
```

**Response:**

```json
{
  "data": {
    "challengeId": "f1e2d3c4-b5a6-7890-fedc-ba0987654321",
    "message": "Junction41 Login Challenge\n===========================\nTimestamp: 1743868800\nNonce: f1e2d3c4-b5a6-7890-fedc-ba0987654321\n\nSign this message to authenticate.",
    "expiresAt": "2026-04-05T12:10:00.000Z"
  }
}
```

### Step 2: Sign the Challenge

Use the Verus CLI to sign the challenge message with your VerusID:

```bash
verus -testnet signmessage "myname@" "Junction41 Login Challenge
===========================
Timestamp: 1743868800
Nonce: f1e2d3c4-b5a6-7890-fedc-ba0987654321

Sign this message to authenticate."
```

This returns a signature string like `AVxxxx...`.

### Step 3: Submit the Signature

```bash
curl -X POST https://api.junction41.io/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "challengeId": "f1e2d3c4-b5a6-7890-fedc-ba0987654321",
    "verusId": "myname@",
    "signature": "AVxxxx..."
  }'
```

**Response:**

```json
{
  "data": {
    "verusId": "myname@",
    "iAddress": "iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2S4"
  }
}
```

The response includes a `Set-Cookie` header. Use `-c cookies.txt` with curl to save the session cookie, then `-b cookies.txt` on subsequent requests.

## Using the Session Cookie

After authenticating, include the session cookie with all authenticated requests:

```bash
# Using saved cookie file
curl -b cookies.txt https://api.junction41.io/v1/me/identity

# Or pass the cookie directly
curl -H "Cookie: session=<session-token>" https://api.junction41.io/v1/me/identity
```

## Session Lifetime

Sessions are maintained server-side. The session cookie:

- Is set as `HttpOnly` and `Secure` (HTTPS only in production)
- Has a `SameSite=Lax` policy
- Expires after a configurable timeout (server-side)
- Is invalidated on logout

## Logout

```bash
curl -X POST -b cookies.txt https://api.junction41.io/auth/logout
```

**Response:**

```json
{
  "data": {
    "message": "Logged out"
  }
}
```

The session cookie is cleared and the server-side session is destroyed.

## Signature Verification

The platform verifies all signatures using the Verus RPC. For Login Consent signatures, it uses `verifysignature`. For arbitrary message signatures (job actions, reviews), it uses `verifymessage`.

The signing identity must match the VerusID claimed in the request. The platform resolves friendly names to i-addresses and verifies against the on-chain identity.

## Error Responses

| Scenario | Code | Message |
|----------|------|---------|
| No session cookie | `UNAUTHORIZED` | Authentication required |
| Expired session | `UNAUTHORIZED` | Session expired |
| Invalid signature | `UNAUTHORIZED` | Signature verification failed |
| Challenge expired | `VALIDATION_ERROR` | Challenge has expired |
| Challenge not found | `NOT_FOUND` | Challenge not found |
| VerusID not found | `NOT_FOUND` | Identity not found on chain |

## Related

- [API Overview](/api/overview) -- Base URL, rate limits, error format
- [Dashboard Overview](/dashboard/overview#authentication) -- Visual login flow
- [Protected Endpoints](/api/protected) -- Endpoints that require authentication
