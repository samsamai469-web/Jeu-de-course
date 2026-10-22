// Procedural Web Audio API Synthesizer for Sports Car Engine, Gearbox, Exhaust Pops, Tires, Wind & UI

class SoundEngine {
  private ctx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;

  // Engine Oscillators (Sawtooth + Square + Sub-Octave Sawtooth) + Mechanical Grain Noise
  private engineOsc1: OscillatorNode | null = null; // Sawtooth fundamental
  private engineOsc2: OscillatorNode | null = null; // Square harmonic
  private engineOsc3: OscillatorNode | null = null; // Sawtooth upper harmonic
  private engineOsc1Gain: GainNode | null = null;
  private engineOsc2Gain: GainNode | null = null;
  private engineOsc3Gain: GainNode | null = null;
  private engineNoiseNode: AudioBufferSourceNode | null = null;
  private engineNoiseFilter: BiquadFilterNode | null = null;
  private engineNoiseGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  // Tire Screech (Bandpass filtered noise)
  private screechNode: AudioBufferSourceNode | null = null;
  private screechFilter: BiquadFilterNode | null = null;
  private screechGain: GainNode | null = null;

  // Aerodynamic Wind Rush (Filtered white noise scaling with speed)
  private windNode: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;

  // Shared white noise buffer for one-shot exhaust "pfff" and "pop" effects
  private sharedNoiseBuffer: AudioBuffer | null = null;

  private isInitialized = false;
  private isMuted = false;
  private volume = 0.7;

  // State tracking for Gearbox shifts & High-RPM Exhaust Overrun Pops
  private lastGear = 1;
  private wasThrottle = false;
  private lastPopTime = 0;
  private shiftDipUntil = 0;

  constructor() {
    this.setupMobileTouchUnlock();
  }

  private setupMobileTouchUnlock() {
    if (typeof window === 'undefined') return;

    const unlock = () => {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    };

    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('touchend', unlock, { passive: true });
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('mousedown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  public init() {
    if (this.isInitialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // 6. MIXAGE: Master Dynamics Compressor + Adjustable Master Gain
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -14;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 6;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.18;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.volume;

      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // Shared 2-second White Noise Buffer for Engine Grain, Tires, Wind & Exhaust Effects
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      this.sharedNoiseBuffer = noiseBuffer;

      // 1. MOTEUR: 3 Oscillators (Sawtooth + Square + Sawtooth) + Mechanical Grain Noise -> Lowpass Filter
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 320;
      this.engineFilter.Q.value = 2.1;

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;

      // Osc 1: Deep Sawtooth Fundamental (~800 RPM idle bass rumble to high rev)
      this.engineOsc1 = this.ctx.createOscillator();
      this.engineOsc1.type = 'sawtooth';
      this.engineOsc1.frequency.value = 38;
      this.engineOsc1Gain = this.ctx.createGain();
      this.engineOsc1Gain.gain.value = 0.65;

      // Osc 2: Square Wave (adds throaty sports exhaust pulse)
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'square';
      this.engineOsc2.frequency.value = 57;
      this.engineOsc2.detune.value = 6;
      this.engineOsc2Gain = this.ctx.createGain();
      this.engineOsc2Gain.gain.value = 0.38;

      // Osc 3: Upper Octave Sawtooth (adds metallic high-RPM scream)
      this.engineOsc3 = this.ctx.createOscillator();
      this.engineOsc3.type = 'sawtooth';
      this.engineOsc3.frequency.value = 76;
      this.engineOsc3.detune.value = -5;
      this.engineOsc3Gain = this.ctx.createGain();
      this.engineOsc3Gain.gain.value = 0.45;

      // Mechanical Grain Noise (valvetrain & intake texture)
      this.engineNoiseNode = this.ctx.createBufferSource();
      this.engineNoiseNode.buffer = noiseBuffer;
      this.engineNoiseNode.loop = true;

      this.engineNoiseFilter = this.ctx.createBiquadFilter();
      this.engineNoiseFilter.type = 'bandpass';
      this.engineNoiseFilter.frequency.value = 480;
      this.engineNoiseFilter.Q.value = 1.4;

      this.engineNoiseGain = this.ctx.createGain();
      this.engineNoiseGain.gain.value = 0.14;

      this.engineOsc1.connect(this.engineOsc1Gain);
      this.engineOsc2.connect(this.engineOsc2Gain);
      this.engineOsc3.connect(this.engineOsc3Gain);
      this.engineOsc1Gain.connect(this.engineFilter);
      this.engineOsc2Gain.connect(this.engineFilter);
      this.engineOsc3Gain.connect(this.engineFilter);

      this.engineNoiseNode.connect(this.engineNoiseFilter);
      this.engineNoiseFilter.connect(this.engineNoiseGain);
      this.engineNoiseGain.connect(this.engineFilter);

      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.compressor);

      this.engineOsc1.start();
      this.engineOsc2.start();
      this.engineOsc3.start();
      this.engineNoiseNode.start();

      // 4. PNEUS: Bandpass-filtered noise for tight cornering & heavy braking
      this.screechNode = this.ctx.createBufferSource();
      this.screechNode.buffer = noiseBuffer;
      this.screechNode.loop = true;

      this.screechFilter = this.ctx.createBiquadFilter();
      this.screechFilter.type = 'bandpass';
      this.screechFilter.frequency.value = 1280;
      this.screechFilter.Q.value = 5.2;

      this.screechGain = this.ctx.createGain();
      this.screechGain.gain.value = 0;

      this.screechNode.connect(this.screechFilter);
      this.screechFilter.connect(this.screechGain);
      this.screechGain.connect(this.compressor);
      this.screechNode.start();

      // 5. VENT: Filtered white noise scaling with vehicle speed
      this.windNode = this.ctx.createBufferSource();
      this.windNode.buffer = noiseBuffer;
      this.windNode.loop = true;

      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'lowpass';
      this.windFilter.frequency.value = 240;
      this.windFilter.Q.value = 0.9;

      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0;

      this.windNode.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.compressor);
      this.windNode.start();

      this.isInitialized = true;
    } catch {
      // Web Audio blocked or unsupported
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime, 0.04);
    }
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.04);
    }
  }

  // 2. BOÎTE DE VITESSES: Exhaust "pfff" blow-off + sharp RPM drop on gear change
  public playGearShift(isUpshift = true) {
    if (!this.isInitialized || !this.ctx || !this.compressor || !this.sharedNoiseBuffer || this.isMuted) {
      return;
    }
    try {
      const now = this.ctx.currentTime;
      this.shiftDipUntil = now + 0.11;

      // Pneumatic exhaust/wastegate "pfff" noise burst
      const noiseSrc = this.ctx.createBufferSource();
      noiseSrc.buffer = this.sharedNoiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 2.4;
      filter.frequency.setValueAtTime(isUpshift ? 2300 : 1750, now);
      filter.frequency.exponentialRampToValueAtTime(520, now + 0.17);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(isUpshift ? 0.22 : 0.16, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      noiseSrc.connect(filter);
      filter.connect(gain);
      gain.connect(this.compressor);

      noiseSrc.start(now, Math.random() * 1.2, 0.2);
      noiseSrc.stop(now + 0.2);

      // Subtle low-end gearbox mechanical thump
      const thumpOsc = this.ctx.createOscillator();
      const thumpGain = this.ctx.createGain();
      thumpOsc.type = 'triangle';
      thumpOsc.frequency.setValueAtTime(95, now);
      thumpOsc.frequency.exponentialRampToValueAtTime(34, now + 0.08);
      thumpGain.gain.setValueAtTime(0.14, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      thumpOsc.connect(thumpGain);
      thumpGain.connect(this.compressor);
      thumpOsc.start(now);
      thumpOsc.stop(now + 0.1);
    } catch {
      // Ignore audio errors
    }
  }

  // 3. ÉCHAPPEMENT: Exhaust overrun "pop" when releasing throttle at high RPM
  public playExhaustPop() {
    if (!this.isInitialized || !this.ctx || !this.compressor || !this.sharedNoiseBuffer || this.isMuted) {
      return;
    }
    try {
      const now = this.ctx.currentTime;
      if (now - this.lastPopTime < 0.18) return;
      this.lastPopTime = now;

      // Trigger 2 rapid staggered exhaust pops for authentic sports exhaust overrun
      const popOffsets = [0.02, 0.095];
      for (let i = 0; i < popOffsets.length; i++) {
        const t = now + popOffsets[i];
        const strength = i === 0 ? 1.0 : 0.72;

        // Low-mid resonant pop impulse
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(155 - i * 18, t);
        osc.frequency.exponentialRampToValueAtTime(38, t + 0.065);

        oscGain.gain.setValueAtTime(0.22 * strength, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

        osc.connect(oscGain);
        oscGain.connect(this.compressor);
        osc.start(t);
        osc.stop(t + 0.075);

        // Crisp muffled burst crackle
        const burst = this.ctx.createBufferSource();
        burst.buffer = this.sharedNoiseBuffer;

        const burstFilter = this.ctx.createBiquadFilter();
        burstFilter.type = 'lowpass';
        burstFilter.frequency.setValueAtTime(680, t);
        burstFilter.frequency.exponentialRampToValueAtTime(180, t + 0.06);

        const burstGain = this.ctx.createGain();
        burstGain.gain.setValueAtTime(0.18 * strength, t);
        burstGain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);

        burst.connect(burstFilter);
        burstFilter.connect(burstGain);
        burstGain.connect(this.compressor);
        burst.start(t, Math.random() * 1.2, 0.08);
        burst.stop(t + 0.07);
      }
    } catch {
      // Ignore audio errors
    }
  }

  public updateEngine(
    rpm: number,
    speedKmh: number,
    isBrakingOrDrifting: boolean,
    isPlaying: boolean,
    gear = 1,
    throttlePressed = false,
    turnIntensity = 0
  ) {
    if (
      !this.isInitialized ||
      !this.ctx ||
      !this.engineOsc1 ||
      !this.engineOsc2 ||
      !this.engineOsc3 ||
      !this.engineFilter ||
      !this.engineNoiseFilter ||
      !this.engineNoiseGain ||
      !this.engineGain ||
      !this.screechFilter ||
      !this.screechGain ||
      !this.windFilter ||
      !this.windGain
    ) {
      return;
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;
    if (!isPlaying || this.isMuted) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.08);
      this.screechGain.gain.setTargetAtTime(0, now, 0.05);
      this.windGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    // Detect Gear Change -> Trigger exhaust "pfff" and momentary RPM drop
    if (gear !== this.lastGear) {
      if (gear > 0 && this.lastGear > 0 && speedKmh > 12) {
        this.playGearShift(gear > this.lastGear);
      }
      this.lastGear = gear;
    }

    // Detect High-RPM Throttle Release -> Trigger Exhaust Overrun "Pop"
    if (this.wasThrottle && !throttlePressed && rpm > 4200 && speedKmh > 35) {
      this.playExhaustPop();
    }
    this.wasThrottle = throttlePressed;

    // 1. MOTEUR: Frequency follows RPM from deep idle (~800 RPM) to high-rev acceleration
    const isShifting = now < this.shiftDipUntil;
    const effectiveRpm = isShifting ? rpm * 0.76 : rpm;
    const normalizedRpm = Math.max(0, Math.min(1, (effectiveRpm - 800) / 7700));

    // Fundamental frequency: ~36 Hz at 800 RPM idle -> ~195 Hz at redline
    const baseFreq = 36 + Math.pow(normalizedRpm, 1.08) * 159;
    const freqTimeConstant = isShifting ? 0.012 : 0.025;

    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, freqTimeConstant);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.5, now, freqTimeConstant);
    this.engineOsc3.frequency.setTargetAtTime(baseFreq * 2.0, now, freqTimeConstant);

    // Lowpass filter opens up progressively with RPM and throttle load
    const targetFilterCutoff =
      240 + normalizedRpm * 1950 + (throttlePressed ? 380 : 0) - (isShifting ? 450 : 0);
    this.engineFilter.frequency.setTargetAtTime(Math.max(180, targetFilterCutoff), now, 0.03);

    // Mechanical grain noise tracks RPM
    this.engineNoiseFilter.frequency.setTargetAtTime(350 + normalizedRpm * 1400, now, 0.04);
    this.engineNoiseGain.gain.setTargetAtTime(0.08 + normalizedRpm * 0.14, now, 0.04);

    // Engine volume responds to RPM, throttle load, and brief gear-shift cut
    const baseEngineGain = 0.09 + normalizedRpm * 0.15 + (throttlePressed ? 0.04 : 0);
    const targetEngineGain = isShifting ? baseEngineGain * 0.35 : baseEngineGain;
    this.engineGain.gain.setTargetAtTime(targetEngineGain, now, isShifting ? 0.01 : 0.04);

    // 4. PNEUS: Bandpass tire squeal in tight corners or heavy braking, volume linked to speed
    const corneringSlip = turnIntensity > 0.55 && speedKmh > 55 ? (turnIntensity - 0.55) * 1.8 : 0;
    const slipFactor = isBrakingOrDrifting ? 1.0 : Math.min(1.0, corneringSlip);
    const speedRatio = Math.max(0, Math.min(1, (speedKmh - 28) / 220));
    const screechVolume = slipFactor > 0.05 && speedKmh > 28 ? slipFactor * speedRatio * 0.18 : 0;

    this.screechFilter.frequency.setTargetAtTime(1150 + speedRatio * 380, now, 0.04);
    this.screechGain.gain.setTargetAtTime(screechVolume, now, 0.035);

    // 5. VENT: Filtered white noise whose volume and cutoff increase with speed
    const windSpeedNorm = Math.max(0, Math.min(1, speedKmh / 290));
    const windVol = Math.pow(windSpeedNorm, 1.55) * 0.18;
    const windCutoff = 180 + windSpeedNorm * 950;
    this.windFilter.frequency.setTargetAtTime(windCutoff, now, 0.06);
    this.windGain.gain.setTargetAtTime(windVol, now, 0.06);
  }

  public playCollision(intensity = 0.7) {
    if (!this.isInitialized || !this.ctx || !this.compressor || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.18);

      gain.gain.setValueAtTime(Math.min(0.35, intensity * 0.3), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(this.compressor);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // Ignore audio errors
    }
  }

  public playCountdownBeep(isGo = false) {
    if (!this.isInitialized || !this.ctx || !this.compressor || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isGo ? 880 : 440, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.38 : 0.18));

      osc.connect(gain);
      gain.connect(this.compressor);
      osc.start(now);
      osc.stop(now + (isGo ? 0.4 : 0.2));
    } catch {
      // Ignore
    }
  }

  public playCheckpointChime() {
    if (!this.isInitialized || !this.ctx || !this.compressor || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.08); // A5
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(this.compressor);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      // Ignore
    }
  }
}

export const soundEngine = new SoundEngine();
