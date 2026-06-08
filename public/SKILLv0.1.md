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

# HypnoVis Skill

Generates and validates two kinds of HypnoVis JSON artifacts:

1. **Preset** — a single `Preset` object controlling all visual parameters at one moment
2. **Sequence** — a `Sequence` object with multiple timed `Phase` entries that transition through presets

Read `references/schema.md` before generating any output. It contains every field, type, range, default, transition category, and lock-derivation formula.

---

## Design philosophy: be bold

HypnoVis is built for dense, layered, hypnotic results. Stack features aggressively and let them interact rather than producing thin single-effect presets. A strong result might combine the Eyes effect with a deep vignette, ramp the spiral speed, run the inversion pulse, and layer audio entrainment all at once.

**The single biggest lever for a polished, professional result:** whenever a preset or phase uses more than one rhythmic effect (strobe, inversion, text cycling, color cycling, tremolo), enable **Master Tempo** and lock those effects to it so everything pulses on one coherent beat.

Strobe, flash, and inversion are safe to include freely — the app presents a full photosensitivity and hypnotic-effects warning on first load that every user must accept, so generated presets don't need per-preset caveats.

---

## Workflow

### Step 1 — Understand the request
Infer from context when obvious; only ask if genuinely unclear:
- **Type**: preset or sequence?
- **Duration / phase count** (sequences only)
- **Mood / theme**: dreamy, aggressive, chaotic, meditative, trance-deepening, etc.
- **Features to highlight**: audio entrainment, strobe, inversion, Eyes, vignette, text, speed ramping, Master Tempo, hue rolling, etc.
- **Exclusions**: e.g. "no strobe", "no audio"
- **Intensity**: chill / moderate / aggressive

### Step 2 — Generate the JSON
Follow all constraints in `references/schema.md`. Key rules:

- Every **hex color** must match `#[0-9a-fA-F]{6}` exactly — no spaces, no shorthand.
- **Everything is plain nested JSON — no escaped strings anywhere.** A phase's settings are a real object, not a stringified blob.
- **Each preset and each phase is self-contained:** include the fields you want to set; any field you omit takes its **default** value. Phases do **NOT** inherit from the previous phase — there is no delta/carry-over. Two phases that should look different must each spell out the fields that differ from defaults.
- **Base-only fields** (`maxFps`, and the sequencer metadata `sequencerEnabled` / `sequenceTitle` / `sequencerLoop`) live only at the **top level**, never inside a phase's `settings`.
- Ranges to respect: `curve` 0.1–10, `arms` 1–30, `turns` 0.1–10, `width` 1–100. `intenseStrobeDelay`/`strobeLength` min 5 ms. `lineSpeed`/`lineTime` 100–1000 ms. `inversionRate`/`inversionDuration` are **seconds**.
- Use `spiralMath` to choose the curve formula. Do **not** emit `spiralRenderMode`, any zoom field, or any removed grid-fragment field (`fragmentCols`, `fragmentRows`, `fragmentRenderMode`, `fragmentBorder*`, `fragmentAutoPulse`, `fragmentDutyCycle`, `fragmentPulseRate`, `cellFalloff`, `rampFragmentPulse`).

### Step 3 — Self-validate before outputting
- [ ] All hex colors valid `#rrggbb`, no typos
- [ ] No escaped JSON strings anywhere — every phase's `settings` is a real nested object
- [ ] Each phase is self-contained vs. defaults (no inheritance from the previous phase); fields that should differ between phases are spelled out in each
- [ ] No base-only field (`maxFps`, `sequencerEnabled`, `sequenceTitle`, `sequencerLoop`) appears inside a phase's `settings`
- [ ] All numeric fields within documented ranges and current defaults
- [ ] `spiralMath` used; no `spiralRenderMode`, zoom, or removed grid-fragment fields
- [ ] Master Tempo enabled + relevant locks set when >1 rhythmic effect is active
- [ ] Phase durations sum to the requested total (sequences)
- [ ] No excluded features present
- [ ] Audio fields included if a brainwave / entrainment mood was requested

### Step 4 — Output
Return **only** a raw valid JSON object. No markdown code fences around it. In a conversation, a brief natural-language sentence before/after the JSON is fine. For sequences, remind the user how to run it (see below).

---

## Current defaults (v3)
These changed in recent versions — use them as the baseline:
`arms` 6 · `turns` 3 · `curve` 4.5 · `width` 50 · `spiralMath` `"log"` · `direction` `-1` (inward) · `rotationSpeed` 1 · `colorMode` `"default"` · `gradientType` `"Three"`.

## Preset design tips

- **Aggressive**: high `rotationSpeed` (2–5), `wobble` 0.2–0.4, `wobbleSpeed` 4–8, many `arms` (8–16), `curve` ≥ 6, `spiralMath: "power"`, strobe + inversion locked to Master Tempo.
- **Meditative / trance**: low `rotationSpeed` (0.2–0.5), gentle wobble, few arms, deep cool colors, `spiralMath: "log"`, `direction: -1`, theta audio (`audioBeatFreq` 4–8), brown noise bed, slow tremolo.
- **Psychedelic**: `colorMode: "kaleidoscopic"`, high `colorCyclingSpeed`, `gradientType: "Three"`, `inversionEnabled: true`, `hueRotateSpeed` 10–30.
- **Eyes (deep-trance symmetry)**: `fragmentEnabled: true`, `fragmentDirectionMode: "mirror"`, `fragmentPhaseOffset` 100–140, `eyeSpread` 45–55, `eyeSoftness` 60–70, `armTaper` 25–40. Pair with `spiralMath: "log"`, a strong soft vignette (`vignetteSoftness` 70), and theta audio.
- **Arm softness**: `armTaper` 25–50 removes harsh outer edges for an organic feel.
- **Coherent rhythmic pulse**: `masterTempoEnabled: true`, set `masterTempoBpm`, then lock the rhythmic systems (`lockStrobe`, `lockInversion`, `lockAudioBeat`, etc.) with ratios.
- **Audio layers**: binaural needs headphones; use `"monaural"` or `"isochronic"` for speakers. Add `audioDroneEnabled` for harmonic depth, `audioNoiseType: "brown"` for warm rumble.

## Sequence design tips

- **Phase `settings`**: each is a self-contained nested object. Include every field you want that phase to set; omitted fields fall back to **defaults**, not the previous phase. To carry a look across phases, repeat the relevant fields in each phase.
- Transition choice: `"ease"` for smooth flow, `"spinBurst"` for dramatic mood changes, `"fragment"` when bringing the Eyes effect in with a phase-offset surge, `"inversionPulse"` for an accelerating full-screen inversion descent.
- Make phases evolve dramatically: shift `spiralMath`, swing `direction`, bring Eyes in and out, deepen the vignette, ramp the speed, move audio bands across the journey.
- Lock multi-rhythm phases to Master Tempo so the whole scene pulses on one beat.
- For 2 min (120s): ~5 phases of 24s. For 3 min: ~6 phases of 30s. `transitionDuration` 2–4s typical; 6–10s for deep descent phases.
- Audio fields are MOTION (interpolated), so drift `audioCarrierFreq`/`audioBeatFreq` across phases for a frequency-following journey. Structural fields (`spiralMath`, `audioBeatMode`, `fragmentDirectionMode`, `vignetteShape`) snap at end of transition — plan order accordingly.
- A field that interpolates (MOTION/COLOR) only animates if both the phase you leave and the phase you enter specify it; since phases are self-contained, set such fields in every phase you want them to glide across.
- If `sequencerLoop: true`, make the last phase loop smoothly back to phase 1.

### Tell the user how to run a sequence
A pasted sequence does **not** auto-play. After importing: (1) open the Sequencer tab, (2) turn the sequencer on with the top enable toggle, (3) press Play.

---

## Reference
See `references/schema.md` for the complete schema with all fields, ranges, defaults, transition categories, lock-pair formulas, and removed/archived fields.
