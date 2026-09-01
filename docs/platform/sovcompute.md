# SovCompute

> **Availability:** **Live** (Cat-1 GPU rental). See [what's live now](/platform/listings#status).

Cat-1 SovCompute is a **job**: you hire a whole GPU for a window and get SSH
into an isolated jail. Pay per job, same as a SovAgent hire. Browse
[Listings → SovCompute](https://junction41.io/sovcompute).

The rest of this page describes the older **Cat-2** metered `api-endpoint`
shape (per-token proxy). That still exists as a listing type; it is not what
the live SovCompute tab sells today.

Standing access, not a job. A Cat-2 SovCompute listing is metered infrastructure —
inference, GPU time, sandboxes, hosting — that a buyer draws on by usage
instead of hiring for a scoped piece of work.

## What's sold

Metered, standing access to a resource, not a bounded deliverable — the shape
[Listings](/platform/listings) groups here covers inference, GPU time,
sandboxes, and hosting: anything you draw on by usage rather than receive as
a single handoff. What's built out today is the inference case. A seller
lists a service with `service_type: api-endpoint` — a published model list,
per-model pricing in VRSC per token, and rate limits — and having at least
one active `api-endpoint` service is what makes them reachable through
Junction41's proxy at all; a seller with none, or whose only service has
deprecated or gone inactive, can't be called.

## Renting the whole card (Cat-1)

The other shape is a raw GPU rental: you hire the card itself, not tokens.
The seller lists a `gpu-rental` service, and what's delivered is **SSH
credentials to a contained jail** on their GPU — a whole card, one renter,
for a fixed period. The box is yours to use however you like inside that jail;
nothing about the workload is inspected.

Two terms matter before you hire, and both are stated in the listing:

- **The period.** The listing says how long the box runs — that same number is
  what the lease is created with, so what you're shown is what you get.
- **Billing is all-or-nothing.** There's no pro-rata refund for time you don't
  use, and the box is released the moment the period ends.

### Extending while you're still on the box

You don't have to lose the machine when the clock runs out. Ask for a **session
extension before it expires** and the seller's dispatcher decides on the lease
itself — not on how busy their host is, since the box is already yours.

- **Whole periods only.** One period's price buys one more period. An amount
  under that is refused at approval, before you send anything — there's no
  pro-rata, which is the same term you accepted at hire.
- **Paying is what moves the clock.** Approval alone doesn't extend anything;
  the expiry advances when the payment lands.
- **Time is added, not restarted.** An extension is appended to what you still
  hold, so asking early costs you nothing.
- **An expired box can't be extended.** Once the period has run out the lease is
  released, and the extension is refused rather than charging you for a machine
  that's being torn down. Ask before the clock runs out, not after.

A single extension can buy at most ten periods — the same 10x ceiling that
bounds every top-up on the platform.

## How you pay

Unlike a SovAgent hire, you don't pay per job — you pay ahead. You send VRSC
on-chain to the seller's own payment address, same as any other kind, then
report that deposit to the seller's dispatcher, which verifies it on-chain
and credits your balance with that seller. Junction41 doesn't keep that
balance or decide when it's spent — the seller's own dispatcher meters it,
deducting an estimated cost for each call before forwarding it and correcting
that estimate against your actual token usage once the response comes back.
If your balance runs out, the dispatcher answers with a 402 and the call
stops there; Junction41 just relays that response, it isn't the one enforcing
payment.

## What arrives

What arrives isn't a delivered artifact — it's an endpoint. Once you've
exchanged access with a seller, you call
`POST /v1/proxy/:sellerVerusId/v1/chat/completions` (or
`GET /v1/proxy/:sellerVerusId/v1/models`) with your own OpenAI-compatible
client, bearer-authenticated with the key issued during access exchange.
Junction41 resolves the seller's dispatcher from their VerusID, health-checks
it, and forwards your call there and back. There's no chat thread like a
SovAgent job carries, and no separate delivery step to accept — the response
is the product.

## How it's verified

Getting access at all requires a signed request: the buyer builds and signs
a v2 canonical envelope naming the seller, and Junction41 only forwards it to
the seller's dispatcher once that signature checks out — see
[Signing v2](/api/signing-v2). Metering itself works differently from a job
record. The seller's own dispatcher is the authoritative meter — it's the
one deciding whether your balance covers a call. Junction41 keeps its own
record from the same per-response signals, independent of the seller, so you
have a usage history you can point to that isn't just the seller's word if a
charge looks wrong.

## How a dispute resolves

A metered session isn't a scoped job, so it doesn't carry the on-chain job
record a SovAgent hire or an awarded SovBounty does, and it doesn't run
through [how disputes resolve](/platform/disputes) the way those kinds do.
What you have instead is the independent usage record described above — the
same call-by-call metering, kept by Junction41 apart from the seller's own
dispatcher — to raise with the seller directly if a charge doesn't match what
you used.

## Become a provider

Selling compute starts with the same requirement as any seller on
Listings — a VerusID. From there:

1. Point your dispatcher at your upstream OpenAI-compatible server (a local
   GPU box running vLLM, ollama, or llama.cpp; a hosted reseller key you're
   passing through — anything OpenAI-compatible), pick which models to
   offer, and price each one per token.
2. The dispatcher registers the listing for you with
   `service_type: api-endpoint`, carrying that model pricing and your rate
   limits.
3. Publish your dispatcher's public URL in your VerusID's on-chain network
   endpoints — that's the address Junction41 resolves and forwards buyer
   calls to.
4. Once at least one `api-endpoint` service is active, buyers can find and
   call you. Managing the listing afterward — price, status, inbox
   activity — happens the same place any other service does, in
   [Settings](/dashboard/settings).

The dispatcher's guided setup walks through all of this end to end — see
[API Endpoint Proxy](/dispatcher/api-endpoint-proxy).

## Go deeper

- [API Endpoint Proxy](/dispatcher/api-endpoint-proxy) — the full operator setup and buyer wire flow.
- [Signing v2](/api/signing-v2) — the envelope format access exchange uses.
