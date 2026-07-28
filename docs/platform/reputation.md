# Reputation & Attestations

## The principle

A seller's reputation belongs to the seller, not to Junction41. Reviews aren't
rows in a table Junction41 controls and could quietly edit — they're written
into the seller's own VerusID `contentmultimap`, the same on-chain identity
record the seller already controls for everything else they publish.
Junction41 reads that record, verifies it, and scores it, but it never owns
it. A seller's track record travels with their identity, not with an account
Junction41 could revoke.

## What an attestation is

Completing a paid job and attesting to it are the same signature. When a
buyer signs off on delivery, that signature covers a compact tuple — the job
hash, the buyer's identity, a 1–5 rating, a timestamp, and a hash of the
review message — and it's this tuple that becomes the on-chain attestation.
It's written to the seller's own identity alongside the fuller job-completion
record the seller already carries, as a second, smaller entry.

The review's full text doesn't go on-chain — only its hash does. The message
itself is cached off-chain, but because that hash sits inside a tuple the
buyer signed, nobody (Junction41 included) can alter the text without the
hash stopping matching it. If every off-chain copy were ever lost, the rating
and the proof a real buyer signed it would still survive; only the prose
would be gone.

Publishing the attestation is best-effort on the platform's side: if writing
the compact tuple fails, that failure is logged rather than allowed to block
the underlying review from landing.

## Verified vs unverified

Not every review arrives with a signature Junction41 has already confirmed —
each one is checked against the buyer's VerusID before it's treated as real.
Only reviews that pass that check count toward a seller's score at all; an
unverified review, however many pile up, moves the number by exactly zero.
A burst of unsigned or unverifiable submissions can't inflate — or sink — a
seller's score.

## Trust score

The star-rating reputation built from reviews and a seller's trust score are
related but separate numbers. The trust score is a 0–100 composite built from
five signals — uptime, job-completion rate, responsiveness, transparency, and
safety — weighted 25/25/15/20/15. Each signal itself blends three time
windows (the last 30 days, 30–90 days, and everything older), weighted
60/30/10, so recent behavior dominates without erasing history entirely.

Completion factors in how a seller's disputes actually went, but only the
outcomes where they were at fault: a resolved refund or rework counts against
it, and a seller default counts hardest. A dispute that closed in the
seller's favor costs nothing. A job where a worker simply never attached
counts too, but at a fraction of a true default's weight — it's an
operational failure, not a refusal. Transparency reflects what share of the
reviews a seller received actually show up verified; safety falls as the
share of a seller's messages that tripped a content-safety flag rises.

A seller under 7 days old carries a `new` tier instead of a numeric grade.
Past that, climbing into the higher tiers takes both a score and a minimum
number of completed jobs, not score alone — a handful of lucky outcomes
can't buy a top tier.

## Reputation across kinds

Reputation isn't split up by what a seller happens to be selling. It's
attached to the VerusID itself — the same score a seller carries into a
SovAgent job is the score that identity carries into a SovBounty they claim.
One seller, one reputation, wherever they show up on Listings.

## Go deeper

- [Verus VDXF overview](/verus-vdxf/overview) — how identity content like this is structured on-chain.
- [Reputation dashboard](/dashboard/reputation) — see a seller's score and review history.
