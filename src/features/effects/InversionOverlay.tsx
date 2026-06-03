import React, { useState, useEffect, useRef } from 'react';
import './InversionOverlay.css';
import { AppState } from '../../types';
import { computeSpeedRampFactor } from '../../utils/color';
import { msUntilNextBeatOffset } from '../../utils/tempo';
import { debugStore } from '../../utils/debugStore';

/**
 * Full-screen inversion pulse overlay.
 *
 * Renders a div with mix-blend-mode:difference positioned above the
 * spiral canvas (but below the text overlay). When active the div's
 * background is a grey value derived from inversionIntensity — at 100%
 * intensity the background is pure white (#ffffff), which inverts every
 * pixel underneath it via the difference blend. At lower intensities a
 * grey value produces a partial inversion.
 *
 * The pulse is driven by a setTimeout loop, identical in structure to the
 * existing strobe in TextOverlay. The rate is optionally tied to the
 * master speed ramp so it accelerates in lockstep with the spiral.
 *
 * This component sits as a sibling of SpiralCanvas so it covers the full
 * viewport area regardless of the current zoom scale (zoom is applied inside
 * the canvas draw, so the overlay is unaffected by it).
 */
export const InversionOverlay: React.FC<{ state: AppState }> = ({ state }) => {
  const [active, setActive] = useState(false);
  const pulseTimerRef = useRef<number | undefined>(undefined);
  const offTimerRef   = useRef<number | undefined>(undefined);

  useEffect(() => {
    const clear = () => {
      window.clearTimeout(pulseTimerRef.current);
      window.clearTimeout(offTimerRef.current);
      pulseTimerRef.current = undefined;
      offTimerRef.current   = undefined;
      setActive(false);
    };

    if (!state.inversionEnabled) {
      clear();
      return;
    }

    const effectiveDurationMs = Math.max(16, state.inversionDuration * 1000);

    if (state.masterTempoEnabled && state.lockInversion) {
      // ── Beat-aligned path ──────────────────────────────────────────────────
      // Fire on beat lockInversionBeat of each measure, then self-resync.
      const fire = () => {
        setActive(true);
        offTimerRef.current = window.setTimeout(() => setActive(false), effectiveDurationMs);

        // Resync to next occurrence — corrects any setTimeout drift
        const msToNext = msUntilNextBeatOffset(
          state.masterTempoBpm,
          state.masterTempoBeats,
          state.lockInversionBeat,
          debugStore.sessionStartMs
        );
        pulseTimerRef.current = window.setTimeout(fire, msToNext);
      };

      // Initial wait until the first target beat
      const msToFirst = msUntilNextBeatOffset(
        state.masterTempoBpm,
        state.masterTempoBeats,
        state.lockInversionBeat,
        debugStore.sessionStartMs
      );
      pulseTimerRef.current = window.setTimeout(fire, msToFirst);

    } else {
      // ── Original rate-based path ───────────────────────────────────────────
      const schedule = () => {
        let effectiveRateMs = state.inversionRate * 1000;

        if (state.rampInversionSpeed && state.pulseSpeed) {
          const timeSec = (performance.now() - state.rampEpoch) / 1000;
          const factor  = computeSpeedRampFactor(
            timeSec, state.pulseMin, state.pulseMax, state.rampDuration, state.rampMode
          );
          effectiveRateMs = Math.max(33, effectiveRateMs / factor);
        }

        setActive(true);
        offTimerRef.current = window.setTimeout(() => setActive(false), effectiveDurationMs);
        pulseTimerRef.current = window.setTimeout(
          schedule,
          Math.max(effectiveDurationMs + 16, effectiveRateMs)
        );
      };
      schedule();
    }

    return clear;
  }, [
    state.inversionEnabled,
    state.inversionRate,
    state.inversionDuration,
    state.inversionIntensity,
    state.rampInversionSpeed,
    state.pulseSpeed,
    state.pulseMin,
    state.pulseMax,
    state.rampDuration,
    state.rampMode,
    state.rampEpoch,
    state.masterTempoEnabled,
    state.lockInversion,
    state.lockInversionBeat,
    state.masterTempoBpm,
    state.masterTempoBeats,
  ]);

  // Don't mount anything while the feature is off.
  if (!state.inversionEnabled) return null;

  // Map 0–100 intensity to a grey hex value for mix-blend-mode:difference.
  // At 100 → #ffffff (full inversion). At 0 → #000000 (no effect).
  // IMPORTANT: keep this element mounted for the whole time the feature is
  // enabled and merely switch its colour between the pulse value and black
  // (#000000 = identity for `difference`, so no visible effect). Mounting /
  // unmounting a mix-blend-mode layer on every pulse forces the compositor to
  // rebuild its layer, which hitches the entire page — including the canvas.
  const grey    = Math.round((state.inversionIntensity / 100) * 255);
  const greyHex = grey.toString(16).padStart(2, '0');
  const bgColor = active ? `#${greyHex}${greyHex}${greyHex}` : '#000000';

  return (
    <div
      className="inversion-overlay"
      style={{ backgroundColor: bgColor }}
    />
  );
};
