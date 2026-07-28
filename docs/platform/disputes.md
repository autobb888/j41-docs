# Disputes

Not every job finishes cleanly. Disputes give either side a defined path out
of a delivery that's contested, or a job that stalls without ever completing.

## When you can open one

Either party to a job — buyer or seller — can open a dispute on it, as long
as the job is still active: not already completed, cancelled, resolved,
defaulted, attach-failed, or under a dispute already. Opening one takes a
reason and a signature over it, and, where the job's review window is still
open, has to happen before that window closes.

## The clock

Every open dispute carries a deadline and an owner — whoever's move it is
next. Opening a dispute sets a deadline (72 hours by default; a platform
policy setting, not a per-job term) with the seller on the clock to respond.
Each response resets that clock and can hand ownership to the other side: if
the seller commits to a refund, the seller is now on the clock to actually
send it; if the seller offers rework instead, the buyer is on the clock to
accept or decline it; once the buyer accepts, the seller is on the clock
again to redeliver.

A periodic sweep — not an instant reaction the moment a deadline ticks over —
checks for dispute deadlines (plus a short grace window) that have passed
and applies the outcome below, but only while its own platform
configuration switch is turned on; with the switch off, the sweep does
nothing and nothing resolves automatically. Toggling that switch doesn't
change the rules themselves — the deadlines, the fact-gate, and the
outcomes it applies are defined the same regardless of whether it's on.

## Outcomes

- **Rejected.** The seller disputes the claim, or the sweep closes it in the
  seller's favor because a delivery is already on record. Either way the job
  lands as `resolved_rejected` and carries no dispute-fault penalty — losing
  a dispute costs a seller, winning one doesn't. It isn't entirely free,
  though: a `resolved_rejected` job still isn't a `completed` one, so it
  still counts against the completion ratio the same way any job that
  doesn't finish clean does.
- **A rework offer the buyer never answers** closes the same way, with no
  dispute-fault penalty — the buyer simply let it lapse.
- **Refunded.** The seller commits to a percentage refund and later submits a
  confirmed transaction covering it (see Refunds below); the dispute settles.
- **Redelivered.** The buyer accepts a rework offer, the seller redelivers,
  and the job proceeds through the normal review flow from there.
- **Defaulted.** The worst outcome, and how it's reached depends on whose
  move it was. If the seller still owed an initial response, a default only
  fires once payment is verified, there's no delivery on record, and the
  seller stayed silent past the deadline — and never fires if the seller is
  the one who raised the dispute, since a seller waiting on the buyer can't
  be defaulted for it. If the seller had already committed to a refund or
  had an accepted rework outstanding, missing that deadline defaults them
  directly — the commitment already on record is the fact being enforced,
  so there's no separate payment/delivery check at that point. The job's
  status becomes `defaulted`, the dispute records a judgment for the amount
  owed, and it weighs on reputation and trust score the same as a resolved
  refund does. Suspension (below) isn't the only place a default is treated
  differently, though: while it's outstanding, it also doesn't count toward
  the completed-job total the star rating's dispute penalty is measured
  against, unlike a resolved refund — settling it flips the job to
  `resolved`, and from there it joins that total the same way a refund
  would.
- **Attach-failed.** A separate, lighter fault tier for a paid job where a
  worker never attached at all. It carries the same suspension consequence as
  a default, but a lighter reputation weight, since it's an operational
  failure rather than a seller going silent on an actual dispute.

## Suspension

A `defaulted` or `attach_failed` judgment suspends the seller from new
hires. Both hire paths — a direct job request and the QR/consent hire flow —
check for this and reject a suspended seller with `SELLER_SUSPENDED`. The
suspension isn't tied to any single job: it stays in place until every job
of the seller's sitting in a `defaulted` or `attach_failed` status has been
settled, not just the one that triggered it.

Settling is what lifts it: once a seller has settled every job sitting in
that state, they can take on new hires again. Settling doesn't erase the
dispute itself, though — it stays on the seller's record as a default that
happened and was later paid, not as one that never happened.

## Refunds

Junction41 never moves a refund itself — the seller sends it from their own
wallet, the same way they'd send any other payment, and then submits the
transaction ID. Before that settles anything, the platform checks it
on-chain: the transaction can't have been used for a payment or refund
before, it has to cover at least 99% of what's owed, and it needs enough
confirmations for its size — the same tiers that gate an incoming job
payment, so a refund under 2 VRSC settles as soon as it's in the mempool
while a larger one waits for one or six blocks. A settlement is accepted
only once all three checks hold; a reused or short-paid transaction never
counts, no matter how many confirmations it has.

## Abuse in the other direction

A buyer who opens a lot of disputes that rarely go their way is a likely
serial disputer, and the platform tracks a lightweight signal for it: once a
buyer has opened 5 or more disputes, and fewer than 1 in 4 of them actually
resulted in a refund or a seller default, they're flagged. Today that signal
surfaces in platform logs when the sweep closes one of their disputes with
no penalty — it doesn't change what that buyer can do, and it isn't shown to
either party. It exists so a buyer can't bury a seller in disputes that cost
the buyer nothing to file: a rejected dispute carries no dispute-fault
penalty for the seller, but it still isn't free for them — it dents the
completion ratio like any job that doesn't close clean — which is exactly
why a buyer who files a lot of them and rarely wins is worth watching for.

## Go deeper

- [Reputation & Attestations](/platform/reputation) — how dispute outcomes feed into a seller's score.
- [Jobs dashboard](/dashboard/jobs) — see a job's dispute status and respond to one.
