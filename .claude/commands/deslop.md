---
name: deslop
description: Clean AI-generated code slop with a regression-safe, deletion-first workflow
---

Clean AI-generated code slop in $ARGUMENTS without drifting scope or changing intended behavior.

## Execution Posture

- Preserve behavior unless explicitly asked for behavior changes.
- Lock behavior with focused regression tests first whenever practical.
- Write a cleanup plan before editing code.
- Prefer deletion over addition.
- Reuse existing utilities and patterns before introducing new ones.
- Avoid new dependencies.
- Keep diffs small, reversible, and smell-focused.

## Workflow

1. **Protect current behavior first**
   - Identify what must stay the same.
   - Add or run the narrowest regression tests needed before editing.
   - If tests cannot come first, record the verification plan explicitly before touching code.

2. **Write a cleanup plan before code**
   - Bound the pass to the requested files.
   - List the concrete smells to remove.
   - Order the work from safest deletion to riskier consolidation.

3. **Classify the slop**
   - **Duplication** — repeated logic, copy-paste branches, redundant helpers
   - **Dead code** — unused exports, unreachable branches, stale flags, debug leftovers
   - **Needless abstraction** — pass-through wrappers, speculative indirection, single-use helper layers
   - **Boundary violations** — hidden coupling, misplaced responsibilities, wrong-layer imports
   - **Missing tests** — behavior not locked, weak regression coverage, edge-case gaps

4. **Run one smell-focused pass at a time**
   - Pass 1: Dead code deletion
   - Pass 2: Duplicate removal
   - Pass 3: Naming and error-handling cleanup
   - Pass 4: Test reinforcement
   - Re-run targeted verification after each pass.

5. **Run quality gates**
   - Keep regression tests green.
   - Run lint, typecheck, and unit tests for touched areas.
   - If a gate fails, fix the issue or back out the risky cleanup.

6. **Close with an evidence-dense report**
   - Changed files
   - Simplifications made
   - Verification run
   - Remaining risks
