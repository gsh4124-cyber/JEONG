from __future__ import annotations

import argparse
import json
import math
import wave
from pathlib import Path

from PIL import Image, ImageDraw
from proof_renderer import W, H, BG, PANEL, CYAN, CYAN_DARK, WHITE, MUTED, YELLOW, font, centered, candy

FPS = 30

def base_grid(spec, dim_others=False, ring=False, title="FIND THE ODD ONE", subtitle="Only one is different"):
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    centered(d, 36, title, font(25), WHITE)
    centered(d, 76, subtitle, font(15), MUTED)
    grid_top, cell_w, cell_h, gap, cols = 142, 76, 68, 15, 3
    left = (W - (cols * cell_w + (cols - 1) * gap)) // 2
    answer = int(spec["answer_index"])
    boxes = []
    for i in range(int(spec["candidate_count"])):
        row, col = divmod(i, cols)
        x = left + col * (cell_w + gap)
        y = grid_top + row * (cell_h + gap)
        box = (x, y, x + cell_w, y + cell_h)
        boxes.append(box)
        candy(d, box, odd=i == answer, dim=dim_others and i != answer)
    if ring:
        x0, y0, x1, y1 = boxes[answer]
        d.rounded_rectangle((x0 - 7, y0 - 7, x1 + 7, y1 + 7), radius=17, outline=YELLOW, width=6)
    return im

def frame_for(spec, t):
    if t < 1.0:
        im = base_grid(spec)
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((54, 535, 306, 582), radius=23, fill=PANEL)
        centered(d, 547, "READY?", font(21), WHITE)
        return im
    if t < 6.1:
        im = base_grid(spec)
        d = ImageDraw.Draw(im)
        p = max(0.0, 1.0 - (t - 1.0) / 5.1)
        d.rounded_rectangle((45, 550, 315, 562), radius=6, fill=PANEL)
        d.rounded_rectangle((45, 550, 45 + int(270 * p), 562), radius=6, fill=YELLOW)
        return im
    if t < 8.4:
        pulse = (math.sin((t - 6.1) * math.pi * 3) + 1) / 2
        im = base_grid(spec, dim_others=True, ring=True)
        d = ImageDraw.Draw(im)
        color = tuple(int(YELLOW[i] * (.72 + .28 * pulse)) for i in range(3))
        centered(d, 535, "THERE!", font(24), color)
        centered(d, 574, "Did you spot it?", font(16), WHITE)
        return im
    reveal = base_grid(spec, dim_others=True, ring=True)
    dr = ImageDraw.Draw(reveal)
    centered(dr, 535, "THERE!", font(24), YELLOW)
    hook = base_grid(spec)
    dh = ImageDraw.Draw(hook)
    dh.rounded_rectangle((54, 535, 306, 582), radius=23, fill=PANEL)
    centered(dh, 547, "READY?", font(21), WHITE)
    return Image.blend(reveal, hook, min(1.0, (t - 8.4) / .6))

def write_audio(path, duration=9.0, rate=44100):
    samples = [0.0] * int(duration * rate)
    def tone(start, length, hz, amp):
        a, b = int(start * rate), min(len(samples), int((start + length) * rate))
        for i in range(a, b):
            env = min(1.0, (i-a)/(rate*.01+1), (b-i)/(rate*.03+1))
            samples[i] += amp * env * math.sin(2*math.pi*hz*i/rate)
    for sec in range(1, 6):
        tone(float(sec), .055, 720, .15)
    tone(6.1, .22, 520, .28)
    tone(6.1, .22, 1040, .18)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(rate)
        wf.writeframes(b"".join(int(max(-1,min(1,s))*32767).to_bytes(2,"little",signed=True) for s in samples))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("spec", type=Path)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    spec = json.loads(args.spec.read_text(encoding="utf-8"))
    if spec.get("format") != "odd_one_out":
        raise ValueError("full renderer currently supports odd_one_out only")
    frames = args.out / "frames"
    frames.mkdir(parents=True, exist_ok=True)
    total = int(float(spec["duration_s"]) * FPS)
    for i in range(total):
        frame_for(spec, i / FPS).save(frames / f"frame_{i:04d}.png", optimize=True)
    write_audio(args.out / "audio.wav", float(spec["duration_s"]))
    manifest = {
        "episode_id": spec["episode_id"], "format": spec["format"],
        "fps": FPS, "frame_count": total, "dimensions": [W,H],
        "duration_s": float(spec["duration_s"]),
        "state": "FULL_RENDER_FRAMES_READY_FOR_ENCODE"
    }
    (args.out / "render_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"FULL_RENDER_FRAMES_READY frames={total} fps={FPS}")

if __name__ == "__main__":
    main()
