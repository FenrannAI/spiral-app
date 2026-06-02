# HYPNOVIS PATTERNS (Reference Guide)

> A supplemental reference that demonstrates how individual visual techniques are
> built. Useful for understanding the system or for seeding an AI prompt — pair it
> with PRESET_SCHEMA.txt when generating new presets.

## What Are Patterns?

Patterns are named templates that demonstrate specific visual techniques. They work best as building blocks rather than finished presets to load directly. They serve as:

1. **Learning references** — See how a technique is achieved mathematically
2. **Prompt seeds** — Copy a pattern's values, then modify them to create something new
3. **Testing benchmarks** — Use patterns to verify the app handles various configurations correctly

## How to Use

### Method 1: Prompt with Delta
Start your prompt by describing the visual you want, then optionally reference a pattern:

```
Create a preset using PRESET_SCHEMA.txt
Reference the STROBE_FLICKER pattern for timing, 
but make the colors shift between purple and cyan instead.
Output ONLY the JSON.
```

### Method 2: Prompt with Base + Delta
Use a pattern as your "base" and request specific changes:

```
Use STROBE_FLICKER as a base but:
- Remove all color cycling
- Make the rotationSpeed 3x slower
- Use only a single color (red)
```

### Method 3: Snapshot Comparison
Load a pattern's values manually, then click "Copy Delta JSON" to see what actually differs from your current state. Use this to understand what variables are driving a visual effect.

## Available Patterns

### STROBE_FLICKER
```json
{
  "intenseFlash": true,
  "rotationSpeed": 8,
  "strobeIntensity": 90,
  "strobeLength": 15,
  "intenseStrobeDelay": 30,
  "colorMode": "static",
  "gradientType": "Single",
  "color1": "#ffffff"
}
```
**Characteristics:** Aggressive, high-contrast strobe. Uses static white. Good for testing strobe system responsiveness.

### COLOR_CASCADE
```json
{
  "colorCyclingSpeed": 0.3,
  "gradientType": "Three",
  "colorMode": "default",
  "rotationSpeed": 0.3,
  "arms": 12,
  "turns": 1
}
```
**Characteristics:** Smooth color transitions. Slow rotation, high arm count. Good for testing gradient lerp and color cycling.

### KALEIDO_SPIN
```json
{
  "colorMode": "kaleidoscopic",
  "kaleidoscopeSectors": 6,
  "rotationSpeed": 2,
  "arms": 1,
  "turns": 4,
  "curve": 1.5,
  "gradientType": "Two"
}
```
**Characteristics:** Single arm, kaleidoscopic reflection. Tests sector-based rendering.

### TEXT_PULSE
```json
{
  "textEnabled": true,
  "textAnimation": "pulse",
  "textSize": 2.5,
  "rotationSpeed": 1,
  "color1": "#ffaa00",
  "gradientType": "Single"
}
```
**Characteristics:** Large pulsing text overlay. Tests text animation system.

### WOBBLE_WAVE
```json
{
  "wobble": 0.5,
  "wobbleSpeed": 3,
  "rotationSpeed": 0.1,
  "turns": 2,
  "curve": 4
}
```
**Characteristics:** Heavy wobble effect, slow rotation. Tests wobble math at extreme values.

## Advanced: Creating Custom Patterns

To create your own pattern:

1. Set up the visual exactly how you want it in the app
2. Open browser DevTools (F12)
3. Run in console: `copy(JSON.stringify(window.__HYPNOVIS_STATE__))`
   - (Requires adding `window.__HYPNOVIS_STATE__ = state` to App.tsx temporarily)
4. Paste the result into a new pattern section above
5. Delete all keys that match the app's defaults (see PRESET_SCHEMA.txt)

This gives you a minimal "delta" pattern that only includes what's actually different.

## Future: Named Pattern Library

In a future version, we may add a built-in pattern library accessible from the UI. For now, this file serves as the experimental reference.