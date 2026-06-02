# HypnoVis Schema Reference

All preset fields are optional. Omit a key to keep its default — only include what shifts relative to defaults.

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
| `maxFps` | 1–240 | 144 |

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
| `masterTempoIndicator` | boolean — pulsing corner dot when debugEnabled | true |
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

### Debug
| Field | Values | Default |
|---|---|---|
| `debugEnabled` | boolean (shows Debug tab) | false |

---

## Sequence schema

```typescript
interface Sequence {
  sequenceTitle: string;
  sequencerLoop?: boolean;       // default: true
  sequencePhases: Phase[];
}

interface Phase {
  id: string;                    // short slug
  title: string;                 // UI label
  duration: number;              // hold time in seconds
  transitionType?: Transition;   // default: "linear"
  transitionDuration?: number;   // seconds, default: 2
  snapshot: string;              // ESCAPED JSON STRING of a partial Preset
}
```

Sequencer metadata stays at the top level, never inside a snapshot: `sequencerEnabled`, `sequencerLoop`, `sequenceTitle`, `sequencePhases`. (`sequencerPlaying` is runtime-only and never saved.)

### Transition types
- `"linear"` — constant rate
- `"ease"` — slow-fast-slow
- `"pulse"` — overshoots target then settles
- `"spinBurst"` — ease + extra rotation surge
- `"fragment"` — ease + temporary grid surge overlay
- `"inversionPulse"` — ease + full-screen inversion that flashes faster and faster (500ms→50ms) across the transition, overriding the normal inversion pulse until it completes

### Transition field categories

**MOTION** — continuously interpolated:
`turns`, `curve`, `width`, `wobble`, `wobbleSpeed`, `wobblePhase`, `colorCyclingSpeed`, `rotationSpeed`, `lineSpeed`, `lineTime`, `textSize`, `flashIntensity`, `intenseStrobeDelay`, `strobeLength`, `strobeIntensity`, `pulseMin`, `pulseMax`, `rampDuration`, `centerDotRadius`, `inversionRate`, `inversionDuration`, `inversionIntensity`, `fragmentPhaseOffset`, `eyeSpread`, `eyeSoftness`, `hueRotation`, `hueRotateSpeed`, `armTaper`, `vignetteIntensity`, `vignetteSize`, `vignetteSoftness`, `audioVolume`, `audioCarrierFreq`, `audioBeatFreq`, `audioDroneLevel`, `audioNoiseLevel`, `audioTremoloRate`, `audioTremoloDepth`, `masterTempoBpm`

**STRUCTURE** — snapped at end of transition, never lerped:
`arms`, `direction`, `gradientType`, `textAnimation`, `mode`, `spiralMath`, `colorMode`, `kaleidoscopeSectors`, `strobeColorCount`, `maxFps`, `rampMode`, `fragmentDirectionMode`, `vignetteShape`, `audioBeatMode`, `audioWaveform`, `audioDroneInterval`, `audioNoiseType`, all `lock*Ratio` and `lock*Beat` fields, `masterTempoBeats`

**SNAP** — applied instantly at phase start:
`textEnabled`, `flashEnabled`, `intenseFlash`, `pulseSpeed`, `randomOrder`, `debugEnabled`, `centerDotEnabled`, all `ramp*Speed` toggles, `inversionEnabled`, `fragmentEnabled` (Eyes), `vignetteEnabled`, `audioEnabled`, `audioToneEnabled`, `audioDroneEnabled`, `audioNoiseEnabled`, `rampAudioBeat`, `masterTempoEnabled`, `masterTempoIndicator`, all `lock*` booleans

**COLOR** — interpolated:
`color1`, `color2`, `color3`, `textColor`, `flashColor`, `centerDotColor`, `strobeColor1`, `strobeColor2`, `strobeColor3`, `vignetteColor`

### Critical sequence rules

1. `snapshot` must be a **JSON-stringified escaped string**, not an object literal.
   - Correct: `"{\"rotationSpeed\":1.5,\"color1\":\"#ff0000\"}"`
   - Wrong: `{"rotationSpeed": 1.5}` (unescaped object)

2. **All fields use delta format, colors included** — include a field (color or otherwise) ONLY when it changes from the previous phase's fully-expanded state, or for phase 1 from the app defaults. Omitted fields automatically inherit the previous phase's value; omitted colors are interpolated from the carried-over value. You do **not** repeat unchanged colors. Example: if phase 1's palette equals the app defaults, omit all color fields from it entirely.

3. Use `spiralMath` (not the removed `spiralRenderMode`) to choose the curve formula.

4. Never include archived zoom fields or removed grid-fragment fields.

### Output constraints (both types)
- Return **only** a single raw valid JSON object — no markdown fences, no commentary.
- All colors must be valid hex: `#[0-9a-fA-F]{6}`.
- Sequence snapshots must be fully escaped nested JSON strings.

### Running a generated sequence (tell the user)
A pasted sequence does **not** auto-play. After importing the JSON the user must: (1) open the Sequencer tab, (2) turn the sequencer on with the enable toggle at the top, (3) press Play. The app shows this reminder automatically on import.
