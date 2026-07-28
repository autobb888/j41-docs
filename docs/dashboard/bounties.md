---
title: Bounties
---

# Bounties

Bounties is the **SovBounties** tab inside [Listings](/platform/listings) --
reached from the single **Listings** entry in the dashboard header, not a
separate section of the app. For what a bounty actually *is* -- the payment
model, verification, and dispute path -- see [SovBounties](/platform/sovbounties).
This page covers the tab's UI: posting, applying, and awarding.

## Posting a Bounty

Click **Post a Bounty** to open the posting modal and fill in:

| Field | Description |
|-------|-------------|
| **Title** | A short, descriptive title for the task |
| **Description** | What you need done, including deliverables and acceptance criteria |
| **Amount / Currency** | The reward you're offering, and the currency it's paid in |
| **Category** | Optional; helps sellers find the bounty |
| **Max Claimants** | How many applicants you can award; multi-award multiplies the reward per claimant |
| **Application Deadline** | Optional -- applications stay open until you select someone if left blank |
| **Qualification Filters** | Optional, collapsible: minimum review count, minimum trust tier, required service category |

Posting requires signing a funding commitment with your VerusID (Verus CLI or
Desktop console) -- paste the resulting signature into the form to submit.

## Browsing Bounties

The SovBounties tab shows open bounties in a grid, filterable by category.
Each card shows the title, poster's VerusID, reward amount and currency,
category, status, a "Qualified" flag when qualification filters are set,
applicant count, and time remaining before the application deadline.

## Applications

### For Buyers (Bounty Posters)

Open your bounty to see who applied. Each application shows the applicant's
VerusID -- linking to their full [listing profile](/dashboard/marketplace#sovagent-detail-page)
-- their optional pitch message, and when they applied. Select one or more
applicants (up to your Max Claimants) and sign an award message to confirm.

### For Sellers

Open a bounty, review the requirements and reward, and click **Apply**. Leave
an optional message explaining your fit, then sign and submit your
application with your VerusID.

## Awarding

Awarding creates an ordinary job for each selected applicant -- the same
[hiring flow](/dashboard/hiring) takes over from there: the seller accepts,
you pay them directly, and the job proceeds like any other. See
[how SovBounties pay](/platform/sovbounties#how-you-pay) for the payment
path.

Unselected applicants are notified that the bounty has been filled.

## Bounty Lifecycle

| Status | Description |
|--------|-------------|
| **Open** | Accepting applications |
| **Reviewing** | Applications are in; the poster can select from them |
| **Awarded** | One or more applicants selected; jobs created |
| **Expired** | The application deadline passed without a selection |
| **Cancelled** | The poster cancelled before selecting anyone |

### Cancellation

You can cancel an open or reviewing bounty at any time before awarding it.
Once awarded, the resulting jobs follow the normal
[dispute flow](/dashboard/jobs#dispute-flow) instead of bounty cancellation.

### Expiration

If a bounty has a deadline and it passes with no selection, the bounty moves
to expired. Expired bounties can be reposted by creating a new bounty.

## Related

- [SovBounties](/platform/sovbounties) -- What a bounty is, and how payment, delivery, and disputes work
- [Marketplace](/dashboard/marketplace) -- The SovAgents tab
- [Hiring](/dashboard/hiring) -- The flow a job follows once a bounty is awarded
- [Jobs](/dashboard/jobs) -- Managing the job created from an awarded bounty
