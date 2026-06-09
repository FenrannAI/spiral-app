# HypnoVis Schema Reference (v0.2)

All fields are optional. Omit a key to keep its **default** — include only what you want to set. This applies the same way to a single preset and to each sequence phase's `settings`: an omitted field always falls back to its default, never to another phase's value.

> **Base-only (top-level) fields** — live at the top level of a preset or sequence and **must never appear inside a phase's `settings`**: `maxFps` (1–240, default 144), plus the sequencer metadata `sequencerEnabled`, `sequenceTitle`, `sequencerLoop`. (`maxFps` rarely needs changing — leave it out unless asked.)

## Types

```
Theme        = "Darken" | "Lighten"
SpiralShape  = "spiral" | "polygon" | "concentricCircle" | "concentricPolygon"
ColorMode    = "default" | "static" | "kaleidoscopic"
SpiralMath   = "power" | "log" | "archimedean" | "fermat"
TextMode     = "phrase" | "rsvp" | "wall" | "highlight"
Anim         = "fade" | "flash" | "pulse"
Ramp         = "legacy" | "sawtooth"
FragDir      = "uniform" | "alternating" | "mirror"   // Eyes spin pattern
BgFill       = "cover" | "contain" | "stretch" | "tile" | "center"
BlendMode    = "screen" | "multiply" | "lighten" | "normal"
DroneInterval= "octave" | "fifth" | "fourth" | "majorThird" | "tritone" | "minorSecond"
BeatMode     = "binaural" | "isochronic" | "monaural"
Waveform     = "sine" | "triangle" | "square" | "sawtooth"
NoiseType    = "white" | "pink" | "brown"
TempoRatio   = "1/8" | "1/4" | "1/2" | "1" | "2" | "4" | "8"
Transition   = "linear" | "ease" | "pulse" | "spinBurst" | "fragment" | "inversionPulse"
```

> Archived / removed — no runtime effect; never emit them: all zoom fields (`zoomEnabled`, `zoomSpeed`, `zoomDirection`, `zoomMin`, `zoomMax`, `zoomEasing`, `zoomMode`, `rampZoomSpeed`), `spiralRenderMode`, and all legacy grid-fragmentation fields (`fragmentCols`, `fragmentRows`, `fragmentRenderMode`, `fragmentBorderWidth`, `fragmentBorderColor`, `fragmentAutoPulse`, `fragmentDutyCycle`, `fragmentPulseRate`, `rampFragmentPulse`, and the fragment-pulse lock fields). `highQuality` is a device/perf control — omit it.

---

## Preset fields

### Core spiral (Visuals)
| Field | Range / Values | Default |
|---|---|---|
| `mode` | `"Darken"` (black bg) \| `"Lighten"` (white bg) | `"Darken"` |
| `arms` | 1–30 (ring count when shape is concentric) | 6 |
| `turns` | 0.1–10 (ignored for concentric shapes) | 3 |
| `curve` | 0.1–10 — density for `power` & `log` math | 4.5 |
| `width` | 1–100 (max stroke) | 50 |
| `spiralMath` | SpiralMath | `"log"` |
| `armTaper` | 0–100 (%) — outer arm length that fades out (spiral shape only) | 0 |
| `taperStrength` | 0–100 — Center Taper: core thickness (0 = full/round, 100 = thin/pointy) | 85 |

**`spiralMath` formulas:**
- `"power"` — r = R·t^curve (classic)
- `"log"` — r = R·(e^(c·t)−1)/(e^c−1) (exponential; best with sequencer transitions; the default)
- `"archimedean"` — r = R·t (constant arm spacing; `curve` ignored)
- `"fermat"` — r = R·√t (dense outer arms; `curve` ignored)

### Geometry
| Field | Range / Values | Default |
|---|---|---|
| `shape` | SpiralShape | `"spiral"` |
| `polygonSides` | 3–12 (polygon / concentricPolygon) | 5 |
| `concentricTwist` | 0–1 (concentricPolygon only) | 0.6 |

- `"spiral"` — classic winding arms.
- `"polygon"` — arms warped to an N-gon, expanded to fill the screen.
- `"concentricCircle"` — nested filled rings (bullseye); `arms` = ring count, `turns` ignored.
- `"concentricPolygon"` — nested filled N-gon bands; `arms` = ring count. `concentricTwist` winds each ring's rotation relative to its neighbours — needed for the spin to be visible (0 = all rings aligned).

### Motion
| Field | Range / Values | Default |
|---|---|---|
| `rotationSpeed` | 0–20 | 1 |
| `direction` | `1` (outward) \| `-1` (inward) | -1 |
| `wobble` | 0–1 amplitude | 0.1 |
| `wobblePhase` | number | 0 |
| `wobbleSpeed` | 0–20 | 1 |

### Afterimage Bloom
Retains a faint, decaying ghost of recent frames so fast motion leaves trails.
| Field | Range / Values | Default |
|---|---|---|
| `afterimageEnabled` | boolean | false |
| `afterimageIntensity` | 0–100 (ghost opacity) | 50 |
| `afterimageDuration` | 50–2000 ms (fade-out time) | 300 |
| `afterimageHold` | 0–500 ms (0 = every frame; >0 = stop-motion hold) | 0 |

### Background image
A URL-loaded image behind the spiral; the spiral blends over it.
| Field | Range / Values | Default |
|---|---|---|
| `bgImageEnabled` | boolean | false |
| `bgImageUrl` | image URL string | `""` |
| `bgImageFill` | BgFill | `"cover"` |
| `bgImageDim` | 0–100 % fade toward bg color | 0 |
| `bgImageBlur` | 0–10 px | 0 |

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
Renders two side-by-side spirals — a hypnotic "two eyes" effect. Each eye is confined to its own soft radial region so they stay distinct while blending toward the middle.
| Field | Range / Values | Default |
|---|---|---|
| `fragmentEnabled` | boolean (master on/off) | false |
| `fragmentDirectionMode` | FragDir | `"alternating"` |
| `fragmentPhaseOffset` | 0–360° rotation offset between the two eyes | 90 |
| `eyeSpread` | 0–100 % — how far each eye reaches toward the other | 55 |
| `eyeSoftness` | 0–100 % — edge falloff (low = crisp, high = gradual) | 60 |

**`fragmentDirectionMode`:** `"uniform"` (both spin the same way), `"alternating"` (opposite directions), `"mirror"` (opposite spin, both pull in/out together).

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
| `textAnimation` | Anim (phrase mode entrance) | `"fade"` |
| `randomOrder` | boolean — no-repeat shuffle (phrase mode only) | false |
| `lineSpeed` | 50–5000 ms between phrases (uncapped; also the wall regen interval) | 800 |
| `lineTime` | 50–5000 ms a phrase stays on screen (uncapped) | 400 |

### Text display modes
| Field | Range / Values | Default |
|---|---|---|
| `textMode` | TextMode | `"phrase"` |
| `customFontName` | Google Fonts family name (`""` = app font) | `""` |
| `wpm` | 60–700 words/min (rsvp pacing) | 300 |
| `rsvpOrp` | boolean — rsvp: highlight the focal letter | false |
| `rsvpAnchor` | boolean — rsvp: pin the focal letter to screen centre (vs inline) | true |
| `wallDensity` | 40–600 words packed into the wall | 200 |
| `wallOpacity` | 0–100 % — wall phrase alpha / highlight dim level | 35 |
| `highlightColor` | hex — highlight sweep & rsvp focal letter | `#ffdd00` |
| `highlightSweepSpeed` | 0.5–12 words/sec — highlight advance rate | 3 |

- `"phrase"` — one line at a time; uses `textAnimation`, `lineSpeed`, `lineTime`, `randomOrder`.
- `"rsvp"` — one word at a time at `wpm`; `rsvpOrp` highlights the focal letter in `highlightColor`.
- `"wall"` — whole phrases tiled to fill the frame, reshuffled every `lineSpeed`; uses `wallDensity`, `wallOpacity`.
- `"highlight"` — all words shown dimmed to `wallOpacity` with a bright sweep in `highlightColor` moving at `highlightSweepSpeed`.

### Text flash (background flash on phrase change)
| Field | Values | Default |
|---|---|---|
| `flashEnabled` | boolean | false |
| `flashColor` | hex | `#ffffff` |
| `flashIntensity` | 0–100 | 50 |

### Independent strobe
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

### Second spiral
An optional full second spiral composited over the primary one. Its visual fields live in the nested `secondary` object. Global effects (text, audio, vignette, hue, tempo, strobe, inversion) are shared and not duplicated.
| Field | Range / Values | Default |
|---|---|---|
| `secondaryEnabled` | boolean (master on/off) | false |
| `secondaryBlendMode` | BlendMode | `"screen"` |
| `secondaryOpacity` | 0–100 % | 70 |
| `secondary` | nested object (below) | — |

**`secondary` object:**
| Field | Range / Values | Default |
|---|---|---|
| `arms` | 1–30 | 3 |
| `turns` | 0.1–10 | 3 |
| `curve` | 0.1–10 | 4.5 |
| `width` | 1–100 | 40 |
| `rotationSpeed` | 0–20 | 0.6 |
| `direction` | `1` \| `-1` | 1 |
| `wobble` | 0–1 | 0.1 |
| `wobblePhase` | number | 0 |
| `wobbleSpeed` | 0–20 | 1 |
| `spiralMath` | SpiralMath | `"log"` |
| `shape` | SpiralShape | `"spiral"` |
| `polygonSides` | 3–12 | 5 |
| `concentricTwist` | 0–1 | 0.6 |
| `colorMode` | ColorMode | `"default"` |
| `kaleidoscopeSectors` | 1–16 | 8 |
| `gradientType` | `"Single"` \| `"Two"` \| `"Three"` | `"Two"` |
| `color1` | hex | `#00ffcc` |
| `color2` | hex | `#0055ff` |
| `color3` | hex | `#ff0055` |
| `armTaper` | 0–100 % | 0 |
| `taperStrength` | 0–100 (Center Taper) | 85 |
| `ignoreRamp` | boolean — spin at a constant rate, ignoring the global speed ramp | false |
| `afterimageEnabled` | boolean — independent bloom for the 2nd spiral | false |
| `afterimageIntensity` | 0–100 | 50 |
| `afterimageDuration` | 50–2000 ms | 300 |
| `afterimageHold` | 0–500 ms | 0 |

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

**Enabling Master Tempo and locking the rhythmic effects is the most reliable way to make a multi-effect preset feel coherent — prefer it whenever a preset uses more than one rhythmic effect.**

| Field | Range / Values | Default |
|---|---|---|
| `masterTempoEnabled` | boolean | false |
| `masterTempoBpm` | 30–240 BPM | 60 |
| `masterTempoIndicator` | boolean — pulsing corner beat dot (debug only) | true |
| `masterTempoBeats` | 2–16 beats per measure | 4 |

**Lock pairs** — each system has a boolean + TempoRatio. Edge-triggered systems (strobe, inversion, text) also have a 1-indexed beat offset (1 = downbeat) to stagger pulses within a measure:

| Lock fields |
|---|
| `lockColorCycling` + `lockColorCyclingRatio` |
| `lockHueRotate` + `lockHueRotateRatio` |
| `lockStrobe` + `lockStrobeRatio` + `lockStrobeBeat` |
| `lockInversion` + `lockInversionRatio` + `lockInversionBeat` |
| `lockText` + `lockTextRatio` + `lockTextBeat` |
| `lockSpeedRamp` + `lockSpeedRampRatio` |
| `lockAudioTremolo` + `lockAudioTremoloRatio` |
| `lockAudioBeat` + `lockAudioBeatRatio` |

All lock booleans default to `false`; all ratios default to `"1"`; all beat offsets default to `1`.

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

`settings` is a plain JSON object whose keys are any per-phase preset field (everything **except** the base-only fields). It is **self-contained**: include the fields you want this phase to set; omitted fields use their defaults, never the previous phase's value. No escaping, no deltas, no inheritance.

### Transition types
- `"linear"` — constant rate
- `"ease"` — slow-fast-slow
- `"pulse"` — overshoots target then settles
- `"spinBurst"` — ease + extra rotation surge
- `"fragment"` — ease + brings the Eyes effect in with a phase-offset surge
- `"inversionPulse"` — ease + full-screen inversion flashing faster and faster (500ms→50ms) across the transition, overriding the normal inversion pulse until it completes

### Transition field categories

**MOTION** — continuously interpolated:
`turns`, `curve`, `width`, `wobble`, `wobblePhase`, `wobbleSpeed`, `colorCyclingSpeed`, `rotationSpeed`, `lineSpeed`, `lineTime`, `textSize`, `flashIntensity`, `intenseStrobeDelay`, `strobeLength`, `strobeIntensity`, `pulseMin`, `pulseMax`, `rampDuration`, `centerDotRadius`, `inversionRate`, `inversionDuration`, `inversionIntensity`, `fragmentPhaseOffset`, `eyeSpread`, `eyeSoftness`, `hueRotation`, `hueRotateSpeed`, `armTaper`, `taperStrength`, `concentricTwist`, `vignetteIntensity`, `vignetteSize`, `vignetteSoftness`, `afterimageIntensity`, `afterimageDuration`, `afterimageHold`, `wpm`, `wallOpacity`, `wallDensity`, `highlightSweepSpeed`, `secondaryOpacity`, `bgImageDim`, `bgImageBlur`, `audioVolume`, `audioCarrierFreq`, `audioBeatFreq`, `audioDroneLevel`, `audioNoiseLevel`, `audioTremoloRate`, `audioTremoloDepth`, `masterTempoBpm`

**COLOR** — interpolated:
`color1`, `color2`, `color3`, `textColor`, `flashColor`, `centerDotColor`, `strobeColor1`, `strobeColor2`, `strobeColor3`, `highlightColor`, `vignetteColor`

**STRUCTURE** — snapped at end of transition, never lerped:
`arms`, `direction`, `gradientType`, `textAnimation`, `mode`, `spiralMath`, `shape`, `polygonSides`, `colorMode`, `kaleidoscopeSectors`, `strobeColorCount`, `textMode`, `secondaryBlendMode`, `bgImageFill`, `rampMode`, `fragmentDirectionMode`, `vignetteShape`, `audioBeatMode`, `audioWaveform`, `audioDroneInterval`, `audioNoiseType`, all `lock*Ratio` and `lock*Beat` fields, `masterTempoBeats`

**SNAP** — applied instantly at phase start:
`textEnabled`, `flashEnabled`, `intenseFlash`, `pulseSpeed`, `randomOrder`, `rsvpOrp`, `rsvpAnchor`, `centerDotEnabled`, `afterimageEnabled`, `secondaryEnabled`, `bgImageEnabled`, all `ramp*Speed` toggles, `inversionEnabled`, `fragmentEnabled` (Eyes), `vignetteEnabled`, `audioEnabled`, `audioToneEnabled`, `audioDroneEnabled`, `audioNoiseEnabled`, `rampAudioBeat`, `masterTempoEnabled`, `masterTempoIndicator`, all `lock*` booleans

**APPLIED-AT-END** — strings and objects that swap with the rest of the phase (not interpolated):
`textLines`, `customFontName`, `bgImageUrl`, and the entire `secondary` object (its geometry/colors swap as a unit; only `secondaryOpacity` glides). `textLines` and `bgImageUrl` swap at the **start** of the transition so the new text/background appears immediately.

### Critical sequence rules

1. `settings` must be a **real nested JSON object**, never a string.
   - Correct: `"settings": { "rotationSpeed": 1.5, "color1": "#ff0000" }`
   - Wrong: `"settings": "{\"rotationSpeed\":1.5}"`
2. **Each phase is self-contained, vs. defaults.** Omit a field and it uses its **default**, NOT the previous phase's value. Repeat fields to persist or animate a look across phases. (A MOTION/COLOR field only glides if both the outgoing and incoming phase specify it.)
3. **No base-only field inside `settings`** — `maxFps`, `sequencerEnabled`, `sequenceTitle`, `sequencerLoop` belong only at the top level.
4. Use `spiralMath` to choose the curve formula.
5. Never include archived fields (zoom, grid-fragment, `spiralRenderMode`), `taperStrength`, or `highQuality`.

### Output constraints (both types)
- Return **only** a single raw valid JSON object — no markdown fences, no commentary.
- All colors must be valid hex: `#[0-9a-fA-F]{6}`.
- Everything is plain nested JSON — never emit an escaped JSON string.

### Running a generated sequence (tell the user)
A pasted sequence does **not** auto-play. After importing the JSON the user must: (1) open the Sequencer tab, (2) turn the sequencer on with the enable toggle at the top, (3) press Play. The app shows this reminder automatically on import.

---

## Examples

### Preset (single object, with a concentric-polygon look and an independent second spiral)
```json
{
  "mode": "Darken",
  "shape": "concentricPolygon",
  "polygonSides": 6,
  "concentricTwist": 0.7,
  "arms": 10,
  "curve": 4,
  "rotationSpeed": 0.6,
  "direction": -1,
  "color1": "#1a0033",
  "color2": "#330066",
  "color3": "#000022",
  "afterimageEnabled": true,
  "afterimageIntensity": 45,
  "afterimageDuration": 700,
  "secondaryEnabled": true,
  "secondaryBlendMode": "screen",
  "secondaryOpacity": 60,
  "secondary": {
    "shape": "spiral", "arms": 3, "turns": 4, "curve": 3,
    "rotationSpeed": 1.2, "direction": 1,
    "gradientType": "Two", "color1": "#00ffcc", "color2": "#0055ff",
    "ignoreRamp": true, "afterimageEnabled": true, "afterimageIntensity": 60, "afterimageDuration": 500
  },
  "vignetteEnabled": true,
  "vignetteIntensity": 80,
  "vignetteSize": 35,
  "vignetteSoftness": 70
}
```

### Sequence (nested `settings`, self-contained phases)
Each phase repeats the fields it needs — there is no inheritance. Colors are restated in "descend" because that phase changes them; "open" omits them, so it uses the defaults.
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
        "afterimageEnabled": true, "afterimageIntensity": 45, "afterimageDuration": 600,
        "vignetteEnabled": true, "vignetteIntensity": 80, "vignetteSize": 35, "vignetteSoftness": 70
      }
    }
  ]
}
```
