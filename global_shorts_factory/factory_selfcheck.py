import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
CONTRACT = ROOT / "factory_contract.json"


def fail(message: str) -> None:
    print(f"SUPPORT_CONTRACT_FAIL: {message}")
    raise SystemExit(1)


def main() -> None:
    data = json.loads(CONTRACT.read_text(encoding="utf-8"))

    if data.get("role") != "SUPPORT_RECOVERY_FALLBACK_ONLY":
        fail("JEONG role must stay support/recovery/fallback only")
    if data.get("primary_repository") != "gsh4124-cyber/hwangje-vault":
        fail("primary repository must be hwangje-vault")
    if data.get("support_repository") != "gsh4124-cyber/JEONG":
        fail("support repository mismatch")

    rules = data.get("rules", {})
    if rules.get("jeong_is_primary") is not False:
        fail("JEONG must never self-declare primary")

    required_true = [
        "primary_blocker_required",
        "return_to_hwangje_required",
        "second_canonical_forbidden",
        "user_manual_relay_forbidden",
        "technical_pass_is_not_commercial_pass",
        "actual_artifact_inspection_required",
        "commercial_qa_required_before_user_submission",
        "failed_intermediate_artifact_must_not_be_submitted_to_user",
        "self_report_without_artifact_evidence_forbidden",
        "submission_requires_both_qa_pass",
    ]
    for key in required_true:
        if rules.get(key) is not True:
            fail(f"required support rule missing: {key}")

    required_activation = {
        "verified_primary_actions_blocker",
        "explicit_support_scope",
        "recovery_or_diagnostic_purpose",
        "return_to_primary_plan",
    }
    actual = set(data.get("activation_requires", []))
    missing = sorted(required_activation - actual)
    if missing:
        fail(f"activation requirements missing: {missing}")

    stages = data.get("stages", [])
    ids = [stage.get("id") for stage in stages]
    if ids != ["00", "01", "02", "03", "04", "05", "06"]:
        fail(f"support stage order mismatch: {ids}")

    by_id = {stage["id"]: stage for stage in stages}
    commercial_required = set(by_id["03"].get("requires", []))
    must_have = {
        "actual_output_opened",
        "first_frame_review",
        "instant_comprehension_review",
        "visual_finish_review",
        "motion_review",
        "payoff_review",
        "cheap_procedural_check",
        "commercial_qa_state",
        "commercial_qa_evidence",
    }
    missing_commercial = sorted(must_have - commercial_required)
    if missing_commercial:
        fail(f"commercial QA evidence missing: {missing_commercial}")

    submission_required = set(by_id["05"].get("requires", []))
    if not {"technical_qa_pass", "commercial_qa_pass"}.issubset(submission_required):
        fail("submission gate must require BOTH technical and commercial PASS")

    print("SUPPORT_CONTRACT_PASS")
    print("primary=gsh4124-cyber/hwangje-vault")
    print("support=gsh4124-cyber/JEONG")
    print("qa=ACTUAL_ARTIFACT>TECHNICAL_QA>COMMERCIAL_QA>INTERNAL_REWORK>SUBMISSION")
    print("submission=BOTH_QA_PASS_ONLY")


if __name__ == "__main__":
    main()
