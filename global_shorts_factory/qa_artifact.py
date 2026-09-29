import json
import pathlib
import sys

REQUIRED = [
    "artifact_path", "actual_output_opened", "first_frame_hook",
    "instant_comprehension", "visual_finish", "motion_or_reveal",
    "payoff", "cheap_procedural_feel", "hard_fail_reasons", "review_notes"
]

def fail(msg):
    print(f"COMMERCIAL_QA_FAIL: {msg}")
    raise SystemExit(1)

def main():
    if len(sys.argv) != 2:
        fail("usage: qa_artifact.py evidence.json")
    p = pathlib.Path(sys.argv[1])
    if not p.is_file():
        fail("evidence file missing")
    d = json.loads(p.read_text(encoding="utf-8"))
    missing = [k for k in REQUIRED if k not in d]
    if missing:
        fail(f"missing evidence fields: {missing}")
    if d["actual_output_opened"] is not True:
        fail("actual artifact must be opened and inspected")
    artifact = pathlib.Path(d["artifact_path"])
    if not artifact.is_file() or artifact.stat().st_size == 0:
        fail("artifact missing or empty")
    if d["hard_fail_reasons"]:
        fail(f"hard fail: {d['hard_fail_reasons']}")
    for k in ["first_frame_hook","instant_comprehension","visual_finish","motion_or_reveal","payoff"]:
        if float(d[k]) < 8:
            fail(f"{k} below 8")
    if float(d["cheap_procedural_feel"]) > 2:
        fail("cheap procedural feel above 2")
    overall = sum(float(d[k]) for k in ["first_frame_hook","instant_comprehension","visual_finish","motion_or_reveal","payoff"])/5
    if overall < 8:
        fail("overall below 8")
    print("COMMERCIAL_QA_PASS")
    print(f"overall={overall:.2f}")

if __name__ == "__main__":
    main()
