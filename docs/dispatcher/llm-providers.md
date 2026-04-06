---
title: LLM Providers
---

# LLM Providers

The Dispatcher supports 22 LLM providers out of the box. Each sovagent can be connected to a different provider and model, allowing you to run a fleet with mixed backends -- Claude for code review, GPT for general conversation, Gemini for long-context analysis, and Ollama for fully local inference.

---

## Configuration

LLM provider settings can be specified at three levels (highest priority wins):

1. **Per-agent** -- `executor` section in the agent's `profile.json`
2. **Environment variables** -- `J41_LLM_PROVIDER`, `J41_LLM_API_KEY`, `J41_LLM_MODEL`, `J41_LLM_BASE_URL`
3. **Global config** -- `config.json` defaults

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `J41_LLM_PROVIDER` | Yes | Provider name (see table below) |
| `J41_LLM_API_KEY` | Yes (most providers) | API key or access token |
| `J41_LLM_MODEL` | No | Model name (uses provider default if omitted) |
| `J41_LLM_BASE_URL` | No | Override the default API endpoint (useful for proxies, self-hosted, or Azure deployments) |

### Per-Agent Override

In `~/.j41/dispatcher/agents/<name>/profile.json`:

```json
{
  "executor": {
    "type": "local-llm",
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "apiKey": "${ANTHROPIC_API_KEY}",
    "baseUrl": "",
    "temperature": 0.3,
    "maxTokens": 4096
  }
}
```

The `${ENV_VAR}` syntax is expanded at runtime, so you never need to hardcode API keys in config files.

---

## Supported Providers

### Cloud Providers

| # | Provider ID | Provider | Default Model | Auth |
|---|------------|----------|--------------|------|
| 1 | `anthropic` | Anthropic | `claude-sonnet-4-20250514` | API key |
| 2 | `openai` | OpenAI | `gpt-4o` | API key |
| 3 | `google` | Google Gemini | `gemini-2.5-pro` | API key |
| 4 | `groq` | Groq | `llama-3.3-70b-versatile` | API key |
| 5 | `mistral` | Mistral AI | `mistral-large-latest` | API key |
| 6 | `cohere` | Cohere | `command-r-plus` | API key |
| 7 | `together` | Together AI | `meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo` | API key |
| 8 | `fireworks` | Fireworks AI | `accounts/fireworks/models/llama-v3p1-70b-instruct` | API key |
| 9 | `perplexity` | Perplexity | `llama-3.1-sonar-large-128k-online` | API key |
| 10 | `deepseek` | DeepSeek | `deepseek-chat` | API key |
| 11 | `xai` | xAI (Grok) | `grok-2` | API key |
| 12 | `sambanova` | SambaNova | `Meta-Llama-3.1-70B-Instruct` | API key |
| 13 | `lepton` | Lepton AI | `llama-3.1-70b` | API key |
| 14 | `anyscale` | Anyscale | `meta-llama/Meta-Llama-3.1-70B-Instruct` | API key |
| 15 | `replicate` | Replicate | `meta/meta-llama-3.1-405b-instruct` | API token |
| 16 | `bedrock` | AWS Bedrock | `anthropic.claude-3-5-sonnet-20241022-v2:0` | AWS credentials |
| 17 | `azure` | Azure OpenAI | (deployment name) | API key + endpoint |
| 18 | `vertex` | Google Vertex AI | `gemini-2.5-pro` | Service account |

### Self-Hosted / Local Providers

| # | Provider ID | Provider | Default Model | Auth |
|---|------------|----------|--------------|------|
| 19 | `ollama` | Ollama | `llama3.1` | None (local) |
| 20 | `llamacpp` | llama.cpp | (loaded model) | None (local) |
| 21 | `vllm` | vLLM | (loaded model) | None or API key |
| 22 | `openai-compatible` | Any OpenAI-compatible API | (varies) | API key |

---

## Provider Configuration Examples

### Anthropic (Claude)

```bash
export J41_LLM_PROVIDER="anthropic"
export J41_LLM_API_KEY="sk-ant-api03-..."
export J41_LLM_MODEL="claude-sonnet-4-20250514"
```

Available models: `claude-opus-4-20250514`, `claude-sonnet-4-20250514`, `claude-haiku-3-20250514`

### OpenAI (GPT)

```bash
export J41_LLM_PROVIDER="openai"
export J41_LLM_API_KEY="sk-proj-..."
export J41_LLM_MODEL="gpt-4o"
```

Available models: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `o3`, `o3-mini`

### Google Gemini

```bash
export J41_LLM_PROVIDER="google"
export J41_LLM_API_KEY="AIza..."
export J41_LLM_MODEL="gemini-2.5-pro"
```

Available models: `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.0-flash`

### Groq

```bash
export J41_LLM_PROVIDER="groq"
export J41_LLM_API_KEY="gsk_..."
export J41_LLM_MODEL="llama-3.3-70b-versatile"
```

Groq provides extremely fast inference. Ideal for sovagents where response latency matters more than model capability.

### Mistral AI

```bash
export J41_LLM_PROVIDER="mistral"
export J41_LLM_API_KEY="..."
export J41_LLM_MODEL="mistral-large-latest"
```

Available models: `mistral-large-latest`, `mistral-medium-latest`, `mistral-small-latest`, `codestral-latest`

### DeepSeek

```bash
export J41_LLM_PROVIDER="deepseek"
export J41_LLM_API_KEY="sk-..."
export J41_LLM_MODEL="deepseek-chat"
```

Available models: `deepseek-chat`, `deepseek-reasoner`

### xAI (Grok)

```bash
export J41_LLM_PROVIDER="xai"
export J41_LLM_API_KEY="xai-..."
export J41_LLM_MODEL="grok-2"
```

### Ollama (Local)

```bash
export J41_LLM_PROVIDER="ollama"
export J41_LLM_BASE_URL="http://localhost:11434"
export J41_LLM_MODEL="llama3.1"
```

No API key needed. Make sure Ollama is running and the model is pulled:

```bash
ollama pull llama3.1
ollama serve
```

Ollama is ideal for fully sovereign operation where no data leaves your machine.

### llama.cpp (Local)

```bash
export J41_LLM_PROVIDER="llamacpp"
export J41_LLM_BASE_URL="http://localhost:8080"
```

Run the llama.cpp server first:

```bash
./llama-server -m ./models/llama-3.1-70b.gguf --port 8080
```

### vLLM (Local/Cluster)

```bash
export J41_LLM_PROVIDER="vllm"
export J41_LLM_BASE_URL="http://localhost:8000"
export J41_LLM_MODEL="meta-llama/Meta-Llama-3.1-70B-Instruct"
```

### AWS Bedrock

```bash
export J41_LLM_PROVIDER="bedrock"
export J41_LLM_MODEL="anthropic.claude-3-5-sonnet-20241022-v2:0"
export AWS_REGION="us-east-1"
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."
```

Bedrock uses standard AWS credential chain. IAM roles, instance profiles, and SSO are all supported.

### Azure OpenAI

```bash
export J41_LLM_PROVIDER="azure"
export J41_LLM_API_KEY="your-azure-key"
export J41_LLM_BASE_URL="https://your-resource.openai.azure.com"
export J41_LLM_MODEL="your-deployment-name"
```

The `model` for Azure is the **deployment name**, not the model name.

### Google Vertex AI

```bash
export J41_LLM_PROVIDER="vertex"
export J41_LLM_MODEL="gemini-2.5-pro"
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
export GOOGLE_CLOUD_PROJECT="your-project-id"
export GOOGLE_CLOUD_REGION="us-central1"
```

### OpenAI-Compatible (Generic)

For any API that follows the OpenAI chat completions format:

```bash
export J41_LLM_PROVIDER="openai-compatible"
export J41_LLM_BASE_URL="https://your-api.example.com/v1"
export J41_LLM_API_KEY="your-key"
export J41_LLM_MODEL="your-model"
```

This works with LiteLLM, LocalAI, OpenRouter, and similar proxies.

---

## Model Parameters

Beyond the required settings, you can tune generation behavior per-agent:

```json
{
  "executor": {
    "type": "local-llm",
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "apiKey": "${ANTHROPIC_API_KEY}",
    "temperature": 0.3,
    "maxTokens": 4096,
    "topP": 0.9,
    "frequencyPenalty": 0,
    "presencePenalty": 0,
    "stopSequences": []
  }
}
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `temperature` | number | 0.7 | Randomness (0 = deterministic, 2 = creative) |
| `maxTokens` | number | 4096 | Maximum tokens per response |
| `topP` | number | 1.0 | Nucleus sampling threshold |
| `frequencyPenalty` | number | 0 | Reduce repetition (0-2) |
| `presencePenalty` | number | 0 | Encourage topic diversity (0-2) |
| `stopSequences` | string[] | `[]` | Stop generation at these strings |

Not all parameters are supported by every provider. Unsupported parameters are silently ignored.

---

## Provider Selection Guide

| Use case | Recommended Provider | Why |
|----------|---------------------|-----|
| Best overall quality | `anthropic` (Claude) | Strong reasoning, instruction following, safety |
| Fastest response time | `groq` | Hardware-optimized inference |
| Lowest cost | `deepseek` or `ollama` | DeepSeek is cheap; Ollama is free (local) |
| Full data sovereignty | `ollama` or `llamacpp` | Zero data leaves your machine |
| Long context (1M+) | `google` (Gemini) or `anthropic` (Claude) | Both support extended context windows |
| Code generation | `anthropic` or `deepseek` | Strong coding benchmarks |
| Enterprise compliance | `bedrock` or `azure` | SOC2, HIPAA, data residency controls |

---

## Switching Providers at Runtime

You can change a sovagent's LLM provider without restarting the Dispatcher:

```bash
# Edit the agent's profile
j41-dispatch agent edit code-reviewer
# Change the executor provider/model
j41-dispatch agent reload code-reviewer
```

New jobs will use the updated provider. Active jobs continue with their original provider until completion.

---

## Next Steps

- [Executors](/dispatcher/executors) -- if you need more than direct LLM calls (webhooks, LangServe, LangGraph, A2A, MCP)
- [Agents](/dispatcher/agents) -- per-agent configuration and SOUL.md files
- [Security](/dispatcher/security) -- network allowlists to control which LLM endpoints are reachable
