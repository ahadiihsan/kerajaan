# Player poses and separate equipment

## Unfinished checkpoint and failed string correction — 2026-11-27

The user rejected the latest southwest idle correction. The whole-bow mirror was reverted, including its shader/pivot/tip reflection, test and screenshot. Current artwork retains the previous bow orientation. The string-side issue shown in SW row 8 column 7 is unresolved. This checkpoint is not visually accepted. Production build and all 36 tests pass; the multiplayer test was rerun with local-port permission after the sandbox blocked its first attempt.

Failure analysis: the first response confused the left holding-hand/string relationship with finger contact on the right drawing hand. Subsequent changes adjusted limb-tip clearance without establishing a correct bow/string orientation for each pose. The final attempt mirrored the entire idle bow to put the string inward; this also reversed the bow artwork and introduced an incorrect orientation/transition. It was not a valid string correction. Attachment and projection tests passed but did not validate anatomy, view-dependent occlusion, bow orientation or transition quality. Earlier claims of “fixed” overstated this evidence.

No further animation correction is included in this checkpoint. Historical sections below describe intermediate attempts, some rejected or superseded. The inactive `rowan-bow-draw-hand-v2` and `rowan-bow-right-arm-v3` sources are retained as experiment records; the exporter uses v4 for the far-arm region. Current work preserves the requested hidden far fist in W6/SW4–6 and the south idle left-palm attachment, while overall visual acceptance remains pending.

## Far drawing fist hidden by the body — 2026-11-27

Following the user's clarification, W column 6 and SW columns 4–6 hide the far right drawing fist and forearm behind the torso. Only the clothed rear arm/elbow silhouette remains visible. This replaces the rejected visible cheek/shoulder fist approach. The left holding arm and all other body cells are preserved. Original drawing sockets remain, preserving the arrow length and contact geometry.

Built-in imagegen source and prompt: `assets-raw/characters/rowan-bow-right-arm-v4/body-poses.png` and `PROMPT.md`. The exporter integrates only the far-arm region into the four specified cells. Pixel comparison confirmed exactly those four cells changed and the left-side pixels remain identical. Nine bow/equipment tests and production build pass. Preview frames and playback have no browser errors; `bow-hidden-draw-hand.png` records the current result. User visual acceptance remains pending.

## Inward string clearance; finger-detail pass reverted — 2026-11-27

The corrected requirement concerns the anatomical left holding hand: the string must clear its inward side toward the body/right drawing hand. NE/W/SW now inset the limb tips toward that side, with the connected string following those tips. A texture-coordinate deformation preserves limb thickness and the fixed palm grip. The per-view `tipInset` values live in `src/assets/items/bow-directions-v1.json`.

The previous finger-detail solution was incorrect and has been reverted: the drawing-hand string mask is removed, the W/SW replacement hand artwork is no longer used by the exporter, and NE drawing-hand anchors are restored. Pixel comparison confirms the full runtime bow body sheet exactly matches the saved sheet from before that pass. The south idle palm attachment and NW left palm calibration remain.

Validation: nine bow/equipment tests and production build pass, including inward string clearance against the actual hand sockets. All frames and playback in NE/W/SW/NW run without browser errors. `bow-inward-string-restored-hands.png` records the current appearance; visual acceptance remains pending. The older finger-detail section below is historical and superseded by this revision.

## South equipped idle grip — 2026-11-27

South idle now attaches the bow to the anatomical left palm at body pixel (173,253), on the viewer's right, instead of the centerline between the hands. The correction applies to frame 1 and the repeated idle frames 7–8. A palm-sized grip cutout lets the fingers cover the handle. Shooting frames retain their centered attachment. The exporter regenerates the corrected sockets without changing body artwork.

Validation: eight bow/equipment tests and production build pass. All eight south frames and playback were inspected without browser errors; `bow-south-idle-grip.png` records the result. Visual acceptance remains pending.

## Drawing fingers and northwest palm — 2026-11-27

The user's string correction means contact inside the curled drawing fingers. NE/W/SW now hide the string immediately under those fingers while retaining the authored bow-limb tip attachments. The right-hand contact points are calibrated to the finger grip. W drawing poses and frame 6, plus SW frames 4–6, use revised connected forearms and cheek-level drawing/release hands. The generated sources and exact prompts are in `assets-raw/characters/rowan-bow-draw-hand-v2/`.

NW bow attachment points now sit in the left palm rather than the cuff, including the release pose. NW joins W/SW in the palm-sized bow grip cutout and body-plane hand alignment. `bow-draw-finger-repair.png` records the affected directions, and `bow-palm-gap-all-frames.png` records the complete grip sequence.

Validation: 23 equipment/character/fishing/preview tests and production build pass. The four affected directions were stepped through all frames and played in the preview without browser errors. User visual acceptance and actual-game review remain pending.

## West/SW palm-sized grip cutout, all frames — 2026-11-27

The bow rendering now discards a palm-sized grip band in West and SW so the actual character hand covers the middle of the handle. Per-frame palm heights (18–22 pixels in the 320px body cells) are calibrated in `src/assets/items/bow-grip-gaps.json`; the cutout follows the ready, raise, draw, release and returned-rest poses. It is a render-time alpha cutout, so the source bow artwork is preserved. Other viewing directions and non-bow body sheets do not use the cutout.

The previous ready-pose inward nudge is superseded by palm-center anchors. West/SW holding points were calibrated to the painted fists in every stage. `playerHandDepth` keeps these two bow-pose hands on the body artwork plane, making their projection and the grip gap coincide. The same helper is used by gameplay and the equipped preview; the hero enables the cutout only while the actual bow body sheet is active.

Validation: build and 13 relevant bow/arrow/equipment/player-sheet tests pass. An isolated renderer check exercised all 16 West/SW frames and sampled the grip center to verify visible palm skin, without page/console errors. `bow-palm-gap-all-frames.png` shows all poses at 3× zoom for grip review. User visual acceptance remains pending.

## West/SW resting palm attachment — 2026-11-27

Moved the West ready left-hand point from (150,264) to (142,261) and SW from (157,262) to (150,261), toward the inner/thumb edge of the left palm. The shared ready pose applies to frame slots 1, 7 and 8. Only those six left-hand attachment records changed; draw/release attachments and body artwork remain as before. The change is authored in `scripts/player_pose_rig.py` and reproduced by the atlas exporter.

Validation: build and eight relevant bow/equipment tests pass. Browser review checked resting slots 1, 7 and 8 in both directions, without page/console errors. `bow-rest-grip-comparison.png` records the old and revised frame-1 placement at 3× zoom. Visual acceptance remains pending.

## Anatomical handedness and north readability — 2026-11-27

Cardinal sprite views are front/back/profile and diagonal views are three-quarter, with near/far shoulder overlap and foreshortening. Screen-side changes must not exchange anatomical hand roles. The intended setup remains left bow hand and right draw hand (conventional right-handed archery).

NE, West and SW now use four explicitly authored ready/raise/draw/release poses from `assets-raw/characters/rowan-bow-handedness-v1/body-poses.png`. The near/far arm artwork was revised alongside attachment points; far draw hands can be occluded near the face, and the rear elbow is no longer used as the nock attachment in West/SW. North uses `assets-raw/characters/rowan-bow-north-v3/body-poses.png`, holding the idle bow at the left waist and the drawn bow higher in front of the forehead. Its upper bow limb and arrow now clear the head while the lower equipment remains correctly occluded by the body. S, SE, E and NW body pixels were preserved. Prompts accompany both source sheets.

The exporter now prepares intermediate pose layouts in memory and writes only complete runtime atlases, preventing the preview from briefly loading a temporary 4-frame body sheet during regeneration. Idle export is preserved as part of the final export.

Validation: build and 23 relevant tests pass, including all eight directional arrow-rest/contact cases. Browser review stepped every frame and played the four changed directions without page/console errors. A separate north full-draw render comparison counted 851 visible bow pixels and 304 visible arrow pixels at 512×512, independently hiding each item to confirm it contributes to the image. See `bow-handedness-revision.png` and `bow-north-visible.png`. User visual acceptance and actual-game appearance remain pending.

## Directional draw and rear-pose corrections — 2026-11-27

The nocked arrow now runs from the reconstructed draw-hand nock through an explicit rest just above the bow grip. Its normal draw length stays constant while the tip remains beyond the rest, including south-east, south-west and west retraction. Projection preserves contact with the painted hands while placing the bow ahead of the torso and keeping the arrow within the shot plane. Released projectiles still use the existing flight renderer and launch from the nocked arrow's physical tip.

`src/assets/items/arrow-directions-v1.png` supplies eight angle-dependent arrow views, including compact front and rear textures. A thin physical shaft maintains continuity under the sprite artwork. The inspector provides a separate Open arrow sheet link. South's grip was raised by six atlas pixels and its draw-hand anchors adjusted within the painted fists. North and north-west now use explicit ready/raise/draw/release body poses from `assets-raw/characters/rowan-bow-rear-v2/`. The other five body directions retain identical pixels. Prompts are saved beside the new source assets.

Equipment attachment preparation runs from the scene's pre-render hook, before Three.js uploads geometry, so sequential direction previews cannot reuse the previous view's string data. Later sprite draw callbacks only refresh rendering state. Center guides are off by default to avoid confusing them with equipment lines.

Validation: production build and 23 relevant regression tests pass, plus two inventory tests. Coverage includes bow-rest intersection, constant default arrow length during draw, painted tip alignment, visible hand projection, scene preparation timing, camera orbit and orthographic/perspective rendering. Browser review stepped all eight frames and played game-timed cycles for South, South-east, South-west, West, North and North-west without console/page errors. `bow-directions-revision.png` contains the reviewed ready/raise/draw/release contact sheet. Actual-game visual review and user acceptance remain pending.

## South-facing bow centerline — 2026-11-27

The south row now uses four centered ready/raise/draw/release body poses from `assets-raw/characters/rowan-bow-south-v2/body-poses.png`, exported to all eight south-facing frame slots. Its hand attachment x coordinates are zero on the character centerline, keeping both the bow and nocked arrow centered. The bow remains on the left-hand attachment and the draw point on the right-hand attachment; frontal overlap of their projections is intentional. The source prompt is saved beside the generated poses.

Rebuild with `python3 scripts/prepare_player_actions.py`. The exporter supports the 2×2 south-only source and retains all seven other direction rows. Pixel comparison verified that only the eight south cells changed. All 22 relevant tests and production build pass; the new regression checks bow grip, arrow center and release origin across all south frame slots under four camera yaws. The south preview was stepped through all frames and played without browser errors. `bow-south-centered.png` is the reviewed contact sheet. User acceptance and actual-game visual review remain pending.

## Fantasy bow artwork — 2026-11-27

The bow limbs now use `src/assets/items/bow-directions-v1.png`, with eight front, rear, side and diagonal views. The walnut limbs, leaf-shaped metal tips, leather grip and small moss-green gem were generated with Rowan and the v3 axe as style references. Per-view grips and limb-tip points are recorded in the adjacent JSON. The prompt is saved under `assets-raw/items/bow-directions-v1/`.

The body still holds the bow at the authored anatomical left hand. A separate live string connects to the painted limb tips, follows the right hand while drawing, and straightens on release. The existing separate arrow still follows the world aim and release timing. The inspector includes an Open bow sheet link. The body poses were not regenerated in this revision.

Validation: build and 21 relevant tests pass, including string-tip pixel alignment through orthographic/perspective projection, camera orbit, directional selection and scale. Browser checks covered all bow frames and eight views, overrides, mobile layout and reduced motion with no page/console errors. Preview appearance awaits user acceptance; actual gameplay remains unverified for this revision.

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
