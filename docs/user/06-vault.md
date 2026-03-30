# Vault — Encrypted Secrets

The vault stores secrets (API keys, tokens, passwords) encrypted with [age](https://github.com/FiloSottile/age). Secrets are never printed in logs or committed to git.

---

## Setup

### 1. Generate a keypair (once per machine)

```sh
vault init
```

Creates `~/.ssh/am-vault.key` (private) and `~/.ssh/am-vault.pub` (public). Run this once; running again is a no-op if the keypair already exists.

### 2. Store a secret

```sh
vault set <key> [value]
```

If `value` is omitted, vault reads from stdin (useful for multi-line secrets or piping).

```sh
vault set TAVILY_API_KEY tvly-abc123
vault set OPENAI_API_KEY            # prompts for value interactively
echo "secret" | vault set MY_TOKEN
```

### 3. Retrieve a secret

```sh
vault get <key>
```

Decrypts and prints the value. Use inline to pass secrets to commands without them appearing in shell history:

```sh
TAVILY_API_KEY=$(vault get TAVILY_API_KEY) bun run dev
curl -H "Authorization: Bearer $(vault get MY_TOKEN)" https://api.example.com
```

### 4. List stored keys

```sh
vault list
```

Prints key names only — values are never shown.

```sh
vault list
# TAVILY_API_KEY
# OPENAI_API_KEY
# MY_TOKEN
```

---

## Worked example: store and use an API key

```sh
# Store the key
vault set ANTHROPIC_API_KEY sk-ant-...

# Confirm it's stored
vault list

# Use it in a command
ANTHROPIC_API_KEY=$(vault get ANTHROPIC_API_KEY) bun run my-script.ts
```

---

## Storage location

Encrypted secrets live in `workspaces/vault/`. The directory is git-tracked (encrypted files are safe to commit) but the private key at `~/.ssh/am-vault.key` is **never** committed.

---

## Notes

- Secrets are encrypted per-machine. A vault from one machine cannot be decrypted on another without key migration.
- Never `vault set` a secret that's already in a `.env` file committed to git — rotate it first.
