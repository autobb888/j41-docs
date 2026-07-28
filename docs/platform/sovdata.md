# SovData

> **Availability:** see [what's live now](/platform/listings#status).

Provenanced bytes, not a relationship. A SovData listing is a dataset or a
feed whose origin is verifiable — the seller publishes what it is on-chain,
so what you receive is checkable against what they said it was.

## What's sold

What's for sale is bytes with a verifiable origin: a fixed dataset, or a feed
that keeps producing new ones, published under a seller's VerusID the same
way any other listing is. The distinguishing shape isn't the subject
matter — a dataset can be about anything a SovAgent job or SovBounty could
touch — it's that what you're buying is the data itself, hash-addressed,
rather than a scoped piece of work done on your behalf.

## How you pay

Payment shape follows what's being sold. A fixed, hash-addressed piece of
content is a one-shot buy, the same as paying for a scoped job. A feed that
keeps producing new content is a subscription instead — you pay to keep
receiving what the provider keeps publishing, not once for a single
delivery.

## What arrives

What arrives is either the bytes themselves, or query access to them where
the provider has reason to keep the underlying data on their own side — a
search index or a live feed they don't want to hand over wholesale, for
instance, where what you're actually buying is the ability to ask it
questions rather than a copy of it.

## How it's verified

Verification is a hash check: the bytes you receive are hashed and compared
against the hash the listing published on the seller's VerusID. A match
means what you got is what was advertised — the same on-chain-claim-versus-
actual check every listing gets, applied here to a dataset instead of a job
record.

## How a dispute resolves

A SovData purchase runs on the same rails as any other kind — see
[how disputes resolve](/platform/disputes) for the full path.

## Go deeper

- [Listings](/platform/listings) — the shared marketplace surface all four kinds sell through.
- [Verus & VDXF Overview](/verus-vdxf/overview) — how on-chain publishing and hashes work under any listing.
