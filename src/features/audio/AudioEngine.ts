/**
 * AudioEngine — Web Audio synthesis for HypnoViz.
 *
 * Built around a single AudioContext.  Topology:
 *
 *   destination ← masterGain ← tremoloGain ← { toneBus, droneBus, noiseBus }
 *   tremoloLFO → tremoloDepthGain → tremoloGain.gain (additive)
 *
 *   toneBus:
 *     binaural   — carrierL → pan(-1), carrierR → pan(+1) where carrierR = carrierL + beat
 *     monaural   — carrierL & carrierR both routed center, beat is acoustic
 *     isochronic — single carrier amplitude-modulated by a square LFO at beat freq
 *
 * The engine runs its own requestAnimationFrame loop that reads stateRef.current
 * every frame and smoothly retunes node parameters via setTargetAtTime.  Structural
 * changes (beat mode, noise type) trigger a partial rebuild on the fly.
 */

import { MutableRefObject } from 'react';
import { AppState } from '../../types';
import { DRONE_INTERVAL_RATIOS } from '../../utils/audio';
import { computeSpeedRampFactor } from '../../utils/color';

const SMOOTH_TC = 0.03;   // ~30 ms time-constant for setTargetAtTime
const FADE_IN_S = 0.3;    // master fade-in on start
const FADE_OUT_S = 0.25;  // master fade-out on stop
const BEAT_RAMP_CAP_HZ = 40; // hard limit for ramped beat frequency

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private rafId = 0;
  private stateRef: MutableRefObject<AppState>;

  // Master + tremolo
  private masterGain!: GainNode;
  private tremoloGain!: GainNode;
  private tremoloLFO!: OscillatorNode;
  private tremoloDepthGain!: GainNode;

  // Tone layer
  private toneGain!: GainNode;
  private carrierL: OscillatorNode | null = null;
  private carrierR: OscillatorNode | null = null;
  private pannerL: StereoPannerNode | null = null;
  private pannerR: StereoPannerNode | null = null;
  private isoLfo: OscillatorNode | null = null;
  private isoGain: GainNode | null = null;
  private isoDepthGain: GainNode | null = null;

  // Drone layer
  private droneGain!: GainNode;
  private droneOsc!: OscillatorNode;

  // Noise layer
  private noiseGain!: GainNode;
  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseBuffers = new Map<AppState['audioNoiseType'], AudioBuffer>();

  // Structural change snapshots
  private lastBeatMode: AppState['audioBeatMode'] = 'binaural';
  private lastNoiseType: AppState['audioNoiseType'] = 'brown';
  private lastWaveform: AppState['audioWaveform'] = 'sine';

  constructor(stateRef: MutableRefObject<AppState>) {
    this.stateRef = stateRef;
  }

  start(): void {
    if (this.ctx) return;
    const AC: typeof AudioContext =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) {
      console.warn('AudioEngine: Web Audio API not available');
      return;
    }
    this.ctx = new AC();
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this.buildGraph();
    this.startLoop();
  }

  stop(): void {
    if (!this.ctx) return;
    cancelAnimationFrame(this.rafId);
    const ctx = this.ctx;
    const now = ctx.currentTime;
    try {
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0, now + FADE_OUT_S);
    } catch {}
    // After fade-out, stop oscillators and close context.  Capture refs so
    // a subsequent start() in another instance won't be affected.
    const carriers = [
      this.carrierL, this.carrierR, this.droneOsc,
      this.tremoloLFO, this.isoLfo, this.noiseSource,
    ];
    setTimeout(() => {
      for (const node of carriers) { try { node?.stop(); } catch {} }
      ctx.close().catch(() => {});
    }, FADE_OUT_S * 1000 + 50);
    this.ctx = null;
  }

  // ── Graph construction ──────────────────────────────────────────────────

  private buildGraph(): void {
    const ctx = this.ctx!;
    const state = this.stateRef.current;
    const now = ctx.currentTime;

    // Master with fade-in
    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(0, now);
    this.masterGain.gain.linearRampToValueAtTime(
      this.volumeMap(state.audioVolume), now + FADE_IN_S
    );
    this.masterGain.connect(ctx.destination);

    // Tremolo bus.  Base gain = 1 - depth/200, LFO swings ±depth/200 → peak=1, trough=1-depth/100.
    this.tremoloGain = ctx.createGain();
    this.tremoloGain.gain.value = 1 - state.audioTremoloDepth / 200;
    this.tremoloGain.connect(this.masterGain);

    this.tremoloLFO = ctx.createOscillator();
    this.tremoloLFO.type = 'sine';
    this.tremoloLFO.frequency.value = Math.max(0.001, state.audioTremoloRate);

    this.tremoloDepthGain = ctx.createGain();
    this.tremoloDepthGain.gain.value = state.audioTremoloDepth / 200;
    this.tremoloLFO.connect(this.tremoloDepthGain);
    this.tremoloDepthGain.connect(this.tremoloGain.gain);
    this.tremoloLFO.start();

    // Tone bus
    this.toneGain = ctx.createGain();
    this.toneGain.gain.value = state.audioToneEnabled ? 0.4 : 0;
    this.toneGain.connect(this.tremoloGain);
    this.buildToneLayer(state);

    // Drone bus
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = state.audioDroneEnabled
      ? (state.audioDroneLevel / 100) * 0.3 : 0;
    this.droneGain.connect(this.tremoloGain);
    this.droneOsc = ctx.createOscillator();
    this.droneOsc.type = state.audioWaveform;
    this.droneOsc.frequency.value =
      state.audioCarrierFreq * DRONE_INTERVAL_RATIOS[state.audioDroneInterval];
    this.droneOsc.connect(this.droneGain);
    this.droneOsc.start();

    // Noise bus
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = state.audioNoiseEnabled
      ? (state.audioNoiseLevel / 100) * 0.5 : 0;
    this.noiseGain.connect(this.tremoloGain);
    this.buildNoiseSource(state.audioNoiseType);

    this.lastBeatMode = state.audioBeatMode;
    this.lastNoiseType = state.audioNoiseType;
    this.lastWaveform = state.audioWaveform;
  }

  private buildToneLayer(state: AppState): void {
    const ctx = this.ctx!;
    // Tear down previous tone subgraph
    try { this.carrierL?.stop(); } catch {}
    try { this.carrierR?.stop(); } catch {}
    try { this.isoLfo?.stop(); } catch {}
    this.carrierL?.disconnect(); this.carrierR?.disconnect();
    this.pannerL?.disconnect(); this.pannerR?.disconnect();
    this.isoLfo?.disconnect(); this.isoGain?.disconnect(); this.isoDepthGain?.disconnect();
    this.pannerL = this.pannerR = null;
    this.isoLfo = this.isoGain = this.isoDepthGain = null;

    const carrier = state.audioCarrierFreq;
    const beat = state.audioBeatFreq;

    this.carrierL = ctx.createOscillator();
    this.carrierR = ctx.createOscillator();
    this.carrierL.type = state.audioWaveform;
    this.carrierR.type = state.audioWaveform;

    if (state.audioBeatMode === 'binaural') {
      this.carrierL.frequency.value = carrier;
      this.carrierR.frequency.value = carrier + beat;
      this.pannerL = ctx.createStereoPanner();
      this.pannerR = ctx.createStereoPanner();
      this.pannerL.pan.value = -1;
      this.pannerR.pan.value = 1;
      this.carrierL.connect(this.pannerL).connect(this.toneGain);
      this.carrierR.connect(this.pannerR).connect(this.toneGain);
    } else if (state.audioBeatMode === 'monaural') {
      this.carrierL.frequency.value = carrier;
      this.carrierR.frequency.value = carrier + beat;
      this.carrierL.connect(this.toneGain);
      this.carrierR.connect(this.toneGain);
    } else {
      // isochronic — single carrier amplitude-modulated by a square LFO
      this.carrierL.frequency.value = carrier;
      this.carrierR.frequency.value = carrier; // disconnected, but must exist
      this.isoGain = ctx.createGain();
      this.isoGain.gain.value = 0.5;
      this.isoLfo = ctx.createOscillator();
      this.isoLfo.type = 'square';
      this.isoLfo.frequency.value = Math.max(0.001, beat);
      this.isoDepthGain = ctx.createGain();
      this.isoDepthGain.gain.value = 0.5;
      this.isoLfo.connect(this.isoDepthGain).connect(this.isoGain.gain);
      this.carrierL.connect(this.isoGain).connect(this.toneGain);
      this.isoLfo.start();
    }
    this.carrierL.start();
    this.carrierR.start();
  }

  private buildNoiseSource(type: AppState['audioNoiseType']): void {
    const ctx = this.ctx!;
    try { this.noiseSource?.stop(); } catch {}
    this.noiseSource?.disconnect();
    let buf = this.noiseBuffers.get(type);
    if (!buf) {
      buf = this.generateNoiseBuffer(type);
      this.noiseBuffers.set(type, buf);
    }
    this.noiseSource = ctx.createBufferSource();
    this.noiseSource.buffer = buf;
    this.noiseSource.loop = true;
    this.noiseSource.connect(this.noiseGain);
    this.noiseSource.start();
  }

  // ── Per-frame parameter automation ──────────────────────────────────────

  private startLoop(): void {
    const tick = () => {
      this.updateParams();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private updateParams(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const state = this.stateRef.current;
    const now = ctx.currentTime;

    // Structural changes → rebuild affected subgraph
    if (state.audioBeatMode !== this.lastBeatMode) {
      this.buildToneLayer(state);
      this.lastBeatMode = state.audioBeatMode;
    }
    if (state.audioNoiseType !== this.lastNoiseType) {
      this.buildNoiseSource(state.audioNoiseType);
      this.lastNoiseType = state.audioNoiseType;
    }
    if (state.audioWaveform !== this.lastWaveform) {
      if (this.carrierL) this.carrierL.type = state.audioWaveform;
      if (this.carrierR) this.carrierR.type = state.audioWaveform;
      this.droneOsc.type = state.audioWaveform;
      this.lastWaveform = state.audioWaveform;
    }

    // Master volume — don't fight the fade-in.  After fade completes the ramp
    // setTargetAtTime takes over smoothly.
    if (now > FADE_IN_S) {
      this.masterGain.gain.setTargetAtTime(
        this.volumeMap(state.audioVolume), now, SMOOTH_TC
      );
    }

    // Tremolo
    this.tremoloLFO.frequency.setTargetAtTime(
      Math.max(0.001, state.audioTremoloRate), now, SMOOTH_TC
    );
    this.tremoloDepthGain.gain.setTargetAtTime(
      state.audioTremoloDepth / 200, now, SMOOTH_TC
    );
    this.tremoloGain.gain.setTargetAtTime(
      1 - state.audioTremoloDepth / 200, now, SMOOTH_TC
    );

    // Effective beat freq (with optional ramp)
    let beat = state.audioBeatFreq;
    if (state.rampAudioBeat && state.pulseSpeed) {
      const t = (performance.now() - state.rampEpoch) / 1000;
      const f = computeSpeedRampFactor(
        t, state.pulseMin, state.pulseMax, state.rampDuration, state.rampMode
      );
      beat = Math.min(BEAT_RAMP_CAP_HZ, Math.max(0.5, state.audioBeatFreq * f));
    }

    // Tone layer levels & frequencies
    this.toneGain.gain.setTargetAtTime(
      state.audioToneEnabled ? 0.4 : 0, now, SMOOTH_TC
    );
    if (state.audioBeatMode === 'binaural' || state.audioBeatMode === 'monaural') {
      this.carrierL?.frequency.setTargetAtTime(state.audioCarrierFreq, now, SMOOTH_TC);
      this.carrierR?.frequency.setTargetAtTime(state.audioCarrierFreq + beat, now, SMOOTH_TC);
    } else if (state.audioBeatMode === 'isochronic') {
      this.carrierL?.frequency.setTargetAtTime(state.audioCarrierFreq, now, SMOOTH_TC);
      this.isoLfo?.frequency.setTargetAtTime(Math.max(0.001, beat), now, SMOOTH_TC);
    }

    // Drone
    this.droneGain.gain.setTargetAtTime(
      state.audioDroneEnabled ? (state.audioDroneLevel / 100) * 0.3 : 0,
      now, SMOOTH_TC
    );
    this.droneOsc.frequency.setTargetAtTime(
      state.audioCarrierFreq * DRONE_INTERVAL_RATIOS[state.audioDroneInterval],
      now, SMOOTH_TC
    );

    // Noise
    this.noiseGain.gain.setTargetAtTime(
      state.audioNoiseEnabled ? (state.audioNoiseLevel / 100) * 0.5 : 0,
      now, SMOOTH_TC
    );
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private volumeMap(v: number): number {
    const norm = Math.max(0, Math.min(100, v)) / 100;
    return norm * norm; // perceptual x² curve
  }

  private generateNoiseBuffer(type: AppState['audioNoiseType']): AudioBuffer {
    const ctx = this.ctx!;
    const duration = 2;
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    if (type === 'white') {
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    } else if (type === 'pink') {
      // Paul Kellet's refined pink noise filter
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    } else { // brown — integrated white noise
      let lastOut = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 3.5;
      }
    }
    return buffer;
  }
}
