import json
import tempfile
import unittest
from pathlib import Path

from harness import FORMATS, build_plan, load_spec

BASE = {
    "episode_id": "TEST-001",
    "format": "odd_one_out",
    "seed": 42,
    "duration_s": 9,
    "hook": "hook",
    "challenge": "challenge",
    "reveal": "reveal",
    "payoff": "payoff",
    "difficulty": 2,
    "visual_theme": "test",
    "audio_mode": "minimal",
    "channel_slot": "test-slot"
}

class HarnessTests(unittest.TestCase):
    def test_all_formats_build(self):
        for fmt in FORMATS:
            spec = dict(BASE, format=fmt, episode_id=f"TEST-{fmt}")
            plan = build_plan(spec)
            self.assertEqual(plan.format, fmt)
            self.assertEqual([b["id"] for b in plan.beats], ["hook", "challenge", "reveal", "payoff"])
            self.assertEqual(len(plan.proof_frames), 3)

    def test_odd_answer_contract(self):
        spec = dict(BASE, candidate_count=12, answer_index=7)
        plan = build_plan(spec)
        layout = plan.beats[1]["layout"]
        self.assertEqual(layout["candidate_count"], 12)
        self.assertEqual(layout["answer_index"], 7)

    def test_load_rejects_missing(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "bad.json"
            p.write_text(json.dumps({"episode_id": "x"}), encoding="utf-8")
            with self.assertRaises(ValueError):
                load_spec(p)

if __name__ == "__main__":
    unittest.main()
