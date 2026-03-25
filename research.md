# Research

## Task
When an agent message is present on a card tile, invert the visual hierarchy so the agent text is the "primary" (bright) content and the card title/ID text is "secondary" (dim). This communicates: "the agent is active — focus on what it's doing."

## Key File

**`apps/board/src/components/CardTile.tsx`** — single component, ~65 lines.

### Current text styling

| Element | Line | Current class | Brightness |
|---|---|---|---|
| Card title | 51 | `text-zinc-100` | Bright (primary) |
| Card ID | 57 | `text-zinc-500` | Dim |
| Agent text | 59 | `text-zinc-400` | Muted gray (secondary) |

### Desired when `agentText` is present

| Element | New class | Brightness |
|---|---|---|
| Card title | `text-zinc-500` | Dim (secondary) |
| Card ID | `text-zinc-600` | Dimmer |
| Agent text | `text-zinc-100` | Bright (primary) |

### Desired when `agentText` is absent

No change — existing classes stay exactly as they are.

## Implementation Plan

Conditionally swap classes using the existing `agentText` state variable (already in scope). No new state, no new props.

```tsx
// title (line 51)
className={`text-base font-semibold ${agentText ? 'text-zinc-500' : 'text-zinc-100'} leading-snug`}

// id (line 57)
className={`text-xs ${agentText ? 'text-zinc-600' : 'text-zinc-500'} font-mono truncate mt-1`}

// agent text (line 59)
className="text-xs text-zinc-100 font-mono mt-2 pt-2 border-t border-white/5 line-clamp-2 leading-relaxed"
```
