import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
CONTRACT = ROOT / "factory_contract.json"


def fail(message: str) -> None:
    print(f"FACTORY_CONTRACT_FAIL: {message}")
    raise SystemExit(1)


def main() -> None:
    data = json.loads(CONTRACT.read_text(encoding="utf-8"))
    stages = data.get("stages", [])
    ids = [stage.get("id") for stage in stages]
    expected = [f"{i:02d}" for i in range(8)]
    if ids != expected:
        fail(f"stage order mismatch: {ids} != {expected}")

    if len({stage.get("name") for stage in stages}) != 8:
        fail("stage names must be unique")

    required = set(data.get("handoff_required", []))
    must_have = {
        "job_id", "target_channel", "benchmark_source", "benchmark_evidence",
        "format_dna", "current_stage", "input_assets", "output_assets",
        "status", "failure_reason", "next_stage", "next_action", "human_gate"
    }
    missing = sorted(must_have - required)
    if missing:
        fail(f"handoff fields missing: {missing}")

    rules = data.get("rules", {})
    hard_rules = [
        "external_market_first",
        "qa_separate_from_production",
        "publish_requires_qa_pass",
        "publish_success_requires_readback",
        "user_manual_relay_forbidden",
    ]
    for key in hard_rules:
        if rules.get(key) is not True:
            fail(f"hard rule not enabled: {key}")

    if rules.get("internal_tournament_required") is not False:
        fail("internal tournament must not be required")

    print("FACTORY_CONTRACT_PASS")
    print("pipeline=00>01>02>03>04>05>06>07>00")
    print("execution=hybrid(chatgpt+web/vidiq -> JEONG/GitHub -> publish connector -> analytics)")


if __name__ == "__main__":
    main()
