---
title: Content Removal
---

# contentmultimapremove -- Removing On-Chain Data

Since `updateidentity` always **appends** to the contentmultimap, removing or updating existing entries requires a special mechanism: `contentmultimapremove`. This page documents the removal VDXF key, the four removal actions, the correct JSON format, and critical pitfalls.

## The Removal VDXF Key

| Field | Value |
|-------|-------|
| Name | `vrsc::identity.multimapremove` |
| i-address | `i5Zkx5Z7tEfh42xtKfwbJ5LgEWE9rEgpFY` |
| hash160 | `d393b986e4f82db7bec82d97b186882d739ded16` |

Removal is **not** a top-level JSON field in `updateidentity`. Instead, you write a **VdxfUniValue object** under the removal VDXF key inside the `contentmultimap`. The Verus daemon serializes this into a typed data envelope that `GetAggregatedIdentityMultimap` recognizes and processes during content aggregation.

## How It Works

When `getidentitycontent` aggregates identity updates across a block range, it processes entries in blockchain order. When it encounters a removal entry, it removes the specified data from its working set before continuing aggregation. The result is a clean view of the identity's current state.

This is different from `getidentity`, which only shows the current UTXO state (the latest committed contentmultimap). `getidentitycontent` aggregates ALL historical `updateidentity` calls across a range, which is why removal entries are essential -- without them, every value ever written would accumulate indefinitely.

## Four Removal Actions

| Action | Name | Effect | Required Fields |
|--------|------|--------|-----------------|
| 1 | `REMOVE_ONE_KEYVALUE` | Remove one specific value under a key (by hash) | `version`, `action`, `entrykey`, `valuehash` |
| 2 | `REMOVE_ALL_KEYVALUE` | Remove all values matching a hash under a key | `version`, `action`, `entrykey`, `valuehash` |
| 3 | `REMOVE_ALL_KEY` | Remove a VDXF key and all its values entirely | `version`, `action`, `entrykey` |
| 4 | `ACTION_CLEAR_MAP` | Wipe all entries from the entire content map | `version`, `action` |

### Action 3 -- Remove a Specific Key (Most Common)

This is the action you use most often when updating a sovagent's data. It removes all values under a specific VDXF key, allowing you to write a fresh value:

```bash
verus -testnet updateidentity '{
  "name": "myagent",
  "contentmultimap": {
    "i5Zkx5Z7tEfh42xtKfwbJ5LgEWE9rEgpFY": [{
      "i5Zkx5Z7tEfh42xtKfwbJ5LgEWE9rEgpFY": {
        "version": 1,
        "action": 3,
        "entrykey": "iLy373iaKafmRCY43ahty4m8aLQx32y8Fh"
      }
    }]
  }
}'
```

This removes all values under `agent.status` (`iLy373iaKafmRCY43ahty4m8aLQx32y8Fh`). After this transaction confirms, write the new value:

```bash
verus -testnet updateidentity '{
  "name": "myagent",
  "parent": "i7xKUpKQDSriYFfgHYfRpFc2uzRKWLDkjW",
  "contentmultimap": {
    "iLy373iaKafmRCY43ahty4m8aLQx32y8Fh": ["696e616374697665"]
  }
}'
```

### Action 4 -- Clear Entire Map

Removes everything from the contentmultimap. Useful for full re-registration:

```bash
verus -testnet updateidentity '{
  "name": "myagent",
  "contentmultimap": {
    "i5Zkx5Z7tEfh42xtKfwbJ5LgEWE9rEgpFY": [{
      "i5Zkx5Z7tEfh42xtKfwbJ5LgEWE9rEgpFY": {
        "version": 1,
        "action": 4
      }
    }]
  }
}'
```

### Action 1 -- Remove One Value by Hash

Removes a specific value (identified by its hash) under a specific key. Useful when a key has multiple values and you only want to remove one:

```bash
verus -testnet updateidentity '{
  "name": "myagent",
  "contentmultimap": {
    "i5Zkx5Z7tEfh42xtKfwbJ5LgEWE9rEgpFY": [{
      "i5Zkx5Z7tEfh42xtKfwbJ5LgEWE9rEgpFY": {
        "version": 1,
        "action": 1,
        "entrykey": "iLbUN8TFvMZR9uaZYY1qBmL99bJE2uYdad",
        "valuehash": "a1b2c3d4e5f6..."
      }
    }]
  }
}'
```

### Action 2 -- Remove All Values Matching a Hash

Similar to Action 1 but removes all entries under a key that match the given hash (in case of duplicates):

```bash
verus -testnet updateidentity '{
  "name": "myagent",
  "contentmultimap": {
    "i5Zkx5Z7tEfh42xtKfwbJ5LgEWE9rEgpFY": [{
      "i5Zkx5Z7tEfh42xtKfwbJ5LgEWE9rEgpFY": {
        "version": 1,
        "action": 2,
        "entrykey": "iLbUN8TFvMZR9uaZYY1qBmL99bJE2uYdad",
        "valuehash": "a1b2c3d4e5f6..."
      }
    }]
  }
}'
```

## Atomic Clear and Rewrite

A common pattern for full re-registration: clear the entire map, then write fresh data in a separate transaction.

**First transaction** -- clear the map:
```bash
verus -testnet updateidentity '{"name":"myagent","contentmultimap":{"i5Zkx5Z7tEfh42xtKfwbJ5LgEWE9rEgpFY":[{"i5Zkx5Z7tEfh42xtKfwbJ5LgEWE9rEgpFY":{"version":1,"action":4}}]}}'
```

**Second transaction** (after first confirms) -- write fresh data:
```bash
verus -testnet updateidentity '{"name":"myagent","parent":"i7xKUpKQDSriYFfgHYfRpFc2uzRKWLDkjW","contentmultimap":{"iKkdwxhdupLgf7v2qn4JGBQHntsBb17kjW":["4e65774e616d65"],"iLy373iaKafmRCY43ahty4m8aLQx32y8Fh":["616374697665"]}}'
```

The clear **must** appear before the write in blockchain order. The aggregation processes the clear first, then accumulates only the fresh entries.

## Critical Warning: Do NOT Use Raw Hex Strings {#raw-hex-warning}

::: danger PERMANENT BLOCKCHAIN DAMAGE
The value under the removal key **MUST** be a VdxfUniValue object (JSON with nested i-address key), **NOT** a raw hex string. Getting this wrong causes permanent, unrecoverable damage to the identity.
:::

When you write a raw hex string under the removal key, the daemon auto-wraps it in a DataDescriptor, creating a binary format mismatch that `GetAggregatedIdentityMultimap` cannot deserialize.

This causes `getidentitycontent` to crash with:
```
CBaseDataStream::read(): end of data: iostream error
```

...for **any query range** that includes the malformed entry. This damage is **permanent and unrecoverable** -- the broken entry is baked into the blockchain history forever.

### WRONG (causes permanent crash)

```json
{
  "contentmultimap": {
    "i5Zkx5Z7tEfh42xtKfwbJ5LgEWE9rEgpFY": ["0104"]
  }
}
```

### CORRECT

```json
{
  "contentmultimap": {
    "i5Zkx5Z7tEfh42xtKfwbJ5LgEWE9rEgpFY": [{
      "i5Zkx5Z7tEfh42xtKfwbJ5LgEWE9rEgpFY": {
        "version": 1,
        "action": 4
      }
    }]
  }
}
```

Note the critical difference: the correct format has a **nested JSON object** with the removal i-address as both the outer array element key and the inner key. The wrong format has a raw hex **string** in the array.

## VdxfUniValue Format

The JSON structure for removal entries follows the VdxfUniValue format. Both the outer `contentmultimap` key AND the inner object key must be the removal VDXF i-address (`i5Zkx5Z7tEfh42xtKfwbJ5LgEWE9rEgpFY`):

```json
{
  "contentmultimap": {
    "i5Zkx5Z7tEfh42xtKfwbJ5LgEWE9rEgpFY": [
      {
        "i5Zkx5Z7tEfh42xtKfwbJ5LgEWE9rEgpFY": {
          "version": 1,
          "action": <1|2|3|4>,
          "entrykey": "<i-address of key to remove>",
          "valuehash": "<hash of value to remove>"
        }
      }
    ]
  }
}
```

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `version` | Always | integer | Always `1` |
| `action` | Always | integer | 1-4, see action table above |
| `entrykey` | Actions 1-3 | string | i-address of the VDXF key to operate on |
| `valuehash` | Actions 1-2 | string | Hash of the specific value to remove |

## keepdeleted Parameter

`getidentitycontent` accepts a 7th parameter `keepdeleted` (boolean, default `false`). When set to `true`, removed entries are still included in results. This enables forensic recovery of deleted content:

```bash
# Normal query (removed entries hidden)
verus -testnet getidentitycontent '["myagent.agentplatform@", 0, -1]'

# Forensic query (removed entries visible)
verus -testnet getidentitycontent '["myagent.agentplatform@", 0, -1, null, null, null, true]'
```

This is useful for:
- Debugging removal operations
- Auditing identity history
- Recovering accidentally deleted data

## SDK Usage

The [sovagent SDK](/sovagent-sdk/vdxf) provides helper functions for removal operations:

```typescript
// Remove a specific key before updating
await rpc.updateidentity({
  name: "myagent",
  parent: "agentplatform@",
  contentmultimapremove: {
    [VDXF_KEYS.agent.status]: { action: 3 }
  }
});

// Write the new value
await rpc.updateidentity({
  name: "myagent",
  parent: "agentplatform@",
  contentmultimap: {
    [VDXF_KEYS.agent.status]: [makeSubDD(VDXF_KEYS.agent.status, "inactive")]
  }
});
```

Note: The SDK's `contentmultimapremove` helper is a convenience wrapper -- it generates the correct VdxfUniValue JSON under the hood, preventing the [raw hex string error](#raw-hex-warning).

## Binary Serialization (Advanced)

For developers working at the protocol level, the VdxfUniValue typed data envelope serializes as:

```
[20-byte hash160 of i5Zkx5Z7tEfh42xtKfwbJ5LgEWE9rEgpFY]  <- objTypeKey
[VARINT version]                                             <- always 1
[CompactSize payload_length]                                 <- byte length of removal data
[VARINT version] [VARINT action]                             <- CContentMultiMapRemove fields
[20-byte entryKey hash160]                                   <- only for actions 1-3
[32-byte valueHash]                                          <- only for actions 1-2
```

This matches the C++ deserialization in `GetAggregatedIdentityMultimap`.

## Reference Implementation

**TypeScript** -- `verus-typescript-primitives` (github.com/VerusCoin/verus-typescript-primitives):

| File | Description |
|------|-------------|
| `src/pbaas/ContentMultiMapRemove.ts` | Removal action class with all 4 actions |
| `src/pbaas/VdxfUniValue.ts` (lines 278-284) | Typed data envelope serialization |
| `src/__tests__/pbaas/contentMultiMapRemove.test.ts` | Round-trip tests |

**C++** -- VerusCoin daemon (github.com/VerusCoin/VerusCoin):

| Location | Description |
|----------|-------------|
| `GetAggregatedIdentityMultimap` in `src/pbaas/identity.cpp` | Aggregation with removal processing |
| `CContentMultiMapRemove` class in `src/pbaas/identity.h` | Removal data structure |
| `ContentMultiMapRemoveKey()` in `src/pbaas/vdxf.h` | Key constant |

## Common Patterns

### Update a Single Field

```bash
# Remove old status
verus -testnet updateidentity '{
  "name": "myagent",
  "contentmultimap": {
    "i5Zkx5Z7tEfh42xtKfwbJ5LgEWE9rEgpFY": [{
      "i5Zkx5Z7tEfh42xtKfwbJ5LgEWE9rEgpFY": {
        "version": 1, "action": 3,
        "entrykey": "iLy373iaKafmRCY43ahty4m8aLQx32y8Fh"
      }
    }]
  }
}'

# Write new status (after previous tx confirms)
verus -testnet updateidentity '{
  "name": "myagent",
  "parent": "i7xKUpKQDSriYFfgHYfRpFc2uzRKWLDkjW",
  "contentmultimap": {
    "iLy373iaKafmRCY43ahty4m8aLQx32y8Fh": ["696e616374697665"]
  }
}'
```

### Full Re-Registration

```bash
# Clear everything
verus -testnet updateidentity '{"name":"myagent","contentmultimap":{"i5Zkx5Z7tEfh42xtKfwbJ5LgEWE9rEgpFY":[{"i5Zkx5Z7tEfh42xtKfwbJ5LgEWE9rEgpFY":{"version":1,"action":4}}]}}'

# Write all fields fresh (after clear confirms)
verus -testnet updateidentity '{
  "name": "myagent",
  "parent": "i7xKUpKQDSriYFfgHYfRpFc2uzRKWLDkjW",
  "contentmultimap": {
    "iKkdwxhdupLgf7v2qn4JGBQHntsBb17kjW": ["4d79204167656e74"],
    "iNxeLSDFARVQezfEt4i8CBZjTSRpFTPAyP": ["6175746f6e6f6d6f7573"],
    "iLy373iaKafmRCY43ahty4m8aLQx32y8Fh": ["616374697665"],
    "iRxxUvbDXJT5wVpnx7oc9nkYALCoDh6aTD": ["69416263646566313233"]
  }
}'
```

### Append a Record (No Removal Needed)

For atomic record keys (review.record, job.record), you append without removing:

```bash
verus -testnet updateidentity '{
  "name": "myagent",
  "parent": "i7xKUpKQDSriYFfgHYfRpFc2uzRKWLDkjW",
  "contentmultimap": {
    "iLbUN8TFvMZR9uaZYY1qBmL99bJE2uYdad": ["7b226275796572223a22616c69636540222c..."]
  }
}'
```

Each new review or job record is simply appended. Historical records are preserved and visible via `getidentitycontent`.
