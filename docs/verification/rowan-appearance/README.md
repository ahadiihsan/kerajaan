# Rowan appearance consistency

## Applied walk-based appearance — 2026-11-27

The user selected the walk sheet as the master and authorized applying the adjustment to every frame. Idle (32), chop (64), bow (64), and fishing (64) now use revised walk-referenced artwork: 224 runtime frames across eight directions. The existing 64 walk frames remain unchanged. All four revised atlases use the same 48-color palette sampled from opaque walk pixels, with binary transparency and nearest-neighbor resizing.

Built-in imagegen produced the four edited pose sources in `assets-raw/characters/rowan-appearance-walk-v2/`. The exact IDLE, CHOP, BOW and FISH prompts, walk master, original pose guides, previous runtime sheets and export report are saved there. `scripts/apply_player_appearance.py` detects complete character components per column before normalization, preserving feet even when generated row spacing varies. It aligns feet to the previous frames and expands pose sources into the runtime animation layout. Repeated poses reuse the same image; SW bow columns 4 and 5 share the revised full-draw artwork.

Rebuild with `python3 scripts/prepare_player_actions.py`, which runs the appearance exporter after the pose export. `python3 scripts/apply_player_appearance.py` reapplies just the appearance. Rebuilding was checked byte-for-byte: all runtime outputs are identical, and the walk atlas and hand sockets remain unchanged. No bow/string rendering, timing, combat, fishing or other equipment code was changed. The previously reported string-side issue remains unresolved.

Validation: all 224 revised cells are nonempty, have no cell-edge clipping, use binary alpha and share at most 48 visible colors. All 36 existing tests pass; the multiplayer test needed a separate local-port-enabled run after sandbox EPERM. Production build passes. Browser verification stepped all 288 frames across all five sheets, played each action and checked mobile/reduced-motion behavior with no page/console errors. Rendered grip samples show the left palm at the bow grip in all 24 W/SW/NW cells. These checks establish export/runtime integrity, not exact visual identity or user acceptance. Actual-game visual acceptance remains pending.

## Review images

- `applied-directions.png`: walk master followed by idle, chop, bow and fish, all eight directions at rest.
- `applied-action-poses.png`: the same comparison during action poses.
- `idle-all-frames.png`, `chop-body-all-frames.png`, `bow-body-all-frames.png`, `fish-body-all-frames.png`: every revised frame, labeled by row/column.
- `idle-equipped.png`, `walk-equipped.png`, `chop-equipped.png`, `bow-equipped.png`, `fish-equipped.png`: rendered preview evidence.

The older `walk-style-sample.png` is the initial two-pose proposal. Its generated sources and prompts remain under `rowan-appearance-walk-v1/` as an experiment record; it is not the installed artwork.
