# 🚀 AugmentedMe (AM) — Rebuilding a Production "baby" AGI System in Public



<!-- we dont need no stinking badges senior -->
![GitHub Repo stars](https://img.shields.io/github/stars/augmentedmike/am-agi?style=for-the-badge&logo=github)
![GitHub forks](https://img.shields.io/github/forks/augmentedmike/am-agi?style=for-the-badge&logo=github) ![GitHub release (latest by date)](https://img.shields.io/github/v/release/augmentedmike/am-agi?style=for-the-badge)

![Project Maintenance](https://img.shields.io/badge/status-active-brightgreen?style=for-the-badge) ![Top Language](https://img.shields.io/github/languages/top/augmentedmike/am-agi?style=for-the-badge&logo=typescript) ![MIT License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge&logo=opensourceinitiative)


## The AI system behind real projects
- [helloam.bot](https://helloam.bot)
- [miniclaw.bot](https://miniclaw.bot)

**Rebuilt from scratch. In public. On purpose.**

---

> I got tired of agents that do things I didn't ask for. So I rewrote it.
>
> This is the real system — not a demo, not a toy, not another LangChain wrapper with a readme that promises AGI. Memory lives on your machine. Inference goes out over HTTPS. Every state change is a git commit. You can read all of it in an afternoon.
>
> The original system works fine. This version exists so *you* can understand it.
---

## Table of Contents
- [The AI system behind real projects](#the-ai-system-behind-real-projects)
- [What it actually does](#what-it-actually-does)
- [Why not just use existing framework](#why-not-just-use-existing-framework)
- [Requirements - MacOS + Anthropic Subscription](#requirements---macos--anthropic-subscription)
- [Dog-Fooding - Building the racecar flying down the track](#dog-fooding---building-the-racecar-flying-down-the-track)
- [Philosophy - Why take this approach?](#philosphy)
- [Architecture - A rebuild from Zero, dogfooding at step 3](#architecture)
- [Start here, not at main (If you want to learn)](#start-here-not-at-main)
- [What This Is Not](#what-this-is-not)
- [Acknowledgements - My Heroes](#acknowledgements)

---

## What it actually does

AugmentedMe is a personal assistant that doesn't forget you exist between sessions. Not Siri. Not Alexa. Those things are stateless magic 8-balls. This is an agent with:

- **Short + long-term memory** via local embeddings — your hardware, your data
- **A Kanban state machine** that tracks what's happening, what's next, and what's blocked
- **A git-based execution loop** — every action is a traceable commit, not a vibe

It manages work tasks, home life logistics, and yes, relationship stuff. The parts of your life that need a system but nobody's ever built a real one for.

---

## Why not just use [existing framework]

Because I read the code.

Projects like OpenClaw are great for getting something running fast. They're bad for knowing what's actually running. You get:

- Dependency trees you can't audit
- Execution paths hidden behind "magic" abstractions  
- Implicit permissions — the system does things, you find out later

That was fine when these were toys. They're not toys anymore. People are running agents with access to their email, their files, their money. The attack surface is real.

So this project is built differently:

- **Zero inherited complexity.** Started from nothing.
- **Minimal surface area.** Less code = less to exploit.
- **Explicit capabilities.** If you didn't wire it, it can't do it.
- **Fully readable.** No magic. No framework black boxes.

---

## Requirements - MacOS + Anthropic Subscription

Eventually I want this on Mac, Windows and my brothers in *nix. Right now I am building it on a M3 pro and testing it on a couple of Mac Minis.

**You need an Anthropic Claude subscription ($20 - light, up to $200/mo capped for heavy use)**

When another foundation model company shows me a better model I will add it. Nothing comes close when you need 99.999% accuracy and 0.001 failures. (untrapped)

Feel free to replace the claude based agent loop with Kimi2 or whatever and let me know how it goes and PR it!

## Dog-Fooding - Building the racecar flying down the track

You use Claude Code to build the first few steps:

./steps/[1..3].md

And after that the new step files will have your new digital assistant do all the work. In the biz we call it dogfooding; what it really means is we find the bugs and speed issues before you do, because we build the product with the product. I

## Guardrailing

Models aren't deterministic. Thats what makes them do damn fun, but fun and business have different requirements of "it works" - so we use every technique in the book (and some new) to turn the stochastic into deterministic systems. The concept has nothing to do with "AI" - we developed these system over 60 years of programming to make it more and more difficult for you or the Jr. engineer from shooting foots.

We just adapt things like:
- Human readable code
- Documentation not commenting
- The "Codification" of workflows (prevents human error)

In Short - Models and employees arent that much different. They both need a handbook to not get in trouble. Speaking of...

## Coding Quality Standards

You can think of this as Guardrail #1 - prevent the model from writing garbage, unsafe, jr level coder bullshit. Remember they are just statistical calculators built on training distributions and I promise they have seen a lot more garbage code than they do from the masters. We use coding quality standards to stop this in its tracks:

- [Style Pedigree](https://github.com/augmentedmike/coding-standards/blob/main/pedigree.md)  
- [TypeScript Style](https://github.com/augmentedmike/coding-standards/blob/main/ts-style.md)

## Philosphy

Claude Code is the incubator, and after step 3 becomes just a Tool in AMs toolbelt. AM is the intelligence and the peristence and the memory and the "being", and Anthropic or other models are just those random thoughts you get in your own head. They arent YOU.

Am is built to be a cognitive architecture, not just random thoughts. She is a mix of engineering (creating analogs for brain regions) and research.

If you are an engineer, builder, researcher or scientist (Neuro)- I have a place for you to contribute and be in on ground floor AGI without requiring millions. I have raised and spent about $60k get to here. This work is the culmination of a lifetime of practical engineering and research and 2 years of iterating and pivoting.

## Architecture

Three things. That's it.

**1. Memory** — Short-term context + long-term embeddings. Stored locally. Traceable. You can inspect every vector if you want to.

**2. State** — Kanban-driven. Every task has an explicit status. Transitions are gated. Nothing implicitly moves.

**3. Loop** — One-shot iteration per worktree. Commit. Merge. Repeat. If you can't trace the execution, the execution is wrong.

Read the docs if you want the details:
- [`docs/AGENT-LOOP.MD`](docs/AGENT-LOOP.MD) — the iteration pattern
- [`docs/KANBAN.MD`](docs/KANBAN.MD) — state machine, gated transitions
- [`docs/CLI.MD`](docs/CLI.MD) — task lifecycle interface

---

## Start here, not at main

Don't clone and run head. Follow the evolution from the beginning:

```bash
git clone https://github.com/augmentedmike/am-agi.git
git submodule update --init --recursive
git checkout 0.0.1-initial-structure
source ./init.sh
```

👉 [v0.0.1-initial-structure](https://github.com/augmentedmike/am-agi/releases/tag/0.0.1-initial-structure)

At first, nothing happens. Then the loop forms. Then the system starts acting on its own structure.

That's the point. Watch it emerge.

---

## Repo layout

```
am/
├── bin/          # CLI scripts — add to PATH
├── docs/         # System definition
└── workspaces/   # Isolated execution (gitignored)
```

---

## What this is not

Not a framework. Not a SaaS. Not a wrapper.

If you want something that works out of the box with zero understanding required, use something else. There are a hundred options.

This is for people who want to know what's running.

---

## What This Is Not
* **Not a framework.**
* **Not a SaaS.**
* **Not a wrapper.**
**This is a real system, exposed.**

## Acknowledgements
Built on ideas and inspiration from:
* **Ken Thompson**
* **John McCarthy**
* **Jim Weirich**
* **Richard Sutton**
* **Yann LeCun**
* **Andrej Karpathy**
* **George Hotz**

If you don’t know who they are, you are looking at some of the most important engineering thinking in modern computing.
