from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 360, 640
BG = (18, 20, 28)
PANEL = (31, 35, 48)
CYAN = (68, 220, 220)
CYAN_DARK = (30, 133, 143)
WHITE = (244, 246, 250)
MUTED = (145, 151, 170)
YELLOW = (255, 211, 77)

def font(size: int):
    for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()

def centered(draw, y, text, f, fill):
    box = draw.textbbox((0, 0), text, font=f)
    draw.text(((W - (box[2] - box[0])) / 2, y), text, font=f, fill=fill)

def candy(draw, box, odd=False, dim=False):
    x0, y0, x1, y1 = box
    color = tuple(int(c * .38) for c in CYAN) if dim else CYAN
    draw.rounded_rectangle(box, radius=12, fill=color)
    draw.ellipse((x0 + 9, y0 + 8, x0 + 21, y0 + 20), fill=(173, 255, 251) if not dim else CYAN_DARK)
    if odd:
        draw.polygon([(x1 - 23, y0), (x1, y0), (x1, y0 + 23)], fill=BG)

def render(spec, phase):
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    centered(d, 36, "FIND THE ODD ONE", font(25), WHITE)
    centered(d, 76, "Only one is different", font(15), MUTED)
    grid_top = 142
    cell_w, cell_h, gap = 76, 68, 15
    cols = 3
    left = (W - (cols * cell_w + (cols - 1) * gap)) // 2
    answer = int(spec["answer_index"])
    for i in range(int(spec["candidate_count"])):
        row, col = divmod(i, cols)
        x = left + col * (cell_w + gap)
        y = grid_top + row * (cell_h + gap)
        box = (x, y, x + cell_w, y + cell_h)
        dim = phase == "reveal" and i != answer
        candy(d, box, odd=i == answer, dim=dim)
        if phase == "reveal" and i == answer:
            d.rounded_rectangle((x - 7, y - 7, x + cell_w + 7, y + cell_h + 7), radius=17, outline=YELLOW, width=6)
    if phase == "hook":
        d.rounded_rectangle((54, 535, 306, 582), radius=23, fill=PANEL)
        centered(d, 547, "READY?", font(21), WHITE)
    elif phase == "challenge":
        d.rounded_rectangle((45, 550, 315, 562), radius=6, fill=PANEL)
        d.rounded_rectangle((45, 550, 238, 562), radius=6, fill=YELLOW)
    else:
        centered(d, 539, "THERE!", font(22), YELLOW)
        centered(d, 574, "Did you spot it?", font(16), WHITE)
    return im

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("spec", type=Path)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    spec = json.loads(args.spec.read_text(encoding="utf-8"))
    if spec.get("format") != "odd_one_out":
        raise ValueError("proof renderer currently supports odd_one_out only")
    args.out.mkdir(parents=True, exist_ok=True)
    frames = []
    for phase in ("hook", "challenge", "reveal"):
        im = render(spec, phase)
        path = args.out / f"{phase}.png"
        im.save(path, optimize=True)
        frames.append(im)
    sheet = Image.new("RGB", (W * 3, H), BG)
    for i, frame in enumerate(frames):
        sheet.paste(frame, (i * W, 0))
    sheet.save(args.out / "contact_sheet.png", optimize=True)
    qa = {
        "episode_id": spec["episode_id"],
        "format": spec["format"],
        "proof_level": "L1_THREE_KEYFRAMES",
        "dimensions": [W, H],
        "frame_count": 3,
        "single_answer": True,
        "answer_index": int(spec["answer_index"]),
        "status": "ARTIFACT_READY_FOR_VISUAL_QA"
    }
    (args.out / "proof_manifest.json").write_text(json.dumps(qa, indent=2), encoding="utf-8")
    print("VISUAL_PROOF_ARTIFACT_READY")

if __name__ == "__main__":
    main()
