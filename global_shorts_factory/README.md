# Global Shorts Factory

This directory is the executable contract layer for the 8-session Global Shorts factory.

Pipeline:

`00 orchestrator -> 01 market scout -> 02 reverse engineering -> 03 production design -> 04 production -> 05 QA -> 06 publish -> 07 performance -> 00`

Execution split:

- 00-03: ChatGPT orchestration + current web/YouTube/vidIQ evidence.
- 04-05: JEONG/GitHub Actions production and deterministic QA where possible.
- 06: connected publishing connector; publishing is complete only after platform readback/proof.
- 07: current YouTube/vidIQ performance retrieval; result feeds the next market scan and planning cycle.

This is a hybrid factory by design. GitHub Actions must not pretend to perform market research, editorial judgment, external publishing, or analytics when the required connected services are not available inside the runner.

The canonical operating rules are owned by `hwangje-vault/직장/콘텐츠/글로벌 숏츠/세션_운영구조.md`.

`factory_contract.json` is the machine-readable handoff contract. `factory_selfcheck.py` verifies that the contract preserves the current stage boundaries and hard rules.

Important: no timer/cadence is defined here until the Emperor explicitly chooses one. The executable workflow therefore validates readiness and production adapters but does not invent a publishing schedule.
