// Procedural Web Audio Engine Synthesizer for High-Performance Sports Car
// Authentic V8 Combustion Firing Order, Exhaust Pipe Resonance & Dynamic Induction Roar

class SoundEngine {
  private ctx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;

  // Engine Combustion Oscillators
  private engineOsc1: OscillatorNode | null = null;      // Sawtooth fundamental (cylinder firing strokes)
  private engineOsc2: OscillatorNode | null = null;      // Sawtooth 2nd harmonic (exhaust manifold pulses)
  private engineSubOsc: OscillatorNode | null = null;    // Triangle sub-harmonic (crankshaft & piston displacement)
  private engineOsc1Gain: GainNode | null = null;
  private engineOsc2Gain: GainNode | null = null;
  private engineSubGain: GainNode | null = null;

  // Exhaust Acoustic Resonator (Formant filter creating the throaty metallic exhaust pipe chamber)
  private exhaustResonance: BiquadFilterNode | null = null;
  private exhaustBass: BiquadFilterNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;   // Dynamic lowpass opening with RPM & throttle
  private engineGain: GainNode | null = null;

  // Intake Induction Roar (Broadband air rush under throttle load)
  private intakeNoiseNode: AudioBufferSourceNode | null = null;
  private intakeFilter: BiquadFilterNode | null = null;
  private intakeGain: GainNode | null = null;

  // Twin-Turbo Spool Whistle
  private turboOsc: OscillatorNode | null = null;
  private turboGain: GainNode | null = null;

  // Tire Screech (Drift & heavy braking)
  private screechNode: AudioBufferSourceNode | null = null;
  private screechFilter: BiquadFilterNode | null = null;
  private screechGain: GainNode | null = null;

  // Aerodynamic Wind Rush
  private windNode: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;

  // Shared noise buffer
  private sharedNoiseBuffer: AudioBuffer | null = null;

  private isInitialized = false;
  private isMuted = false;
  private lastCollisionTime = -1;
  private volume = 0.85;

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

      // Master Dynamics Compressor: Punchy, clean, prevents clipping
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -12;
      this.compressor.knee.value = 6;
      this.compressor.ratio.value = 4.0;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.10;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.volume;

      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // Shared 2-second White Noise Buffer for mechanical noise, wind & backfires
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      this.sharedNoiseBuffer = noiseBuffer;

      // ------------------------------------------------------------------------
      // 1. ENGINE SYNTHESIS: Authentic V8 Combustion Stack
      // ------------------------------------------------------------------------

      // Sub-harmonic piston rumble (Triangle wave)
      this.engineSubOsc = this.ctx.createOscillator();
      this.engineSubOsc.type = 'triangle';
      this.engineSubOsc.frequency.value = 28;
      this.engineSubGain = this.ctx.createGain();
      this.engineSubGain.gain.value = 0.52;

      // Fundamental firing stroke (Sawtooth wave)
      this.engineOsc1 = this.ctx.createOscillator();
      this.engineOsc1.type = 'sawtooth';
      this.engineOsc1.frequency.value = 56;
      this.engineOsc1Gain = this.ctx.createGain();
      this.engineOsc1Gain.gain.value = 0.65;

      // 2nd Harmonic (Exhaust pulse pairing, Sawtooth wave with slight chorus detune)
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'sawtooth';
      this.engineOsc2.frequency.value = 112;
      this.engineOsc2.detune.value = -6;
      this.engineOsc2Gain = this.ctx.createGain();
      this.engineOsc2Gain.gain.value = 0.38;

      // Exhaust pipe acoustic formant resonator (gives the throaty hollow metal timbre)
      this.exhaustResonance = this.ctx.createBiquadFilter();
      this.exhaustResonance.type = 'peaking';
      this.exhaustResonance.frequency.value = 320;
      this.exhaustResonance.Q.value = 2.2;
      this.exhaustResonance.gain.value = 6.5;

      // Low-shelf bass boost for deep idle rumble
      this.exhaustBass = this.ctx.createBiquadFilter();
      this.exhaustBass.type = 'lowshelf';
      this.exhaustBass.frequency.value = 120;
      this.exhaustBass.gain.value = 5.0;

      // Dynamic lowpass filter (opens with RPM & throttle for screaming redline roar)
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 620;
      this.engineFilter.Q.value = 1.4;

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;

      // Connect oscillators -> exhaust filters -> master engine gain -> compressor
      this.engineSubOsc.connect(this.engineSubGain);
      this.engineOsc1.connect(this.engineOsc1Gain);
      this.engineOsc2.connect(this.engineOsc2Gain);

      this.engineSubGain.connect(this.exhaustBass);
      this.engineOsc1Gain.connect(this.exhaustBass);
      this.engineOsc2Gain.connect(this.exhaustBass);

      this.exhaustBass.connect(this.exhaustResonance);
      this.exhaustResonance.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.compressor);

      this.engineSubOsc.start();
      this.engineOsc1.start();
      this.engineOsc2.start();

      // ------------------------------------------------------------------------
      // 2. INTAKE INDUCTION ROAR (Throaty combustion air rush under throttle)
      // ------------------------------------------------------------------------
      this.intakeNoiseNode = this.ctx.createBufferSource();
      this.intakeNoiseNode.buffer = noiseBuffer;
      this.intakeNoiseNode.loop = true;

      this.intakeFilter = this.ctx.createBiquadFilter();
      this.intakeFilter.type = 'bandpass';
      this.intakeFilter.frequency.value = 650;
      this.intakeFilter.Q.value = 2.0;

      this.intakeGain = this.ctx.createGain();
      this.intakeGain.gain.value = 0.0;

      this.intakeNoiseNode.connect(this.intakeFilter);
      this.intakeFilter.connect(this.intakeGain);
      this.intakeGain.connect(this.compressor);
      this.intakeNoiseNode.start();

      // ------------------------------------------------------------------------
      // 3. TURBOCHARGER SPOOL WHISTLE
      // ------------------------------------------------------------------------
      this.turboOsc = this.ctx.createOscillator();
      this.turboOsc.type = 'sine';
      this.turboOsc.frequency.value = 1800;
      this.turboGain = this.ctx.createGain();
      this.turboGain.gain.value = 0.0;

      this.turboOsc.connect(this.turboGain);
      this.turboGain.connect(this.compressor);
      this.turboOsc.start();

      // ------------------------------------------------------------------------
      // 4. TIRE SCREECH (Drift & hard braking)
      // ------------------------------------------------------------------------
      this.screechNode = this.ctx.createBufferSource();
      this.screechNode.buffer = noiseBuffer;
      this.screechNode.loop = true;

      this.screechFilter = this.ctx.createBiquadFilter();
      this.screechFilter.type = 'bandpass';
      this.screechFilter.frequency.value = 1250;
      this.screechFilter.Q.value = 4.2;

      this.screechGain = this.ctx.createGain();
      this.screechGain.gain.value = 0.0;

      this.screechNode.connect(this.screechFilter);
      this.screechFilter.connect(this.screechGain);
      this.screechGain.connect(this.compressor);
      this.screechNode.start();

      // ------------------------------------------------------------------------
      // 5. AERODYNAMIC WIND NOISE
      // ------------------------------------------------------------------------
      this.windNode = this.ctx.createBufferSource();
      this.windNode.buffer = noiseBuffer;
      this.windNode.loop = true;

      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'lowpass';
      this.windFilter.frequency.value = 220;
      this.windFilter.Q.value = 1.0;

      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.0;

      this.windNode.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.compressor);
      this.windNode.start();

      this.isInitialized = true;
    } catch {
      // AudioContext unavailable or blocked
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

  // Dual-Clutch Gear Shift: Quick 0.08s ignition cut and transmission thud
  public playGearShift(isUpshift = true) {
    if (!this.isInitialized || !this.ctx || !this.compressor || !this.sharedNoiseBuffer || this.isMuted) {
      return;
    }
    try {
      const now = this.ctx.currentTime;
      this.shiftDipUntil = now + 0.09;

      // Shift ignition cut pop
      const noiseSrc = this.ctx.createBufferSource();
      noiseSrc.buffer = this.sharedNoiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 3.0;
      filter.frequency.setValueAtTime(isUpshift ? 2200 : 1600, now);
      filter.frequency.exponentialRampToValueAtTime(450, now + 0.12);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(isUpshift ? 0.32 : 0.22, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      noiseSrc.connect(filter);
      filter.connect(gain);
      gain.connect(this.compressor);

      noiseSrc.start(now, Math.random() * 1.0, 0.14);
      noiseSrc.stop(now + 0.15);

      // Low-end gearbox thud
      const thumpOsc = this.ctx.createOscillator();
      const thumpGain = this.ctx.createGain();
      thumpOsc.type = 'triangle';
      thumpOsc.frequency.setValueAtTime(110, now);
      thumpOsc.frequency.exponentialRampToValueAtTime(32, now + 0.09);
      thumpGain.gain.setValueAtTime(0.28, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);

      thumpOsc.connect(thumpGain);
      thumpGain.connect(this.compressor);
      thumpOsc.start(now);
      thumpOsc.stop(now + 0.11);
    } catch {
      // Ignore
    }
  }

  // Exhaust Overrun Backfires: Clean, crisp combustion pops on throttle lift-off
  public playExhaustPop() {
    if (!this.isInitialized || !this.ctx || !this.compressor || !this.sharedNoiseBuffer || this.isMuted) {
      return;
    }
    try {
      const now = this.ctx.currentTime;
      if (now - this.lastPopTime < 0.15) return;
      this.lastPopTime = now;

      const popCount = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < popCount; i++) {
        const t = now + i * 0.055 + Math.random() * 0.02;
        const strength = 1.0 - i * 0.18;

        // Sub-bass pressure pulse
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(105, t);
        subOsc.frequency.exponentialRampToValueAtTime(30, t + 0.06);

        subGain.gain.setValueAtTime(0.45 * strength, t);
        subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

        subOsc.connect(subGain);
        subGain.connect(this.compressor);
        subOsc.start(t);
        subOsc.stop(t + 0.08);

        // Crisp exhaust crackle
        const burst = this.ctx.createBufferSource();
        burst.buffer = this.sharedNoiseBuffer;

        const burstFilter = this.ctx.createBiquadFilter();
        burstFilter.type = 'bandpass';
        burstFilter.frequency.setValueAtTime(1400, t);
        burstFilter.Q.value = 2.5;

        const burstGain = this.ctx.createGain();
        burstGain.gain.setValueAtTime(0.35 * strength, t);
        burstGain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);

        burst.connect(burstFilter);
        burstFilter.connect(burstGain);
        burstGain.connect(this.compressor);
        burst.start(t, Math.random() * 1.0, 0.07);
        burst.stop(t + 0.08);
      }
    } catch {
      // Ignore
    }
  }

  // Chassis / Curb Thud
  public playSuspensionThud(intensity = 0.5) {
    if (!this.isInitialized || !this.ctx || !this.compressor || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.10);

      const amp = Math.min(0.25, Math.max(0.04, intensity * 0.22));
      gain.gain.setValueAtTime(amp, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.compressor);
      osc.start(now);
      osc.stop(now + 0.13);
    } catch {
      // Ignore
    }
  }

  // Collision Impact Thump
  public playCollision(intensity = 0.7) {
    if (!this.isInitialized || !this.ctx || !this.compressor || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      if (now - this.lastCollisionTime < 0.18) return;
      this.lastCollisionTime = now;
      const clampedIntensity = Math.min(1.0, Math.max(0.1, intensity));

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.18);

      gain.gain.setValueAtTime(clampedIntensity * 0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.20);

      osc.connect(gain);
      gain.connect(this.compressor);
      osc.start(now);
      osc.stop(now + 0.21);

      if (this.sharedNoiseBuffer) {
        const crunch = this.ctx.createBufferSource();
        crunch.buffer = this.sharedNoiseBuffer;
        const crunchFilter = this.ctx.createBiquadFilter();
        crunchFilter.type = 'bandpass';
        crunchFilter.frequency.setValueAtTime(1200, now);
        crunchFilter.Q.value = 2.0;

        const crunchGain = this.ctx.createGain();
        crunchGain.gain.setValueAtTime(clampedIntensity * 0.35, now);
        crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        crunch.connect(crunchFilter);
        crunchFilter.connect(crunchGain);
        crunchGain.connect(this.compressor);
        crunch.start(now, Math.random() * 1.0, 0.20);
        crunch.stop(now + 0.21);
      }
    } catch {
      // Ignore
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
      !this.engineSubOsc ||
      !this.engineFilter ||
      !this.exhaustResonance ||
      !this.intakeFilter ||
      !this.intakeGain ||
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
      if (this.turboGain) this.turboGain.gain.setTargetAtTime(0, now, 0.08);
      this.intakeGain.gain.setTargetAtTime(0, now, 0.08);
      this.screechGain.gain.setTargetAtTime(0, now, 0.05);
      this.windGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    // Detect Gear Change
    if (gear !== this.lastGear) {
      if (gear > 0 && this.lastGear > 0 && speedKmh > 10) {
        this.playGearShift(gear > this.lastGear);
      }
      this.lastGear = gear;
    }

    // High-RPM Throttle Release -> Overrun Backfire Pops
    if (this.wasThrottle && !throttlePressed && rpm > 3400 && speedKmh > 20) {
      this.playExhaustPop();
    }
    this.wasThrottle = throttlePressed;

    const isShifting = now < this.shiftDipUntil;
    const effectiveRpm = isShifting ? rpm * 0.78 : rpm;

    // Authentic V8 4-Stroke Cylinder Firing Frequency:
    // 4 cylinder firing strokes per crankshaft revolution -> (RPM / 60) * 4
    // Idle 850 RPM  -> 56.7 Hz
    // 3000 RPM      -> 200 Hz
    // 6000 RPM      -> 400 Hz
    // 7500 RPM      -> 500 Hz
    const clampedRpm = Math.max(750, Math.min(8000, effectiveRpm));
    const firingFreq = (clampedRpm / 60) * 4;
    const timeConstant = isShifting ? 0.015 : 0.025;

    // Fundamental + Harmonics
    this.engineSubOsc.frequency.setTargetAtTime(firingFreq * 0.5, now, timeConstant);
    this.engineOsc1.frequency.setTargetAtTime(firingFreq, now, timeConstant);
    this.engineOsc2.frequency.setTargetAtTime(firingFreq * 2.0, now, timeConstant);

    // Exhaust Pipe Resonant Formant Frequency tracks engine pitch
    const exhaustPitch = 240 + (clampedRpm / 7500) * 850;
    this.exhaustResonance.frequency.setTargetAtTime(exhaustPitch, now, 0.03);

    // Dynamic Lowpass Filter: Opens up with throttle for powerful acceleration bark
    const rpmFrac = (clampedRpm - 750) / (7500 - 750);
    const filterCutoff = throttlePressed
      ? 1200 + rpmFrac * 3600
      : 550 + rpmFrac * 1600;
    this.engineFilter.frequency.setTargetAtTime(Math.max(450, filterCutoff), now, 0.03);

    // Engine Volume: Deep distinct idle, powerful roaring pull under load
    const baseGain = 0.48 + rpmFrac * 0.28 + (throttlePressed ? 0.16 : 0);
    const targetGain = isShifting ? baseGain * 0.5 : baseGain;
    this.engineGain.gain.setTargetAtTime(targetGain, now, isShifting ? 0.01 : 0.03);

    // Throttle Air Induction Roar (visceral "VROOOOM" air suction)
    const intakeRoar = throttlePressed ? 0.08 + rpmFrac * 0.22 : 0.015;
    this.intakeGain.gain.setTargetAtTime(intakeRoar, now, 0.025);
    this.intakeFilter.frequency.setTargetAtTime(450 + rpmFrac * 950, now, 0.03);

    // Turbo Spool Whistle (Subtle, pleasant high whistle)
    if (this.turboOsc && this.turboGain) {
      const turboPitch = 1800 + rpmFrac * 2200;
      this.turboOsc.frequency.setTargetAtTime(turboPitch, now, 0.05);
      const turboVol = throttlePressed && rpmFrac > 0.2 ? 0.004 + rpmFrac * 0.012 : 0.001;
      this.turboGain.gain.setTargetAtTime(turboVol, now, 0.04);
    }

    // Tire Screech on drift / hard braking
    const corneringSlip = turnIntensity > 0.45 && speedKmh > 35 ? (turnIntensity - 0.45) * 2.0 : 0;
    const slipFactor = isBrakingOrDrifting ? 1.0 : Math.min(1.0, corneringSlip);
    const speedRatio = Math.max(0, Math.min(1, (speedKmh - 20) / 200));
    const screechVolume = slipFactor > 0.05 && speedKmh > 20 ? slipFactor * speedRatio * 0.24 : 0;

    this.screechFilter.frequency.setTargetAtTime(1150 + speedRatio * 400, now, 0.04);
    this.screechGain.gain.setTargetAtTime(screechVolume, now, 0.035);

    // Aerodynamic Wind Noise
    const windSpeedNorm = Math.max(0, Math.min(1, speedKmh / 320));
    const windVol = Math.pow(windSpeedNorm, 1.8) * 0.22;
    const windCutoff = 180 + windSpeedNorm * 1100;
    this.windFilter.frequency.setTargetAtTime(windCutoff, now, 0.05);
    this.windGain.gain.setTargetAtTime(windVol, now, 0.05);
  }

  public playCountdownBeep(isGo = false) {
    if (!this.isInitialized || !this.ctx || !this.compressor || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isGo ? 880 : 440, now);
      gain.gain.setValueAtTime(0.20, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.35 : 0.16));

      osc.connect(gain);
      gain.connect(this.compressor);
      osc.start(now);
      osc.stop(now + (isGo ? 0.36 : 0.18));
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
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      osc.connect(gain);
      gain.connect(this.compressor);
      osc.start(now);
      osc.stop(now + 0.28);
    } catch {
      // Ignore
    }
  }

  // Dual-tone automotive horn (415 Hz + 510 Hz)
  public playHorn(duration = 0.28) {
    if (!this.isInitialized || !this.ctx || !this.compressor || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      for (const freq of [415, 512]) {
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1650, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.16, now + 0.015);
        gain.gain.setValueAtTime(0.16, now + Math.max(0.04, duration - 0.04));
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.compressor);
        osc.start(now);
        osc.stop(now + duration + 0.02);
      }
    } catch {
      // Ignore
    }
  }

  // Crisp mechanical relay "tic-tac" for turn signals & hazard lights
  public playTurnSignalTick(isTick = true) {
    if (!this.isInitialized || !this.ctx || !this.compressor || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isTick ? 1350 : 980, now);
      osc.frequency.exponentialRampToValueAtTime(isTick ? 420 : 310, now + 0.018);

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

      osc.connect(gain);
      gain.connect(this.compressor);
      osc.start(now);
      osc.stop(now + 0.025);
    } catch {
      // Ignore
    }
  }

  // Starter crank & ignition flare when starting the engine
  public playEngineStarter() {
    if (!this.isInitialized || !this.ctx || !this.compressor || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        const t = now + i * 0.095;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(92 + i * 12, t);
        osc.frequency.exponentialRampToValueAtTime(145, t + 0.075);
        gain.gain.setValueAtTime(0.16, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
        osc.connect(gain);
        gain.connect(this.compressor);
        osc.start(t);
        osc.stop(t + 0.085);
      }
    } catch {
      // Ignore
    }
  }
}

export const soundEngine = new SoundEngine();

