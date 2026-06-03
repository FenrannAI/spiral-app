import React from 'react';
import './VignetteOverlay.css';
import { AppState } from '../../types';

/**
 * Full-screen vignette overlay.
 *
 * Renders a radial gradient that darkens (or tints) the edges of the canvas
 * while leaving the centre transparent. The gradient sits above SpiralCanvas
 * via pointer-events:none so it never blocks interaction.
 *
 * vignetteSize  (0–100) — inner transparent radius as a % of the container width.
 *   0  = gradient starts at the very centre (maximum coverage).
 *   100 = gradient starts at the edge (no visible effect).
 * vignetteIntensity (0–100) — peak alpha at the outermost edge.
 * vignetteColor — hex string for the edge tint colour.
 * vignetteShape — 'ellipse' fits the screen aspect; 'circle' is uniform.
 * vignetteSoftness (0–100) — shapes the falloff curve.
 *   low  = darkness concentrates near the inner edge (hard ring).
 *   high = darkness eases in gradually and packs toward the edge (smooth).
 */
export const VignetteOverlay: React.FC<{ state: AppState }> = ({ state }) => {
  if (!state.vignetteEnabled || state.vignetteIntensity <= 0) return null;

  const { vignetteColor, vignetteIntensity, vignetteSize, vignetteShape, vignetteSoftness } = state;

  // Parse hex → r, g, b
  const hex = vignetteColor.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16) || 0;
  const g = parseInt(hex.slice(2, 4), 16) || 0;
  const b = parseInt(hex.slice(4, 6), 16) || 0;
  const peak = vignetteIntensity / 100;

  // Inner transparent radius (% of the gradient ray to the farthest corner).
  const innerPct = Math.min(95, Math.max(0, vignetteSize));

  // Softness controls the WIDTH of the fade band, not just its curve. Beyond the
  // band the color is held solid at peak alpha all the way to the corner, so at
  // 100% intensity the outer region is a true, complete blackout.
  //   softness 0   → band ≈ 4% of the remaining radius (a hard ring)
  //   softness 100 → band fills the entire remaining radius (fully gradual)
  const s = Math.min(100, Math.max(0, vignetteSoftness)) / 100;
  const remaining = 100 - innerPct;
  const band = remaining * (0.04 + s * 0.96);
  const fadeEnd = Math.min(100, innerPct + band);

  // Smoothstep across the band for clean easing at both ends.
  const STOPS = 16;
  const fadeStops = Array.from({ length: STOPS + 1 }, (_, i) => {
    const t      = i / STOPS;
    const smooth = t * t * (3 - 2 * t);
    const a      = peak * smooth;
    const pos    = innerPct + (fadeEnd - innerPct) * t;
    return `rgba(${r},${g},${b},${a.toFixed(4)}) ${pos.toFixed(2)}%`;
  }).join(', ');

  // Hold solid peak from the end of the band out to the corner → full coverage.
  const solidStop = `rgba(${r},${g},${b},${peak.toFixed(4)}) 100%`;

  // 'farthest-corner' guarantees the gradient reaches the screen corners so the
  // edge color can fully cover at 100% intensity.
  const shape = vignetteShape === 'circle' ? 'circle' : 'ellipse';
  const gradient = `radial-gradient(${shape} farthest-corner at center, transparent ${innerPct}%, ${fadeStops}, ${solidStop})`;

  return (
    <div
      className="vignette-overlay"
      style={{ background: gradient }}
    />
  );
};
