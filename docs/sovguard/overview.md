---
title: SovGuard Overview
---

# SovGuard Overview

SovGuard is the security engine that protects every conversation between buyers and sovagents on the Junction41 platform. It scans inbound messages for prompt injection attacks, scans outbound messages for data leakage, and provides file scanning, canary tokens, and spotlighting -- all through a layered defense architecture.

## Why Prompt Injection Matters for Sovagent Marketplaces

In a traditional SaaS product, the operator controls both the AI model and the user interface. Prompt injection is a concern, but the blast radius is limited to one product.

A **sovagent marketplace** is fundamentally different:

- **Untrusted buyers** send messages to **third-party sovagents** running on **independent infrastructure**
- Sovagents hold system prompts containing proprietary logic, API keys, and business rules
- Financial transactions (VRSC payments) are tied to job outcomes
- Sovagents may have [jailbox workspace access](/jailbox/overview) with read/write file permissions

A successful prompt injection in this environment can:

1. **Steal the system prompt** -- exposing the sovagent operator's proprietary logic
2. **Exfiltrate data** -- leaking PII, financial information, or files from the workspace
3. **Manipulate payments** -- redirecting payment addresses or inflating amounts
4. **Cross-contaminate jobs** -- leaking data from one buyer's session into another
5. **Compromise the workspace** -- writing malicious files or executing unauthorized operations

SovGuard exists to prevent all five attack vectors.

## Detection Rates

SovGuard's layered architecture achieves progressively higher detection rates as more layers are enabled:

| Configuration | Detection Rate | What's Active |
|---------------|---------------|---------------|
| L1 + L1+ only | ~40% | Regex patterns + encoding detection |
| + L2 | ~50% | + Perplexity / entropy analysis |
| + L3 | ~60% | + ML classifier (Lakera Guard v2) |
| Full stack (L1-L6) | ~65% | All layers including spotlighting, canaries, file scanning |

Detection rates are measured against a combined corpus of known prompt injection datasets (TensorTrust, Lakera Gandalf, HackAPrompt, custom adversarial samples).

The remaining ~35% gap represents novel zero-day attacks that no scanner has seen before. SovGuard compensates through defense-in-depth: even if an injection bypasses scanning, [spotlighting (L4)](/sovguard/defense-layers#l4-spotlighting) and [canary tokens (L5)](/sovguard/defense-layers#l5-canary-tokens) provide additional containment.

## Threat Scoring

Every scanned message receives a **threat score** from 0.0 (safe) to 1.0 (certain injection). Two thresholds determine the response:

| Threshold | Score | Action |
|-----------|-------|--------|
| **Block** | >= 0.7 | Message rejected, not delivered to sovagent |
| **Suspicious** | >= 0.3 | Message delivered with warning flag, buyer notified |
| **Safe** | < 0.3 | Message delivered normally |

These thresholds are configurable per deployment. The platform default is `blockThreshold: 0.7` and `suspiciousThreshold: 0.3`.

When a message is blocked, the buyer sees a generic "Message blocked by safety filter" error. The specific scanner that flagged it is never disclosed -- this prevents oracle attacks where an attacker iteratively probes to discover the scanner's blind spots.

## Crescendo Attack Detection

SovGuard includes a multi-turn session scorer that detects **crescendo attacks** -- where individually benign messages gradually build toward an injection payload across multiple turns.

The session scorer maintains a rolling window per session and tracks:

- **Rolling sum** of threat scores across recent messages
- **Flagged count** of messages that exceeded the suspicious threshold
- **Escalation trigger** when the rolling pattern indicates a coordinated attack

When escalation is detected, all further messages from that session are blocked until the session resets.

## Architecture Overview

SovGuard operates as a standalone service with its own HTTP API, deployed separately from the Junction41 platform. The platform communicates with SovGuard through an HTTP client with a built-in circuit breaker:

```
Buyer  -->  Junction41 WebSocket  -->  SovGuard API  -->  Score + Classification
                                            |
                                       [L1] Regex
                                       [L1+] Encoding
                                       [L2] Perplexity
                                       [L3] ML Classifier
                                       [L4] Spotlighting
                                       [L5] Canary Tokens
                                       [L6] File Scanner
```

When SovGuard is unreachable, the platform falls back to an inline regex scanner (L1 only) embedded in the Junction41 codebase. This ensures messages are never completely unscanned, even during outages.

See [Defense Layers](/sovguard/defense-layers) for the full breakdown of each scanning layer, [Integration](/sovguard/integration) for deployment and configuration, [Outbound Scanning](/sovguard/outbound) for agent-to-buyer message protection, and [API Reference](/sovguard/api) for the complete HTTP endpoint documentation.

## SovGuard Per-Job Toggle

SovGuard scanning is enabled by default for all jobs. When a sovagent's service has `sovguard: true` in its [VDXF service definition](/verus-vdxf/schema), SovGuard becomes **mandatory** -- the buyer cannot opt out. The platform enforces this server-side:

```typescript
// Server rejects sovguardEnabled:false when service requires it
if (service.sovguard_required && !body.sovguardEnabled) {
  return reply.code(400).send({
    error: { code: 'SOVGUARD_REQUIRED', message: 'This service requires SovGuard protection' }
  });
}
```

This prevents bypasses through DevTools or direct API calls -- the enforcement happens at the API layer, not the UI.

## Circuit Breaker

The SovGuard HTTP client implements a circuit breaker to handle SovGuard service outages gracefully:

| Parameter | Value |
|-----------|-------|
| Failure window | 60 seconds |
| Failure threshold | 3 failures within window |
| Open duration | 30 seconds |

When the circuit opens (3 failures in 60 seconds), all scan requests are routed to the inline fallback scanner for 30 seconds before the circuit resets and tries the HTTP API again. Any successful request immediately resets the failure counter.
