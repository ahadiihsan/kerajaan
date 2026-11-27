import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import find_objects, label


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets-raw/characters/rowan-appearance-walk-v2'
DESTINATION = ROOT / 'src/assets/characters'


def digest(image):
    return hashlib.sha256(image.tobytes()).hexdigest()


def bounds(image):
    return image.getchannel('A').point(lambda value: 255 if value > 110 else 0).getbbox()


def foreground(image):
    pixels = np.array(image.convert('RGBA'))
    regions, count = label(pixels[:, :, 3] > 110)
    assert count, 'Empty generated pose cell'
    sizes = np.bincount(regions.ravel())
    sizes[0] = 0
    component = sizes.argmax()
    assert sizes[component] > 150, 'Generated pose is too small'
    pixels[:, :, 3] = np.where(regions == component, 255, 0)
    result = Image.fromarray(pixels)
    return result.crop(bounds(result))


def extract_generated(image, columns):
    pixels = np.array(image.convert('RGBA'))
    regions, _ = label(pixels[:, :, 3] > 110)
    sizes = np.bincount(regions.ravel())
    groups = [[] for _ in range(columns)]
    for component, region in enumerate(find_objects(regions), 1):
        if sizes[component] < 300:
            continue
        ys, xs = region
        column = min(columns - 1, int((xs.start + xs.stop) / 2 / (image.width / columns)))
        sprite = pixels[ys, xs].copy()
        sprite[:, :, 3] = np.where(regions[ys, xs] == component, 255, 0)
        groups[column].append((ys.stop, Image.fromarray(sprite)))
    assert all(len(group) == 8 for group in groups), [len(group) for group in groups]
    return [[sprite for _, sprite in sorted(group, key=lambda item: item[0])] for group in groups]


def normalize(image, original, palette):
    sprite = foreground(image)
    box = bounds(original)
    height = box[3] - box[1]
    sprite = sprite.resize((round(sprite.width * height / sprite.height), height), Image.Resampling.NEAREST)
    alpha = sprite.getchannel('A')
    sprite = sprite.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE).convert('RGBA')
    sprite.putalpha(alpha)
    assert sprite.width <= 300, 'Pose exceeds its cell'
    original_pixels = np.array(original)
    old_feet = np.nonzero(original_pixels[box[3] - 10:box[3], :, 3] > 110)[1]
    new_feet = np.nonzero(np.array(sprite)[-10:, :, 3] > 110)[1]
    x = round(old_feet.mean() - new_feet.mean())
    y = box[3] - sprite.height
    assert x >= 0 and x + sprite.width <= 320 and y >= 0
    cell = Image.new('RGBA', (320, 320))
    cell.alpha_composite(sprite, (x, y))
    return cell


def apply_appearance():
    frames = json.loads((SOURCE / 'frames.json').read_text())
    master = np.array(Image.open(DESTINATION / 'rowan-walk.png').convert('RGBA'))
    colors = master[master[:, :, 3] > 220][:, :3]
    palette = Image.fromarray(colors.reshape((-1, 1, 3))).quantize(colors=48)
    report = {}
    results = {}
    for action, selected in frames.items():
        original = Image.open(SOURCE / f'{action}-before.png').convert('RGBA')
        generated = Image.open(SOURCE / f'{action}-poses.png').convert('RGBA')
        extracted = extract_generated(generated, len(selected))
        columns = original.width // 320
        result = Image.new('RGBA', original.size)
        for row in range(8):
            replacements = {}
            for index, column in enumerate(selected):
                old = original.crop((column * 320, row * 320, (column + 1) * 320, (row + 1) * 320))
                cell = extracted[index][row]
                replacements[digest(old)] = normalize(cell, old, palette)
            for column in range(columns):
                old = original.crop((column * 320, row * 320, (column + 1) * 320, (row + 1) * 320))
                if (action, row, column) == ('bow', 7, 4):
                    old = original.crop((3 * 320, row * 320, 4 * 320, (row + 1) * 320))
                assert digest(old) in replacements, (action, row, column, 'Missing source pose')
                result.paste(replacements[digest(old)], (column * 320, row * 320))
        results[action] = result
        report[action] = {'rows': 8, 'columns': columns, 'frames': columns * 8, 'sourceColumns': selected}
    for action, result in results.items():
        suffix = '' if action == 'idle' else '-body'
        result.save(DESTINATION / f'rowan-{action}{suffix}.png', optimize=True)
    (SOURCE / 'export-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print('Applied walk appearance:', ', '.join(f'{action} {data["frames"]} frames' for action, data in report.items()))


if __name__ == '__main__':
    apply_appearance()
