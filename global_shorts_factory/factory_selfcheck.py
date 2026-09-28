import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
CONTRACT = ROOT / "factory_contract.json"
REGISTRY = ROOT / "channel_registry.json"


def fail(message: str) -> None:
    print(f"FACTORY_CONTRACT_FAIL: {message}")
    raise SystemExit(1)


def main() -> None:
    data = json.loads(CONTRACT.read_text(encoding="utf-8"))
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))

    stages = data.get("stages", [])
    ids = [stage.get("id") for stage in stages]
    expected = ["00", "01", "02", "03", "03.5", "04", "05T", "05C", "06", "07"]
    if ids != expected:
        fail(f"stage order mismatch: {ids} != {expected}")

    if len({stage.get("name") for stage in stages}) != len(stages):
        fail("stage names must be unique")

    required = set(data.get("handoff_required", []))
    must_have = {
        "job_id", "target_channel", "slot_type", "benchmark_source", "benchmark_evidence",
        "format_dna", "current_stage", "input_assets", "output_assets",
        "status", "failure_reason", "next_stage", "next_action", "human_gate"
    }
    missing = sorted(must_have - required)
    if missing:
        fail(f"handoff fields missing: {missing}")

    rules = data.get("rules", {})
    hard_true = [
        "external_market_first",
        "active_slots_only_for_normal_production",
        "job_created_only_when_market_candidate_matches_lane",
        "visual_proof_required_before_full_render",
        "qa_separate_from_production",
        "technical_and_commercial_qa_both_required",
        "publish_requires_all_qa_pass",
        "publish_success_requires_readback",
        "user_manual_relay_forbidden",
        "production_quota_must_not_lower_quality_gate",
        "daily_zero_publish_is_not_normal",
        "daily_recovery_loop_required_when_no_candidate_passes",
        "same_master_cross_channel_forbidden",
    ]
    for key in hard_true:
        if rules.get(key) is not True:
            fail(f"hard rule not enabled: {key}")

    if rules.get("daily_minimum_publish_target") != 1:
        fail("daily minimum publish target must be 1")

    if rules.get("internal_tournament_required") is not False:
        fail("internal tournament must not be required")

    channels = registry.get("channels", [])
    active = [c for c in channels if c.get("production_eligible")]
    core = [c for c in channels if c.get("slot_type") == "CORE"]
    premium = [c for c in channels if c.get("slot_type") == "PREMIUM_CHALLENGER"]
    control = [c for c in channels if c.get("slot_type") == "CONTROL_BACKUP"]
    hold = [c for c in channels if c.get("slot_type") == "HOLD"]

    if len(core) != 4:
        fail(f"expected 4 core channels, found {len(core)}")
    if len(premium) != 1:
        fail(f"expected 1 premium challenger, found {len(premium)}")
    if len(active) != 5:
        fail(f"expected 5 normal production channels, found {len(active)}")
    if len(control) != 1 or control[0].get("production_eligible"):
        fail("control lane must exist and stay out of normal production")
    if any(c.get("production_eligible") for c in hold):
        fail("hold channel cannot be production eligible")

    recovery = data.get("recovery_loop", {})
    if recovery.get("trigger") != "no_publishable_job_for_day":
        fail("daily recovery trigger missing")
    if "lower_commercial_post_gate" not in recovery.get("forbidden", []):
        fail("quality-gate lowering must be forbidden")

    print("FACTORY_CONTRACT_PASS")
    print("portfolio=CORE4+PREMIUM1+CONTROL1+HOLD")
    print("pipeline=00>01>02>03>03.5>04>05T>05C>06>07>00")
    print("daily_rule=min_publish_target_1_without_lowering_quality_gate")
    print("execution=hybrid(chatgpt+web/vidiq -> JEONG/GitHub -> publish connector -> analytics)")


if __name__ == "__main__":
    main()
