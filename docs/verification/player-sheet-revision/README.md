# Player poses and separate equipment

## Directional axe artwork revision — 2026-11-27

The active axe is now `src/assets/items/axe-directions-v3.png`: eight authored front, rear, side and diagonal views in the supplied reference’s simple gray-head, brown-handle, black-outline style. Calibration is in the adjacent JSON; the generation prompt is under `assets-raw/items/axe-directions-v3/`. `AxeSprite` selects artwork using body heading relative to camera yaw rather than mirroring a single broadside axe.

After the user reported that the equipment texture did not match and confirmed the axe was too small, v3 adds character-matched warm outlines, steel facets and wood highlights, and the default axe scale increases from 1.0 to 1.25. Visual acceptance is pending.

The chop shaft now follows the body’s forward swing plane, with the grip centered between the authored fists and a small forward offset. The earlier assumption that the line between the side-by-side fists was the handle axis was incorrect. Rest keeps the head upright; impact brings the cutting edge forward and down. Rear-facing equipment uses scene depth so the body can hide the forward-held axe instead of painting it over the character’s back.

Validation: production build and 20 character/fishing/preview tests pass. Browser checks exercised all chop frames and eight directions, item overrides, mobile width and reduced motion, with no page or console errors. Visual inspection covered the equipped preview; actual gameplay and user visual acceptance remain outstanding.

## Checkpoint status

The user requested a branch, commit, and push of the current progress on 2026-11-27. Visual acceptance has **not** been reached. This is an experimental checkpoint, not a finished animation implementation.

The latest changes replace skin-color guessing with authored left/right attachment points in `hand-grips.json`, exported by `scripts/player_pose_rig.py`. The bow uses the anatomical left hand, the right hand controls the drawn string, and the axe handle follows both authored grip points during the swing. Malformed source frames are excluded from runtime selection. The new `chop-clean.png` source still contains rejected rear resting poses; runtime uses earlier valid rear resting frames in their place.

Remaining work: review and refine anatomy, anatomical handedness, occluded hands, axe orientation and contact, transitions, and all fishing stages in actual gameplay. The user remains dissatisfied with the result. The validation below describes earlier checkpoints; current build/test results are reported with the commit handoff.

The earlier `hand-sockets.json` and `body-hand-sockets.png` are retained intermediate artifacts. Current runtime uses `hand-grips.json` and the `*-authored-grips.png` inspection images.

## Earlier implementation notes

2026-11-27. Local development implementation; not deployed.

The initial action sheets painted equipment into each frame. Several bow arrows faced sideways regardless of body direction, and the fishing rod and painted line disagreed with the live bobber. The first idle sheet also had malformed boots.

Runtime now uses `rowan-chop-body.png`, `rowan-bow-body.png`, and `rowan-fish-body.png`: empty-hand character poses with separately rendered equipment. The repaired idle sheet has four frames per direction and distinct planted boots. The initial sources and superseded runtime atlases are retained under `assets-raw/characters/rowan-actions-v1/`.

`PlayerEquipment.ts` owns independent axe, bow, and nocked-arrow geometry. Both the bow and arrow point along the player's world-space shot heading, independently of camera orbit or sprite mirroring. Arrow release starts at the equipped bow. `FishingVisuals.ts` renders the rod, bobber, and a line whose first point is the actual rod tip. The generated body pose hand sockets place the equipment at the visible hands.

Each item can be customized independently in code:

```ts
hero.equipment.setAppearance('rod', { woodColor: 0x7851a9, scale: 1.2 });
hero.equipment.setAppearance('bow', { woodColor: 0x604327 });
hero.equipment.setAppearance('arrow', { metalColor: 0xd7e4ec });
hero.equipment.setAppearance('axe', { metalColor: 0x8497a6 });
```

There is no new customization menu. Tool geometry can be changed in `PlayerEquipment.ts`; rod geometry is in `FishingVisuals.ts`. Body frames and attachment metadata remain independent of tool appearance.

Rebuild the atlases and attachment points with `python3 scripts/prepare_player_actions.py` (Pillow, NumPy, SciPy). Body-only sources take precedence over the earlier combined sheets; idle uses `idle-v2.png`. Image generation used built-in image_gen; prompts are in `BODY-ONLY-PROMPTS.md` and `REVISION-PROMPTS.md` alongside the sources.

Validation:

- Production build passed; all 26 tests passed, including nocked-arrow aim across all eight directions and four camera orientations, release timing, and independent item styles.
- Browser: observed separate bow on leftward and rearward shots; observed a live fishing cast and active fishing round, with a continuous line from rod tip to bobber. No browser warnings or errors were captured.
- Reviewed the repaired idle boots and generated attachment points across all eight directions in `idle-directions.png` and `body-hand-sockets.png`.
- `bow-directions-before-modular.png` is an intermediate comparison image, not the active runtime artwork.

Hand sockets are extracted from skin-colored regions and reviewed visually. New character palettes or substantially different poses may need adjusted attachment metadata. Remote multiplayer travelers still use the existing procedural character rendering.
