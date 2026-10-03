# Global Shorts Production Harness V1

Status: IMPLEMENTATION BASELINE
Date: 2026-10-03
Role: support execution harness only. Canonical strategy remains in `gsh4124-cyber/hwangje-vault`.

## Goal
Build one low-cost repeatable production harness with five swappable format modules. Do not build five unrelated pipelines.

## Locked market-test formats
1. `odd_one_out` — spot the different object.
2. `logic_puzzle` — visual rule/order/path puzzle.
3. `satisfying_fit` — sort / fit / complete / resolve motion.
4. `rank_compare` — intuitive visual ranking or comparison.
5. `guess_reveal` — prompt viewer to guess, then reveal/payoff.

These are market-test formats, not permanent brands. The five retained YouTube channels are experimental slots and may test/rotate modules.

## Harness architecture

`episode_spec.json`
→ SPEC VALIDATION
→ FORMAT MODULE
→ STORYBOARD / SCENE PLAN
→ CHEAP VISUAL PROOF
→ VISUAL PROOF QA
→ FULL RENDER
→ TECHNICAL QA
→ COMMERCIAL QA
→ PACKAGE
→ PUBLISH GATE
→ PLATFORM READBACK
→ METRICS

A failed proof never proceeds to full render. A technical PASS is not a commercial PASS.

## Cost ladder
- L0: deterministic spec generation/validation. Near-zero render cost.
- L1: 3-keyframe proof (hook / reveal / payoff), low resolution.
- L2: short motion proof only when motion is essential to judge the format.
- L3: full 9:16 render only after L1/L2 PASS.
- L4: publish only after technical + commercial QA PASS.

## Common episode contract
Every module consumes the same minimum fields:
- `episode_id`
- `format`
- `seed`
- `duration_s`
- `hook`
- `challenge`
- `reveal`
- `payoff`
- `difficulty`
- `visual_theme`
- `audio_mode`
- `channel_slot`

Every module emits:
- `scene_plan.json`
- `proof/` keyframes or motion proof
- `render/final.mp4`
- `qa/technical.json`
- `qa/commercial.json`
- `package/metadata.json`

## Shared commercial QA
Must answer PASS to all:
1. First frame communicates a challenge/reward without explanation.
2. Viewer can understand the task within ~1 second.
3. There is a reason to stay for the reveal/payoff.
4. Reveal is visually unambiguous.
5. No obviously cheap/broken procedural artifact.
6. Episode differs materially from prior episodes, not only by color/seed.
7. Loop/end state does not feel accidentally cut off.
8. Mobile 9:16 readability is sufficient.

## Module-specific rules
### odd_one_out
- 6–20 visible candidates.
- Exactly one intended answer unless episode explicitly declares multiple-answer mode.
- Difference must be detectable but not obvious in first glance.
- Reveal highlights answer; no misleading decoys after reveal.

### logic_puzzle
- One concise visual rule.
- Puzzle must be solvable from information on screen.
- Avoid language dependence where possible.
- Answer verification must be deterministic.

### satisfying_fit
- Motion/ordering itself is the reward.
- Misalignment/tension at hook; clean resolution at payoff.
- Physics need not be realistic, but motion must look intentional and smooth.

### rank_compare
- Comparison dimension must be explicit visually.
- Values/order must come from episode spec; factual claims require verified source upstream.
- Prefer comparisons understandable without narration.

### guess_reveal
- Hook presents concealed identity/outcome.
- At least one useful visual clue before reveal.
- Reveal must deliver information or transformation, not merely remove a cover.

## Initial implementation order
1. Common spec validator + module registry.
2. `odd_one_out` deterministic module as reference implementation.
3. `guess_reveal`.
4. `satisfying_fit`.
5. `logic_puzzle`.
6. `rank_compare`.

Odd One Out is first because it can validate the complete harness cheaply without requiring expensive 3D rendering.

## Scale rule
Start with total `1 commercial PASS + published episode/day`. Do not scale because the renderer works. Scale only after repeatable viewer response and acceptable production time/cost. Target after stability: up to five published episodes/day across retained slots.

## Forbidden regressions
- Runway.
- Restoring old Family/10-channel equal-production model.
- Full render before cheap proof.
- Publishing fallback garbage because a quota/dependency failed.
- Treating a single view spike as a winner.
- Asking the user to run CLI/repo steps as the production path.
