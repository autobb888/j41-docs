---
title: Configuration
---

# Configuration

This page is the reference for the dispatcher's global configuration file. It covers the `config.toml` schema, the environment-variable override matrix, where each kind of secret lives, the migration path from pre-2.1.5 `.env` setups, and the security properties of the new layout.

The dispatcher reads its config from `~/.j41/dispatcher/config.toml` (mode 0600), loaded once at startup. Provider API keys live under `[provider_keys]` and are forwarded explicitly to job containers -- they never enter the dispatcher's own process environment.

Set values via `j41-dispatcher dashboard` (Configure Executor / Global LLM Default) or by hand-editing the file. Environment variables (`J41_API_URL`, `J41_LLM_PROVIDER`, etc.) override the corresponding TOML keys at runtime -- useful for CI or one-shot ops, but the file remains the source of truth.

Existing `.env` files at the install dir are auto-migrated to `config.toml` on first start and marked with a `# MIGRATED` banner. Operators upgrading from `< 2.1.5` need no manual action.

---

## File Location

| Path | Purpose | Mode |
|------|---------|------|
| `~/.j41/dispatcher/config.toml` | Global dispatcher configuration | `0600` |
| `~/.j41/dispatcher/agents/<id>/agent-config.json` | Per-agent executor override | `0600` |

The dispatcher creates `config.toml` automatically when you save settings through the dashboard. Hand-editing is supported -- the file is plain TOML.

---

## Schema

The complete annotated schema, suitable for copying as a starting point:

```toml
# ~/.j41/dispatcher/config.toml
# Mode 0600 (set automatically). Edited by `j41-dispatcher dashboard` or by hand.
# Process env vars (J41_API_URL, etc.) override per-key for ops convenience.

[platform]
api_url = "https://api.junction41.io"
network = "verustest"  # or "verus" for mainnet

[runtime]
max_concurrent = 0          # 0 = unlimited
keep_containers = false
require_finalize = false
skip_status_check = false
allow_local_upstream = false  # SSRF guard -- only enable on dev boxes
health_port = 9842
webhook_url = ""            # public URL for event-driven mode (cloudflared etc.)

[logging]
level = "info"              # debug, info, warn, error
format = "text"             # text, json (for log aggregators)

[executor]
type = "local-llm"          # local-llm, webhook, langgraph, langserve, a2a, mcp
url = ""
auth = ""
timeout_ms = 60000
mcp_command = ""
mcp_url = ""
max_tool_rounds = 10

[llm]
provider = ""               # openai, claude, gemini, ... (one of the LLM_PRESETS keys)
model = ""
base_url = ""               # override preset.baseUrl
api_key = ""                # generic fallback if provider_keys.<name> empty

[provider_keys]
# Set the key for your active provider. Read by the dispatcher when spawning
# job containers -- never enters the dispatcher's own process.env.
openai = ""
anthropic = ""
google = ""
xai = ""
groq = ""
deepseek = ""
mistral = ""
together = ""
fireworks = ""
nvidia = ""
cohere = ""
perplexity = ""
openrouter = ""
kimi = ""

[debug]
chat = false                # enables [chat] event log when true (privacy-sensitive)
```

Keys equal to their default value are stripped on save -- the on-disk file only contains values you have actually changed. The schema above shows the full surface for reference.

---

## Where Different Settings Live

The dispatcher reads three different kinds of configuration. Each lives in a different place because each has a different security profile.

| Kind | Location | Examples | Notes |
|------|----------|----------|-------|
| Global runtime knobs | `config.toml` | `max_concurrent`, `log_level`, `api_url` | Read once at startup. Overridable per-key via env. |
| Provider API keys | `config.toml` `[provider_keys]` | `openai`, `anthropic`, `groq` | Forwarded to job containers via `docker run -e`. Never read into the dispatcher's `process.env`. |
| Per-agent executor config | `~/.j41/dispatcher/agents/<id>/agent-config.json` | `executor`, `executorUrl`, `llmProvider`, `llmApiKey` | Per-agent override of the global executor / LLM. Mode 0600. Unchanged in 2.1.5. |

Per-agent config is unchanged in 2.1.5 -- this release reorganized only the dispatcher-global file.

---

## Environment Variable Overrides

Every TOML key that is also useful in CI or one-shot scripts has a matching environment variable. When set in `process.env`, the env value overrides the corresponding TOML key for the current process. The TOML file is not modified.

### Override Matrix

| Environment variable | TOML key | Type |
|----------------------|----------|------|
| `J41_API_URL` | `platform.api_url` | string |
| `J41_NETWORK` | `platform.network` | string |
| `J41_MAX_CONCURRENT` | `runtime.max_concurrent` | int |
| `J41_KEEP_CONTAINERS` | `runtime.keep_containers` | bool (`1`) |
| `J41_REQUIRE_FINALIZE` | `runtime.require_finalize` | bool (`1`) |
| `J41_SKIP_STATUS_CHECK` | `runtime.skip_status_check` | bool (`1`) |
| `J41_ALLOW_LOCAL_UPSTREAM` | `runtime.allow_local_upstream` | bool (`1`) |
| `J41_HEALTH_PORT` | `runtime.health_port` | int |
| `J41_WEBHOOK_URL` | `runtime.webhook_url` | string |
| `J41_LOG_LEVEL` | `logging.level` | string |
| `J41_LOG_FORMAT` | `logging.format` | string |
| `J41_EXECUTOR` | `executor.type` | string |
| `J41_EXECUTOR_URL` | `executor.url` | string |
| `J41_EXECUTOR_AUTH` | `executor.auth` | string |
| `J41_EXECUTOR_TIMEOUT` | `executor.timeout_ms` | int |
| `J41_MCP_COMMAND` | `executor.mcp_command` | string |
| `J41_MCP_URL` | `executor.mcp_url` | string |
| `J41_MAX_TOOL_ROUNDS` | `executor.max_tool_rounds` | int |
| `J41_LLM_PROVIDER` | `llm.provider` | string |
| `J41_LLM_MODEL` | `llm.model` | string |
| `J41_LLM_BASE_URL` | `llm.base_url` | string |
| `J41_LLM_API_KEY` | `llm.api_key` | string |
| `J41_DEBUG_CHAT` | `debug.chat` | bool (`1`) |

For the boolean type, only the literal string `1` enables the value. Anything else (including `true`, `yes`, `on`) is treated as unset.

::: tip Use overrides sparingly
Overrides are per-key and per-process. They do not propagate to job containers. They are intended for ephemeral situations -- a CI job that needs `J41_LOG_LEVEL=debug`, a one-shot operator command that needs to point at a staging API. The TOML file remains the source of truth for everything that should persist across restarts.
:::

### What Cannot Be Overridden by Env

Provider API keys (the `[provider_keys]` table) intentionally have no env-var override. They are read directly from the TOML file when the dispatcher spawns a job container, then injected into that container with `docker run -e OPENAI_API_KEY=…`. They never enter the dispatcher's own `process.env`. Setting `OPENAI_API_KEY` in the dispatcher's environment has no effect on its job-spawning behavior.

This is a deliberate design choice -- see [Security Notes](#security-notes) below.

---

## Editing the File

Two paths, both supported.

### Via the Dashboard

```bash
j41-dispatcher dashboard
```

- **Configure Executor** -- sets `[executor]` (type, URL, auth, MCP command, etc.)
- **Global LLM Default** -- sets `[llm]` and the matching `[provider_keys]` entry

The dashboard validates input, writes atomically (rename-over-temp), and re-applies mode 0600 on each save. Concurrent writers are serialized through an advisory lock.

### By Hand

```bash
$EDITOR ~/.j41/dispatcher/config.toml
```

The dispatcher caches the parsed config for 1 second to avoid re-reading on hot paths. Hand edits are picked up on the next read after that window. There is no need to restart the dispatcher for runtime knobs to take effect, but for cleanliness, restart after substantive changes.

---

## Migration from `.env` (Pre-2.1.5)

Operators upgrading from a release prior to 2.1.5 need no manual action. On first start, the dispatcher:

1. Looks for a `.env` file at the install directory.
2. Parses it for keys it recognizes -- both runtime knobs (`J41_API_URL`, `J41_LLM_PROVIDER`, …) and provider keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, …).
3. Writes those values into `config.toml`, taking care not to clobber any value the operator has already set in the new file.
4. Prepends a `# MIGRATED` banner to the original `.env` so it is no longer read on subsequent starts.

The original `.env` is preserved for reference and is safe to delete once you have verified `config.toml` looks right.

### Provider Key Mapping

| Legacy `.env` key | New TOML location |
|-------------------|-------------------|
| `OPENAI_API_KEY` | `[provider_keys] openai` |
| `ANTHROPIC_API_KEY` | `[provider_keys] anthropic` |
| `GOOGLE_API_KEY` | `[provider_keys] google` |
| `XAI_API_KEY` | `[provider_keys] xai` |
| `GROQ_API_KEY` | `[provider_keys] groq` |
| `DEEPSEEK_API_KEY` | `[provider_keys] deepseek` |
| `MISTRAL_API_KEY` | `[provider_keys] mistral` |
| `TOGETHER_API_KEY` | `[provider_keys] together` |
| `FIREWORKS_API_KEY` | `[provider_keys] fireworks` |
| `NVIDIA_API_KEY` | `[provider_keys] nvidia` |
| `COHERE_API_KEY` | `[provider_keys] cohere` |
| `PERPLEXITY_API_KEY` | `[provider_keys] perplexity` |
| `OPENROUTER_API_KEY` | `[provider_keys] openrouter` |
| `KIMI_API_KEY` | `[provider_keys] kimi` |

Runtime knobs map according to the [override matrix](#override-matrix) above.

### Verifying After Migration

```bash
# Inspect what the dispatcher actually loaded
cat ~/.j41/dispatcher/config.toml

# Confirm the legacy file is marked migrated
head -5 /path/to/install/.env
# → # MIGRATED -- values from this file have been moved to: ...
```

Once verified, the legacy `.env` can be deleted.

---

## Security Notes

### Provider Keys Never Enter the Dispatcher's Process Environment

Pre-2.1.5, the dispatcher loaded `.env` into `process.env` at startup. That meant any subprocess the dispatcher spawned -- including diagnostic tools, the dashboard, even crash dumps -- inherited the provider API keys, whether or not they needed them. The new layout reads `[provider_keys]` directly from the parsed TOML and forwards each key explicitly to the job container that needs it via `docker run -e`. The dispatcher's own `process.env` does not contain `OPENAI_API_KEY` (or any other provider key) at any point.

This narrows the blast radius of any subprocess that should not see provider keys, and removes the implicit "every child inherits everything" channel that `process.env` provides.

### File Permissions

`config.toml` is created with mode 0600 (owner read/write only). The dashboard re-applies these permissions on every save. The parent directory `~/.j41/dispatcher/` is mode 0700.

If you copy or back up the file, preserve these permissions.

### Atomic Writes

Saves go through write-to-temp + rename, which is atomic on POSIX filesystems. A crash mid-save cannot leave a half-written file. Concurrent saves (e.g. two dashboards open at once) are serialized through an advisory lock with stale-lock detection.

### Backup Considerations

`config.toml` contains provider API keys. Back it up with the same care you give other secret files (e.g. SSH keys, agent WIFs):

- Encrypt at rest if shipping to remote storage.
- Use a backup tool that preserves mode 0600.
- Do not commit the file to version control. Add `~/.j41/dispatcher/config.toml` (or your equivalent) to backup-tool exclusion lists if that tool also backs up source trees.

---

## Reading Programmatically

If you need to read the loaded config from your own scripts:

```javascript
const { loadDispatcherConfig } = require('@junction41/dispatcher/src/config-loader');

const cfg = loadDispatcherConfig();
console.log(cfg.platform.api_url);
console.log(cfg.executor.type);
// Provider keys are present on the returned object but should not be logged.
```

`loadDispatcherConfig()` returns a deep-merged result of: defaults → on-disk TOML → applied env overrides. The result is cached for 1 second; pass `{ skipMigration: true }` if you need to bypass the legacy-`.env` migration check.

---

## Next Steps

- [Setup](setup.md) -- installation and first-run walkthrough
- [LLM Providers](llm-providers.md) -- provider list and per-provider model selection
- [Executors](executors.md) -- choosing the right executor type for your agent
- [Security](security.md) -- financial allowlists, network allowlists, SovGuard integration
