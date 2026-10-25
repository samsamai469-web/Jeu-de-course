import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TouchInputState } from './RacingCanvas';
import { ShifterPosition, TransmissionType } from '../types/game';
import { soundEngine } from '../audio/soundEngine';
import { Compass, Disc, ArrowLeftRight, RotateCcw, Footprints } from 'lucide-react';

export type SteerMode = 'wheel' | 'tilt' | 'buttons';

interface TouchControlsProps {
  touchInputRef: React.MutableRefObject<TouchInputState>;
  visible: boolean;
  nitroAmount: number;
  nitroActive: boolean;
  steerRatio: number; // -1 (left) to +1 (right) from physics for visual sync
  transmission: TransmissionType;
  gear: number;
  shifterPos?: ShifterPosition;
  handbrakePulled?: boolean;
  isWalking?: boolean;
}

const STORAGE_STEER_MODE_KEY = 'apex_horizon_steer_mode_v1';
const MAX_WHEEL_DEG = 150;
const SHIFTER_STEPS: ShifterPosition[] = ['P', 'R', 'N', 'D'];

export const TouchControls: React.FC<TouchControlsProps> = React.memo(
  ({
    touchInputRef,
    visible,
    nitroAmount,
    nitroActive,
    steerRatio,
    transmission,
    gear,
    shifterPos = 'D',
    handbrakePulled = false,
    isWalking = false,
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

    const startForwardThrottle = () => {
      soundEngine.init();
      setThrottleHeld(true);
      setBrakeHeld(false);
      touchInputRef.current.throttle = true;
      touchInputRef.current.brake = false;
      touchInputRef.current.shifterPos = 'D';
      touchInputRef.current.handbrake = false;
    };

    const stopForwardThrottle = () => {
      setThrottleHeld(false);
      touchInputRef.current.throttle = false;
    };

    const startBrakeReverse = () => {
      soundEngine.init();
      setBrakeHeld(true);
      setThrottleHeld(false);
      touchInputRef.current.brake = true;
      touchInputRef.current.throttle = false;
      touchInputRef.current.handbrake = false;
    };

    const stopBrakeReverse = () => {
      setBrakeHeld(false);
      touchInputRef.current.brake = false;
    };

    return (
      <div
        onContextMenu={(e) => e.preventDefault()}
        className="fixed inset-x-0 bottom-0 z-20 pointer-events-none px-2 pb-2 pt-1 sm:px-5 sm:pb-4 flex items-end justify-between gap-2 max-w-full overflow-hidden select-none touch-none"
      >
        {/* BOTTOM-LEFT: Mode Selector (Volant / Incliner / Flèches) + GT Steering Wheel */}
        <div className="flex flex-col items-center pointer-events-auto touch-none shrink-0">
          {/* Quick Steering Mode Switcher: Volant | Incliner (Gyro) | Flèches */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-950/85 border border-white/25 rounded-xl p-0.5 sm:p-1 mb-1.5 shadow-xl">
            <button
              type="button"
              onClick={() => handleSelectSteerMode('wheel')}
              className={`px-1.5 sm:px-2.5 py-1 rounded-lg text-[9px] sm:text-[10px] font-display font-bold flex items-center gap-1 transition-all whitespace-nowrap shrink-0 ${
                steerMode === 'wheel'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <Disc className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span>VOLANT</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectSteerMode('tilt')}
              className={`px-1.5 sm:px-2.5 py-1 rounded-lg text-[9px] sm:text-[10px] font-display font-bold flex items-center gap-1 transition-all whitespace-nowrap shrink-0 ${
                steerMode === 'tilt'
                  ? 'bg-cyan-400 text-slate-950 shadow'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <Compass className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span>INCLINER</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectSteerMode('buttons')}
              className={`px-1.5 sm:px-2.5 py-1 rounded-lg text-[9px] sm:text-[10px] font-display font-bold flex items-center gap-1 transition-all whitespace-nowrap shrink-0 ${
                steerMode === 'buttons'
                  ? 'bg-emerald-400 text-slate-950 shadow'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <ArrowLeftRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span>FLÈCHES</span>
            </button>
          </div>

          {transmission === 'manual' && !isWalking && (
            <div className="flex items-center gap-1.5 mb-1">
              <button
                type="button"
                onClick={() => {
                  soundEngine.init();
                  touchInputRef.current.shiftDownQueued = true;
                }}
                aria-label="Rétrograder vitesse (-)"
                className="px-2.5 py-0.5 rounded-xl bg-slate-950/80 border border-white/35 active:scale-95 text-white font-display font-bold text-xs flex items-center gap-1 shadow-lg whitespace-nowrap shrink-0"
              >
                <span>−</span>
                <span className="text-[9px] text-slate-300">RAPPORT</span>
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
                className="px-2.5 py-0.5 rounded-xl bg-slate-950/80 border border-white/35 active:scale-95 text-white font-display font-bold text-xs flex items-center gap-1 shadow-lg whitespace-nowrap shrink-0"
              >
                <span className="text-[9px] text-slate-300">RAPPORT</span>
                <span>+</span>
              </button>
            </div>
          )}

          {steerMode === 'buttons' ? (
            <div className="flex items-center gap-2 sm:gap-3.5 py-2">
              <button
                type="button"
                aria-label="Tourner à gauche"
                onPointerDown={(e) => {
                  soundEngine.init();
                  setLeftBtnHeld(true);
                  touchInputRef.current.left = true;
                  touchInputRef.current.steerInput = -1;
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    // Ignore capture error
                  }
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
                onTouchStart={() => {
                  soundEngine.init();
                  setLeftBtnHeld(true);
                  touchInputRef.current.left = true;
                  touchInputRef.current.steerInput = -1;
                }}
                onTouchEnd={() => {
                  setLeftBtnHeld(false);
                  touchInputRef.current.left = false;
                  touchInputRef.current.steerInput = rightBtnHeld ? 1 : 0;
                }}
                onTouchCancel={() => {
                  setLeftBtnHeld(false);
                  touchInputRef.current.left = false;
                  touchInputRef.current.steerInput = 0;
                }}
                className={`w-16 h-16 sm:w-22 sm:h-22 rounded-2xl border-[3px] flex items-center justify-center transition-transform touch-none shadow-xl shrink-0 ${
                  leftBtnHeld
                    ? 'bg-emerald-500/40 border-emerald-300 scale-95'
                    : 'bg-slate-950/65 border-white/75'
                }`}
              >
                <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="18,4 6,12 18,20" />
                </svg>
              </button>

              <button
                type="button"
                aria-label="Tourner à droite"
                onPointerDown={(e) => {
                  soundEngine.init();
                  setRightBtnHeld(true);
                  touchInputRef.current.right = true;
                  touchInputRef.current.steerInput = 1;
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    // Ignore capture error
                  }
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
                onTouchStart={() => {
                  soundEngine.init();
                  setRightBtnHeld(true);
                  touchInputRef.current.right = true;
                  touchInputRef.current.steerInput = 1;
                }}
                onTouchEnd={() => {
                  setRightBtnHeld(false);
                  touchInputRef.current.right = false;
                  touchInputRef.current.steerInput = leftBtnHeld ? -1 : 0;
                }}
                onTouchCancel={() => {
                  setRightBtnHeld(false);
                  touchInputRef.current.right = false;
                  touchInputRef.current.steerInput = 0;
                }}
                className={`w-16 h-16 sm:w-22 sm:h-22 rounded-2xl border-[3px] flex items-center justify-center transition-transform touch-none shadow-xl shrink-0 ${
                  rightBtnHeld
                    ? 'bg-emerald-500/40 border-emerald-300 scale-95'
                    : 'bg-slate-950/65 border-white/75'
                }`}
              >
                <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="6,4 18,12 6,20" />
                </svg>
              </button>
            </div>
          ) : (
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
              className={`relative w-32 h-32 sm:w-44 sm:h-44 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing touch-none ${
                isWheelHeld ? 'scale-[1.03]' : ''
              }`}
            >
              <div
                className={`absolute inset-0 rounded-full border-2 pointer-events-none transition-colors ${
                  isWheelHeld
                    ? 'border-amber-400/85 bg-amber-400/10 shadow-[0_0_24px_rgba(245,158,11,0.3)]'
                    : steerMode === 'tilt'
                    ? 'border-cyan-400/65 bg-cyan-400/10'
                    : 'border-white/25 bg-slate-950/30'
                }`}
              />

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
                    <radialGradient id="gtRimGrad" cx="50%" cy="45%" r="52%">
                      <stop offset="68%" stopColor="#0f172a" />
                      <stop offset="78%" stopColor="#334155" />
                      <stop offset="86%" stopColor="#475569" />
                      <stop offset="94%" stopColor="#1e293b" />
                      <stop offset="100%" stopColor="#090d16" />
                    </radialGradient>

                    <linearGradient id="gtAlloyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#e2e8f0" />
                      <stop offset="45%" stopColor="#94a3b8" />
                      <stop offset="75%" stopColor="#475569" />
                      <stop offset="100%" stopColor="#1e293b" />
                    </linearGradient>

                    <radialGradient id="gtHubGrad" cx="45%" cy="38%" r="60%">
                      <stop offset="0%" stopColor="#334155" />
                      <stop offset="60%" stopColor="#1e293b" />
                      <stop offset="100%" stopColor="#090d16" />
                    </radialGradient>
                  </defs>

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

                  <circle
                    cx="120"
                    cy="120"
                    r="95"
                    fill="none"
                    stroke="url(#gtRimGrad)"
                    strokeWidth="26"
                  />

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

                  <rect x="52" y="117" width="24" height="7" rx="3.5" fill="#0f172a" />
                  <rect x="164" y="117" width="24" height="7" rx="3.5" fill="#0f172a" />
                  <rect x="115.5" y="162" width="9" height="26" rx="4" fill="#0f172a" />

                  <circle cx="84" cy="120" r="6" fill="#dc2626" stroke="#f8fafc" strokeWidth="1.2" />
                  <circle cx="156" cy="120" r="6" fill="#0284c7" stroke="#f8fafc" strokeWidth="1.2" />

                  <circle cx="98" cy="27" r="2.6" fill="#22c55e" />
                  <circle cx="106" cy="25.5" r="2.6" fill="#22c55e" />
                  <circle cx="134" cy="25.5" r="2.6" fill="#f59e0b" />
                  <circle cx="142" cy="27" r="2.6" fill="#ef4444" />

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
          <div className="flex items-center gap-2 mt-1 opacity-90 pointer-events-none bg-slate-950/70 px-2 py-0.5 rounded-full border border-white/15">
            <svg
              ref={leftIndicatorRef}
              className="w-3 h-3 transition-transform"
              style={{ color: activeRatio < -0.08 ? '#f59e0b' : 'rgba(255,255,255,0.6)' }}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <polygon points="19,4 7,12 19,20" />
            </svg>
            <span
              ref={steerPercentTextRef}
              className="text-[9px] sm:text-[10px] font-mono-num font-bold text-white/95 min-w-[48px] text-center"
            >
              {steerMode === 'tilt'
                ? 'GYRO ACTIF'
                : Math.round(activeRatio * 100) === 0
                ? '0° CENTRE'
                : `${activeRatio > 0 ? '+' : ''}${Math.round(activeRatio * MAX_WHEEL_DEG)}°`}
            </span>
            <svg
              ref={rightIndicatorRef}
              className="w-3 h-3 transition-transform"
              style={{ color: activeRatio > 0.08 ? '#f59e0b' : 'rgba(255,255,255,0.6)' }}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <polygon points="5,4 17,12 5,20" />
            </svg>
          </div>
        </div>

        {/* BOTTOM-RIGHT: Car Parking Multiplayer Shifter (P-R-N-D) + Handbrake ((P)) + Turbo [N] + Pedals */}
        <div className="flex flex-col items-end gap-1.5 sm:gap-2 pointer-events-auto touch-none shrink-0">
          {/* Top Action Row above Pedals: Rétablir, Frein à main ((P)), Turbo [N] */}
          <div className="flex items-center gap-1.5">
            {isWalking ? (
              <button
                type="button"
                onClick={() => {
                  soundEngine.init();
                  touchInputRef.current.toggleWalkQueued = true;
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 border border-white active:scale-95 text-slate-950 text-xs font-display font-extrabold flex items-center gap-1.5 shadow-xl transition-all whitespace-nowrap shrink-0"
              >
                <Footprints className="w-4 h-4" />
                <span>MONTER EN VOITURE</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.init();
                    touchInputRef.current.respawnQueued = true;
                  }}
                  title="Rétablir la voiture sur la piste (Touche R)"
                  aria-label="Rétablir la voiture sur la piste"
                  className="px-2 py-1 rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-amber-400/80 active:scale-95 text-amber-300 text-[9px] sm:text-[10px] font-display font-bold flex items-center gap-1 shadow-xl transition-all whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3 h-3 text-amber-400" />
                  <span>RÉTABLIR</span>
                </button>

                {/* Handbrake / Parking Brake Button ((P)) */}
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.init();
                    soundEngine.playSuspensionThud(0.5);
                    touchInputRef.current.handbrake = !touchInputRef.current.handbrake;
                  }}
                  title="Frein à main ((P)) (Touche P)"
                  aria-label="Frein à main"
                  className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex flex-col items-center justify-center border-2 shadow-lg transition-all touch-none shrink-0 ${
                    handbrakePulled
                      ? 'bg-red-600/85 border-red-300 text-white scale-95 shadow-red-500/40'
                      : 'bg-slate-950/80 border-red-400/70 text-red-400 hover:bg-slate-900'
                  }`}
                >
                  <span className="font-mono-num font-black text-[10px] sm:text-xs leading-none">((P))</span>
                  <span className="text-[7px] font-bold tracking-tighter">FREIN</span>
                </button>

                {/* Turbo NOS Button */}
                <button
                  type="button"
                  aria-label="Activer Turbo NOS"
                  onPointerDown={(e) => {
                    soundEngine.init();
                    setNitroHeld(true);
                    touchInputRef.current.nitro = true;
                    try {
                      e.currentTarget.setPointerCapture(e.pointerId);
                    } catch {
                      // Ignore capture error
                    }
                  }}
                  onPointerUp={() => {
                    setNitroHeld(false);
                    touchInputRef.current.nitro = false;
                  }}
                  onPointerCancel={() => {
                    setNitroHeld(false);
                    touchInputRef.current.nitro = false;
                  }}
                  onTouchStart={() => {
                    soundEngine.init();
                    setNitroHeld(true);
                    touchInputRef.current.nitro = true;
                  }}
                  onTouchEnd={() => {
                    setNitroHeld(false);
                    touchInputRef.current.nitro = false;
                  }}
                  onTouchCancel={() => {
                    setNitroHeld(false);
                    touchInputRef.current.nitro = false;
                  }}
                  className={`relative w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center border-[2.5px] shadow-lg transition-transform touch-none shrink-0 ${
                    nitroHeld || nitroActive
                      ? 'bg-cyan-400/45 border-cyan-300 scale-95'
                      : nitroAmount > 10
                      ? 'bg-slate-950/60 border-cyan-300/90 hover:bg-white/15'
                      : 'bg-black/30 border-white/35 opacity-60'
                  }`}
                >
                  <span
                    className="font-display font-black text-sm sm:text-base tracking-tight text-white drop-shadow"
                    style={{ WebkitTextStroke: '1px #0f172a' }}
                  >
                    N
                  </span>
                </button>
              </>
            )}
          </div>

          {/* Gearbox Selector Row (P - R - N - D) placed directly above the 2 Pedals so GAZ is never pushed off-screen */}
          {!isWalking && (
            <div
              aria-label="Boîte de vitesses P R N D"
              className="flex items-center bg-slate-950/90 border border-white/30 rounded-xl p-0.5 gap-1 shadow-xl"
            >
              {SHIFTER_STEPS.map((pos) => {
                const active = shifterPos === pos;
                const activeStyle =
                  pos === 'R'
                    ? 'bg-red-500 text-white border-red-200 shadow-md'
                    : pos === 'P'
                    ? 'bg-amber-500 text-slate-950 border-amber-200 shadow-md'
                    : pos === 'N'
                    ? 'bg-slate-300 text-slate-950 border-white shadow-md'
                    : 'bg-emerald-500 text-slate-950 border-emerald-200 shadow-md';

                return (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => {
                      soundEngine.init();
                      soundEngine.playGearShift(pos === 'D');
                      touchInputRef.current.shifterPos = pos;
                      if (pos === 'P') {
                        touchInputRef.current.handbrake = true;
                      } else {
                        touchInputRef.current.handbrake = false;
                      }
                    }}
                    className={`w-7 h-6 sm:w-8 sm:h-7 rounded-lg font-mono-num font-black text-[11px] sm:text-xs border flex items-center justify-center transition-all shrink-0 ${
                      active
                        ? `${activeStyle} scale-105`
                        : 'bg-slate-900/80 text-slate-400 border-white/10 hover:text-white'
                    }`}
                  >
                    {pos}
                  </button>
                );
              })}
            </div>
          )}

          {/* Main Pedals Row: Left = FREIN / RECUL (▼) | Right = AVANCER / GAZ (▲) */}
          <div className="flex items-end gap-2 sm:gap-3">
            {/* Brake / Reverse Pedal (Left) */}
            <button
              type="button"
              aria-label="Pédale de frein et marche arrière"
              onPointerDown={(e) => {
                startBrakeReverse();
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // Ignore capture error
                }
              }}
              onPointerUp={stopBrakeReverse}
              onPointerCancel={stopBrakeReverse}
              onTouchStart={startBrakeReverse}
              onTouchEnd={stopBrakeReverse}
              onTouchCancel={stopBrakeReverse}
              className={`relative w-16 h-20 sm:w-20 sm:h-24 rounded-xl border-[3px] flex flex-col items-center justify-between p-2 transition-transform touch-none shrink-0 shadow-xl ${
                brakeHeld
                  ? 'bg-red-500/55 border-red-300 scale-95 translate-y-0.5'
                  : 'bg-slate-950/75 border-red-400/80 hover:border-red-300'
              }`}
            >
              <div className="w-full flex flex-col gap-1 mt-0.5 opacity-80">
                <div className="h-1 w-full rounded-full bg-red-300/80" />
                <div className="h-1 w-full rounded-full bg-red-300/80" />
              </div>
              <span className="text-red-300 font-black text-xs leading-none">▼</span>
              <span className="text-[9px] sm:text-[10px] font-display font-extrabold tracking-tight text-white drop-shadow text-center leading-tight">
                {isWalking ? 'RECULER' : 'FREIN / RECUL'}
              </span>
            </button>

            {/* Accelerator / Forward Gas Pedal (Right, Tall, Always Forward!) */}
            <button
              type="button"
              aria-label="Pédale d'accélérateur pour avancer"
              onPointerDown={(e) => {
                startForwardThrottle();
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // Ignore capture error
                }
              }}
              onPointerUp={stopForwardThrottle}
              onPointerCancel={stopForwardThrottle}
              onTouchStart={startForwardThrottle}
              onTouchEnd={stopForwardThrottle}
              onTouchCancel={stopForwardThrottle}
              className={`relative w-20 h-28 sm:w-24 sm:h-36 rounded-2xl border-[3px] flex flex-col items-center justify-between p-2.5 transition-transform touch-none shrink-0 shadow-2xl ${
                throttleHeld
                  ? 'bg-emerald-500/65 border-emerald-200 scale-95 translate-y-0.5 shadow-emerald-500/40'
                  : 'bg-emerald-950/75 border-emerald-400 hover:border-emerald-300'
              }`}
            >
              <div className="w-full flex flex-col gap-1.5 mt-1 opacity-85">
                <div className="h-1 w-full rounded-full bg-emerald-300" />
                <div className="h-1 w-full rounded-full bg-emerald-300" />
                <div className="h-1 w-full rounded-full bg-emerald-300" />
              </div>
              <span className="text-emerald-300 font-black text-base sm:text-lg leading-none">▲</span>
              <span className="text-[10px] sm:text-xs font-display font-black tracking-wide text-white drop-shadow text-center leading-tight">
                {isWalking ? 'MARCHER' : 'AVANCER (GAZ)'}
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }
);
