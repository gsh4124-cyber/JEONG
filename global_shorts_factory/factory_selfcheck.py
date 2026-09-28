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

    ids = [stage.get("id") for stage in data.get("stages", [])]
    if ids != ["00", "01", "02", "03"]:
        fail(f"support stage order mismatch: {ids}")

    print("SUPPORT_CONTRACT_PASS")
    print("primary=gsh4124-cyber/hwangje-vault")
    print("support=gsh4124-cyber/JEONG")
    print("route=HWANGJE_PRIMARY>VERIFIED_BLOCKER>JEONG_SUPPORT>RETURN_TO_HWANGJE")


if __name__ == "__main__":
    main()
