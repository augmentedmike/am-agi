# Local Coding Model: Setup & Training Pipeline

**Machine**: MacBook Pro M3 Pro, 36 GB unified memory, ~150 GB/s bandwidth
**Updated**: March 2026

---

## Model Recommendation

### Best choice for M3 Pro 36GB: Qwen3-Coder-30B-A3B

| Model | Architecture | 4-bit Size | SWE-bench | Est. tok/s |
|---|---|---|---|---|
| **Qwen3-Coder-30B-A3B** ← use this | MoE, 3.3B active | ~17 GB | ~70% | ~45–55 |
| Qwen3-8B | Dense | ~5 GB | strong | ~80–110 |
| Qwen3-Coder-Next (80B) | MoE, 3B active | ~48 GB | 70.6% | **too large** |
| Devstral (already installed) | Dense 24B | ~14 GB | 68.0% | ~9.8 (Ollama) |

**Why Qwen3-Coder-30B-A3B beats everything else on this machine:**
- MoE architecture: only 3.3B params activate per token → fast generation despite 30B total
- 70% SWE-bench Verified (Feb 2026 benchmark) — best open-weight coding score that fits 36 GB
- Qwen3-Coder-Next is better (70.6%) but needs 48 GB and won't load on this machine
- Qwen2.5-Coder was the old recommendation — Qwen3 supersedes it across the board

**Speculative decoding pair**: Qwen3-8B (draft) + Qwen3-Coder-30B-A3B (verifier) → estimated 2–3x speedup

---

## Part 1: Inference Setup

### Install MLX

```sh
pip install mlx-lm
```

### Pull and run Qwen3-Coder-30B-A3B

```sh
# Pull 4-bit MLX weights (~17 GB)
mlx_lm.generate \
  --model mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit \
  --prompt "Write a TypeScript function that validates an email address"

# Or via LM Studio (GUI, OpenAI-compatible API on port 1234)
# Search: Qwen3-Coder-30B-A3B, select MLX 4-bit
```

### Benchmark your machine

```sh
# Measure tok/s
mlx_lm.generate \
  --model mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit \
  --prompt "Hello" \
  --max-tokens 200 \
  2>&1 | grep "Tokens per second"

# Devstral via Ollama (already installed)
ollama run devstral "Hello" --verbose
```

### Speculative decoding (2–3x speedup)

```sh
# Pull 8B draft model (~5 GB)
mlx_lm.generate \
  --model mlx-community/Qwen3-8B-Instruct-4bit \
  --prompt "Hello" \
  --max-tokens 5

# Run with speculative decoding
mlx_lm.generate \
  --model mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit \
  --draft-model mlx-community/Qwen3-8B-Instruct-4bit \
  --prompt "Write a REST API endpoint in TypeScript" \
  --max-tokens 500
```

---

## AM Integration: am.project.json Config

To use a local model with AM, add an `adapter` block to your project's `am.project.json`.
AM will use this adapter for all agent iterations instead of Claude.

### Hermes via Ollama

```sh
# Start Hermes via Ollama
ollama run NousResearch/Hermes-3-Llama-3.1-8B
```

```json
{
  "adapter": {
    "provider": "hermes",
    "baseURL": "http://localhost:11434/v1",
    "apiKey": "ollama",
    "model": "NousResearch/Hermes-3-Llama-3.1-8B"
  }
}
```

### Hermes via vLLM

```sh
# Start vLLM server
python -m vllm.entrypoints.openai.api_server \
  --model NousResearch/Hermes-3-Llama-3.1-8B \
  --port 8000
```

```json
{
  "adapter": {
    "provider": "hermes",
    "baseURL": "http://localhost:8000/v1",
    "apiKey": "none",
    "model": "NousResearch/Hermes-3-Llama-3.1-8B"
  }
}
```

### Qwen3 via MLX (recommended for Apple Silicon)

```sh
# Start MLX server (OpenAI-compatible)
mlx_lm.server \
  --model mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit \
  --port 8080
```

```json
{
  "adapter": {
    "provider": "qwen",
    "baseURL": "http://localhost:8080/v1",
    "apiKey": "none",
    "model": "mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit"
  }
}
```

### Qwen3 via Ollama

```sh
ollama run qwen3:30b-a3b
```

```json
{
  "adapter": {
    "provider": "qwen",
    "baseURL": "http://localhost:11434/v1",
    "apiKey": "ollama",
    "model": "qwen3:30b-a3b"
  }
}
```

### Qwen3 via DashScope (Alibaba Cloud API)

```json
{
  "adapter": {
    "provider": "qwen",
    "baseURL": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "apiKey": "sk-your-dashscope-key",
    "model": "qwen3-coder-30b-a3b"
  }
}
```

### Environment variable alternative

Instead of `am.project.json`, you can set environment variables globally:

```sh
export AM_PROVIDER=hermes
export AM_BASE_URL=http://localhost:11434/v1
export AM_API_KEY=ollama
export AM_MODEL=NousResearch/Hermes-3-Llama-3.1-8B
```

When `AM_PROVIDER` is set to a non-`claude` value, `install.sh` will skip Claude CLI installation entirely.

---

## Part 2: Training Data Capture

Every shipped AM task is a verified `(problem, solution)` pair. Use `bin/collect-training-data`
to extract them automatically.

```sh
# Collect all shipped tasks as ShareGPT JSONL
bin/collect-training-data --output dataset/am-tasks.jsonl

# Output:
# Scanned 47 shipped cards
# 43 unique prompts (4 duplicates skipped)
# Avg response length: 1,847 tokens
# Written: dataset/am-tasks.jsonl
```

### Output format (ShareGPT)

```json
{
  "conversations": [
    {"from": "system", "value": "<AM KB rules>"},
    {"from": "human", "value": "<task description + criteria>"},
    {"from": "gpt", "value": "<git diff of shipped implementation>"}
  ]
}
```

---

## Part 3: Teacher Model

Claude generates high-quality labeled responses for each collected prompt, incorporating
the AM KB as system context. This distills Claude's reasoning into training signal.

```sh
export ANTHROPIC_API_KEY="..."

# Generate teacher labels
bin/generate-labels \
  --input dataset/am-tasks.jsonl \
  --output dataset/am-tasks-labeled.jsonl \
  --model claude-3-5-sonnet-20241022
```

The AM KB (`workspaces/memory/st/*.md`) is injected as the system prompt so Claude responds
with the same coding style rules that have been proven in production.

---

## Part 4: Fine-Tuning (LoRA)

```sh
# One-step dry run (verify no OOM)
bin/finetune --data dataset/am-tasks-labeled.jsonl --dry-run

# Full fine-tune (expect 30–50 min/epoch on M3 Pro)
bin/finetune --data dataset/am-tasks-labeled.jsonl

# Adapter saved to: ./adapters/
```

Config: `finetune-config.yaml` — QLoRA rank 8, lr 1e-4, batch 2, max_seq_len 2048.

---

## Part 5: Speculative Decoding in Production

Once fine-tuned, deploy with speculative decoding for maximum throughput:

```sh
# Base: ~45–55 tok/s
mlx_lm.generate --model mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit ...

# With speculative decoding: ~90–165 tok/s (estimated)
mlx_lm.generate \
  --model mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit \
  --draft-model mlx-community/Qwen3-8B-Instruct-4bit \
  --adapter-path ./adapters \
  ...
```

---

## Model Choice Rationale (Full)

### Why not Qwen2.5-Coder 14B?
Qwen3-Coder-30B-A3B achieves ~70% SWE-bench vs ~60% for Qwen2.5-Coder 32B, and generates
faster due to MoE (3.3B active vs 32B dense). Qwen3 is a clear upgrade in every dimension.

### Why not Qwen3-Coder-Next (80B)?
It's the best open-weight coder as of March 2026 (70.6% SWE-bench, 256K context, Sonnet-4.5
parity), but the 4-bit quantization is ~48 GB — it won't load on 36 GB unified memory.
When Mike upgrades to M3/M4 Ultra (192+ GB), upgrade to Qwen3-Coder-Next.

### Why MLX over Ollama?
- MLX uses Apple's Metal GPU natively; llama.cpp (which Ollama wraps) is ~3x slower on M-series
- Devstral via Ollama: ~9.8 tok/s. Qwen3-Coder-30B-A3B via MLX: ~45–55 tok/s
- MLX also supports LoRA fine-tuning natively

### Fine-tuning approach
- QLoRA (4-bit base + fp16 adapters): ~20–22 GB peak on M3 Pro, comfortable
- LoRA rank 8 is sufficient for task-specific adaptation
- Full fine-tune of any >7B model is impossible (exceeds 36 GB)

---

## Sources

- https://qwen.ai/blog?id=qwen3-coder-next
- https://arxiv.org/pdf/2603.00729 (Qwen3-Coder-Next technical report)
- https://deepnewz.com/ai-modeling/qwen3-30b-a3b-model-mlx-weights-shows-m4-max-m3-ultra-lead-tokens-per-second-32k-380e5584
- https://github.com/ggml-org/llama.cpp/issues/19366
- https://markaicode.com/run-fine-tune-llms-mac-mlx-lm/
- https://machinelearning.apple.com/research/recurrent-drafter
