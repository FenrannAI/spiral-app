# HypnoVis Schema Reference

All fields are optional. Omit a key to keep its **default** — include only what you want to set. This applies the same way to a single preset and to each sequence phase's `settings`: an omitted field always falls back to its default, never to another phase's value.

> **Base-only (top-level) fields** — these live at the top level of a preset or sequence and **must never appear inside a phase's `settings`**: `maxFps` (1–240, default 144), plus the sequencer metadata `sequencerEnabled`, `sequenceTitle`, `sequencerLoop`. They are global/structural for the whole artifact. (`maxFps` rarely needs changing — leave it out unless asked.)

## Types

```
Theme        = "Darken" | "Lighten"
ColorMode    = "default" | "static" | "kaleidoscopic"
SpiralMath   = "power" | "log" | "archimedean" | "fermat"
Anim         = "fade" | "flash" | "pulse"
Ramp         = "legacy" | "sawtooth"
FragDir      = "uniform" | "alternating" | "mirror"   // Eyes spin pattern
DroneInterval= "octave" | "fifth" | "fourth" | "majorThird" | "tritone" | "minorSecond"
BeatMode     = "binaural" | "isochronic" | "monaural"
Waveform     = "sine" | "triangle" | "square" | "sawtooth"
NoiseType    = "white" | "pink" | "brown"
TempoRatio   = "1/8" | "1/4" | "1/2" | "1" | "2" | "4" | "8"
Transition   = "linear" | "ease" | "pulse" | "spinBurst" | "fragment" | "inversionPulse"
```

> Archived / removed — these have no runtime effect; never emit them: all zoom fields (`zoomEnabled`, `zoomSpeed`, `zoomDir`, `zoomEase`, `zoomMode`, `rampZoomSpeed`), `spiralRenderMode`, and all legacy grid-fragmentation fields (see Eyes section).

---

## Preset fields

### Core spiral (Visuals)
| Field | Range / Values | Default |
|---|---|---|
| `mode` | `"Darken"` (black bg) \| `"Lighten"` (white bg) | `"Darken"` |
| `arms` | 1–30 | 6 |
| `turns` | 0.1–10 | 3 |
| `curve` | 0.1–10 | 4.5 — density for `power` & `log` math |
| `width` | 1–100 (max stroke) | 50 |
| `spiralMath` | SpiralMath | `"log"` |
| `armTaper` | 0–100 (%) | 0 — % of outer arm length that fades to transparent |

**`spiralMath` formulas:**
- `"power"` — r = R·t^curve (classic)
- `"log"` — r = R·(e^(c·t)−1)/(e^c−1) (exponential; best with sequencer transitions; the default)
- `"archimedean"` — r = R·t (constant arm spacing; `curve` ignored)
- `"fermat"` — r = R·√t (dense outer arms; `curve` ignored)

### Motion
| Field | Range / Values | Default |
|---|---|---|
| `rotationSpeed` | 0–20 | 1 |
| `direction` | `1` (outward) \| `-1` (inward) | -1 |
| `wobble` | 0–1 amplitude | 0.1 |
| `wobblePhase` | number | 0 |
| `wobbleSpeed` | 0–20 | 1 |

### Center dot
| Field | Values | Default |
|---|---|---|
| `centerDotEnabled` | boolean | false |
| `centerDotRadius` | 1–200 | 10 |
| `centerDotColor` | hex | `#ffffff` |

### Color
| Field | Range / Values | Default |
|---|---|---|
| `gradientType` | `"Single"` \| `"Two"` \| `"Three"` | `"Three"` |
| `color1` | hex | `#ff0055` |
| `color2` | hex | `#00ffcc` |
| `color3` | hex | `#0055ff` |
| `colorMode` | ColorMode (`default` cycles, `static` fixed, `kaleidoscopic` mirrored) | `"default"` |
| `kaleidoscopeSectors` | 1–16 | 8 |
| `colorCyclingSpeed` | 0–20 | 1 |
| `hueRotation` | 0–360° global hue offset | 0 |
| `hueRotateSpeed` | -360–360 °/sec continuous roll | 0 |

### Eyes
Renders two side-by-side spirals — a hypnotic "two eyes" effect. Each eye is confined to its own soft radial region so they stay distinct while still blending toward the middle. (This replaces the old grid-fragmentation system; `fragmentCols`, `fragmentRows`, `fragmentRenderMode`, `fragmentBorder*`, `fragmentAutoPulse`, `fragmentDutyCycle`, `fragmentPulseRate`, `cellFalloff`, and `rampFragmentPulse` no longer exist.)

| Field | Range / Values | Default |
|---|---|---|
| `fragmentEnabled` | boolean (master on/off) | false |
| `fragmentDirectionMode` | FragDir | `"alternating"` |
| `fragmentPhaseOffset` | 0–360° rotation offset between the two eyes | 90 |
| `eyeSpread` | 0–100 % — how far each eye reaches toward the other | 55 |
| `eyeSoftness` | 0–100 % — edge falloff (low = crisp, high = gradual) | 60 |

**`fragmentDirectionMode`:**
- `"uniform"` — both eyes spin the same way
- `"alternating"` — eyes spin in opposite directions
- `"mirror"` — opposite spin, but both pull in/out together (best for deep-trance symmetry)

### Vignette
| Field | Range / Values | Default |
|---|---|---|
| `vignetteEnabled` | boolean | false |
| `vignetteIntensity` | 0–100 edge opacity (100 = full edge blackout) | 70 |
| `vignetteSize` | 0–95 inner transparent radius as % of width | 50 |
| `vignetteColor` | hex edge tint | `#000000` |
| `vignetteShape` | `"ellipse"` \| `"circle"` | `"ellipse"` |
| `vignetteSoftness` | 0–100 transition softness (low = hard ring, high = gradual) | 60 |

### Subliminal text
| Field | Range / Values | Default |
|---|---|---|
| `textEnabled` | boolean | false |
| `textLines` | string (`\n`-separated phrases) | `"Relax\nLet go\nFocus\nBreathe"` |
| `textColor` | hex | `#ffffff` |
| `textSize` | 0.5–3.0 scale | 1 |
| `textAnimation` | Anim | `"fade"` |
| `randomOrder` | boolean (no-repeat shuffle) | false |
| `lineSpeed` | 100–1000 ms interval between phrases | 800 |
| `lineTime` | 100–1000 ms phrase duration | 400 |

### Text flash (background flash on phrase change)
| Field | Values | Default |
|---|---|---|
| `flashEnabled` | boolean | false |
| `flashColor` | hex | `#ffffff` |
| `flashIntensity` | 0–100 | 50 |

### Independent strobe
The app shows a full photosensitivity + hypnotic-effects warning on first load, which the user must accept. Strobe, flash, and inversion are therefore safe to include in generated presets without adding per-preset caveats.

| Field | Range / Values | Default |
|---|---|---|
| `intenseFlash` | boolean (master toggle) | false |
| `intenseStrobeDelay` | 5–1000 ms delay between flashes | 50 |
| `strobeLength` | 5–1000 ms flash duration | 20 |
| `strobeIntensity` | 0–100 overlay opacity | 50 |
| `strobeColor1` | hex | `#ffffff` |
| `strobeColor2` | hex | `#ff0000` |
| `strobeColor3` | hex | `#0000ff` |
| `strobeColorCount` | 1–3 active colors | 2 |

### Inversion pulse
Briefly inverts all canvas colors (complementary afterimage).

| Field | Range / Values | Default |
|---|---|---|
| `inversionEnabled` | boolean | false |
| `inversionRate` | 0.1–10 seconds between pulse starts | 2.0 |
| `inversionDuration` | 0.05–2 seconds held | 0.08 |
| `inversionIntensity` | 0–100 (100 = full inversion) | 100 |
| `rampInversionSpeed` | boolean — tie rate to master speed ramp | false |

### Audio
All audio is user-gesture-gated; `audioEnabled` must be true for anything to play.

| Field | Range / Values | Default |
|---|---|---|
| `audioEnabled` | boolean | false |
| `audioVolume` | 0–100 (perceptual x² curve) | 35 |
| **Tone layer** | | |
| `audioToneEnabled` | boolean | true |
| `audioBeatMode` | BeatMode | `"binaural"` |
| `audioCarrierFreq` | 50–800 Hz base pitch | 220 |
| `audioBeatFreq` | 0.5–40 Hz | 6 |
| `audioWaveform` | Waveform | `"sine"` |
| **Drone layer** | | |
| `audioDroneEnabled` | boolean | false |
| `audioDroneInterval` | DroneInterval | `"fifth"` |
| `audioDroneLevel` | 0–100 mix | 40 |
| **Noise bed** | | |
| `audioNoiseEnabled` | boolean | false |
| `audioNoiseType` | NoiseType | `"brown"` |
| `audioNoiseLevel` | 0–100 mix | 25 |
| **Tremolo (LFO on master)** | | |
| `audioTremoloRate` | 0–10 Hz, 0 = off | 0 |
| `audioTremoloDepth` | 0–100 % | 0 |
| **Ramp coupling** | | |
| `rampAudioBeat` | boolean — tie beat freq to master ramp (cap 40 Hz) | false |

`audioBeatMode`: `"binaural"` (L/R panned, needs headphones), `"isochronic"` (carrier amp-modulated by square LFO, works on speakers), `"monaural"` (acoustic beat, any speaker).
`audioBeatFreq` brainwave bands: <4 delta, <8 theta, <13 alpha, <30 beta, ≥30 gamma.

### Speed ramping
| Field | Range / Values | Default |
|---|---|---|
| `pulseSpeed` | boolean (master toggle) | false |
| `rampMode` | Ramp (`sawtooth` linear+snap, `legacy` sine) | `"sawtooth"` |
| `pulseMin` | 0–1 trough (legacy only) | 0.2 |
| `pulseMax` | 1–8 peak | 1.8 |
| `rampDuration` | 1–60 seconds full cycle | 30 |
| `rampSpiralSpeed` | boolean | false |
| `rampColorSpeed` | boolean | false |
| `rampTextSpeed` | boolean | false |
| `rampStrobeSpeed` | boolean | false |
| `rampInversionSpeed` | boolean | false |
| `rampAudioBeat` | boolean | false |

### Master Tempo
When `masterTempoEnabled` is true, locked effects have their rate fields overridden by BPM + ratio, creating a single coherent pulse across systems. Old presets load with `masterTempoEnabled: false` and behave exactly as before.

**Enabling Master Tempo and locking the rhythmic effects is the single biggest lever for a polished result — strongly prefer it whenever a preset uses more than one rhythmic effect.**

| Field | Range / Values | Default |
|---|---|---|
| `masterTempoEnabled` | boolean | false |
| `masterTempoBpm` | 30–240 BPM | 60 |
| `masterTempoIndicator` | boolean — pulsing corner beat dot (debug only) | true |
| `masterTempoBeats` | 2,3,4,5,6,7,8,12,16 beats per measure | 4 |

**Lock pairs** — each system has a boolean + TempoRatio. Edge-triggered systems (strobe, inversion, text) also have a 1-indexed beat offset (1 = downbeat) to stagger pulses within a measure:

| Lock fields | |
|---|---|
| `lockColorCycling` + `lockColorCyclingRatio` | |
| `lockHueRotate` + `lockHueRotateRatio` | |
| `lockStrobe` + `lockStrobeRatio` + `lockStrobeBeat` | |
| `lockInversion` + `lockInversionRatio` + `lockInversionBeat` | |
| `lockText` + `lockTextRatio` + `lockTextBeat` | |
| `lockSpeedRamp` + `lockSpeedRampRatio` | |
| `lockAudioTremolo` + `lockAudioTremoloRatio` | |
| `lockAudioBeat` + `lockAudioBeatRatio` | |

All lock booleans default to `false`; all ratios default to `"1"`; all beat offsets default to `1`. (There is no fragment-pulse lock — that system was removed with the Eyes rework.)

**Derived rates when locked (reference only — not stored):**
- Color cycling: `colorCyclingSpeed = BPM/60 × ratio` (cyc/s)
- Hue rotate: `hueRotateSpeed = BPM/60 × ratio × 360` (°/s)
- Strobe: `intenseStrobeDelay = period − strobeLength` (ms)
- Inversion: `inversionRate = 60/BPM / ratio` (s)
- Text: `lineSpeed = 60/BPM / ratio × 1000` (ms)
- Speed ramp: `rampDuration = 60/BPM / ratio` (s)
- Audio tremolo: `audioTremoloRate = min(10, BPM/60 × ratio)` (Hz)
- Audio beat: `audioBeatFreq = min(40, BPM/60 × ratio)` (Hz)

---

## Sequence schema

```typescript
interface Sequence {
  // Top-level / base-only fields:
  sequenceTitle: string;
  sequencerLoop?: boolean;       // default: true
  sequencerEnabled?: boolean;    // optional; set true to auto-arm on import
  maxFps?: number;               // optional base-only; default 144
  sequencePhases: Phase[];
}

interface Phase {
  id: string;                    // short slug
  title: string;                 // UI label
  duration: number;              // hold time in seconds
  transitionType?: Transition;   // default: "linear"
  transitionDuration?: number;   // seconds, default: 2
  settings: Settings;            // a REAL nested object (not a string) — the visual fields for this phase
}
```

`settings` is a plain JSON object whose keys are any of the per-phase preset fields above (everything **except** the base-only fields). It is **self-contained**: include the fields you want this phase to set; omitted fields use their defaults, never the previous phase's value. No escaping, no deltas, no inheritance.

Top-level-only fields (never inside `settings`): `sequenceTitle`, `sequencerLoop`, `sequencerEnabled`, `maxFps`. (`sequencerPlaying` is runtime-only and never saved.)

### Transition types
- `"linear"` — constant rate
- `"ease"` — slow-fast-slow
- `"pulse"` — overshoots target then settles
- `"spinBurst"` — ease + extra rotation surge
- `"fragment"` — ease + brings the Eyes effect in with a phase-offset surge
- `"inversionPulse"` — ease + full-screen inversion that flashes faster and faster (500ms→50ms) across the transition, overriding the normal inversion pulse until it completes

### Transition field categories

**MOTION** — continuously interpolated:
`turns`, `curve`, `width`, `wobble`, `wobbleSpeed`, `wobblePhase`, `colorCyclingSpeed`, `rotationSpeed`, `lineSpeed`, `lineTime`, `textSize`, `flashIntensity`, `intenseStrobeDelay`, `strobeLength`, `strobeIntensity`, `pulseMin`, `pulseMax`, `rampDuration`, `centerDotRadius`, `inversionRate`, `inversionDuration`, `inversionIntensity`, `fragmentPhaseOffset`, `eyeSpread`, `eyeSoftness`, `hueRotation`, `hueRotateSpeed`, `armTaper`, `vignetteIntensity`, `vignetteSize`, `vignetteSoftness`, `audioVolume`, `audioCarrierFreq`, `audioBeatFreq`, `audioDroneLevel`, `audioNoiseLevel`, `audioTremoloRate`, `audioTremoloDepth`, `masterTempoBpm`

**STRUCTURE** — snapped at end of transition, never lerped:
`arms`, `direction`, `gradientType`, `textAnimation`, `mode`, `spiralMath`, `colorMode`, `kaleidoscopeSectors`, `strobeColorCount`, `rampMode`, `fragmentDirectionMode`, `vignetteShape`, `audioBeatMode`, `audioWaveform`, `audioDroneInterval`, `audioNoiseType`, all `lock*Ratio` and `lock*Beat` fields, `masterTempoBeats`

**SNAP** — applied instantly at phase start:
`textEnabled`, `flashEnabled`, `intenseFlash`, `pulseSpeed`, `randomOrder`, `centerDotEnabled`, all `ramp*Speed` toggles, `inversionEnabled`, `fragmentEnabled` (Eyes), `vignetteEnabled`, `audioEnabled`, `audioToneEnabled`, `audioDroneEnabled`, `audioNoiseEnabled`, `rampAudioBeat`, `masterTempoEnabled`, `masterTempoIndicator`, all `lock*` booleans

**COLOR** — interpolated:
`color1`, `color2`, `color3`, `textColor`, `flashColor`, `centerDotColor`, `strobeColor1`, `strobeColor2`, `strobeColor3`, `vignetteColor`

### Critical sequence rules

1. `settings` must be a **real nested JSON object**, never a string.
   - Correct: `"settings": { "rotationSpeed": 1.5, "color1": "#ff0000" }`
   - Wrong: `"settings": "{\"rotationSpeed\":1.5}"` (escaped string)

2. **Each phase is self-contained, vs. defaults.** Include a field only when you want this phase to set it; an omitted field uses its **default**, NOT the previous phase's value — there is no inheritance or carry-over. To keep a look or animate a value across phases, repeat the relevant fields in each phase. (A MOTION/COLOR field only glides if both the outgoing and incoming phase specify it.)

3. **No base-only field inside `settings`** — `maxFps`, `sequencerEnabled`, `sequenceTitle`, `sequencerLoop` belong only at the top level.

4. Use `spiralMath` (not the removed `spiralRenderMode`) to choose the curve formula.

5. Never include archived zoom fields or removed grid-fragment fields.

### Output constraints (both types)
- Return **only** a single raw valid JSON object — no markdown fences, no commentary.
- All colors must be valid hex: `#[0-9a-fA-F]{6}`.
- Everything is plain nested JSON — never emit an escaped JSON string.

### Running a generated sequence (tell the user)
A pasted sequence does **not** auto-play. After importing the JSON the user must: (1) open the Sequencer tab, (2) turn the sequencer on with the enable toggle at the top, (3) press Play. The app shows this reminder automatically on import.

---

## Examples

### Preset (single, flat object)
```json
{
  "mode": "Darken",
  "spiralMath": "log",
  "arms": 6,
  "turns": 3,
  "curve": 4.5,
  "direction": -1,
  "rotationSpeed": 0.4,
  "color1": "#1a0033",
  "color2": "#330066",
  "color3": "#000022",
  "fragmentEnabled": true,
  "fragmentDirectionMode": "mirror",
  "fragmentPhaseOffset": 120,
  "eyeSpread": 50,
  "eyeSoftness": 65,
  "armTaper": 35,
  "vignetteEnabled": true,
  "vignetteIntensity": 80,
  "vignetteSize": 35,
  "vignetteSoftness": 70,
  "audioEnabled": true,
  "audioBeatMode": "binaural",
  "audioCarrierFreq": 220,
  "audioBeatFreq": 6,
  "audioDroneEnabled": true,
  "audioNoiseEnabled": true,
  "audioNoiseType": "brown"
}
```

### Sequence (nested `settings`, self-contained phases)
Note how each phase repeats the fields it needs — there is no inheritance. The
colors are restated in "descend" because that phase changes them; "open" omits
them, so it uses the defaults.
```json
{
  "sequenceTitle": "Mirror Descent",
  "sequencerLoop": true,
  "sequencerEnabled": true,
  "sequencePhases": [
    {
      "id": "open",
      "title": "Opening",
      "duration": 12,
      "transitionType": "ease",
      "transitionDuration": 3,
      "settings": {
        "spiralMath": "power", "arms": 6, "turns": 2, "curve": 3,
        "rotationSpeed": 0.5, "direction": 1
      }
    },
    {
      "id": "descend",
      "title": "Descent",
      "duration": 20,
      "transitionType": "ease",
      "transitionDuration": 8,
      "settings": {
        "spiralMath": "log", "arms": 6, "turns": 3, "curve": 2.5,
        "rotationSpeed": 0.25, "direction": -1,
        "color1": "#1a0033", "color2": "#330066", "color3": "#000022",
        "vignetteEnabled": true, "vignetteIntensity": 75, "vignetteSize": 40
      }
    },
    {
      "id": "mirror",
      "title": "Mirror",
      "duration": 30,
      "transitionType": "fragment",
      "transitionDuration": 6,
      "settings": {
        "spiralMath": "log", "arms": 6, "turns": 3, "curve": 2.5,
        "rotationSpeed": 0.2, "direction": -1,
        "color1": "#1a0033", "color2": "#330066", "color3": "#000022",
        "fragmentEnabled": true, "fragmentDirectionMode": "mirror",
        "fragmentPhaseOffset": 120, "eyeSpread": 50, "eyeSoftness": 65,
        "armTaper": 35,
        "vignetteEnabled": true, "vignetteIntensity": 80, "vignetteSize": 35, "vignetteSoftness": 70
      }
    }
  ]
}
```
