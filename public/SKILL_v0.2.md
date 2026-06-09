---
name: hypnovis
description: >
  Generate valid HypnoVis preset JSON objects and multi-phase sequence JSON files for the HypnoVis
  spiral visualizer app. Use this skill whenever the user mentions HypnoVis, asks for a spiral preset,
  wants a hypnosis animation sequence, asks to generate or tweak a HypnoVis JSON, or describes a
  visual/mood they want rendered as a spiral animation (e.g. "make me a dreamy slow spiral", "create
  a strobe-heavy sequence", "I need a 3-minute HypnoVis journey"). Also trigger if the user pastes
  a HypnoVis JSON and asks to modify, validate, or extend it.
---

# HypnoVis Skill (v0.2)

Generates and validates two kinds of HypnoVis JSON artifacts:

1. **Preset** — a single object controlling all visual parameters at one moment.
2. **Sequence** — an object with multiple timed phases that transition between presets.

Read `references/schema.md` before generating output. It contains every field, type, range, default, transition category, and lock-derivation formula.

---

## Workflow

### Step 1 — Understand the request
Infer from context when obvious; only ask if genuinely unclear:
- **Type**: preset or sequence?
- **Duration / phase count** (sequences only).
- **Features to highlight**: geometry (polygon/concentric), second spiral, afterimage bloom, text mode (phrase/rsvp/wall/highlight), background image, audio entrainment, strobe, inversion, Eyes, vignette, speed ramping, Master Tempo, hue rolling.
- **Exclusions**: e.g. "no strobe", "no audio".
- **Intensity**: chill / moderate / aggressive.

### Step 2 — Generate the JSON
Follow all constraints in `references/schema.md`. Key rules:

- Every **hex color** must match `#[0-9a-fA-F]{6}` exactly — no spaces, no shorthand.
- **Everything is plain nested JSON — no escaped strings anywhere.** A phase's `settings` and the `secondary` object are real objects, never stringified blobs.
- **Each preset and each phase is self-contained:** include the fields you want to set; any omitted field takes its **default**. Phases do **NOT** inherit from the previous phase — there is no delta/carry-over. Two phases that should look different must each spell out the fields that differ from defaults.
- **Base-only fields** (`maxFps`, and sequencer metadata `sequencerEnabled` / `sequenceTitle` / `sequencerLoop`) live only at the **top level**, never inside a phase's `settings`.
- Use `spiralMath` to choose the curve formula. Do **not** emit archived fields: `spiralRenderMode`, any zoom field, or the legacy grid-fragment fields (`fragmentCols`, `fragmentRows`, `fragmentRenderMode`, `fragmentBorder*`, `fragmentAutoPulse`, `fragmentDutyCycle`, `fragmentPulseRate`, `cellFalloff`, `rampFragmentPulse`). Omit `highQuality`.

### Step 3 — Self-validate before outputting
- [ ] All hex colors valid `#rrggbb`, no typos.
- [ ] No escaped JSON strings anywhere — every phase's `settings` and `secondary` is a real nested object.
- [ ] Each phase is self-contained vs. defaults (no inheritance); fields that should differ between phases are spelled out in each.
- [ ] No base-only field (`maxFps`, `sequencerEnabled`, `sequenceTitle`, `sequencerLoop`) inside a phase's `settings`.
- [ ] All numeric fields within documented ranges and current defaults.
- [ ] `spiralMath` used; no archived spiralRenderMode / zoom / grid-fragment fields; no `highQuality`.
- [ ] When `shape` is `concentricCircle`/`concentricPolygon`, remember `arms` is the ring count and `turns` is ignored.
- [ ] Master Tempo enabled + relevant locks set when >1 rhythmic effect is active.
- [ ] Phase durations sum to the requested total (sequences).
- [ ] No excluded features present.

### Step 4 — Output
Return **only** a raw valid JSON object. No markdown fences around it. In a conversation, a brief sentence before/after is fine. For sequences, remind the user how to run it (see below).

---

## Current defaults (v0.2)
Baseline values: `arms` 6 · `turns` 3 · `curve` 4.5 · `width` 50 · `shape` `"spiral"` · `spiralMath` `"log"` · `direction` `-1` (inward) · `rotationSpeed` 1 · `colorMode` `"default"` · `gradientType` `"Three"` · `textMode` `"phrase"`.

## v0.2 feature notes (functional)
- **Geometry (`shape`)**: `"spiral"` (default), `"polygon"` (N-gon arms, `polygonSides` 3–12), `"concentricCircle"` (nested rings — `arms` = ring count, `turns` ignored), `"concentricPolygon"` (nested N-gons; `concentricTwist` 0–1 winds ring-to-ring rotation, needed for the spin to read).
- **Afterimage Bloom**: `afterimageEnabled` + `afterimageIntensity` (ghost opacity), `afterimageDuration` (fade ms), `afterimageHold` (0 = every frame; >0 = stop-motion).
- **Text modes (`textMode`)**: `"phrase"` (uses textAnimation/lineSpeed/lineTime/randomOrder), `"rsvp"` (one word at `wpm`; `rsvpOrp` highlights the focal letter in `highlightColor`), `"wall"` (phrases tiled to fill the frame; `wallDensity`, `wallOpacity`; reshuffles every `lineSpeed`), `"highlight"` (all words dimmed to `wallOpacity` with a sweep in `highlightColor` at `highlightSweepSpeed`). `customFontName` loads a Google Fonts family.
- **Second spiral**: `secondaryEnabled` + `secondaryBlendMode` + `secondaryOpacity`, with all per-spiral visuals in the nested `secondary` object (own geometry, motion, colors). `secondary.ignoreRamp` keeps it at constant speed during a speed ramp; `secondary.afterimage*` gives it an independent bloom.
- **Background image**: `bgImageEnabled` + `bgImageUrl` + `bgImageFill` (cover/contain/stretch/tile/center) + `bgImageDim` + `bgImageBlur`.

## Layering & rhythm
HypnoVis is built for dense, layered results — features are designed to stack and interact. The single biggest lever for a coherent result: whenever a preset or phase uses more than one rhythmic effect (strobe, inversion, text cycling, color cycling, tremolo), enable **Master Tempo** and lock those effects to it so everything pulses on one beat.
(Detailed aesthetic/style guidance lives in separate styling documents.)

## Sequence notes
- **Phase `settings`** are self-contained nested objects. Omitted fields fall back to **defaults**, not the previous phase. Repeat fields to carry or animate a look across phases.
- A MOTION/COLOR field only glides if both the outgoing and incoming phase specify it.
- STRUCTURE fields (`spiralMath`, `shape`, `audioBeatMode`, `fragmentDirectionMode`, `vignetteShape`, lock ratios/beats…) snap at the end of the transition. The whole `secondary` object also snaps at the end; only `secondaryOpacity` glides.
- Transitions: `"ease"` smooth, `"spinBurst"` rotation surge, `"fragment"` brings the Eyes effect in, `"inversionPulse"` accelerating full-screen inversion.
- Rough sizing: 2 min ≈ 5 phases of ~24s; 3 min ≈ 6 phases of ~30s. `transitionDuration` 2–4s typical, 6–10s for deep descents.

### Tell the user how to run a sequence
A pasted sequence does **not** auto-play. After importing: (1) open the Sequencer tab, (2) turn the sequencer on with the top enable toggle, (3) press Play.

---

## Reference
See `references/schema.md` for the complete schema with all fields, ranges, defaults, transition categories, lock-pair formulas, and removed/archived fields.
