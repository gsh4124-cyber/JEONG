from __future__ import annotations

import argparse
import json
import random
from dataclasses import dataclass, asdict
from pathlib import Path

FORMATS = {
    "odd_one_out",
    "logic_puzzle",
    "satisfying_fit",
    "rank_compare",
    "guess_reveal",
}

REQUIRED = {
    "episode_id", "format", "seed", "duration_s", "hook", "challenge",
    "reveal", "payoff", "difficulty", "visual_theme", "audio_mode", "channel_slot",
}

@dataclass
class ScenePlan:
    episode_id: str
    format: str
    beats: list[dict]
    proof_frames: list[dict]
    qa_checks: list[str]


def load_spec(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    missing = sorted(REQUIRED - set(data))
    if missing:
        raise ValueError(f"missing required fields: {missing}")
    if data["format"] not in FORMATS:
        raise ValueError(f"unsupported format: {data['format']}")
    if not 5 <= float(data["duration_s"]) <= 30:
        raise ValueError("duration_s must be between 5 and 30")
    if not 1 <= int(data["difficulty"]) <= 5:
        raise ValueError("difficulty must be 1..5")
    return data


def common_beats(spec: dict) -> list[dict]:
    d = float(spec["duration_s"])
    return [
        {"id": "hook", "start": 0.0, "end": round(min(1.0, d * .12), 2), "intent": spec["hook"]},
        {"id": "challenge", "start": round(min(1.0, d * .12), 2), "end": round(d * .68, 2), "intent": spec["challenge"]},
        {"id": "reveal", "start": round(d * .68, 2), "end": round(d * .86, 2), "intent": spec["reveal"]},
        {"id": "payoff", "start": round(d * .86, 2), "end": d, "intent": spec["payoff"]},
    ]


def build_odd_one_out(spec: dict, rng: random.Random) -> ScenePlan:
    count = int(spec.get("candidate_count", rng.randint(9, 16)))
    if not 6 <= count <= 20:
        raise ValueError("odd_one_out candidate_count must be 6..20")
    answer = int(spec.get("answer_index", rng.randrange(count)))
    if not 0 <= answer < count:
        raise ValueError("answer_index outside candidate range")
    beats = common_beats(spec)
    beats[1]["layout"] = {"candidate_count": count, "answer_index": answer, "mode": "single_answer"}
    return ScenePlan(
        spec["episode_id"], spec["format"], beats,
        [
            {"beat": "hook", "at": 0.0},
            {"beat": "challenge", "at": round(float(spec["duration_s"]) * .45, 2)},
            {"beat": "reveal", "at": round(float(spec["duration_s"]) * .76, 2)},
        ],
        ["single_answer", "one_second_comprehension", "answer_not_first_glance", "reveal_unambiguous"],
    )


def build_generic(spec: dict, rng: random.Random) -> ScenePlan:
    module_checks = {
        "logic_puzzle": ["solvable_on_screen", "deterministic_answer", "low_language_dependency"],
        "satisfying_fit": ["visible_initial_tension", "intentional_motion", "clean_resolution"],
        "rank_compare": ["comparison_dimension_clear", "order_from_spec", "mobile_readability"],
        "guess_reveal": ["concealed_outcome", "useful_pre_reveal_clue", "meaningful_reveal"],
    }
    return ScenePlan(
        spec["episode_id"], spec["format"], common_beats(spec),
        [
            {"beat": "hook", "at": 0.0},
            {"beat": "reveal", "at": round(float(spec["duration_s"]) * .72, 2)},
            {"beat": "payoff", "at": round(float(spec["duration_s"]) * .92, 2)},
        ], module_checks[spec["format"]],
    )


def build_plan(spec: dict) -> ScenePlan:
    rng = random.Random(int(spec["seed"]))
    if spec["format"] == "odd_one_out":
        return build_odd_one_out(spec, rng)
    return build_generic(spec, rng)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("spec", type=Path)
    ap.add_argument("--out", type=Path, default=Path("scene_plan.json"))
    args = ap.parse_args()
    spec = load_spec(args.spec)
    plan = build_plan(spec)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(asdict(plan), ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"HARNESS_SPEC_PASS format={spec['format']} episode={spec['episode_id']}")
    print(f"SCENE_PLAN={args.out}")


if __name__ == "__main__":
    main()
