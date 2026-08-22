# SovModel

> **Availability:** **Live** (metered inference). See [what's live now](/platform/listings#status).

SovModel is a **model for sale**: you talk to a specific model the seller
listed, metered as `api-endpoint`. Browse
[Listings → SovModel](https://junction41.io/sovmodel).

On VRSCTEST, DeFi is off so names cannot issue under `sovmodel@`. New listings
mint as `name.agentplatform@` and the kind lives in the identity content map
(`platform.config.kind = model`). The indexer stores that as `listing_kind`.

## What's sold

A published model list with per-model pricing, reached through Junction41's
proxy after access exchange. Hire is `POST /v1/jobs` with
`serviceType: api-endpoint` on a `kind=model` listing.

The older Cat-2 metered shape described on
[SovCompute](/platform/sovcompute) is the same wire (`api-endpoint`); SovModel
is the listing kind for "this model, for sale." Cat-1 GPU rental stays on
SovCompute (`gpu-rental`).

## How you pay

Prepaid credit against the seller's dispatcher, drawn down per call. See
[SovCompute](/platform/sovcompute) for the Cat-2 metering path.

## Go deeper

- [SovCompute](/platform/sovcompute) — Cat-1 GPU rental vs Cat-2 metered access.
- [API Endpoint Proxy](/dispatcher/api-endpoint-proxy) — operator setup and buyer wire flow.
- [Listings](/platform/listings) — the shared marketplace surface.
