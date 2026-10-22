import React, { useEffect, useRef, useState } from 'react';
import { TouchInputState } from './RacingCanvas';
import { TransmissionType } from '../types/game';
import { soundEngine } from '../audio/soundEngine';

interface TouchControlsProps {
  touchInputRef: React.MutableRefObject<TouchInputState>;
  visible: boolean;
  nitroAmount: number;
  nitroActive: boolean;
  steerRatio: number; // -1 (left) to +1 (right) from physics for visual sync
  transmission: TransmissionType;
  gear: number;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  touchInputRef,
  visible,
  nitroAmount,
  nitroActive,
  steerRatio,
  transmission,
  gear,
}) => {
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const activeWheelPointerRef = useRef<{
    pointerId: number;
    centerX: number;
    centerY: number;
    startX: number;
    startAngle: number;
  } | null>(null);

  const [isWheelHeld, setIsWheelHeld] = useState(false);
  const [wheelSteerInput, setWheelSteerInput] = useState(0); // -1 (left) to +1 (right)
  const [throttleHeld, setThrottleHeld] = useState(false);
  const [brakeHeld, setBrakeHeld] = useState(false);
  const [nitroHeld, setNitroHeld] = useState(false);

  useEffect(() => {
    const resetAll = () => {
      activeWheelPointerRef.current = null;
      setIsWheelHeld(false);
      setWheelSteerInput(0);
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

  const updateSteeringFromPointer = (clientX: number, clientY: number) => {
    const session = activeWheelPointerRef.current;
    if (!session) return;

    const dx = clientX - session.centerX;
    const dy = clientY - session.centerY;
    const distFromCenter = Math.hypot(dx, dy);

    const slideDeltaX = (clientX - session.startX) / 60;
    const directOffsetX = dx / 65;

    let angleSteer = 0;
    if (distFromCenter > 14) {
      const currentAngle = Math.atan2(dx, -dy);
      let deltaAngle = currentAngle - session.startAngle;
      while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
      while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
      angleSteer = deltaAngle / 1.25;
    }

    const combined =
      distFromCenter > 22
        ? angleSteer * 0.65 + directOffsetX * 0.35
        : slideDeltaX * 0.5 + directOffsetX * 0.5;

    const clamped = Math.max(-1, Math.min(1, combined));
    setWheelSteerInput(clamped);
    touchInputRef.current.steerInput = clamped;
    touchInputRef.current.left = clamped < -0.08;
    touchInputRef.current.right = clamped > 0.08;
  };

  const handleWheelPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    soundEngine.init();
    const el = wheelRef.current;
    if (!el) return;

    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const startAngle = Math.atan2(dx, -dy);

    activeWheelPointerRef.current = {
      pointerId: e.pointerId,
      centerX,
      centerY,
      startX: e.clientX,
      startAngle,
    };
    setIsWheelHeld(true);
    updateSteeringFromPointer(e.clientX, e.clientY);
  };

  const handleWheelPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeWheelPointerRef.current || activeWheelPointerRef.current.pointerId !== e.pointerId) return;
    e.preventDefault();
    updateSteeringFromPointer(e.clientX, e.clientY);
  };

  const handleWheelPointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeWheelPointerRef.current || activeWheelPointerRef.current.pointerId !== e.pointerId) return;
    activeWheelPointerRef.current = null;
    setIsWheelHeld(false);
    setWheelSteerInput(0);
    touchInputRef.current.steerInput = 0;
    touchInputRef.current.left = false;
    touchInputRef.current.right = false;
  };

  const activeRatio = isWheelHeld ? wheelSteerInput : steerRatio;
  const visualAngleDeg = Math.max(-130, Math.min(130, activeRatio * 125));
  const gearLabel = gear === -1 ? 'R' : String(gear);

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="fixed inset-x-0 bottom-0 z-20 pointer-events-none px-4 pb-3 pt-2 sm:px-6 sm:pb-5 flex items-end justify-between select-none touch-none"
    >
      {/* BOTTOM-LEFT: Translucent Virtual Circular Steering Wheel + Sequential Paddle Shifters (if Manual) */}
      <div className="flex flex-col items-center pointer-events-auto touch-none">
        {transmission === 'manual' && (
          <div className="flex items-center gap-2.5 mb-2">
            <button
              type="button"
              onClick={() => {
                soundEngine.init();
                touchInputRef.current.shiftDownQueued = true;
              }}
              aria-label="Rétrograder vitesse (-)"
              className="px-3.5 py-1.5 rounded-xl bg-slate-950/75 hover:bg-slate-900 border border-white/35 active:scale-95 text-white font-display font-bold text-xs flex items-center gap-1 shadow-lg whitespace-nowrap shrink-0"
            >
              <span>−</span>
              <span className="text-[10px] text-slate-300">RAPPORT</span>
            </button>
            <div className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-300 font-mono-num font-bold text-xs">
              M{gearLabel}
            </div>
            <button
              type="button"
              onClick={() => {
                soundEngine.init();
                touchInputRef.current.shiftUpQueued = true;
              }}
              aria-label="Monter vitesse (+)"
              className="px-3.5 py-1.5 rounded-xl bg-slate-950/75 hover:bg-slate-900 border border-white/35 active:scale-95 text-white font-display font-bold text-xs flex items-center gap-1 shadow-lg whitespace-nowrap shrink-0"
            >
              <span className="text-[10px] text-slate-300">RAPPORT</span>
              <span>+</span>
            </button>
          </div>
        )}

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
          className={`relative w-36 h-36 sm:w-44 sm:h-44 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing touch-none ${
            isWheelHeld ? 'scale-[1.03]' : ''
          }`}
        >
          {/* Rotating Semi-Transparent 3-Spoke Steering Wheel SVG */}
          <div
            style={{
              transform: `rotate(${visualAngleDeg}deg)`,
              transition: isWheelHeld ? 'none' : 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className="w-full h-full flex items-center justify-center pointer-events-none drop-shadow-lg"
          >
            <svg viewBox="0 0 200 200" className="w-full h-full">
              <circle
                cx="100"
                cy="100"
                r="82"
                fill="none"
                stroke="rgba(148, 163, 184, 0.52)"
                strokeWidth="20"
              />
              <circle
                cx="100"
                cy="100"
                r="92"
                fill="none"
                stroke="rgba(255, 255, 255, 0.45)"
                strokeWidth="2"
              />
              <circle
                cx="100"
                cy="100"
                r="72"
                fill="none"
                stroke="rgba(255, 255, 255, 0.38)"
                strokeWidth="1.5"
              />

              {/* 3 Sculpted Translucent Spokes */}
              <path
                d="M 28 96 Q 60 92 78 96 L 78 112 Q 55 116 30 118 Z"
                fill="rgba(148, 163, 184, 0.55)"
              />
              <path
                d="M 172 96 Q 140 92 122 96 L 122 112 Q 145 116 170 118 Z"
                fill="rgba(148, 163, 184, 0.55)"
              />
              <path
                d="M 88 120 L 112 120 L 107 172 L 93 172 Z"
                fill="rgba(148, 163, 184, 0.55)"
              />

              {/* White Alignment Grip Markers on the Rim */}
              <rect x="96" y="8" width="8" height="20" rx="2" fill="rgba(255, 255, 255, 0.85)" />
              <rect
                x="22"
                y="156"
                width="8"
                height="18"
                rx="2"
                transform="rotate(35 26 165)"
                fill="rgba(255, 255, 255, 0.75)"
              />
              <rect
                x="170"
                y="156"
                width="8"
                height="18"
                rx="2"
                transform="rotate(-35 174 165)"
                fill="rgba(255, 255, 255, 0.75)"
              />

              {/* Center Hub Ring */}
              <circle
                cx="100"
                cy="102"
                r="26"
                fill="rgba(71, 85, 105, 0.48)"
                stroke="rgba(255, 255, 255, 0.75)"
                strokeWidth="4"
              />
              <circle cx="100" cy="102" r="14" fill="rgba(30, 41, 59, 0.55)" />
            </svg>
          </div>
        </div>

        {/* Turn Signal / Direction Indicators under the Steering Wheel */}
        <div className="flex items-center gap-5 mt-1 opacity-75 pointer-events-none">
          <svg className={`w-4 h-4 ${activeRatio < -0.15 ? 'text-emerald-400' : 'text-white'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polygon points="19,4 7,12 19,20" />
          </svg>
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polygon points="12,4 21,20 3,20" />
          </svg>
          <svg className={`w-4 h-4 ${activeRatio > 0.15 ? 'text-emerald-400' : 'text-white'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polygon points="5,4 17,12 5,20" />
          </svg>
        </div>
      </div>

      {/* BOTTOM-RIGHT: Circular [N] Turbo Button + Translucent Outline Brake & Accelerator Pedals */}
      <div className="flex flex-col items-end gap-4 pointer-events-auto touch-none">
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
          onPointerLeave={() => {
            setNitroHeld(false);
            touchInputRef.current.nitro = false;
          }}
          className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center border-[3.5px] shadow-lg transition-transform touch-none mr-1 ${
            nitroHeld || nitroActive
              ? 'bg-cyan-400/35 border-cyan-300 scale-95'
              : nitroAmount > 10
              ? 'bg-black/25 border-white/85 hover:bg-white/15'
              : 'bg-black/20 border-white/35 opacity-60'
          }`}
        >
          <span
            className="font-display font-black text-xl sm:text-2xl tracking-tight text-white drop-shadow"
            style={{ WebkitTextStroke: '1px #0f172a' }}
          >
            N
          </span>
        </button>

        {/* Two Translucent Outline Pedals: Brake (Left, Wide) & Accelerator (Right, Tall) */}
        <div className="flex items-end gap-4 sm:gap-6">
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
            onPointerLeave={() => {
              setBrakeHeld(false);
              touchInputRef.current.brake = false;
            }}
            className={`relative w-20 h-20 sm:w-24 sm:h-22 rounded-xl border-[3px] flex flex-col items-center justify-between p-2.5 transition-transform touch-none ${
              brakeHeld
                ? 'bg-red-500/35 border-red-300 scale-95 translate-y-0.5'
                : 'bg-white/10 border-white/75 hover:border-white'
            }`}
          >
            <div className="w-full flex flex-col gap-1.5 mt-1 opacity-65">
              <div className="h-1 w-full rounded-full bg-white/70" />
              <div className="h-1 w-full rounded-full bg-white/70" />
            </div>
            <span className="text-[10px] font-bold tracking-wider text-white/85 drop-shadow">
              FREIN
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
            onPointerLeave={() => {
              setThrottleHeld(false);
              touchInputRef.current.throttle = false;
            }}
            className={`relative w-16 h-32 sm:w-20 sm:h-36 rounded-2xl border-[3px] flex flex-col items-center justify-between p-2.5 transition-transform touch-none ${
              throttleHeld
                ? 'bg-emerald-500/35 border-emerald-300 scale-95 translate-y-0.5'
                : 'bg-white/10 border-white/75 hover:border-white'
            }`}
          >
            <div className="w-full flex flex-col gap-2 mt-1.5 opacity-65">
              <div className="h-1 w-full rounded-full bg-white/70" />
              <div className="h-1 w-full rounded-full bg-white/70" />
              <div className="h-1 w-full rounded-full bg-white/70" />
            </div>
            <span className="text-[10px] font-bold tracking-wider text-white/85 drop-shadow">
              GAZ
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
