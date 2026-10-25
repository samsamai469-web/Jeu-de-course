import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TouchInputState } from './RacingCanvas';
import { TransmissionType } from '../types/game';
import { soundEngine } from '../audio/soundEngine';
import { Compass, Disc, ArrowLeftRight, RotateCcw } from 'lucide-react';

export type SteerMode = 'wheel' | 'tilt' | 'buttons';

interface TouchControlsProps {
  touchInputRef: React.MutableRefObject<TouchInputState>;
  visible: boolean;
  nitroAmount: number;
  nitroActive: boolean;
  steerRatio: number; // -1 (left) to +1 (right) from physics for visual sync
  transmission: TransmissionType;
  gear: number;
}

const STORAGE_STEER_MODE_KEY = 'apex_horizon_steer_mode_v1';
const MAX_WHEEL_DEG = 150;

export const TouchControls: React.FC<TouchControlsProps> = React.memo(
  ({
    touchInputRef,
    visible,
    nitroAmount,
    nitroActive,
    steerRatio,
    transmission,
    gear,
  }) => {
    const wheelRef = useRef<HTMLDivElement | null>(null);
    const wheelSvgContainerRef = useRef<HTMLDivElement | null>(null);
    const steerPercentTextRef = useRef<HTMLSpanElement | null>(null);
    const leftIndicatorRef = useRef<SVGSVGElement | null>(null);
    const rightIndicatorRef = useRef<SVGSVGElement | null>(null);

    const activeWheelSessionRef = useRef<{
      pointerId: number;
      centerX: number;
      centerY: number;
      prevX: number;
      prevY: number;
      startPointerX: number;
      startPointerY: number;
      startSteer: number;
      radius: number;
      currentSteer: number;
      prevAngle: number; // dernier angle du doigt autour du centre (rad)
      accumAngle: number; // rotation cumulée du volant depuis le début du geste (rad)
      useSwipe: boolean; // doigt posé près du centre : on utilise le balayage horizontal
    } | null>(null);

    const [steerMode, setSteerMode] = useState<SteerMode>(() => {
      try {
        const saved = localStorage.getItem(STORAGE_STEER_MODE_KEY);
        if (saved === 'wheel' || saved === 'tilt' || saved === 'buttons') {
          return saved;
        }
      } catch {
        // Ignore storage error
      }
      return 'wheel';
    });

    const [isWheelHeld, setIsWheelHeld] = useState(false);
    const [tiltSteerInput, setTiltSteerInput] = useState(0);
    const [leftBtnHeld, setLeftBtnHeld] = useState(false);
    const [rightBtnHeld, setRightBtnHeld] = useState(false);
    const [throttleHeld, setThrottleHeld] = useState(false);
    const [brakeHeld, setBrakeHeld] = useState(false);
    const [nitroHeld, setNitroHeld] = useState(false);

    // Direct DOM update for 120Hz zero-latency steering wheel rotation & indicators
    const applySteerValue = useCallback(
      (clamped: number, isTiltMode = false) => {
        touchInputRef.current.steerInput = clamped;
        touchInputRef.current.left = clamped < -0.06;
        touchInputRef.current.right = clamped > 0.06;

        if (wheelSvgContainerRef.current) {
          const deg = Math.max(-MAX_WHEEL_DEG, Math.min(MAX_WHEEL_DEG, clamped * MAX_WHEEL_DEG));
          wheelSvgContainerRef.current.style.transform = `rotate(${deg.toFixed(1)}deg)`;
        }
        if (steerPercentTextRef.current && !isTiltMode) {
          const pct = Math.round(clamped * 100);
          steerPercentTextRef.current.textContent =
            pct === 0 ? '0° CENTRE' : `${pct > 0 ? '+' : ''}${Math.round(clamped * MAX_WHEEL_DEG)}°`;
        }
        if (leftIndicatorRef.current) {
          leftIndicatorRef.current.style.color = clamped < -0.08 ? '#f59e0b' : 'rgba(255,255,255,0.6)';
          leftIndicatorRef.current.style.transform = clamped < -0.08 ? 'scale(1.25)' : 'scale(1)';
        }
        if (rightIndicatorRef.current) {
          rightIndicatorRef.current.style.color = clamped > 0.08 ? '#f59e0b' : 'rgba(255,255,255,0.6)';
          rightIndicatorRef.current.style.transform = clamped > 0.08 ? 'scale(1.25)' : 'scale(1)';
        }
      },
      [touchInputRef]
    );

    const handleSelectSteerMode = useCallback(
      async (mode: SteerMode) => {
        soundEngine.init();
        if (mode === 'tilt') {
          try {
            const devOrient = DeviceOrientationEvent as unknown as {
              requestPermission?: () => Promise<'granted' | 'denied'>;
            };
            if (typeof devOrient.requestPermission === 'function') {
              await devOrient.requestPermission();
            }
          } catch {
            // Permission handled or not required on Android
          }
        }
        setSteerMode(mode);
        activeWheelSessionRef.current = null;
        setIsWheelHeld(false);
        setTiltSteerInput(0);
        setLeftBtnHeld(false);
        setRightBtnHeld(false);
        applySteerValue(0, mode === 'tilt');
        try {
          localStorage.setItem(STORAGE_STEER_MODE_KEY, mode);
        } catch {
          // Ignore storage error
        }
      },
      [applySteerValue]
    );

    // Gyroscope / Accelerometer Tilt Steering ("Incliner le téléphone")
    useEffect(() => {
      if (!visible || steerMode !== 'tilt') return;

      const handleOrientation = (e: DeviceOrientationEvent) => {
        const gamma = e.gamma ?? 0;
        const beta = e.beta ?? 0;

        let angle = 0;
        if (typeof window.screen?.orientation?.angle === 'number') {
          angle = window.screen.orientation.angle;
        } else if (typeof (window as unknown as { orientation?: number }).orientation === 'number') {
          angle = (window as unknown as { orientation: number }).orientation;
        } else if (window.innerWidth > window.innerHeight) {
          angle = 90;
        }

        let tiltDeg = gamma;
        if (angle === 90) {
          tiltDeg = beta;
        } else if (angle === -90 || angle === 270) {
          tiltDeg = -beta;
        } else if (angle === 180) {
          tiltDeg = -gamma;
        } else if (window.innerWidth > window.innerHeight && Math.abs(beta) > Math.abs(gamma)) {
          tiltDeg = beta;
        }

        const deadzone = 1.2;
        let normalized = 0;
        if (Math.abs(tiltDeg) > deadzone) {
          const effective = tiltDeg - Math.sign(tiltDeg) * deadzone;
          normalized = Math.max(-1, Math.min(1, effective / 22));
        }

        setTiltSteerInput(normalized);
        applySteerValue(normalized, true);
      };

      window.addEventListener('deviceorientation', handleOrientation, true);
      return () => {
        window.removeEventListener('deviceorientation', handleOrientation, true);
      };
    }, [visible, steerMode, applySteerValue]);

    useEffect(() => {
      const resetAll = () => {
        activeWheelSessionRef.current = null;
        setIsWheelHeld(false);
        setTiltSteerInput(0);
        setLeftBtnHeld(false);
        setRightBtnHeld(false);
        setThrottleHeld(false);
        setBrakeHeld(false);
        setNitroHeld(false);
        touchInputRef.current.steerInput = 0;
        touchInputRef.current.left = false;
        touchInputRef.current.right = false;
        touchInputRef.current.throttle = false;
        touchInputRef.current.brake = false;
        touchInputRef.current.nitro = false;
        touchInputRef.current.lookBack = false;
      };
      window.addEventListener('blur', resetAll);
      return () => window.removeEventListener('blur', resetAll);
    }, [touchInputRef]);

    if (!visible) return null;

    // Natural Polar & Cartesian Virtual Steering Wheel Physics:
    // Natural Relative Virtual Steering Wheel Physics:
    // - Never jumps on initial finger touch down
    // - Follows finger rotation & drag progressively with fine center deadzone
    // - Perfectly linear, predictable, and responsive without jumping or drift
    const updateWheelFromMove = (clientX: number, clientY: number) => {
      const session = activeWheelSessionRef.current;
      if (!session) return;

      const r = session.radius;
      session.prevX = clientX;
      session.prevY = clientY;

      // Rotation maximale du volant (rad) correspondant à un braquage complet.
      const LOCK_ANGLE = Math.PI * 0.65;

      let combinedDelta: number;
      if (session.useSwipe) {
        // Doigt posé près du centre : l'angle n'est pas fiable, on suit le balayage horizontal.
        combinedDelta = (clientX - session.startPointerX) / (r * 0.95);
      } else {
        // Rotation CONTINUE : on additionne de petits écarts d'angle entre deux mouvements.
        // Contrairement à un angle comparé au point de départ, il n'y a aucun repli à ±180°,
        // donc le volant ne bascule jamais de l'autre côté quand on tourne trop.
        const dxNow = clientX - session.centerX;
        const dyNow = clientY - session.centerY;
        if (dxNow * dxNow + dyNow * dyNow > 12 * 12) {
          const angleNow = Math.atan2(dxNow, -dyNow);
          let step = angleNow - session.prevAngle;
          while (step > Math.PI) step -= Math.PI * 2;
          while (step < -Math.PI) step += Math.PI * 2;
          session.prevAngle = angleNow;
          // On borne le cumul : si on tourne au-delà du braquage max, revenir est immédiat.
          session.accumAngle = Math.max(-LOCK_ANGLE, Math.min(LOCK_ANGLE, session.accumAngle + step));
        }
        combinedDelta = session.accumAngle / LOCK_ANGLE;
      }

      let targetSteer = Math.max(-1, Math.min(1, session.startSteer + combinedDelta));

      // Deadzone around dead center for rock-solid straight highway cruising
      if (Math.abs(targetSteer) < 0.035) {
        targetSteer = 0;
      }

      session.currentSteer = targetSteer;
      applySteerValue(targetSteer);
    };

    const handleWheelPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      soundEngine.init();

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture is unavailable
      }

      const el = wheelRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const radius = Math.max(54, rect.width / 2);

      // Always start seamlessly without any sudden spike: start neutral at 0
      const startSteer = 0;

      activeWheelSessionRef.current = {
        pointerId: e.pointerId,
        centerX,
        centerY,
        prevX: e.clientX,
        prevY: e.clientY,
        startPointerX: e.clientX,
        startPointerY: e.clientY,
        startSteer,
        radius,
        currentSteer: startSteer,
        prevAngle: Math.atan2(e.clientX - centerX, -(e.clientY - centerY)),
        accumAngle: 0,
        useSwipe: Math.hypot(e.clientX - centerX, e.clientY - centerY) < radius * 0.3,
      };
      setIsWheelHeld(true);
      applySteerValue(startSteer);
    };

    const handleWheelPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      const session = activeWheelSessionRef.current;
      if (!session || session.pointerId !== e.pointerId) return;
      e.preventDefault();
      updateWheelFromMove(e.clientX, e.clientY);
    };

    const handleWheelPointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
      const session = activeWheelSessionRef.current;
      if (!session || session.pointerId !== e.pointerId) return;
      activeWheelSessionRef.current = null;
      setIsWheelHeld(false);
      applySteerValue(0);
    };

    const activeRatio =
      steerMode === 'tilt'
        ? tiltSteerInput
        : steerMode === 'buttons'
        ? (rightBtnHeld ? 1 : 0) - (leftBtnHeld ? 1 : 0)
        : isWheelHeld
        ? activeWheelSessionRef.current?.currentSteer ?? 0
        : steerRatio;

    const visualAngleDeg = Math.max(-MAX_WHEEL_DEG, Math.min(MAX_WHEEL_DEG, activeRatio * MAX_WHEEL_DEG));
    const gearLabel = gear === -1 ? 'R' : String(gear);

    return (
      <div
        onContextMenu={(e) => e.preventDefault()}
        className="fixed inset-x-0 bottom-0 z-20 pointer-events-none px-3 pb-2.5 pt-1 sm:px-6 sm:pb-4 flex items-end justify-between select-none touch-none"
      >
        {/* BOTTOM-LEFT: Mode Selector (Volant / Incliner / Flèches) + Ultra-Realistic GT Steering Wheel */}
        <div className="flex flex-col items-center pointer-events-auto touch-none">
          {/* Quick Steering Mode Switcher: Volant | Incliner (Gyro) | Flèches */}
          <div className="flex items-center gap-1 bg-slate-950/85 border border-white/25 rounded-xl p-1 mb-2 shadow-xl">
            <button
              type="button"
              onClick={() => handleSelectSteerMode('wheel')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-display font-bold flex items-center gap-1 transition-all ${
                steerMode === 'wheel'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <Disc className="w-3 h-3" />
              <span>VOLANT</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectSteerMode('tilt')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-display font-bold flex items-center gap-1 transition-all ${
                steerMode === 'tilt'
                  ? 'bg-cyan-400 text-slate-950 shadow'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <Compass className="w-3 h-3" />
              <span>INCLINER</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectSteerMode('buttons')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-display font-bold flex items-center gap-1 transition-all ${
                steerMode === 'buttons'
                  ? 'bg-emerald-400 text-slate-950 shadow'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <ArrowLeftRight className="w-3 h-3" />
              <span>FLÈCHES</span>
            </button>
          </div>

          {transmission === 'manual' && (
            <div className="flex items-center gap-2 mb-1.5">
              <button
                type="button"
                onClick={() => {
                  soundEngine.init();
                  touchInputRef.current.shiftDownQueued = true;
                }}
                aria-label="Rétrograder vitesse (-)"
                className="px-3 py-1 rounded-xl bg-slate-950/80 border border-white/35 active:scale-95 text-white font-display font-bold text-xs flex items-center gap-1 shadow-lg"
              >
                <span>−</span>
                <span className="text-[10px] text-slate-300">RAPPORT</span>
              </button>
              <div className="px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-300 font-mono-num font-bold text-xs">
                M{gearLabel}
              </div>
              <button
                type="button"
                onClick={() => {
                  soundEngine.init();
                  touchInputRef.current.shiftUpQueued = true;
                }}
                aria-label="Monter vitesse (+)"
                className="px-3 py-1 rounded-xl bg-slate-950/80 border border-white/35 active:scale-95 text-white font-display font-bold text-xs flex items-center gap-1 shadow-lg"
              >
                <span className="text-[10px] text-slate-300">RAPPORT</span>
                <span>+</span>
              </button>
            </div>
          )}

          {steerMode === 'buttons' ? (
            /* Large Responsive Left / Right Steering Buttons */
            <div className="flex items-center gap-3.5 py-3">
              <button
                type="button"
                aria-label="Tourner à gauche"
                onPointerDown={(e) => {
                  e.preventDefault();
                  soundEngine.init();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setLeftBtnHeld(true);
                  touchInputRef.current.left = true;
                  touchInputRef.current.steerInput = -1;
                }}
                onPointerUp={() => {
                  setLeftBtnHeld(false);
                  touchInputRef.current.left = false;
                  touchInputRef.current.steerInput = rightBtnHeld ? 1 : 0;
                }}
                onPointerCancel={() => {
                  setLeftBtnHeld(false);
                  touchInputRef.current.left = false;
                  touchInputRef.current.steerInput = 0;
                }}
                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-[3px] flex items-center justify-center transition-transform touch-none shadow-xl ${
                  leftBtnHeld
                    ? 'bg-emerald-500/40 border-emerald-300 scale-95'
                    : 'bg-slate-950/65 border-white/75'
                }`}
              >
                <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="18,4 6,12 18,20" />
                </svg>
              </button>

              <button
                type="button"
                aria-label="Tourner à droite"
                onPointerDown={(e) => {
                  e.preventDefault();
                  soundEngine.init();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setRightBtnHeld(true);
                  touchInputRef.current.right = true;
                  touchInputRef.current.steerInput = 1;
                }}
                onPointerUp={() => {
                  setRightBtnHeld(false);
                  touchInputRef.current.right = false;
                  touchInputRef.current.steerInput = leftBtnHeld ? -1 : 0;
                }}
                onPointerCancel={() => {
                  setRightBtnHeld(false);
                  touchInputRef.current.right = false;
                  touchInputRef.current.steerInput = 0;
                }}
                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-[3px] flex items-center justify-center transition-transform touch-none shadow-xl ${
                  rightBtnHeld
                    ? 'bg-emerald-500/40 border-emerald-300 scale-95'
                    : 'bg-slate-950/65 border-white/75'
                }`}
              >
                <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="6,4 18,12 6,20" />
                </svg>
              </button>
            </div>
          ) : (
            /* Ultra-Realistic GT3 Carbon & Alcantara Sport Steering Wheel */
            <div
              ref={wheelRef}
              role="slider"
              aria-label="Volant de direction"
              aria-valuemin={-100}
              aria-valuemax={100}
              aria-valuenow={Math.round(activeRatio * 100)}
              onPointerDown={handleWheelPointerDown}
              onPointerMove={handleWheelPointerMove}
              onPointerUp={handleWheelPointerUpOrCancel}
              onPointerCancel={handleWheelPointerUpOrCancel}
              className={`relative w-40 h-40 sm:w-48 sm:h-48 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing touch-none ${
                isWheelHeld ? 'scale-[1.03]' : ''
              }`}
            >
              {/* Outer Touch Guidance Halo */}
              <div
                className={`absolute inset-0 rounded-full border-2 pointer-events-none transition-colors ${
                  isWheelHeld
                    ? 'border-amber-400/85 bg-amber-400/10 shadow-[0_0_24px_rgba(245,158,11,0.3)]'
                    : steerMode === 'tilt'
                    ? 'border-cyan-400/65 bg-cyan-400/10'
                    : 'border-white/25 bg-slate-950/30'
                }`}
              />

              {/* Rotating 3D-Shaded GT Supercar Steering Wheel SVG */}
              <div
                ref={wheelSvgContainerRef}
                style={{
                  transform: `rotate(${visualAngleDeg.toFixed(1)}deg)`,
                  transition:
                    isWheelHeld || steerMode === 'tilt'
                      ? 'none'
                      : 'transform 170ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                className="w-full h-full flex items-center justify-center pointer-events-none drop-shadow-[0_10px_18px_rgba(0,0,0,0.75)]"
              >
                <svg viewBox="0 0 240 240" className="w-full h-full">
                  <defs>
                    {/* 3D Leather & Carbon Rim Gradient */}
                    <radialGradient id="gtRimGrad" cx="50%" cy="45%" r="52%">
                      <stop offset="68%" stopColor="#0f172a" />
                      <stop offset="78%" stopColor="#334155" />
                      <stop offset="86%" stopColor="#475569" />
                      <stop offset="94%" stopColor="#1e293b" />
                      <stop offset="100%" stopColor="#090d16" />
                    </radialGradient>

                    {/* Brushed Gunmetal Aluminum Spoke Gradient */}
                    <linearGradient id="gtAlloyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#e2e8f0" />
                      <stop offset="45%" stopColor="#94a3b8" />
                      <stop offset="75%" stopColor="#475569" />
                      <stop offset="100%" stopColor="#1e293b" />
                    </linearGradient>

                    {/* Center Carbon Airbag Hub Gradient */}
                    <radialGradient id="gtHubGrad" cx="45%" cy="38%" r="60%">
                      <stop offset="0%" stopColor="#334155" />
                      <stop offset="60%" stopColor="#1e293b" />
                      <stop offset="100%" stopColor="#090d16" />
                    </radialGradient>
                  </defs>

                  {/* Left & Right Shift Paddles ("-" and "+") behind the Horizontal Spokes */}
                  <g opacity="0.92">
                    <path
                      d="M 52 62 L 66 56 L 69 112 L 52 106 Z"
                      fill="#1e293b"
                      stroke="#94a3b8"
                      strokeWidth="1.5"
                    />
                    <text
                      x="60"
                      y="86"
                      textAnchor="middle"
                      fill="#f87171"
                      fontSize="15"
                      fontWeight="900"
                    >
                      −
                    </text>

                    <path
                      d="M 188 62 L 174 56 L 171 112 L 188 106 Z"
                      fill="#1e293b"
                      stroke="#94a3b8"
                      strokeWidth="1.5"
                    />
                    <text
                      x="180"
                      y="86"
                      textAnchor="middle"
                      fill="#38bdf8"
                      fontSize="14"
                      fontWeight="900"
                    >
                      +
                    </text>
                  </g>

                  {/* Main Sculpted Outer Leather/Carbon Wheel Rim */}
                  <circle
                    cx="120"
                    cy="120"
                    r="95"
                    fill="none"
                    stroke="url(#gtRimGrad)"
                    strokeWidth="26"
                  />

                  {/* Outer Specular Rim Highlight & Inner Red Stitching Ring */}
                  <circle
                    cx="120"
                    cy="120"
                    r="107"
                    fill="none"
                    stroke="rgba(226, 232, 240, 0.55)"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx="120"
                    cy="120"
                    r="82.5"
                    fill="none"
                    stroke="rgba(239, 68, 68, 0.65)"
                    strokeWidth="1.4"
                    strokeDasharray="4 4"
                  />

                  {/* Perforated Alcantara Side Grip Zones (Left & Right 9-and-3 Bolsters) */}
                  <path
                    d="M 31 82 A 95 95 0 0 0 31 158"
                    fill="none"
                    stroke="rgba(15, 23, 42, 0.85)"
                    strokeWidth="22"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 209 82 A 95 95 0 0 1 209 158"
                    fill="none"
                    stroke="rgba(15, 23, 42, 0.85)"
                    strokeWidth="22"
                    strokeLinecap="round"
                  />

                  {/* Sculpted Brushed-Aluminum 3-Spoke Core Frame */}
                  <path
                    d="M 36 110 C 66 104, 82 104, 96 108 L 96 132 C 80 132, 62 136, 38 140 Z"
                    fill="url(#gtAlloyGrad)"
                    stroke="#0f172a"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M 204 110 C 174 104, 158 104, 144 108 L 144 132 C 160 132, 178 136, 202 140 Z"
                    fill="url(#gtAlloyGrad)"
                    stroke="#0f172a"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M 103 142 L 137 142 L 131 204 L 109 204 Z"
                    fill="url(#gtAlloyGrad)"
                    stroke="#0f172a"
                    strokeWidth="1.5"
                  />

                  {/* Spoke Cutout Slots for Authentic GT3 Lightweight Look */}
                  <rect x="52" y="117" width="24" height="7" rx="3.5" fill="#0f172a" />
                  <rect x="164" y="117" width="24" height="7" rx="3.5" fill="#0f172a" />
                  <rect x="115.5" y="162" width="9" height="26" rx="4" fill="#0f172a" />

                  {/* Rotary Manettino Drive Mode Dials on Left & Right Spokes */}
                  <circle cx="84" cy="120" r="6" fill="#dc2626" stroke="#f8fafc" strokeWidth="1.2" />
                  <circle cx="156" cy="120" r="6" fill="#0284c7" stroke="#f8fafc" strokeWidth="1.2" />

                  {/* Top Carbon-Fiber Telemetry Shift-Light LED Array + 12-o'clock Racing Stripe */}
                  <circle cx="98" cy="27" r="2.6" fill="#22c55e" />
                  <circle cx="106" cy="25.5" r="2.6" fill="#22c55e" />
                  <circle cx="134" cy="25.5" r="2.6" fill="#f59e0b" />
                  <circle cx="142" cy="27" r="2.6" fill="#ef4444" />

                  {/* Red / Amber 12-O'Clock Center Alignment Band */}
                  <rect
                    x="113"
                    y="12"
                    width="14"
                    height="26"
                    rx="3"
                    fill="#ef4444"
                    stroke="#fef08a"
                    strokeWidth="1.5"
                  />

                  {/* Central Sculpted Airbag Hub & Chrome/Gold GT Crest */}
                  <circle
                    cx="120"
                    cy="122"
                    r="32"
                    fill="url(#gtHubGrad)"
                    stroke="#94a3b8"
                    strokeWidth="2.5"
                  />
                  <circle
                    cx="120"
                    cy="122"
                    r="25"
                    fill="none"
                    stroke="rgba(248, 250, 252, 0.25)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  {/* Shield Crest inside Hub */}
                  <polygon
                    points="120,104 133,110 130,129 120,137 110,129 107,110"
                    fill="#f59e0b"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  <polygon
                    points="120,109 127,113 125,126 120,131 115,126 113,113"
                    fill="#0f172a"
                  />
                </svg>
              </div>
            </div>
          )}

          {/* Live Steering Angle Indicator Bar under the Wheel */}
          <div className="flex items-center gap-3 mt-1 opacity-90 pointer-events-none bg-slate-950/70 px-2.5 py-0.5 rounded-full border border-white/15">
            <svg
              ref={leftIndicatorRef}
              className="w-3.5 h-3.5 transition-transform"
              style={{ color: activeRatio < -0.08 ? '#f59e0b' : 'rgba(255,255,255,0.6)' }}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <polygon points="19,4 7,12 19,20" />
            </svg>
            <span
              ref={steerPercentTextRef}
              className="text-[10px] font-mono-num font-bold text-white/95 min-w-[54px] text-center"
            >
              {steerMode === 'tilt'
                ? 'GYRO ACTIF'
                : Math.round(activeRatio * 100) === 0
                ? '0° CENTRE'
                : `${activeRatio > 0 ? '+' : ''}${Math.round(activeRatio * MAX_WHEEL_DEG)}°`}
            </span>
            <svg
              ref={rightIndicatorRef}
              className="w-3.5 h-3.5 transition-transform"
              style={{ color: activeRatio > 0.08 ? '#f59e0b' : 'rgba(255,255,255,0.6)' }}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <polygon points="5,4 17,12 5,20" />
            </svg>
          </div>
        </div>

        {/* BOTTOM-RIGHT: Rétablir (Unstick) + Turbo [N] + Brake/Reverse & Accelerator Pedals */}
        <div className="flex flex-col items-end gap-2.5 pointer-events-auto touch-none">
          <div className="flex items-center gap-2 mr-0.5">
            <button
              type="button"
              onClick={() => {
                soundEngine.init();
                touchInputRef.current.respawnQueued = true;
              }}
              title="Rétablir la voiture sur la piste en cas d'accident (Touche R)"
              aria-label="Rétablir la voiture sur la piste"
              className="px-2.5 py-1.5 rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-amber-400/80 active:scale-95 text-amber-300 text-[10px] font-display font-bold flex items-center gap-1.5 shadow-xl transition-all pointer-events-auto"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>RÉTABLIR</span>
            </button>

            <button
              type="button"
              aria-label="Activer Turbo NOS"
              onPointerDown={(e) => {
                e.preventDefault();
                soundEngine.init();
                e.currentTarget.setPointerCapture(e.pointerId);
                setNitroHeld(true);
                touchInputRef.current.nitro = true;
              }}
              onPointerUp={() => {
                setNitroHeld(false);
                touchInputRef.current.nitro = false;
              }}
              onPointerCancel={() => {
                setNitroHeld(false);
                touchInputRef.current.nitro = false;
              }}
              className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center border-[3px] shadow-lg transition-transform touch-none ${
                nitroHeld || nitroActive
                  ? 'bg-cyan-400/45 border-cyan-300 scale-95'
                  : nitroAmount > 10
                  ? 'bg-slate-950/60 border-cyan-300/90 hover:bg-white/15'
                  : 'bg-black/30 border-white/35 opacity-60'
              }`}
            >
              <span
                className="font-display font-black text-lg sm:text-xl tracking-tight text-white drop-shadow"
                style={{ WebkitTextStroke: '1px #0f172a' }}
              >
                N
              </span>
            </button>
          </div>

          {/* Brake/Reverse (Left, Wide) & Accelerator (Right, Tall) */}
          <div className="flex items-end gap-3.5 sm:gap-5">
            <button
              type="button"
              aria-label="Pédale de frein et marche arrière"
              onPointerDown={(e) => {
                e.preventDefault();
                soundEngine.init();
                e.currentTarget.setPointerCapture(e.pointerId);
                setBrakeHeld(true);
                touchInputRef.current.brake = true;
              }}
              onPointerUp={() => {
                setBrakeHeld(false);
                touchInputRef.current.brake = false;
              }}
              onPointerCancel={() => {
                setBrakeHeld(false);
                touchInputRef.current.brake = false;
              }}
              className={`relative w-20 h-20 sm:w-24 sm:h-22 rounded-xl border-[3px] flex flex-col items-center justify-between p-2 transition-transform touch-none ${
                brakeHeld
                  ? 'bg-red-500/45 border-red-300 scale-95 translate-y-0.5'
                  : 'bg-slate-950/55 border-white/80 hover:border-white'
              }`}
            >
              <div className="w-full flex flex-col gap-1.5 mt-1 opacity-75">
                <div className="h-1 w-full rounded-full bg-white/80" />
                <div className="h-1 w-full rounded-full bg-white/80" />
              </div>
              <span className="text-[10px] font-bold tracking-wider text-white drop-shadow text-center leading-tight">
                {gear === -1 ? 'RECULER' : 'FREIN / REC.'}
              </span>
            </button>

            <button
              type="button"
              aria-label="Pédale d'accélérateur"
              onPointerDown={(e) => {
                e.preventDefault();
                soundEngine.init();
                e.currentTarget.setPointerCapture(e.pointerId);
                setThrottleHeld(true);
                touchInputRef.current.throttle = true;
              }}
              onPointerUp={() => {
                setThrottleHeld(false);
                touchInputRef.current.throttle = false;
              }}
              onPointerCancel={() => {
                setThrottleHeld(false);
                touchInputRef.current.throttle = false;
              }}
              className={`relative w-16 h-32 sm:w-20 sm:h-36 rounded-2xl border-[3px] flex flex-col items-center justify-between p-2.5 transition-transform touch-none ${
                throttleHeld
                  ? 'bg-emerald-500/45 border-emerald-300 scale-95 translate-y-0.5'
                  : 'bg-slate-950/55 border-white/80 hover:border-white'
              }`}
            >
              <div className="w-full flex flex-col gap-2 mt-1.5 opacity-75">
                <div className="h-1 w-full rounded-full bg-white/80" />
                <div className="h-1 w-full rounded-full bg-white/80" />
                <div className="h-1 w-full rounded-full bg-white/80" />
              </div>
              <span className="text-[11px] font-bold tracking-wider text-white drop-shadow">
                GAZ
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }
);
