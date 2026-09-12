# Limen as a reference for Hermes Szef

Scope correction: Limen is a learning reference only, not a selected dependency.
Szymon explicitly wants Hermes + Herdr + simple project-owned workflow files.
The adapter recommendation below documents the earlier adoption hypothesis;
it is superseded by `README.md`. Findings about upstream behavior remain useful
for comparison and do not prescribe our implementation.

Research date: 2026-09-12. GitHub HEAD resolved to `b5bdf33f6f09464066471b6062d44978104043a7` using `git ls-remote`. The browser returned cached `main` sources, so their contents are **not verified against that commit**. In particular, README and communication-hook descriptions differ. Pin and reread the actual installed revision before implementation. No runtime installation or configuration was performed.

## What fits

Limen exposes an ordinary CLI for spawn, jobs, diff, steer, stop, and branch reuse. It records work in isolated Git worktrees and durable `.limen/jobs/` files. Its default coordinator is Pi; workers use Pi's `openai-codex` provider with explicit model/thinking arguments. This describes Pi accessing Codex models, not launching a nested Codex CLI. A separate Claude engine exists, but the README says steer does not reach Claude jobs. `done` reports a clean run, not verified completion of a ticket. Human merge responsibility and conditional review are upstream policy; mowa must preserve its own mandatory review policy. [README](https://github.com/overment/limen/blob/main/README.md)

**Inference:** Hermes can invoke these CLI commands through its command tool. That does not make Hermes a supported Limen coordinator automatically: notification delivery and project-context injection depend on Pi APIs.

## Completion wake needs a Hermes adapter

The wake extension registers Pi lifecycle/message events and obtains the Pi session ID. It watches durable job records, maintains subscriptions and delivery claims, and injects a user message when idle or a queued `followUp` while busy. Delivery confirmation requires observing entry of the wake message, an assistant response, and a settled turn; acceptance alone is insufficient. It also recovers missed filesystem events and observes running-job advisories. [wake.ts](https://github.com/overment/limen/blob/main/hook/wake.ts)

For Hermes, implement equivalent session routing, queued wake delivery, confirmation and restart recovery against a **verified Hermes input interface**. Terminal-state detection can use durable job files. An opt-in finish webhook is also documented, but HTTP acceptance does not prove that the coordinator processed a turn; its payload only covers terminal completion, so it cannot replace advisory monitoring by itself. No Hermes webhook endpoint or supported session-injection API was established in this research. [README: finish webhooks](https://github.com/overment/limen#finish-webhooks-opt-in)

## Live corrections can remain Pi-side

The worker steering extension runs only with `LIMEN_JOB=1`, finds its job through `LIMEN_CONTEXT_ROOT` and `LIMEN_JOB_ID`, and watches the durable steer inbox. Delivery calls Pi's `sendUserMessage(text, { deliverAs: "steer" })`, with claims and delivered records around that call. Hermes Szef can issue `limen steer` while the Pi worker retains this existing delivery mechanism. A Hermes worker or Claude worker would need its own delivery implementation. [steering.ts](https://github.com/overment/limen/blob/main/hook/steering.ts)

## Herdr and project context

Herdr hosts Pi worker tabs through `herdr agent start … --kind pi --pane … -- …args`. Hosted start requires Herdr environment detection. Its `idle`/`done` UI statuses explicitly do not mean the hosted process has ended; Limen checks session end or disappearance. Limen owns job orchestration; Herdr supplies process/tab operations. Hermes should retain this distinction rather than deriving task success from a terminal badge. [herdr.ts](https://github.com/overment/limen/blob/main/src/herdr.ts)

The inspected communication hook uses Pi's `before_agent_start` to inject vision, board, styleguide, inherited instructions and communication rules. Hermes must explicitly load mowa's root `vision.md`, `build.md`, `SZEF.md`, `AGENT-LOOP.md`, roles and accepted tickets, and refresh mutable board/ticket context. Upstream `spec/` paths differ from mowa's conventions. [communication.ts](https://github.com/overment/limen/blob/main/hook/communication.ts)

Recommended seam: Hermes remains the only human-facing coordinator; a small adapter supplies context and reliable wake delivery; Limen-style CLI orchestration launches Pi workers in Herdr. Validate spawn → steer → completion wake → review → repair with a disposable task before treating this as an operational setup.
