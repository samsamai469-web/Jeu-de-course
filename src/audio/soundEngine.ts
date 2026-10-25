// Procedural Web Audio API Synthesizer for Mercedes-AMG V8 BiTurbo
// High-Fidelity Cross-Plane Cadence, Analog Saturation, Active Exhaust Valves, Twin-Turbo Flutter & Overrun Pops

class SoundEngine {
  private ctx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;

  // Harmonic Generation (Cross-plane V8 Crankshaft & Cylinders)
  private engineSubOsc: OscillatorNode | null = null; // Deep sub-bass piston displacement rumble (20-110 Hz)
  private engineOsc1: OscillatorNode | null = null;   // Sawtooth fundamental firing pulses
  private engineOsc2: OscillatorNode | null = null;   // Square wave throaty exhaust growl
  private engineOsc3: OscillatorNode | null = null;   // Upper harmonic sawtooth (high-RPM racing rasp)
  private engineSubGain: GainNode | null = null;
  private engineOsc1Gain: GainNode | null = null;
  private engineOsc2Gain: GainNode | null = null;
  private engineOsc3Gain: GainNode | null = null;

  // Cross-plane V8 Firing Order Amplitude Modulation (uneven burble at idle / low-mid RPM)
  private firingPulseOsc: OscillatorNode | null = null;
  private firingPulseGain: GainNode | null = null;

  // Analog WaveShaper Saturation (manifold acoustic distortion & raw exhaust pipe growl)
  private enginePreGain: GainNode | null = null;
  private engineSaturation: WaveShaperNode | null = null;

  // AMG Performance Exhaust Stage: Dual-Stage Acoustic Resonators & Active Sport Flaps
  private exhaustBassBoost: BiquadFilterNode | null = null;  // Low-shelf 130 Hz (+7.5 dB)
  private exhaustResonator: BiquadFilterNode | null = null;  // Peaking 440 Hz (+4.5 dB)
  private exhaustSportFlap: BiquadFilterNode | null = null;  // Peaking 1100 Hz (+2 to +10 dB under throttle)
  private engineFilter: BiquadFilterNode | null = null;      // Dynamic lowpass filter (680 Hz idle -> 6500 Hz redline)
  private engineGain: GainNode | null = null;                // Master engine volume node

  // Twin-Turbocharger Spool & Whistle
  private engineTurboOsc: OscillatorNode | null = null;
  private engineTurboGain: GainNode | null = null;

  // Mechanical Valvetrain & Induction Roar
  private engineNoiseNode: AudioBufferSourceNode | null = null;
  private engineNoiseFilter: BiquadFilterNode | null = null;
  private engineNoiseGain: GainNode | null = null;
  private intakeFilter: BiquadFilterNode | null = null;
  private intakeGain: GainNode | null = null;

  // Tire Screech & Lateral Drift Scrub
  private screechNode: AudioBufferSourceNode | null = null;
  private screechFilter: BiquadFilterNode | null = null;
  private screechGain: GainNode | null = null;

  // Aerodynamic Wind Noise
  private windNode: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;

  // Shared 2-second White Noise Buffer for backfires, blow-off valves, chassis rattles & collisions
  private sharedNoiseBuffer: AudioBuffer | null = null;

  private isInitialized = false;
  private isMuted = false;
  private lastCollisionTime = -1; // anti-spam : un seul bruit d'impact toutes les ~180 ms
  private volume = 0.88;

  // State tracking for Gearbox shifts, Blow-Off Flutter & High-RPM Exhaust Overrun Pops
  private lastGear = 1;
  private wasThrottle = false;
  private lastPopTime = 0;
  private lastFlutterTime = 0;
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

  // Non-linear transfer curve creating authentic AMG exhaust manifold saturation and acoustic crunch
  private makeAmgExhaustDistortionCurve(): Float32Array {
    const n = 4096;
    const curve = new Float32Array(n);
    const drive = 2.4;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      const y = Math.tanh(x * drive);
      // Subtle asymmetric harmonic warmth typical of large displacement exhaust manifolds
      curve[i] = y * 0.84 + 0.16 * Math.sin(x * Math.PI * 0.95);
    }
    return curve;
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

      // Master Dynamics Compressor + Master Gain (High perceived loudness, zero digital clipping)
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -12;
      this.compressor.knee.value = 8;
      this.compressor.ratio.value = 4.5;
      this.compressor.attack.value = 0.002;
      this.compressor.release.value = 0.12;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.volume;

      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // Shared 2-second White Noise Buffer for mechanical grain, wind, tire scrub & impacts
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      this.sharedNoiseBuffer = noiseBuffer;

      // 1. ENGINE SYNTHESIS: Multi-oscillator harmonic stack + Saturation + AMG Active Exhaust
      this.enginePreGain = this.ctx.createGain();
      this.enginePreGain.gain.value = 0.92;

      this.engineSaturation = this.ctx.createWaveShaper();
      this.engineSaturation.curve = this.makeAmgExhaustDistortionCurve() as Float32Array<ArrayBuffer>;
      this.engineSaturation.oversample = '2x';

      // Exhaust Stage Filters:
      // a. Deep sub-bass low-shelf (+7.5 dB) for chest-thumping idle and acceleration rumble
      this.exhaustBassBoost = this.ctx.createBiquadFilter();
      this.exhaustBassBoost.type = 'lowshelf';
      this.exhaustBassBoost.frequency.value = 135;
      this.exhaustBassBoost.gain.value = 7.5;

      // b. Exhaust pipe cavity resonance (+4.5 dB at 440 Hz)
      this.exhaustResonator = this.ctx.createBiquadFilter();
      this.exhaustResonator.type = 'peaking';
      this.exhaustResonator.frequency.value = 440;
      this.exhaustResonator.Q.value = 1.8;
      this.exhaustResonator.gain.value = 4.5;

      // c. AMG Active Sport Exhaust Flaps (+2.0 dB at idle, surging to +10.5 dB under throttle at 1100 Hz)
      this.exhaustSportFlap = this.ctx.createBiquadFilter();
      this.exhaustSportFlap.type = 'peaking';
      this.exhaustSportFlap.frequency.value = 1100;
      this.exhaustSportFlap.Q.value = 2.4;
      this.exhaustSportFlap.gain.value = 2.0;

      // d. Dynamic lowpass engine filter (opens wide with throttle and RPM)
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 680;
      this.engineFilter.Q.value = 2.2;

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;

      // Cross-Plane V8 Firing Cadence Modulation (LFO)
      this.firingPulseOsc = this.ctx.createOscillator();
      this.firingPulseOsc.type = 'sine';
      this.firingPulseOsc.frequency.value = 14.5; // ~Half-crank rotation at idle
      this.firingPulseGain = this.ctx.createGain();
      this.firingPulseGain.gain.value = 0.14; // Subtle 14% amplitude burble

      this.firingPulseOsc.connect(this.firingPulseGain);
      this.firingPulseGain.connect(this.engineGain.gain);

      // Sub-Bass fundamental (deep mechanical V8 cross-plane piston stroke & block rumble)
      this.engineSubOsc = this.ctx.createOscillator();
      this.engineSubOsc.type = 'sine';
      this.engineSubOsc.frequency.value = 29;
      this.engineSubGain = this.ctx.createGain();
      this.engineSubGain.gain.value = 0.95;

      // Osc 1: Deep Sawtooth Fundamental (~850 RPM idle bass rumble to 7500 RPM)
      this.engineOsc1 = this.ctx.createOscillator();
      this.engineOsc1.type = 'sawtooth';
      this.engineOsc1.frequency.value = 44;
      this.engineOsc1.detune.value = -10;
      this.engineOsc1Gain = this.ctx.createGain();
      this.engineOsc1Gain.gain.value = 0.88;

      // Osc 2: Square Wave (throaty sports exhaust pulse with AMG cross-plane growl)
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'square';
      this.engineOsc2.frequency.value = 66;
      this.engineOsc2.detune.value = 12;
      this.engineOsc2Gain = this.ctx.createGain();
      this.engineOsc2Gain.gain.value = 0.62;

      // Osc 3: Upper Octave Sawtooth (metallic high-RPM racing scream)
      this.engineOsc3 = this.ctx.createOscillator();
      this.engineOsc3.type = 'sawtooth';
      this.engineOsc3.frequency.value = 88;
      this.engineOsc3.detune.value = -4;
      this.engineOsc3Gain = this.ctx.createGain();
      this.engineOsc3Gain.gain.value = 0.58;

      // Twin-Turbocharger High-Frequency Spool & Whistle Oscillator
      this.engineTurboOsc = this.ctx.createOscillator();
      this.engineTurboOsc.type = 'sine';
      this.engineTurboOsc.frequency.value = 1600;
      this.engineTurboGain = this.ctx.createGain();
      this.engineTurboGain.gain.value = 0.0;
      this.engineTurboOsc.connect(this.engineTurboGain);
      this.engineTurboGain.connect(this.compressor);
      this.engineTurboOsc.start();

      // Mechanical Grain Noise (valvetrain & intake texture)
      this.engineNoiseNode = this.ctx.createBufferSource();
      this.engineNoiseNode.buffer = noiseBuffer;
      this.engineNoiseNode.loop = true;

      this.engineNoiseFilter = this.ctx.createBiquadFilter();
      this.engineNoiseFilter.type = 'bandpass';
      this.engineNoiseFilter.frequency.value = 720;
      this.engineNoiseFilter.Q.value = 2.0;

      this.engineNoiseGain = this.ctx.createGain();
      this.engineNoiseGain.gain.value = 0.24;

      // Intake Resonator (opens up under throttle load)
      this.intakeFilter = this.ctx.createBiquadFilter();
      this.intakeFilter.type = 'bandpass';
      this.intakeFilter.frequency.value = 520;
      this.intakeFilter.Q.value = 2.5;
      this.intakeGain = this.ctx.createGain();
      this.intakeGain.gain.value = 0.0;

      // Route oscillators to pre-gain
      this.engineSubOsc.connect(this.engineSubGain);
      this.engineOsc1.connect(this.engineOsc1Gain);
      this.engineOsc2.connect(this.engineOsc2Gain);
      this.engineOsc3.connect(this.engineOsc3Gain);

      this.engineSubGain.connect(this.enginePreGain);
      this.engineOsc1Gain.connect(this.enginePreGain);
      this.engineOsc2Gain.connect(this.enginePreGain);
      this.engineOsc3Gain.connect(this.enginePreGain);

      // Noise & intake to pre-gain
      this.engineNoiseNode.connect(this.engineNoiseFilter);
      this.engineNoiseFilter.connect(this.engineNoiseGain);
      this.engineNoiseGain.connect(this.enginePreGain);

      this.engineNoiseFilter.connect(this.intakeFilter);
      this.intakeFilter.connect(this.intakeGain);
      this.intakeGain.connect(this.enginePreGain);

      // Pipe through analog saturation WaveShaper -> exhaust resonators -> dynamic lowpass -> engineGain -> compressor
      this.enginePreGain.connect(this.engineSaturation);
      this.engineSaturation.connect(this.exhaustBassBoost);
      this.exhaustBassBoost.connect(this.exhaustResonator);
      this.exhaustResonator.connect(this.exhaustSportFlap);
      this.exhaustSportFlap.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.compressor);

      this.engineSubOsc.start();
      this.engineOsc1.start();
      this.engineOsc2.start();
      this.engineOsc3.start();
      this.firingPulseOsc.start();
      this.engineNoiseNode.start();

      // 2. TIRE SCREECH (Bandpass-filtered noise for lateral slip & braking)
      this.screechNode = this.ctx.createBufferSource();
      this.screechNode.buffer = noiseBuffer;
      this.screechNode.loop = true;

      this.screechFilter = this.ctx.createBiquadFilter();
      this.screechFilter.type = 'bandpass';
      this.screechFilter.frequency.value = 1320;
      this.screechFilter.Q.value = 4.8;

      this.screechGain = this.ctx.createGain();
      this.screechGain.gain.value = 0;

      this.screechNode.connect(this.screechFilter);
      this.screechFilter.connect(this.screechGain);
      this.screechGain.connect(this.compressor);
      this.screechNode.start();

      // 3. AERODYNAMIC WIND NOISE (Filtered white noise scaling with vehicle speed)
      this.windNode = this.ctx.createBufferSource();
      this.windNode.buffer = noiseBuffer;
      this.windNode.loop = true;

      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'lowpass';
      this.windFilter.frequency.value = 240;
      this.windFilter.Q.value = 0.95;

      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0;

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

  // Twin-Turbo Wastegate Blow-off / Compressor Flutter ("stututu") on throttle lift
  public playBlowOffSurge(intensity = 0.7) {
    if (!this.isInitialized || !this.ctx || !this.compressor || !this.sharedNoiseBuffer || this.isMuted) {
      return;
    }
    try {
      const now = this.ctx.currentTime;
      if (now - this.lastFlutterTime < 0.35) return;
      this.lastFlutterTime = now;

      const boostClamped = Math.min(1.0, Math.max(0.2, intensity));
      // 4 rapid flutter pulses
      const pulses = 4;
      for (let p = 0; p < pulses; p++) {
        const t = now + p * 0.052;
        const decay = Math.pow(0.68, p);

        const flutterNoise = this.ctx.createBufferSource();
        flutterNoise.buffer = this.sharedNoiseBuffer;

        const flutterFilter = this.ctx.createBiquadFilter();
        flutterFilter.type = 'bandpass';
        flutterFilter.frequency.setValueAtTime(2600 - p * 180, t);
        flutterFilter.Q.value = 3.6;

        const flutterGain = this.ctx.createGain();
        flutterGain.gain.setValueAtTime(0.001, t);
        flutterGain.gain.linearRampToValueAtTime(0.38 * boostClamped * decay, t + 0.012);
        flutterGain.gain.exponentialRampToValueAtTime(0.001, t + 0.048);

        flutterNoise.connect(flutterFilter);
        flutterFilter.connect(flutterGain);
        flutterGain.connect(this.compressor);

        flutterNoise.start(t, Math.random() * 1.0, 0.055);
        flutterNoise.stop(t + 0.052);
      }
    } catch {
      // Ignore
    }
  }

  // 4. GEARBOX: AMG SPEEDSHIFT DCT dual-clutch shift bang & ignition cut pop
  public playGearShift(isUpshift = true) {
    if (!this.isInitialized || !this.ctx || !this.compressor || !this.sharedNoiseBuffer || this.isMuted) {
      return;
    }
    try {
      const now = this.ctx.currentTime;
      this.shiftDipUntil = now + 0.14;

      // Pneumatic turbo blow-off / wastegate surge & ignition cut sound
      const noiseSrc = this.ctx.createBufferSource();
      noiseSrc.buffer = this.sharedNoiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 3.5;
      filter.frequency.setValueAtTime(isUpshift ? 3100 : 2200, now);
      filter.frequency.exponentialRampToValueAtTime(540, now + 0.16);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(isUpshift ? 0.48 : 0.34, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      noiseSrc.connect(filter);
      filter.connect(gain);
      gain.connect(this.compressor);

      noiseSrc.start(now, Math.random() * 1.2, 0.18);
      noiseSrc.stop(now + 0.19);

      // Low-end AMG dual-clutch transmission engagement thud
      const thumpOsc = this.ctx.createOscillator();
      const thumpGain = this.ctx.createGain();
      thumpOsc.type = 'triangle';
      thumpOsc.frequency.setValueAtTime(135, now);
      thumpOsc.frequency.exponentialRampToValueAtTime(26, now + 0.11);
      thumpGain.gain.setValueAtTime(0.42, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      thumpOsc.connect(thumpGain);
      thumpGain.connect(this.compressor);
      thumpOsc.start(now);
      thumpOsc.stop(now + 0.13);

      // If upshifting under load: distinct metallic exhaust "BRAP" crack
      if (isUpshift) {
        const crackNoise = this.ctx.createBufferSource();
        crackNoise.buffer = this.sharedNoiseBuffer;
        const crackFilter = this.ctx.createBiquadFilter();
        crackFilter.type = 'bandpass';
        crackFilter.frequency.setValueAtTime(1450, now);
        crackFilter.Q.value = 2.8;

        const crackGain = this.ctx.createGain();
        crackGain.gain.setValueAtTime(0.44, now + 0.02);
        crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        crackNoise.connect(crackFilter);
        crackFilter.connect(crackGain);
        crackGain.connect(this.compressor);
        crackNoise.start(now + 0.02, Math.random() * 1.0, 0.08);
        crackNoise.stop(now + 0.09);
      }
    } catch {
      // Ignore
    }
  }

  // 5. EXHAUST BACKFIRE: Visceral AMG Sport+ multi-stage crackles & pops (burble tune)
  public playExhaustPop() {
    if (!this.isInitialized || !this.ctx || !this.compressor || !this.sharedNoiseBuffer || this.isMuted) {
      return;
    }
    try {
      const now = this.ctx.currentTime;
      if (now - this.lastPopTime < 0.14) return;
      this.lastPopTime = now;

      // 4 to 6 rapid staggered combustion explosions
      const popCount = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < popCount; i++) {
        const t = now + i * 0.052 + Math.random() * 0.026;
        const strength = 1.0 - i * 0.14;

        // Sub-bass exhaust gas expansion shockwave (heavy chest thump)
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(115, t);
        subOsc.frequency.exponentialRampToValueAtTime(28, t + 0.075);

        subGain.gain.setValueAtTime(0.65 * strength, t);
        subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.085);

        subOsc.connect(subGain);
        subGain.connect(this.compressor);
        subOsc.start(t);
        subOsc.stop(t + 0.09);

        // Mid-frequency metallic exhaust pipe resonance
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(250 - i * 30, t);
        osc.frequency.exponentialRampToValueAtTime(42, t + 0.07);

        oscGain.gain.setValueAtTime(0.52 * strength, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.075);

        osc.connect(oscGain);
        oscGain.connect(this.compressor);
        osc.start(t);
        osc.stop(t + 0.08);

        // High-frequency rifle-like muzzle crackle
        const burst = this.ctx.createBufferSource();
        burst.buffer = this.sharedNoiseBuffer;

        const burstFilter = this.ctx.createBiquadFilter();
        burstFilter.type = 'bandpass';
        burstFilter.frequency.setValueAtTime(1650, t);
        burstFilter.Q.value = 3.2;

        const burstGain = this.ctx.createGain();
        burstGain.gain.setValueAtTime(0.48 * strength, t);
        burstGain.gain.exponentialRampToValueAtTime(0.001, t + 0.075);

        burst.connect(burstFilter);
        burstFilter.connect(burstGain);
        burstGain.connect(this.compressor);
        burst.start(t, Math.random() * 1.2, 0.085);
        burst.stop(t + 0.09);
      }
    } catch {
      // Ignore
    }
  }

  // 6. CHASSIS / SUSPENSION THUDS (curbs, bumps, landings)
  public playSuspensionThud(intensity = 0.5) {
    if (!this.isInitialized || !this.ctx || !this.compressor || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(90, now);
      osc.frequency.exponentialRampToValueAtTime(36, now + 0.12);

      const amp = Math.min(0.32, Math.max(0.04, intensity * 0.28));
      gain.gain.setValueAtTime(amp, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(this.compressor);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch {
      // Ignore
    }
  }

  // 7. COLLISION SOUND (scaled by physical impact impulse)
  public playCollision(intensity = 0.7) {
    if (!this.isInitialized || !this.ctx || !this.compressor || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      if (now - this.lastCollisionTime < 0.18) return;
      this.lastCollisionTime = now;
      const clampedIntensity = Math.min(1.0, Math.max(0.1, intensity));

      // Low-frequency impact thump
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(24, now + 0.22);

      gain.gain.setValueAtTime(clampedIntensity * 0.52, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.compressor);
      osc.start(now);
      osc.stop(now + 0.26);

      // High-frequency sheet metal / guardrail scrape crunch
      if (this.sharedNoiseBuffer) {
        const crunch = this.ctx.createBufferSource();
        crunch.buffer = this.sharedNoiseBuffer;

        const crunchFilter = this.ctx.createBiquadFilter();
        crunchFilter.type = 'bandpass';
        crunchFilter.frequency.setValueAtTime(1450, now);
        crunchFilter.Q.value = 1.8;

        const crunchGain = this.ctx.createGain();
        crunchGain.gain.setValueAtTime(clampedIntensity * 0.44, now);
        crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        crunch.connect(crunchFilter);
        crunchFilter.connect(crunchGain);
        crunchGain.connect(this.compressor);
        crunch.start(now, Math.random() * 1.0, 0.24);
        crunch.stop(now + 0.25);
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
      !this.engineOsc3 ||
      !this.engineSubOsc ||
      !this.engineFilter ||
      !this.exhaustSportFlap ||
      !this.intakeFilter ||
      !this.intakeGain ||
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
      if (this.engineTurboGain) {
        this.engineTurboGain.gain.setTargetAtTime(0, now, 0.08);
      }
      this.screechGain.gain.setTargetAtTime(0, now, 0.05);
      this.windGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    // Detect Gear Change -> AMG DCT Shift Pop & pneumatic thud
    if (gear !== this.lastGear) {
      if (gear > 0 && this.lastGear > 0 && speedKmh > 10) {
        this.playGearShift(gear > this.lastGear);
      }
      this.lastGear = gear;
    }

    // Detect High-RPM Throttle Release -> Trigger Twin-Turbo Flutter ("stututu") & Exhaust Pops
    if (this.wasThrottle && !throttlePressed && rpm > 3100 && speedKmh > 18) {
      const normRpmForSurge = Math.max(0, Math.min(1, (rpm - 850) / (7500 - 850)));
      this.playBlowOffSurge(normRpmForSurge);
      if (rpm > 3500) {
        this.playExhaustPop();
      }
    }
    this.wasThrottle = throttlePressed;

    const isShifting = now < this.shiftDipUntil;
    const effectiveRpm = isShifting ? rpm * 0.72 : rpm;
    const normalizedRpm = Math.max(0, Math.min(1, (effectiveRpm - 850) / (7500 - 850)));

    // Cross-Plane V8 Firing Frequency (~29 Hz at 850 RPM idle -> ~225 Hz at 7500 RPM)
    const baseFreq = 29 + Math.pow(normalizedRpm, 1.15) * 196;
    const freqTimeConstant = isShifting ? 0.012 : 0.022;

    this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, freqTimeConstant);
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, freqTimeConstant);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.5, now, freqTimeConstant);
    this.engineOsc3.frequency.setTargetAtTime(baseFreq * 2.0, now, freqTimeConstant);

    // Cross-plane firing LFO modulation frequency: tracks crankshaft speed (~14.5 Hz at idle)
    if (this.firingPulseOsc && this.firingPulseGain) {
      const crankFreq = Math.max(12, baseFreq * 0.5);
      this.firingPulseOsc.frequency.setTargetAtTime(crankFreq, now, 0.03);
      // More noticeable thumping burble at idle / low RPM, smoothing out into solid roar at high RPM
      const amDepth = 0.16 * (1.0 - normalizedRpm * 0.65);
      this.firingPulseGain.gain.setTargetAtTime(amDepth, now, 0.03);
    }

    // Twin-Turbo spool whistle tracks RPM & throttle boost pressure
    if (this.engineTurboOsc && this.engineTurboGain) {
      const turboFrequency = 1500 + Math.pow(normalizedRpm, 1.25) * 2600;
      this.engineTurboOsc.frequency.setTargetAtTime(turboFrequency, now, 0.05);
      const turboVolume = throttlePressed && normalizedRpm > 0.15 ? 0.08 + normalizedRpm * 0.18 : 0.008;
      this.engineTurboGain.gain.setTargetAtTime(isShifting ? 0.005 : turboVolume, now, 0.035);
    }

    // AMG Active Sport Exhaust Flaps: Opens wide under throttle (+2 dB idle -> +10.5 dB wide-open throttle)
    const targetFlapGain = throttlePressed ? 3.5 + normalizedRpm * 7.0 : 1.8 + normalizedRpm * 2.2;
    this.exhaustSportFlap.gain.setTargetAtTime(targetFlapGain, now, 0.025);

    // Lowpass filter opens wide with RPM & throttle load for crisp, tearing V8 roar
    const targetFilterCutoff =
      680 + Math.pow(normalizedRpm, 1.1) * 4400 + (throttlePressed ? 1400 : 0) - (isShifting ? 800 : 0);
    this.engineFilter.frequency.setTargetAtTime(Math.max(480, targetFilterCutoff), now, 0.022);

    // Intake throatiness opens up under throttle
    const intakeRoar = throttlePressed ? 0.35 + normalizedRpm * 0.42 : 0.08;
    this.intakeGain.gain.setTargetAtTime(intakeRoar, now, 0.025);
    this.intakeFilter.frequency.setTargetAtTime(500 + normalizedRpm * 1450, now, 0.025);

    // Mechanical grain noise tracks RPM
    this.engineNoiseFilter.frequency.setTargetAtTime(450 + normalizedRpm * 2100, now, 0.035);
    this.engineNoiseGain.gain.setTargetAtTime(0.16 + normalizedRpm * 0.24, now, 0.035);

    // Engine Master Volume: Authoritative, deep, visceral AMG sports exhaust presence
    // Noticeable at idle (0.54) and loud, punchy under throttle (up to 0.96)
    const baseEngineGain = 0.54 + normalizedRpm * 0.28 + (throttlePressed ? 0.18 : 0);
    const targetEngineGain = isShifting ? baseEngineGain * 0.40 : baseEngineGain;
    this.engineGain.gain.setTargetAtTime(targetEngineGain, now, isShifting ? 0.01 : 0.03);

    // Tire squeal in corners and hard braking
    const corneringSlip = turnIntensity > 0.45 && speedKmh > 35 ? (turnIntensity - 0.45) * 2.0 : 0;
    const slipFactor = isBrakingOrDrifting ? 1.0 : Math.min(1.0, corneringSlip);
    const speedRatio = Math.max(0, Math.min(1, (speedKmh - 20) / 220));
    const screechVolume = slipFactor > 0.05 && speedKmh > 20 ? slipFactor * speedRatio * 0.28 : 0;

    this.screechFilter.frequency.setTargetAtTime(1180 + speedRatio * 450, now, 0.04);
    this.screechGain.gain.setTargetAtTime(screechVolume, now, 0.035);

    // Aerodynamic wind rush (scales with speed^1.8)
    const windSpeedNorm = Math.max(0, Math.min(1, speedKmh / 320));
    const windVol = Math.pow(windSpeedNorm, 1.8) * 0.26;
    const windCutoff = 200 + windSpeedNorm * 1250;
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
      gain.gain.setValueAtTime(0.22, now);
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
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.18, now);
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
