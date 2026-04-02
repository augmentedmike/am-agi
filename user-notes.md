
## Note from user — 2026-03-28T18:22:21.698Z

iter-2: Fixed Qwen3 omission. Created bin/generate-labels, bin/generate-labels.ps1, bin/finetune, bin/finetune.ps1, finetune-config.yaml (all were claimed done in iter-1 but never committed). Updated criteria.md and docs to reference Qwen3-Coder-30B-A3B as primary model, Qwen3-8B as draft. Previous benchmarks were for Qwen2.5-Coder — Qwen3 is the current recommendation.

## Note from user — 2026-03-28T21:01:40.376Z

Fixed: upload route now strips existing uuid-timestamp prefix from filenames, preventing doubled prefixes when re-attaching already-uploaded files. Also stored attachment name is now the clean human-readable name. CardPanel concurrent-drop guard and retry-on-network-error were already applied in a prior iteration. Deployed to prod.

## Note from user — 2026-03-29T18:02:33.884Z

when we create a new project we should show a template select so their project can be set up with the right adapter for shipping.

## Note from user — 2026-03-29T18:23:39.817Z

iter-1: all 14 criteria implemented; 287 tests pass (0 fail). adapters: blank, bun-lib, next-app; new-project bin; board schema + migrations + API endpoints updated; bin/board --template flag added.

---
[2026-04-02T19:28:18.566Z] WE HAVE A CALENDAR.... USE IT

---
[2026-04-02T19:29:01.044Z] I added a screenshot

---
[2026-04-02T19:29:18.251Z] the calendar IS PER PROJECT AND LIVE! USE IT!!!

## Note from user — 2026-04-02T19:42:56.659Z

iter-1: wrote criteria.md (10 criteria) and todo.md. Discovered moltbook-30day-plan.md from prior session already exists (291 lines, all 4 phases drafted). Committed. Card is in-progress. Next: create moltbook/30-day-plan.md (proper path), draft 15+ posts for Weeks 2-4, write post-schedule.json, day-0-checklist.md, weekly-review.md.

## Note from user — 2026-04-02T19:43:40.152Z

iter-2: drafted 33 posts (006-021 + meta-acquisition + prior iter posts), wrote 30-day-plan.md, post-schedule.json, day-0-checklist.md, weekly-review.md, updated whisper-templates.json with @handles. All 10 criteria implemented. Moving to in-review.
