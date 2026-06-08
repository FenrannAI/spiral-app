import React, { useRef } from 'react';
import './SpiralCanvas.css';
import { AppState } from '../../types';
import { useAnimationFrame } from '../../utils/hooks';
import { lerpColor, computeSpeedRampFactor } from '../../utils/color';
import { debugStore } from '../../utils/debugStore';

/* ─────────────────────────────────────────────────────────────────────────────
 * buildGradient
 * Creates a radial gradient on any 2D context, centred at (gx, gy).
 * Separated from drawSpiralArms so callers can pass it to offscreen contexts.
 * ───────────────────────────────────────────────────────────────────────────── */
function buildGradient(
  gCtx: CanvasRenderingContext2D,
  gx: number, gy: number, gradRadius: number,
  activeColors: string[],
  colorPhase: number,
): CanvasGradient {
  const rg = gCtx.createRadialGradient(gx, gy, 0, gx, gy, gradRadius);
  for (let i = 0; i <= 64; i++) {
    const t         = i / 64;
    const animatedT = t * 2 - colorPhase;
    const norm      = ((animatedT % activeColors.length) + activeColors.length) % activeColors.length;
    const idx1 = Math.floor(norm);
    const idx2 = (idx1 + 1) % activeColors.length;
    rg.addColorStop(t, lerpColor(activeColors[idx1], activeColors[idx2], norm - idx1));
  }
  return rg;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * computeSpiralR
 * Returns the radial distance for normalised arm position t ∈ [0,1].
 * 'power'      — r = R·t^curve          (default; Curve slider controls shape)
 * 'log'        — r = R·(e^(c·t)−1)/(e^c−1) (exponential; equiangular-like)
 * 'archimedean'— r = R·t               (linear; constant arm spacing)
 * 'fermat'     — r = R·√t              (parabolic; denser arms toward outside)
 * ───────────────────────────────────────────────────────────────────────────── */
function computeSpiralR(
  t: number,
  radius: number,
  curve: number,
  spiralMath: AppState['spiralMath'],
): number {
  switch (spiralMath) {
    case 'log': {
      const c = Math.max(0.5, curve);
      return radius * (Math.exp(c * t) - 1) / (Math.exp(c) - 1);
    }
    case 'archimedean':
      return radius * t;
    case 'fermat':
      return radius * Math.sqrt(t);
    case 'power':
    default:
      return radius * Math.pow(t, Math.max(0.1, curve));
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * computeSpiralDR — d(radius)/dt, the analytic radial derivative of computeSpiralR.
 * Used to build a stable edge normal near the centre (where finite differences
 * between sub-pixel-spaced samples go noisy and make the ribbon shimmer).
 * t is clamped away from 0 for the singular forms (fermat, power with curve<1).
 * ───────────────────────────────────────────────────────────────────────────── */
function computeSpiralDR(
  t: number,
  radius: number,
  curve: number,
  spiralMath: AppState['spiralMath'],
): number {
  switch (spiralMath) {
    case 'log': {
      const c = Math.max(0.5, curve);
      return radius * c * Math.exp(c * t) / (Math.exp(c) - 1);
    }
    case 'archimedean':
      return radius;
    case 'fermat':
      return radius / (2 * Math.sqrt(Math.max(t, 1e-6)));
    case 'power':
    default: {
      const c = Math.max(0.1, curve);
      return radius * c * Math.pow(Math.max(t, 1e-9), c - 1);
    }
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * perCellDirection
 * Returns the spin direction for a given cell based on the direction pattern.
 * ───────────────────────────────────────────────────────────────────────────── */
function perCellDirection(
  col: number, row: number,
  baseDir: 1 | -1,
  mode: AppState['fragmentDirectionMode'],
): 1 | -1 {
  // Eyes feature: 'uniform' spins both eyes the same way; 'alternating' and
  // 'mirror' flip every other eye so the two spin in opposite directions.
  // ('mirror' additionally reverses the spiral geometry — handled by the caller —
  // so the eyes still pull in/out together despite spinning oppositely.)
  if (mode === 'alternating' || mode === 'mirror') {
    return ((col + row) % 2 === 0 ? baseDir : -baseDir) as 1 | -1;
  }
  return baseDir;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * drawSpiralArms
 * Module-level helper — not recreated on each render.
 * Draws all arms of a spiral into ctx centred at (cx, cy).
 * ctx.strokeStyle must be set by the caller before invoking.
 * baseAlpha (default 1.0) multiplies the per-mode globalAlpha so that blend
 * mode can pass a fractional value without fighting the soft-mode 0.88.
 * Always resets globalAlpha to 1.0 on exit.
 * ───────────────────────────────────────────────────────────────────────────── */
function drawSpiralArms(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  radius: number, strokeWidth: number,
  rotation: number,
  state: AppState,
  timeSec: number,
  baseAlpha: number = 1.0,
  mirrorArms: boolean = false,
  maskTaper: boolean = false,
): void {
  const MIN_WIDTH = 0.5;
  const armsCount  = Math.max(1, state.arms);
  const steps      = 360;
  // Width taper exponent from the Center Taper slider (0–100). Maps to
  // [0.2, 1.0]: 0 → round/full core, ~38 → gentle √ taper, 100 → original
  // linear taper (pointiest). Higher = more aggressive thinning at the centre.
  const taperExp = 0.2 + Math.min(100, Math.max(0, state.taperStrength)) / 100 * 0.8;

  // Arm taper: fraction (0–1) of the outer arm that fades to transparent.
  // Uses a quadratic ease-in fade so the arm stays bright until the final stretch.
  const taper     = Math.max(0, Math.min(1, state.armTaper / 100));
  const fadeStart = 1 - taper; // t value where fading begins

  // Cell falloff: dims segments that are physically far from the cell center.
  // The fade uses a quadratic curve: alpha × (1 - falloff × (r/radius)²).
  // At 100% falloff, the outermost segments fade to zero; at 0% there's no effect.
  const falloff = Math.max(0, Math.min(1, state.cellFalloff / 100));

  /** Taper + falloff alpha as a function of position (ignores modeAlpha). Used both
   *  for per-quad alpha and to build the post-draw radial mask. */
  const taperFalloffAlpha = (t: number, r0: number): number => {
    let a = 1;
    if (taper > 0 && t > fadeStart) {
      const progress = (t - fadeStart) / taper;
      a *= Math.max(0, 1 - progress * progress);
    }
    if (falloff > 0 && radius > 0) {
      const rNorm = r0 / radius;
      a *= Math.max(0, 1 - falloff * rNorm);
    }
    return a;
  };

  /** Per-segment alpha multiplier based on normalised position t (0=inner, 1=outer).
   *  When maskTaper is set, taper/falloff are applied later as a radial mask, so the
   *  geometry is drawn at full modeAlpha here (no per-quad alpha → no overlap seams). */
  const segAlpha = (t: number, r0: number, modeAlpha: number): number => {
    if (maskTaper) return modeAlpha;
    // Arm taper fade
    let a = modeAlpha;
    if (taper > 0 && t > fadeStart) {
      const progress = (t - fadeStart) / taper;
      a *= Math.max(0, 1 - progress * progress);
    }
    // Cell falloff fade (based on actual radius, not t, so it works in blend mode).
    // Linear rNorm gives a much more aggressive mid-range fade than the old quadratic,
    // so at 100% the crossing arms are nearly invisible.
    if (falloff > 0 && radius > 0) {
      const rNorm = r0 / radius; // 0=center, 1=outermost
      a *= Math.max(0, 1 - falloff * rNorm);
    }
    return a;
  };

  const kaleidoscopeSectors = state.kaleidoscopeSectors;
  const sectorAngle = (2 * Math.PI) / kaleidoscopeSectors;
  const reflectAngle = (angle: number) => {
    if (kaleidoscopeSectors <= 1) return angle;
    let localAngle = angle % sectorAngle;
    if (localAngle < 0) localAngle += sectorAngle;
    if (localAngle > sectorAngle / 2) localAngle = sectorAngle - localAngle;
    const sectorIndex = Math.floor(angle / sectorAngle);
    return sectorIndex * sectorAngle + localAngle;
  };

  // Shared geometry helper: full angle + radius + half-width at parameter t for arm i.
  const sampleArm = (t: number, armOffset: number) => {
    const r = computeSpiralR(t, radius, state.curve, state.spiralMath);
    const thetaSign = mirrorArms ? -1 : 1;
    const theta = thetaSign * t * state.turns * Math.PI * 2;
    const w = state.wobble * Math.sin(state.wobblePhase + timeSec * state.wobbleSpeed + t * Math.PI * 8);
    let fa = theta + armOffset + rotation + w;
    if (state.colorMode === 'kaleidoscopic') fa = reflectAngle(fa);
    const cfa = Math.cos(fa), sfa = Math.sin(fa);
    const x = cx + r * cfa;
    const y = cy + r * sfa;
    // Center taper: width × (r/radius)^taperExp. Larger exponent → arms thin
    // faster toward the centre (more aggressive, pointier core); smaller →
    // fuller, rounder core that avoids the sub-pixel hairline ring on small
    // screens. taperExp is precomputed from state.taperStrength below.
    const rNorm = radius > 0 ? r / radius : 0;
    const halfW = Math.max(MIN_WIDTH, strokeWidth * Math.pow(rNorm, taperExp)) / 2;
    return { r, x, y, halfW, fa, cfa, sfa };
  };

  // Analytic edge normal: rotate the curve's exact tangent dP/dt by 90°. Stable
  // at any radius — unlike a finite difference between near-coincident samples.
  // Disabled for kaleidoscopic mode (its angle reflection isn't differentiable);
  // that path falls back to finite differences.
  const analyticNormals = state.colorMode !== 'kaleidoscopic';
  const dThetaDt   = (mirrorArms ? -1 : 1) * state.turns * Math.PI * 2;  // d(theta)/dt
  const wobbleAmp  = state.wobble * 8 * Math.PI;                         // d(wobble)/dt coefficient

  // ── Filled tapered ribbon (single continuous polygon per arm) ───────────────
  // Each arm is drawn as ONE filled path: out along the left edge (samples
  // 0→steps), then back along the right edge (steps→0). Because taper / cell
  // falloff are applied via the radial mask below, the alpha is constant across
  // the arm, so the whole thing can be a single fill. This removes every
  // inter-segment seam — there are no per-quad boundaries that could leak the
  // background, so the spiral stays solid even where it winds sub-pixel-tight
  // near the centre (no flickering "spider" lines), and overlapping windings
  // simply union via nonzero winding. fillStyle reuses the caller's gradient.
  ctx.fillStyle = ctx.strokeStyle;
  // Under maskTaper (the only path used) segAlpha is constant per arm; sample it
  // once so a single fill carries the correct mode/base alpha.
  ctx.globalAlpha = segAlpha(0, 0, baseAlpha);
  const N = steps + 1;
  const lxs = new Float64Array(N), lys = new Float64Array(N);
  const rxs = new Float64Array(N), rys = new Float64Array(N);
  for (let i = 0; i < armsCount; i++) {
    const armOffset = (i / armsCount) * Math.PI * 2;
    let prev = sampleArm(0, armOffset);
    for (let k = 0; k < N; k++) {
      const t = k / steps;
      const cur = sampleArm(t, armOffset);
      let nx = 0, ny = 0;
      if (analyticNormals) {
        // Tangent = dP/dt, with P = (cx + r·cos fa, cy + r·sin fa):
        //   dx = r'·cos fa − r·fa'·sin fa ,  dy = r'·sin fa + r·fa'·cos fa
        const dr = computeSpiralDR(t, radius, state.curve, state.spiralMath);
        const faPrime = dThetaDt + wobbleAmp * Math.cos(state.wobblePhase + timeSec * state.wobbleSpeed + t * Math.PI * 8);
        const dx = dr * cur.cfa - cur.r * faPrime * cur.sfa;
        const dy = dr * cur.sfa + cur.r * faPrime * cur.cfa;
        const len = Math.hypot(dx, dy);
        if (len > 1e-9) { nx = -dy / len; ny = dx / len; }
      }
      if (nx === 0 && ny === 0) {
        // Finite-difference fallback (kaleidoscopic mode, or a degenerate tangent).
        const next = k < steps ? sampleArm((k + 1) / steps, armOffset) : cur;
        let dx = next.x - prev.x, dy = next.y - prev.y;
        const len = Math.hypot(dx, dy) || 1;
        nx = -dy / len; ny = dx / len;
      }
      lxs[k] = cur.x + nx * cur.halfW; lys[k] = cur.y + ny * cur.halfW;
      rxs[k] = cur.x - nx * cur.halfW; rys[k] = cur.y - ny * cur.halfW;
      prev = cur;
    }
    ctx.beginPath();
    ctx.moveTo(lxs[0], lys[0]);
    for (let k = 1; k < N; k++) ctx.lineTo(lxs[k], lys[k]);      // out along left edge
    for (let k = N - 1; k >= 0; k--) ctx.lineTo(rxs[k], rys[k]);  // back along right edge
    ctx.closePath();
    ctx.fill();
  }
  // ── Taper / falloff via radial mask ─────────────────────────────────────────
  // Apply arm taper + cell falloff as a single destination-in radial gradient
  // instead of per-quad alpha. Because the spiral radius grows monotonically
  // with t, screen-radius uniquely maps to a taper value, so a radial mask is
  // EXACT (not an approximation) — and it leaves the ribbon geometry at full
  // opacity, so no seams appear in the faded region.
  if (maskTaper && (taper > 0 || falloff > 0)) {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-in';
    const mask = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    const MASK_STOPS = 24;
    let lastPos = -1;
    for (let s = 0; s <= MASK_STOPS; s++) {
      const t = s / MASK_STOPS;
      const r0 = computeSpiralR(t, radius, state.curve, state.spiralMath);
      let pos = radius > 0 ? r0 / radius : t;
      pos = Math.min(1, Math.max(0, pos));
      if (pos <= lastPos) pos = lastPos + 1e-4; // keep stops strictly increasing
      if (pos > 1) break;
      lastPos = pos;
      mask.addColorStop(pos, `rgba(0,0,0,${taperFalloffAlpha(t, r0).toFixed(4)})`);
    }
    ctx.fillStyle = mask;
    ctx.fillRect(cx - radius * 1.5, cy - radius * 1.5, radius * 3, radius * 3);
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ── ARCHIVED RENDER PATHS (removed — kept for reference only) ───────────────
   * These earlier per-segment stroking approaches were replaced by the filled
   * ribbon above. The 'spiralRenderMode' field is retained in AppState for
   * saved-state compatibility but no longer selects between paths.
   *
   * BUTT path — butt-cap line segments per step (the prior default):
   *   ctx.lineCap='butt'; ctx.lineJoin='round';
   *   for each arm, for each step j: moveTo(p0)+lineTo(p1) with lineWidth=segW,
   *   globalAlpha=segAlpha(...), plus a 0.001px micro-overlap nudge to reduce the
   *   hairline gap between adjacent butt caps. Showed notches at high curve/wobble.
   *
   * SMOOTH path — filled polygon strips per segment, lineWidth × 1.08 overlap.
   * SOFT path   — round caps at 0.88 alpha. STANDARD — round caps at full alpha.
   * (Round-cap paths produced bright overlap beads under screen compositing.)
   * ─────────────────────────────────────────────────────────────────────────── */

  ctx.globalAlpha = 1.0;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * SpiralCanvas component
 * ───────────────────────────────────────────────────────────────────────────── */
export const SpiralCanvas: React.FC<{ state: AppState }> = ({ state }) => {
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const containerRef    = useRef<HTMLDivElement>(null);
  const rotationRef     = useRef(0);
  const colorPhaseRef   = useRef(0);
  const lastDrawTimeRef = useRef(0);
  // Animated hue accumulator — driven imperatively to avoid React re-renders.
  const animHueRef      = useRef(0);
  // Cached offscreen canvases for feather mode — re-used across frames.
  const offscreenRef    = useRef<HTMLCanvasElement[]>([]);
  // Single offscreen layer for the ribbon flat-composite prototype — re-used across frames.
  const flatLayerRef    = useRef<HTMLCanvasElement | null>(null);
  // Afterimage Bloom: frameLayerRef holds the just-rendered frame (so it can be
  // both shown and stamped into the trail buffer); trailLayerRef accumulates a
  // decaying history of recent frames that gets blended back in for ghosting.
  const frameLayerRef   = useRef<HTMLCanvasElement | null>(null);
  const trailLayerRef   = useRef<HTMLCanvasElement | null>(null);
  // Global session clock — set on first frame, never reset. Foundation for future sync.
  const sessionStartRef  = useRef<number>(0);
  const frameCountRef    = useRef(0);
  // Master tempo phase accumulator — advances at BPM/60 per second when enabled.
  const masterPhaseRef   = useRef(0);
  // Zoom phase accumulator (archived with zoom feature — see comment in render loop)
  // const zoomPhaseRef     = useRef(0);
  // const prevRampEpochRef = useRef(0);

  useAnimationFrame((dt, time) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const dpr           = window.devicePixelRatio || 1;
    const logicalWidth  = parent.clientWidth;
    const logicalHeight = parent.clientHeight;
    const physicalWidth  = logicalWidth  * dpr;
    const physicalHeight = logicalHeight * dpr;

    if (canvas.width !== physicalWidth || canvas.height !== physicalHeight) {
      canvas.width  = physicalWidth;
      canvas.height = physicalHeight;
    }

    const centerX   = logicalWidth  / 2;
    const centerY   = logicalHeight / 2;
    // Extend 5% past the corner so arm tips fully cover canvas edges rather
    // than clipping just short of them.
    const maxRadius = Math.sqrt(centerX ** 2 + centerY ** 2) * 1.05;
    const isDarken  = state.mode === 'Darken';
    const bgColor   = isDarken ? '#000000' : '#ffffff';

    // ── Time / ramp ───────────────────────────────────────────────────────────
    const timeSec  = (time - state.rampEpoch) / 1000;
    const deltaSec = dt / 1000;

    // ── Zoom scale (ARCHIVED — feature removed from UI) ──────────────────────
    // Fields retained in AppState for saved-preset compatibility.
    // To restore: uncomment this block, re-add zoom refs, and restore UI section.
    /*
    if (state.rampEpoch !== prevRampEpochRef.current) {
      zoomPhaseRef.current     = 0;
      prevRampEpochRef.current = state.rampEpoch;
    }
    let zoomScale = 1;
    if (state.zoomEnabled) {
      let ezs = state.zoomSpeed;
      if (state.rampZoomSpeed && state.pulseSpeed) {
        ezs *= Math.max(0.01, computeSpeedRampFactor(
          timeSec, state.pulseMin, state.pulseMax, state.rampDuration, state.rampMode
        ));
      }
      zoomPhaseRef.current += deltaSec * ezs;
      const phase = zoomPhaseRef.current;
      if (state.zoomMode === 'breathe') {
        const rawT = 0.5 + 0.5 * Math.sin(phase * 2 * Math.PI);
        zoomScale = state.zoomMin + (state.zoomMax - state.zoomMin) * rawT;
      } else {
        const raw = phase % 1;
        let t: number;
        switch (state.zoomEasing) {
          case 'ease-in':     t = raw * raw; break;
          case 'ease-out':    t = 1 - (1 - raw) * (1 - raw); break;
          case 'ease-in-out': t = raw < 0.5 ? 2*raw*raw : 1 - 2*(1-raw)*(1-raw); break;
          default:            t = raw;
        }
        zoomScale = state.zoomDirection === 'in'
          ? state.zoomMin + (state.zoomMax - state.zoomMin) * t
          : state.zoomMax - (state.zoomMax - state.zoomMin) * t;
      }
    }
    */
    const zoomScale    = 1;
    const effectiveRadius = maxRadius * zoomScale;
    const effectiveWidth  = state.width  * zoomScale;

    // Advance animated hue every frame regardless of FPS throttle so the
    // rotation feels smooth even at capped frame rates.
    // When speed is zero, drain the accumulator so stale rotation from a
    // previous roll doesn't persist after a preset change or factory reset.
    if (state.hueRotateSpeed !== 0) {
      animHueRef.current += state.hueRotateSpeed * deltaSec;
    } else {
      animHueRef.current = 0;
    }

    const rampActive = state.pulseSpeed;
    let dynamicSpeedFactor = 1;
    if (rampActive) {
      dynamicSpeedFactor = Math.max(0.01, computeSpeedRampFactor(
        timeSec, state.pulseMin, state.pulseMax, state.rampDuration, state.rampMode
      ));
    }

    const spiralFactor   = (rampActive && state.rampSpiralSpeed) ? dynamicSpeedFactor : 1;
    const effectiveSpeed = state.rotationSpeed * (-state.direction as 1 | -1) * spiralFactor;

    rotationRef.current += deltaSec * effectiveSpeed;

    if (state.colorMode !== 'static') {
      const colorFactor = (rampActive && state.rampColorSpeed) ? dynamicSpeedFactor : 1;
      colorPhaseRef.current += deltaSec * state.colorCyclingSpeed * colorFactor * 0.5;
    }

    // ── Global session clock (monotonic — never resets) ──────────────────────
    if (sessionStartRef.current === 0) sessionStartRef.current = time;
    frameCountRef.current += 1;
    const sessionTime = (time - sessionStartRef.current) / 1000;

    // ── Master tempo phase accumulator ────────────────────────────────────────
    // Advances at BPM/60 cycles per second. Clamp deltaSec to 100ms max so
    // that frame hitches don't cause large phase jumps.
    if (state.masterTempoEnabled) {
      const clampedDelta = Math.min(deltaSec, 0.1);
      masterPhaseRef.current += clampedDelta * (state.masterTempoBpm / 60);
    }

    const fpsInterval = 1000 / state.maxFps;
    if (time - lastDrawTimeRef.current < fpsInterval) {
      // Still update timing fields on throttled frames so the clock stays live.
      debugStore.sessionTime    = sessionTime;
      debugStore.frameTimeMs    = dt;
      debugStore.fps            = Math.round(1000 / Math.max(dt, 1));
      debugStore.frameCount     = frameCountRef.current;
      debugStore.rotationAngle  = rotationRef.current;
      debugStore.effectiveSpeed = effectiveSpeed;
      debugStore.rampFactor     = dynamicSpeedFactor;
      debugStore.colorPhase      = colorPhaseRef.current;
      debugStore.hueOffsetDeg    = animHueRef.current;
      debugStore.masterTempoBpm  = state.masterTempoEnabled ? state.masterTempoBpm : 0;
      debugStore.masterPhaseRaw  = masterPhaseRef.current;
      debugStore.masterBeatPhase = masterPhaseRef.current % 1;
      debugStore.beatCount       = Math.floor(masterPhaseRef.current);
      return;
    }
    lastDrawTimeRef.current = time;

    // ── Shared draw state ─────────────────────────────────────────────────────
    const rotation   = rotationRef.current;
    const colorPhase = state.colorMode === 'static' ? 0 : colorPhaseRef.current;

    let activeColors: string[];
    if      (state.gradientType === 'Single') activeColors = [state.color1];
    else if (state.gradientType === 'Two')    activeColors = [state.color1, state.color2];
    else                                      activeColors = [state.color1, state.color2, state.color3];

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) (ctx as any).imageSmoothingQuality = 'high';

    // High-quality supersampling: render the spiral layer(s) at 2× linear
    // resolution and let the single composite drawImage downsample it, giving
    // ~4 samples/pixel of anti-aliasing that smooths the centre crawl. Capped so
    // the offscreen buffer never exceeds ~5000px on a side — that keeps the full
    // 2× on common large 1080p screens (the problem case) while protecting 4K /
    // retina from a runaway buffer. renderScale folds dpr in for the layers.
    const ssTarget   = state.highQuality ? 2 : 1;
    const physMaxDim = Math.max(physicalWidth, physicalHeight) || 1;
    const ss         = Math.max(1, Math.min(ssTarget, 5000 / physMaxDim));
    const renderScale = dpr * ss;
    const layerW = Math.round(logicalWidth  * renderScale);
    const layerH = Math.round(logicalHeight * renderScale);

    // Eyes effect is on whenever enabled. (Rhythmic on/off is handled via
    // sequences now — the old auto duty-cycle pulse has been removed.)
    const isFragmented = state.fragmentEnabled;

    // ── Afterimage Bloom: render target setup ────────────────────────────────
    // When enabled, the arms are drawn into a TRANSPARENT offscreen layer
    // (frameLayer) rather than straight onto the bg-filled visible canvas. That
    // arms-only image is then (a) composited to the canvas for the crisp present
    // frame, and (b) stamped into a persistent feedback buffer (the trail) that
    // is faded toward transparent each frame so older arm positions linger as a
    // decaying ghost. Keeping the layer transparent (no bg fill) is essential —
    // it's what lets past frames persist as distinct faded arms instead of being
    // washed out by an opaque background every deposit.
    const afterimageOn = state.afterimageEnabled;
    let frameTarget: CanvasRenderingContext2D = ctx;
    let frameLayer: HTMLCanvasElement | null = null;

    if (afterimageOn) {
      let fl = frameLayerRef.current;
      if (!fl) { fl = document.createElement('canvas'); frameLayerRef.current = fl; }
      if (fl.width !== physicalWidth || fl.height !== physicalHeight) {
        fl.width = physicalWidth; fl.height = physicalHeight;
      }
      frameLayer = fl;
      const flCtx = fl.getContext('2d')!;
      flCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      flCtx.globalCompositeOperation = 'source-over';
      flCtx.globalAlpha = 1;
      flCtx.clearRect(0, 0, logicalWidth, logicalHeight);
      frameTarget = flCtx;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // EYES RENDER — two side-by-side spirals with a per-eye separation mask
    // ═════════════════════════════════════════════════════════════════════════
    if (isFragmented) {
      // Eyes is always a 2×1 layout (two columns, one row).
      const EYES = 2;
      const cellW = logicalWidth / EYES;
      const cyEye = logicalHeight / 2;

      frameTarget.globalCompositeOperation = 'source-over';
      // Only paint the opaque background when drawing straight to the visible
      // canvas. With afterimage on, frameTarget is the transparent arms layer
      // and must stay transparent so the trail buffer can persist past frames.
      if (!afterimageOn) {
        frameTarget.fillStyle = bgColor;
        frameTarget.fillRect(0, 0, logicalWidth, logicalHeight);
      }

      // Separation-mask geometry. Each eye is confined to a radial region centred
      // on its own eye centre. eyeSpread widens that region (more overlap toward
      // the midline / far edges); eyeSoftness controls how gradual the falloff is.
      const spread   = Math.min(100, Math.max(0, state.eyeSpread))   / 100;
      const softness = Math.min(100, Math.max(0, state.eyeSoftness)) / 100;
      const outerR   = (cellW / 2) * (0.7 + spread * 1.4);
      const innerR   = outerR * (1 - (0.15 + softness * 0.8));

      while (offscreenRef.current.length < EYES) {
        offscreenRef.current.push(document.createElement('canvas'));
      }

      for (let col = 0; col < EYES; col++) {
        const cxEye = col * cellW + cellW / 2;
        const phaseRad = col * (state.fragmentPhaseOffset * Math.PI / 180);
        const dir = perCellDirection(col, 0, state.direction, state.fragmentDirectionMode);
        const cellRotation = rotation * (dir === state.direction ? 1 : -1) + phaseRad;
        // 'mirror': flip the spiral chirality on the second eye so opposite spin
        // still reads as both eyes pulling in/out together.
        const mirrorEye = state.fragmentDirectionMode === 'mirror' && col % 2 === 1;

        const oc = offscreenRef.current[col];
        if (oc.width !== layerW || oc.height !== layerH) {
          oc.width = layerW; oc.height = layerH;
        }
        const oCtx = oc.getContext('2d')!;
        oCtx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
        oCtx.imageSmoothingEnabled = true;
        if ('imageSmoothingQuality' in oCtx) (oCtx as any).imageSmoothingQuality = 'high';
        oCtx.globalCompositeOperation = 'source-over';
        oCtx.clearRect(0, 0, logicalWidth, logicalHeight);

        // Full-canvas-radius spiral, centred on this eye. Drawn at full opacity to
        // its own layer so ribbon overlap seams never reappear.
        oCtx.strokeStyle = buildGradient(oCtx, cxEye, cyEye, effectiveRadius, activeColors, colorPhase);
        drawSpiralArms(oCtx, cxEye, cyEye, effectiveRadius, effectiveWidth, cellRotation, state, timeSec, 1.0, mirrorEye, true);

        // Per-eye separation mask: confine this eye to a soft radial region around
        // its own centre. This is the "special vignette" that stops each eye from
        // sprawling across the midline gap and the far edges over the other eye.
        oCtx.globalCompositeOperation = 'destination-in';
        const mask = oCtx.createRadialGradient(cxEye, cyEye, innerR, cxEye, cyEye, outerR);
        const MStops = 12;
        for (let s = 0; s <= MStops; s++) {
          const t = s / MStops;
          const smooth = t * t * (3 - 2 * t);   // smoothstep
          mask.addColorStop(t, `rgba(0,0,0,${(1 - smooth).toFixed(4)})`);
        }
        oCtx.fillStyle = mask;
        oCtx.fillRect(0, 0, logicalWidth, logicalHeight);

        // Composite the finished, masked eye onto the frame target a single time.
        frameTarget.globalCompositeOperation = isDarken ? 'screen' : 'multiply';
        frameTarget.drawImage(oc, 0, 0, logicalWidth, logicalHeight);
      }

    // ═════════════════════════════════════════════════════════════════════════
    // NORMAL RENDER — single full-canvas spiral
    // ═════════════════════════════════════════════════════════════════════════
    } else {
      frameTarget.globalCompositeOperation = 'source-over';
      // See eyes path: skip the bg fill when rendering into the transparent
      // arms layer for the afterimage trail.
      if (!afterimageOn) {
        frameTarget.fillStyle = bgColor;
        frameTarget.fillRect(0, 0, logicalWidth, logicalHeight);
      }

      // Flat-layer composite: draw all arms onto a transparent offscreen with
      // source-over (overlaps paint once — no accumulation), then composite the
      // finished layer onto the canvas a SINGLE time with screen/multiply. This
      // removes arm-to-arm and self-winding brightening while keeping the fast
      // composite ops (no lighten/darken perf hit).
      let layer = flatLayerRef.current;
      if (!layer) { layer = document.createElement('canvas'); flatLayerRef.current = layer; }
      if (layer.width !== layerW || layer.height !== layerH) {
        layer.width = layerW; layer.height = layerH;
      }
      const lCtx = layer.getContext('2d')!;
      lCtx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
      lCtx.clearRect(0, 0, logicalWidth, logicalHeight);
      lCtx.globalCompositeOperation = 'source-over';
      lCtx.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in lCtx) (lCtx as any).imageSmoothingQuality = 'high';
      lCtx.strokeStyle = buildGradient(lCtx, centerX, centerY, effectiveRadius, activeColors, colorPhase);
      drawSpiralArms(lCtx, centerX, centerY, effectiveRadius, effectiveWidth, rotation, state, timeSec, 1.0, false, true);

      frameTarget.globalCompositeOperation = isDarken ? 'screen' : 'multiply';
      frameTarget.drawImage(layer, 0, 0, logicalWidth, logicalHeight);
    }

    // ── Afterimage Bloom: feedback-buffer trail ──────────────────────────────
    // Classic accumulation-buffer ghosting. The trail buffer holds arms-only
    // (transparent bg) content. Each frame we:
    //   1) draw the bg + the crisp current arms to the visible canvas (the
    //      normal look — untouched at intensity 0),
    //   2) overlay the EXISTING trail (older arm positions, already faded) on
    //      top at the user's intensity so recent motion reads as a ghost,
    //   3) fade the trail toward transparent by a frame-rate-independent decay
    //      derived from afterimageDuration, then stamp the current arms in at
    //      full strength so they become the freshest (brightest) layer of the
    //      ghost for subsequent frames.
    // Because the trail is transparent-bg and faded multiplicatively, old arms
    // linger as distinct, dimming copies spread across the rotation arc — a real
    // trail, not a single coinciding frame.
    if (afterimageOn && frameLayer) {
      let trail = trailLayerRef.current;
      if (!trail) { trail = document.createElement('canvas'); trailLayerRef.current = trail; }
      if (trail.width !== physicalWidth || trail.height !== physicalHeight) {
        trail.width = physicalWidth; trail.height = physicalHeight;
      }
      const tCtx = trail.getContext('2d')!;
      tCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const blend = isDarken ? 'screen' : 'multiply';
      const intensity = Math.min(100, Math.max(0, state.afterimageIntensity)) / 100;

      // 1) Crisp present frame: opaque bg, then arms.
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, logicalWidth, logicalHeight);
      ctx.globalCompositeOperation = blend;
      ctx.drawImage(frameLayer, 0, 0, logicalWidth, logicalHeight);

      // 2) Ghost: the existing (already-faded) trail of PAST arm positions.
      ctx.globalAlpha = intensity;
      ctx.drawImage(trail, 0, 0, logicalWidth, logicalHeight);
      ctx.globalAlpha = 1;

      // 3) Age the trail, then deposit the current arms at full strength.
      // decay = fraction of the trail's alpha removed this frame so it falls to
      // ~5% after roughly afterimageDuration seconds, independent of FPS.
      const durationSec = Math.max(0.05, state.afterimageDuration / 1000);
      const decay = Math.min(1, Math.max(0, 1 - Math.exp(-3 * deltaSec / durationSec)));
      tCtx.globalCompositeOperation = 'destination-out';
      tCtx.globalAlpha = decay;
      tCtx.fillStyle = '#000000';
      tCtx.fillRect(0, 0, logicalWidth, logicalHeight);
      tCtx.globalCompositeOperation = 'source-over';
      tCtx.globalAlpha = 1;
      tCtx.drawImage(frameLayer, 0, 0, logicalWidth, logicalHeight);
    }

    // ── Apply hue rotation imperatively (no React re-render) ─────────────────
    if (containerRef.current) {
      const totalHue = state.hueRotation + animHueRef.current;
      containerRef.current.style.filter =
        totalHue !== 0 ? `hue-rotate(${totalHue % 360}deg)` : '';
    }

    // ── Reset ─────────────────────────────────────────────────────────────────
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.globalAlpha = 1.0;

    // ── Center dot ────────────────────────────────────────────────────────────
    if (state.centerDotEnabled) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, state.centerDotRadius, 0, Math.PI * 2);
      ctx.fillStyle = state.centerDotColor;
      ctx.fill();
      ctx.shadowColor = state.centerDotColor; ctx.shadowBlur = 4;
      ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    }

    // ── Debug store ───────────────────────────────────────────────────────────
    debugStore.sessionTime    = sessionTime;
    debugStore.sessionStartMs = sessionStartRef.current;
    debugStore.fps            = Math.round(1000 / Math.max(dt, 1));
    debugStore.frameTimeMs    = dt;
    debugStore.frameCount     = frameCountRef.current;
    debugStore.canvasWidth    = logicalWidth;
    debugStore.canvasHeight   = logicalHeight;
    debugStore.rotationAngle  = rotation;
    debugStore.effectiveSpeed = effectiveSpeed;
    debugStore.rampFactor     = dynamicSpeedFactor;
    debugStore.colorPhase     = colorPhaseRef.current;
    debugStore.hueOffsetDeg   = animHueRef.current;
    // Master tempo
    debugStore.masterTempoBpm  = state.masterTempoEnabled ? state.masterTempoBpm : 0;
    debugStore.masterPhaseRaw  = masterPhaseRef.current;
    debugStore.masterBeatPhase = masterPhaseRef.current % 1;
    debugStore.beatCount       = Math.floor(masterPhaseRef.current);
    // Audio state is written by useAudio — we don't overwrite it here.
  });

  return (
    <div className="spiral-canvas-container" ref={containerRef}>
      <canvas ref={canvasRef} />
    </div>
  );
};
