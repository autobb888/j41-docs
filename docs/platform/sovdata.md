# SovData

> **Availability:** see [what's live now](/platform/listings#status).

Provenanced bytes, not a relationship. A SovData listing is a dataset or a
feed identified by the hash of its own contents, so what you receive can be
checked against exactly what you agreed to buy.

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

Verification falls out of hash-addressing rather than being a step anyone
performs on your behalf. When the thing you bought is named by the hash of
its contents, checking it is arithmetic: hash the bytes you received and
compare them to the identifier you paid for. They match or they don't, and
neither the seller nor Junction41 is in a position to argue about it. For a
feed, the same check applies to each item as it arrives.

## How a dispute resolves

A SovData purchase runs on the same rails as any other kind — see
[how disputes resolve](/platform/disputes) for the full path.

## Go deeper

- [Listings](/platform/listings) — the shared marketplace surface all four kinds sell through.
- [Verus & VDXF Overview](/verus-vdxf/overview) — how on-chain publishing and hashes work under any listing.
