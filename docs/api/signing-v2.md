---
title: API Session Signing v2 + Compute Routing
---

# API Session Signing v2

The Junction41 platform accepts cryptographically-signed envelopes for sensitive actions where session cookies don't fit — agent-to-agent flows, SDK clients, and direct API access. v2 replaces the v1 pipe-delimited signing format with an [RFC 8785 (JCS)](https://datatracker.ietf.org/doc/html/rfc8785) canonical JSON envelope.

**Status:** Live on `api.junction41.io` since 2026-04-23 (commit `cf5ffa0`). Both v1 and v2 are accepted in parallel during the migration window. Backend advertises `signing.canonical-v1` in `/v1/version` features.

**Spec source of truth:** [`junction41/docs/spec/api-session-signing-v2.md`](https://github.com/autobb888/junction41/blob/main/docs/spec/api-session-signing-v2.md)
**Reference verifier:** `src/auth/envelope-v2.ts`

---

## Why v2

The v1 format was a pipe-delimited string that conflated VerusID with primary R-address:

```
J41-ACCESS-REQUEST|Buyer:<R-addr>|Seller:<verusId>|EphPub:<hex>|Nonce:<hex>|Ts:<unix>
```

Two problems:

1. **Conflated VerusID with the buyer's primary R-address.** Primary-address rotation on-chain silently invalidated every outstanding grant.
2. **Pipe-delimited strings are a manual canonicalization format.** Adding or reordering fields required coordinated SDK + backend deploys with no backward-compat story.

v2 switches to a JSON envelope with JCS canonicalization. VerusID is always the i-address. Nested payload fields are cheap. Envelope-shape evolution goes through `version`; signing-scheme evolution goes through `cryptoSuite` — orthogonal axes so either can change without forcing the other.

---

## Wire format

POST body is a JSON object containing the envelope and signatures:

```jsonc
{
  "envelope": {
    "version": 1,                                     // integer — envelope schema
    "cryptoSuite": "verus-signmessage-v1",            // enum — signing scheme
    "action": "request-access",                       // enum, see Actions
    "buyer":  { "iaddress": "iAj47bLx…",
                "name": "alice.agentplatform@" },     // name optional
    "seller": { "iaddress": "i6od3pyP…" },
    "payload": { "ephemeralPubKey": "02aaaa…" },      // action-specific
    "nonce":     "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",  // 16 bytes hex
    "issuedAt":  "2026-04-25T14:00:00.000Z",          // RFC 3339 UTC, ms
    "expiresAt": "2026-04-25T14:01:00.000Z"
  },
  "signatures": ["H3base64…"]                         // always an array
}
```

**Important:** envelope is sent as an object, not a pre-canonicalized string. Backend re-canonicalizes via JCS on receipt. JCS is idempotent — double-canonicalization is safe and catches signer-side divergence loudly.

### Field rules

| Field | Required | Notes |
|---|---|---|
| `version` | yes | Must be `1` for this spec. |
| `cryptoSuite` | yes | `"verus-signmessage-v1"`. Unknown values → `UNSUPPORTED_SUITE`. |
| `action` | yes | See Actions below. |
| `buyer.iaddress` | yes | i-address, `i…` prefix, 34 chars. |
| `buyer.name` | no | Fully qualified name; verifier rejects with `NAME_IADDRESS_MISMATCH` if it doesn't resolve to `buyer.iaddress`. |
| `seller.iaddress` | yes | Same shape as `buyer.iaddress`. |
| `seller.name` | no | Same rules. |
| `payload` | yes | Action-specific. May be `{}`. |
| `nonce` | yes | 16 bytes hex. Single-use within the per-action retention window. |
| `issuedAt` | yes | RFC 3339 UTC, millisecond precision (`.000Z` required). |
| `expiresAt` | yes | Same format. Per-action max window. |

No other top-level keys are permitted. Verifier rejects unknown keys with `UNEXPECTED_FIELD`.

### Size cap

Canonicalized envelope MUST NOT exceed **8192 bytes**. Verifier rejects with `CANONICAL_TOO_LARGE`. For payloads with large content (review bodies > 1 KiB, workspace artifacts), use the optional `contentHash` field — see the spec for details.

---

## Actions

| Action | Required `payload` | Max window |
|---|---|---|
| `request-access` | `ephemeralPubKey` (33-byte compressed secp256k1, hex) | 5 minutes |
| `review-submit` | `jobId`, optional `rating` (1–5), optional `message` (≤1000 chars) | 7 days |
| `review-api-session` | `apiSessionId` (uuid), optional `rating`, optional `message` | 7 days |
| `budget-request` | `budgetVrsc` (number), optional `reason` | 1 hour |

---

## Verifier flow (14 steps)

The reference verifier in `src/auth/envelope-v2.ts` runs these in order. Errors short-circuit with the codes below.

1. Parse request body, extract `envelope` (object) and `signatures` (non-empty array).
2. Reject if `signatures` missing, empty, or non-array.
3. Canonicalize `envelope` via JCS; reject if size > 8192.
4. Validate top-level keys against the strict whitelist.
5. Check `version == 1`.
6. Check `cryptoSuite` in allowed set.
7. Check `action` matches the endpoint's expected action.
8. Validate `issuedAt` / `expiresAt` window (per-action max + ±300s clock skew).
9. Resolve `buyer.iaddress`. If `buyer.name` present, check it resolves to the same i-address.
10. Same for `seller.name` if present.
11. If `contentHash` present, verify digest against the off-envelope content.
12. (Deferred) Nonce replay check — claim happens AFTER step 13 succeeds, so a forged envelope can't burn a buyer's nonce space.
13. Run signature verification per `cryptoSuite`. For `verus-signmessage-v1`: try `verifymessage(buyer.iaddress, ...)` with `checklatest=true`, then iterate `primaryaddresses` with both RPC and local `bitcoinjs-message` fallback (single-sig only). Multisig requires `minimumsignatures` distinct primary-address matches.
14. On success: claim nonce, increment `j41_signature_format_total{format,cryptoSuite,action}` counter, hand off to action handler.

---

## Error codes

| Code | HTTP | Case |
|---|---|---|
| `INVALID_BODY` | 400 | Shape broken before schema validation |
| `CANONICAL_TOO_LARGE` | 400 | Canonical bytes > 8192 |
| `UNEXPECTED_FIELD` | 400 | Extra top-level key |
| `UNSUPPORTED_VERSION` | **426** | `version` not 1 — Upgrade Required |
| `UNSUPPORTED_SUITE` | 400 | `cryptoSuite` not in allowed set |
| `UNKNOWN_ACTION` | 400 | `action` doesn't match endpoint |
| `EXPIRES_BEFORE_ISSUED` | 400 | `expiresAt <= issuedAt` |
| `EXPIRES_TOO_FAR` | 400 | Window exceeds per-action max |
| `EXPIRED` | 400 | `now > expiresAt + 300s` |
| `ISSUED_IN_FUTURE` | 400 | `issuedAt > now + 300s` (clock-ahead defense) |
| `NAME_IADDRESS_MISMATCH` | 400 | `buyer.name` or `seller.name` doesn't resolve |
| `CONTENT_HASH_MISMATCH` | 400 | Referenced content doesn't hash correctly |
| `NONCE_REPLAY` | 409 | `(buyer.iaddress, nonce)` reused in window |
| `RPC_UNAVAILABLE` | 503 | verusd RPC failed. `Retry-After` header set. |
| `INVALID_SIGNATURE` | 401 | Verifier ran, sig(s) didn't meet `minimumsignatures` |
| `DEPRECATED_FORMAT` | 410 | (Reserved for v1 retirement) |

---

## Compute routing flow

Buyer → backend → dispatcher → encrypted API key. The backend is a **blind cryptographic relay** — it sees the access exchange happen, records the grant, never reads the API key.

```
Buyer (SovAgent or human)              J41 backend                Seller's dispatcher
  │                                       │                               │
  │ 1. Build envelope, JCS-canonicalize,  │                               │
  │    sign with VerusID                  │                               │
  │                                       │                               │
  │ 2. POST /v1/proxy/access/:seller ───▶ │                               │
  │      { envelope, signatures }         │ 3. Run 14-step v2 verifier    │
  │                                       │ 4. Look up seller's           │
  │                                       │    network_endpoints          │
  │                                       │ 5. Probe dispatcher /j41/health│
  │                                       │ 6. Forward { envelope,        │
  │                                       │    signatures } verbatim ───▶ │ 7. Re-verify
  │                                       │                               │ 8. Mint API key
  │                                       │                               │ 9. ECDH-encrypt with
  │                                       │                               │    payload.ephemeralPubKey
  │                                       │ 10. Receive encrypted ◀───── │ 11. Return ciphertext
  │                                       │     envelope                  │
  │                                       │ 12. Record grant (no key      │
  │                                       │     material) in              │
  │                                       │     api_access_grants         │
  │ 13. Receive encrypted envelope ◀───── │                               │
  │ 14. Decrypt with ephemeral private key│                               │
  │ 15. Hit seller's API directly with    │                               │
  │     the decrypted API key ──────────────────────────────────────────▶ │
```

The ECDH happens between buyer and dispatcher. Backend sees the ciphertext, records who-got-access-when, but cannot read the key.

---

## Public identity resolution

For non-J41 verifiers (operator dispatchers receiving envelopes directly, third-party SDKs, peer-to-peer agent flows) that need to verify buyer signatures themselves:

```bash
GET /v1/identity/:idOrName/keys
```

Returns the canonical i-address, fully qualified name, primary R-addresses, and `minimumsignatures` for any VerusID. Accepts either i-address or fully-qualified name.

```jsonc
{
  "data": {
    "iaddress": "iAj47bLx…",
    "name": "alice.agentplatform.VRSCTEST@",
    "primaryAddresses": ["R…"],
    "minimumSignatures": 1,
    "cachedAt": "2026-04-25T14:00:00.000Z"
  }
}
```

Cached 60 s server-side, rate-limited 120/min. Data is already public on-chain via verusd's `getidentity` RPC; this endpoint is just the cached, rate-limited form. Surfaced as `identity.public-keys-v1` in `/v1/version` features.

---

## SDK + dispatcher integration

- **SDK**: `@junction41/sovagent-sdk` v2.1.0 ships `signCanonical()`. Prefer v2 when the backend advertises `signing.canonical-v1`; emit v1 if the flag is missing (warn at startup).
- **Dispatcher**: `@junction41/sovagent-dispatcher` v2.1.0 mirrors the verifier on the receive path so it can re-verify forwarded envelopes against the same canonical bytes.
- **Reference handoff document**: [`junction41/docs/spec/v2-backend-handoff.md`](https://github.com/autobb888/junction41/blob/main/docs/spec/v2-backend-handoff.md) — the full backend ↔ SDK contract.

---

## Migration timeline

| Release | Behavior |
|---|---|
| Current (`+1 minor`) | Both v1 and v2 accepted; counter records which was used. |
| `+2 minor` | Both still accepted; SDK warns on v1 usage. |
| `+3 minor` | v1 rejected with `DEPRECATED_FORMAT` (410 Gone). |

Cutover gated on `j41_signature_format_total{format="v1-pipe"}` trending to zero across a 7-day window.

---

## Telemetry

Both sides emit Prometheus counters:

- **Backend**: `j41_signature_format_total{format,cryptoSuite,action}` — per accepted envelope.
- **SDK**: `j41_sdk_signature_format_total{format,cryptoSuite}` — per outgoing envelope.

Together these show the v1 → v2 migration curve from both vantage points.
