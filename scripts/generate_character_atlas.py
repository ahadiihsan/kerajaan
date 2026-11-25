#!/usr/bin/env python3
"""
Ragnarok Online Character Sprite Sheet & Atlas Generator
========================================================
Composites official Ragnarok Online Body and Head sprite sheets into
standardized 8-directional, 10-frame character atlases (640x768) ready for Three.js.

Atlas Layout:
  - 8 Rows (Directions):
      Row 0: South (Front)
      Row 1: South-West (Front-Left)
      Row 2: West (Profile-Left)
      Row 3: North-West (Back-Left)
      Row 4: North (Back)
      Row 5: North-East (Back-Right, mirrored Row 3)
      Row 6: East (Profile-Right, mirrored Row 2)
      Row 7: South-East (Front-Right, mirrored Row 1)
  - 10 Columns (Frames):
      Col 0: Standing Idle
      Col 1..8: 8-Beat Walking Animation Cycle
      Col 9: Sitting Pose (/sit)

Usage:
  python3 scripts/generate_character_atlas.py --style 1 --color blonde --output public/sprites/characters/archbishop_blonde.png
  python3 scripts/generate_character_atlas.py --preview-styles
  python3 scripts/generate_character_atlas.py --batch-all
"""

import os
import sys
import argparse
import colorsys
from PIL import Image, ImageOps

# Default Source Paths
DEFAULT_BODY_SHEET = "Sprites/PC _ Computer - Ragnarok Online - Classes (Male) - Arch Bishop.png"
DEFAULT_HEAD_SHEET = "Sprites/PC _ Computer - Ragnarok Online - Heads (Male) - Blue.png"
DEFAULT_OUTPUT = "public/sprites/ro_character_atlas.png"

FRAME_W = 64
FRAME_H = 96
BASELINE_Y = 90

# 5 Base Body Direction Slices (South, SW, West, NW, North)
# 1. Idle Boxes (x, y, w, h)
DEFAULT_IDLE_BOXES = [
    (12, 13, 43, 74),   # 0: South
    (67, 12, 37, 75),   # 1: South-West
    (117, 14, 28, 72),  # 2: West
    (156, 13, 35, 74),  # 3: North-West
    (204, 14, 42, 71),  # 4: North
]

# 2. Sitting Boxes (x, y, w, h)
DEFAULT_SIT_BOXES = [
    (310, 29, 47, 58),  # 0: South
    (370, 28, 50, 60),  # 1: South-West
    (432, 28, 44, 59),  # 2: West
    (488, 25, 44, 65),  # 3: North-West
    (544, 28, 44, 59),  # 4: North
]

# 3. Walk Cycle 8-Frame Boxes for 5 Base Directions
DEFAULT_WALK_BOXES = [
    # 0: South (8 frames)
    [(13, 110, 43, 74), (69, 111, 42, 72), (123, 110, 40, 73), (175, 109, 42, 76),
     (228, 110, 43, 74), (283, 110, 43, 74), (339, 110, 42, 73), (392, 108, 43, 77)],
    # 1: South-West (7 frames + looped frame 1)
    [(17, 202, 38, 73), (67, 203, 42, 72), (121, 201, 38, 75), (170, 201, 35, 75),
     (218, 203, 36, 72), (265, 204, 41, 69), (319, 203, 36, 71), (67, 203, 42, 72)],
    # 2: West (7 frames + looped frame 1)
    [(17, 288, 34, 71), (62, 289, 47, 69), (122, 289, 44, 69), (178, 289, 28, 70),
     (217, 290, 35, 67), (264, 290, 45, 67), (322, 289, 40, 70), (62, 289, 47, 69)],
    # 3: North-West (8 frames)
    [(16, 377, 34, 74), (62, 377, 36, 74), (110, 377, 40, 74), (161, 378, 35, 71),
     (208, 379, 31, 69), (251, 379, 35, 70), (299, 380, 44, 68), (354, 379, 41, 70)],
    # 4: North (8 frames)
    [(14, 470, 41, 68), (68, 468, 40, 72), (119, 469, 39, 70), (171, 469, 40, 70),
     (222, 470, 41, 68), (276, 468, 40, 72), (328, 469, 40, 70), (380, 469, 40, 70)]
]

# Head Offset calibration per direction relative to body neckline
DEFAULT_HEAD_OFFSETS = [
    (0, -17),   # 0: South
    (1, -17),   # 1: South-West
    (2, -17),   # 2: West
    (0, -17),   # 3: North-West
    (0, -17),   # 4: North
]

# Color Palette Hue Shifting
PALETTES = {
    'original': None,
    'blue':     None,
    'blonde':   (0.125, 0.85, 1.30),
    'red':      (0.015, 0.90, 1.15),
    'green':    (0.350, 0.75, 1.10),
    'purple':   (0.780, 0.80, 1.15),
    'black':    (0.600, 0.15, 0.55),
    'silver':   (0.600, 0.08, 1.25),
    'brown':    (0.075, 0.70, 0.85),
    'pink':     (0.920, 0.75, 1.20),
}


def detect_hairstyles(head_sheet_img):
    """Detects all hairstyles and their 5 directional bounding boxes in a head sprite sheet."""
    w, h = head_sheet_img.size
    row_has_pixels = [any(head_sheet_img.getpixel((x, y))[3] > 20 for x in range(w)) for y in range(h)]

    y_ranges = []
    start = None
    for y, has_px in enumerate(row_has_pixels):
        if has_px and start is None:
            start = y
        elif not has_px and start is not None:
            if y - start > 10:
                y_ranges.append((start, y))
            start = None
    if start is not None:
        y_ranges.append((start, h))

    styles = {}
    for s_idx, (y0, y1) in enumerate(y_ranges):
        col_has_pixels = [any(head_sheet_img.getpixel((x, y))[3] > 20 for y in range(y0, y1)) for x in range(w)]
        clusters = []
        c_start = None
        for x, hp in enumerate(col_has_pixels):
            if hp and c_start is None:
                c_start = x
            elif not hp and c_start is not None:
                if x - c_start > 12:
                    clusters.append((c_start, x))
                c_start = None
        if c_start is not None:
            clusters.append((c_start, w))

        # First 5 clusters are the 5 standard directions (South, SW, West, NW, North)
        dirs = []
        for x0, x1 in clusters[:5]:
            dirs.append((x0, y0, x1 - x0, y1 - y0))
        styles[s_idx + 1] = dirs

    return styles


def recolor_hair(head_crop, target_color):
    """Applies authentic color transformation to hair pixels without altering skin tones."""
    if not target_color or target_color.lower() in ('original', 'blue'):
        return head_crop

    preset = PALETTES.get(target_color.lower())
    if not preset:
        return head_crop

    t_h, t_s_mult, t_v_mult = preset
    img = head_crop.copy()
    data = img.load()
    w, h = img.size

    for y in range(h):
        for x in range(w):
            r, g, b, a = data[x, y]
            if a < 20:
                continue

            # Hair pixel classification:
            # Blue hair in RO has blue dominant over red, and blue >= green
            # (Excludes skin tone pixels which have red > green > blue)
            is_hair = (b > r + 8) or (b >= g and r < 165 and b > 70)
            if is_hair:
                h_val, s_val, v_val = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
                new_h = t_h
                new_s = min(1.0, s_val * t_s_mult)
                new_v = min(1.0, v_val * t_v_mult)
                nr, ng, nb = colorsys.hsv_to_rgb(new_h, new_s, new_v)
                data[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)

    return img


CHIN_OFFSETS = {
    1: 23, 2: 32, 3: 29, 4: 23, 5: 24,
    6: 25, 7: 25, 8: 26, 9: 23, 10: 27, 11: 29
}

def composite_frame(body_sheet, head_sheet, body_box, head_box, head_offset, style_num=1, color='original', is_sitting=False):
    """Composites a single frame combining body and head at precise anchor alignments."""
    bx, by, bw, bh = body_box
    hx, hy, hw, hh = head_box
    ox, oy = head_offset

    body_crop = body_sheet.crop((bx, by, bx + bw, by + bh))
    head_crop = head_sheet.crop((hx, hy, hx + hw, hy + hh))

    if color and color.lower() != 'original':
        head_crop = recolor_hair(head_crop, color)

    frame = Image.new('RGBA', (FRAME_W, FRAME_H), (0, 0, 0, 0))
    body_x = (FRAME_W - bw) // 2
    body_y = (BASELINE_Y - 8) - bh if is_sitting else (BASELINE_Y - bh)
    frame.paste(body_crop, (body_x, body_y), body_crop)

    # Align head using chin anchor line so long hairstyles hang naturally without floating
    chin = CHIN_OFFSETS.get(style_num, 23)
    anchor_shift = chin - 23

    head_x = (FRAME_W - hw) // 2 + ox
    head_y = body_y + oy - anchor_shift + (2 if is_sitting else 0)
    frame.paste(head_crop, (head_x, head_y), head_crop)

    return frame


def generate_atlas(body_path, head_path, style_num=1, color='original', output_path=DEFAULT_OUTPUT):
    """Generates the full 8-directional, 80-frame character atlas."""
    if not os.path.exists(body_path):
        raise FileNotFoundError(f"Body sheet not found: {body_path}")
    if not os.path.exists(head_path):
        raise FileNotFoundError(f"Head sheet not found: {head_path}")

    body_sheet = Image.open(body_path).convert('RGBA')
    head_sheet = Image.open(head_path).convert('RGBA')

    styles = detect_hairstyles(head_sheet)
    if style_num not in styles:
        print(f"Warning: Hairstyle {style_num} not found. Defaulting to Hairstyle 1.")
        style_num = 1

    head_boxes = styles[style_num]

    atlas = Image.new('RGBA', (FRAME_W * 10, FRAME_H * 8), (0, 0, 0, 0))

    for dir_idx in range(8):
        is_flipped = dir_idx > 4
        base_dir = 8 - dir_idx if is_flipped else dir_idx

        # Frame 0: Idle Pose
        idle_frame = composite_frame(
            body_sheet, head_sheet,
            DEFAULT_IDLE_BOXES[base_dir],
            head_boxes[base_dir],
            DEFAULT_HEAD_OFFSETS[base_dir],
            style_num=style_num,
            color=color, is_sitting=False
        )
        if is_flipped:
            idle_frame = ImageOps.mirror(idle_frame)
        atlas.paste(idle_frame, (0, dir_idx * FRAME_H), idle_frame)

        # Frames 1..8: 8-Frame Walk Cycle
        for f in range(8):
            walk_frame = composite_frame(
                body_sheet, head_sheet,
                DEFAULT_WALK_BOXES[base_dir][f],
                head_boxes[base_dir],
                DEFAULT_HEAD_OFFSETS[base_dir],
                style_num=style_num,
                color=color, is_sitting=False
            )
            if is_flipped:
                walk_frame = ImageOps.mirror(walk_frame)
            atlas.paste(walk_frame, ((f + 1) * FRAME_W, dir_idx * FRAME_H), walk_frame)

        # Frame 9: Sitting Pose
        sit_frame = composite_frame(
            body_sheet, head_sheet,
            DEFAULT_SIT_BOXES[base_dir],
            head_boxes[base_dir],
            DEFAULT_HEAD_OFFSETS[base_dir],
            style_num=style_num,
            color=color, is_sitting=True
        )
        if is_flipped:
            sit_frame = ImageOps.mirror(sit_frame)
        atlas.paste(sit_frame, (9 * FRAME_W, dir_idx * FRAME_H), sit_frame)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    atlas.save(output_path)
    print(f"✅ Generated Character Atlas: {output_path} (640x768, Style {style_num}, Color: {color})")
    return output_path


def preview_all_styles(body_path, head_path, output_path="public/sprites/preview_all_hairstyles.png"):
    """Creates a collage showing all 11 hairstyles composited on the character."""
    body_sheet = Image.open(body_path).convert('RGBA')
    head_sheet = Image.open(head_path).convert('RGBA')
    styles = detect_hairstyles(head_sheet)

    collage_w = FRAME_W * 5
    collage_h = FRAME_H * len(styles)
    collage = Image.new('RGBA', (collage_w, collage_h), (25, 30, 42, 255))

    for s_idx, (s_num, boxes) in enumerate(sorted(styles.items())):
        for d in range(5):
            f = composite_frame(
                body_sheet, head_sheet,
                DEFAULT_IDLE_BOXES[d],
                boxes[d],
                DEFAULT_HEAD_OFFSETS[d],
                style_num=s_num,
                color='original'
            )
            collage.paste(f, (d * FRAME_W, s_idx * FRAME_H), f)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    collage.save(output_path)
    print(f"📸 Saved Hairstyle Preview Gallery: {output_path}")


def batch_generate_roster(body_path, head_path, out_dir="public/sprites/characters"):
    """Generates a diverse roster of characters with different hairstyles and hair colors."""
    os.makedirs(out_dir, exist_ok=True)
    roster = [
        {"name": "archbishop_blue_spiky",   "style": 1, "color": "blue"},
        {"name": "archbishop_blonde_spiky", "style": 1, "color": "blonde"},
        {"name": "archbishop_red_spiky",    "style": 1, "color": "red"},
        {"name": "archbishop_black_long",   "style": 2, "color": "black"},
        {"name": "archbishop_silver_long",  "style": 2, "color": "silver"},
        {"name": "archbishop_blonde_short", "style": 4, "color": "blonde"},
        {"name": "archbishop_brown_curls",  "style": 5, "color": "brown"},
        {"name": "archbishop_green_wild",   "style": 6, "color": "green"},
        {"name": "archbishop_purple_royal", "style": 7, "color": "purple"},
        {"name": "archbishop_pink_casual",  "style": 8, "color": "pink"},
    ]

    print(f"🚀 Batch generating {len(roster)} character atlases...")
    for item in roster:
        out_file = os.path.join(out_dir, f"{item['name']}.png")
        generate_atlas(body_path, head_path, style_num=item['style'], color=item['color'], output_path=out_file)

    print(f"🎉 Complete! All {len(roster)} character atlases generated in {out_dir}/")


def main():
    parser = argparse.ArgumentParser(description="Ragnarok Online Character Sprite Atlas Generator")
    parser.add_argument("--body", default=DEFAULT_BODY_SHEET, help="Path to body sprite sheet PNG")
    parser.add_argument("--head", default=DEFAULT_HEAD_SHEET, help="Path to head sprite sheet PNG")
    parser.add_argument("--style", type=int, default=1, help="Hairstyle number (1..11, default: 1)")
    parser.add_argument("--color", default="original", choices=list(PALETTES.keys()), help="Hair color preset")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help="Output atlas PNG path")
    parser.add_argument("--preview-styles", action="store_true", help="Generate preview of all hairstyles")
    parser.add_argument("--batch-all", action="store_true", help="Batch generate full character roster")

    args = parser.parse_args()

    if args.preview_styles:
        preview_all_styles(args.body, args.head)
    elif args.batch_all:
        batch_generate_roster(args.body, args.head)
    else:
        generate_atlas(args.body, args.head, style_num=args.style, color=args.color, output_path=args.output)


if __name__ == "__main__":
    main()
