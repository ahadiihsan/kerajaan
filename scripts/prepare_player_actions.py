from pathlib import Path
import json

import numpy as np
from PIL import Image
from scipy.ndimage import find_objects, label


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets-raw/characters/rowan-actions-v1'
DESTINATION = ROOT / 'src/assets/characters'


def prepare(name, source_override=None, column_override=None, row_count=8, write=True):
    revised = SOURCE / f'{name}-v2.png'
    body = SOURCE / f'{name}-body.png'
    source = body if body.exists() else revised if revised.exists() else SOURCE / f'{name}.png'
    column_count = 4 if name == 'idle' and revised.exists() else 8
    source = source_override or source
    column_count = column_override or column_count
    image = Image.open(source).convert('RGBA')
    pixels = np.array(image)
    labels, _ = label(pixels[:, :, 3] > 110)
    counts = np.bincount(labels.ravel())
    columns = [[] for _ in range(column_count)]
    for component, region in enumerate(find_objects(labels), 1):
        if counts[component] < 1500:
            continue
        ys, xs = region
        column = int((xs.start + xs.stop) / 2 / (image.width / column_count))
        columns[column].append((ys, xs, component))
    assert all(len(column) == row_count for column in columns), [len(column) for column in columns]
    for column in columns:
        column.sort(key=lambda frame: frame[0].stop)
    atlas = Image.new('RGBA', (320 * column_count, 320 * row_count))
    for row in range(row_count):
        neutral_y, _, _ = columns[0][row]
        scale = 168 / (neutral_y.stop - neutral_y.start)
        for column in range(column_count):
            ys, xs, component = columns[column][row]
            frame = pixels[ys, xs].copy()
            frame[:, :, 3] = np.where(labels[ys, xs] == component, 255, 0)
            sprite = Image.fromarray(frame)
            sprite = sprite.resize((round(sprite.width * scale), round(sprite.height * scale)), Image.Resampling.NEAREST)
            bottom = labels[max(ys.start, ys.stop - 10):ys.stop, xs] == component
            foot_x = np.nonzero(bottom)[1].mean() if bottom.any() else frame.shape[1] / 2
            x = round(160 - foot_x * scale)
            y = 312 - sprite.height
            assert x >= 0 and x + sprite.width <= 320 and y >= 0, (name, row, column, x, y)
            atlas.alpha_composite(sprite, (column * 320 + x, row * 320 + y))
    destination = DESTINATION / f'rowan-{name}{"-body" if body.exists() else ""}.png'
    if write:
        atlas.save(destination, optimize=True)
    operation = 'Wrote' if write else 'Prepared in memory'
    print(f'{operation} {destination.name}: {column_count * row_count} frames, transparent, feet aligned; source={source.name}')
    return atlas


if __name__ == '__main__':
    from player_pose_rig import export_rig
    atlases = {action: prepare(action, write=False) for action in ('chop', 'fish', 'bow', 'idle')}
    clean = prepare('chop', SOURCE / 'chop-clean.png', 4, write=False)
    clean.save(SOURCE / 'chop-clean-normalized.png')
    points = json.loads((SOURCE / 'chop-clean-grips.json').read_text())
    south_bow = prepare('bow', ROOT / 'assets-raw/characters/rowan-bow-south-v2/body-poses.png', 2, 2, write=False)
    rear_bow = prepare('bow', ROOT / 'assets-raw/characters/rowan-bow-rear-v2/body-poses.png', 4, 2, write=False)
    handed_bow = prepare('bow', ROOT / 'assets-raw/characters/rowan-bow-handedness-v1/body-poses.png', 4, 3, write=False)
    north_bow = prepare('bow', ROOT / 'assets-raw/characters/rowan-bow-north-v3/body-poses.png', 2, 2, write=False)
    right_arm = prepare('bow', ROOT / 'assets-raw/characters/rowan-bow-right-arm-v4/body-poses.png', 2, 2, write=False)
    export_rig(atlases, clean, DESTINATION, points, south_bow, rear_bow, handed_bow, north_bow, right_arm)
    from apply_player_appearance import apply_appearance
    apply_appearance()
