import React, { useState } from 'react';
import {
  CAMERA_LABELS,
  CameraMode,
  GameMode,
  PARKING_CHALLENGES,
  TelemetryState,
  TIME_OF_DAY_LABELS,
  TimeOfDay,
  TRACKS,
  TrackSpec,
  WEATHER_LABELS,
  WeatherType,
} from '../types/game';
import { TouchInputState } from './RacingCanvas';
import { soundEngine } from '../audio/soundEngine';
import {
  Pause,
  Volume2,
  VolumeX,
  Video,
  Sun,
  Moon,
  Gamepad2,
  Settings,
  CloudRain,
  Eye,
  Smartphone,
  RotateCcw,
  Fuel,
  Footprints,
  Power,
  Lightbulb,
  TriangleAlert,
  Volume1,
} from 'lucide-react';

interface HUDProps {
  telemetry: TelemetryState;
  gameMode: GameMode;
  trackSpec: TrackSpec;
  soundEnabled: boolean;
  cameraMode: CameraMode;
  timeOfDay: TimeOfDay;
  dynamicDayNight: boolean;
  weather: WeatherType;
  rearViewMirror: boolean;
  showTouchControls: boolean;
  touchInputRef: React.MutableRefObject<TouchInputState>;
  parkingChallengeId?: number;
  playerMoney?: number;
  onPauseClick: () => void;
  onToggleSound: () => void;
  onCycleCamera: () => void;
  onSelectCamera?: (mode: CameraMode) => void;
  onToggleTouchControls: () => void;
  onCycleTimeOfDay: () => void;
  onToggleDynamicDayNight: () => void;
  onCycleWeather: () => void;
  onSelectLevel?: (track: TrackSpec) => void;
  onSelectParkingChallenge?: (id: number) => void;
}

export function formatRaceTime(seconds: number | null): string {
  if (seconds === null || Number.isNaN(seconds)) return '--:--.--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hundredths = Math.floor((seconds % 1) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

export function formatClock24h(dayTimeHours: number): string {
  const hNorm = ((dayTimeHours % 24) + 24) % 24;
  const hh = Math.floor(hNorm);
  const mm = Math.floor((hNorm - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export const HUD: React.FC<HUDProps> = ({
  telemetry,
  gameMode,
  trackSpec,
  soundEnabled,
  cameraMode,
  timeOfDay,
  dynamicDayNight,
  weather,
  rearViewMirror,
  showTouchControls,
  touchInputRef,
  parkingChallengeId = 1,
  playerMoney = 50000,
  onPauseClick,
  onToggleSound,
  onCycleCamera,
  onSelectCamera,
  onToggleTouchControls,
  onCycleTimeOfDay,
  onToggleDynamicDayNight,
  onCycleWeather,
  onSelectLevel,
  onSelectParkingChallenge,
}) => {
  const [lookBackHeld, setLookBackHeld] = useState(false);

  const activeParkingChallenge =
    PARKING_CHALLENGES.find((c) => c.id === parkingChallengeId) || PARKING_CHALLENGES[0];

  // Circular GPS Minimap (Top-Left)
  const renderCircularMinimap = () => {
    const pts = telemetry.minimapPoints;
    if (!pts || pts.length === 0) return null;

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }

    const pad = 32;
    minX -= pad;
    maxX += pad;
    minZ -= pad;
    maxZ += pad;
    const spanX = Math.max(1, maxX - minX);
    const spanZ = Math.max(1, maxZ - minZ);

    const toSvg = (x: number, z: number) => ({
      cx: ((x - minX) / spanX) * 100,
      cy: ((z - minZ) / spanZ) * 100,
    });

    const pathD =
      pts
        .map((p, idx) => {
          const { cx, cy } = toSvg(p.x, p.z);
          return `${idx === 0 ? 'M' : 'L'} ${cx.toFixed(1)} ${cy.toFixed(1)}`;
        })
        .join(' ');

    const playerSvg = toSvg(telemetry.playerPos.x, telemetry.playerPos.z);
    const headingDeg = (-telemetry.playerPos.heading * 180) / Math.PI;

    return (
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-black/55 border-2 border-white/30 overflow-hidden shadow-lg shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(226, 232, 240, 0.25)" strokeWidth="4" />
          <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(226, 232, 240, 0.25)" strokeWidth="4" />
          <path d={pathD} fill="none" stroke="rgba(241, 245, 249, 0.78)" strokeWidth="8" strokeLinejoin="round" />
          <path d={pathD} fill="none" stroke="rgba(71, 85, 105, 0.6)" strokeWidth="1.5" strokeLinejoin="round" />

          {gameMode === 'exploration' &&
            telemetry.discoveryBeacons.map((b, idx) => {
              if (b.collected) return null;
              const pos = toSvg(b.x, b.z);
              return <circle key={idx} cx={pos.cx} cy={pos.cy} r="3.5" fill="#22c55e" stroke="#ffffff" strokeWidth="1" />;
            })}

          {telemetry.opponentsPos.map((op, idx) => {
            const pos = toSvg(op.x, op.z);
            return <circle key={idx} cx={pos.cx} cy={pos.cy} r="3.5" fill={op.color} stroke="#ffffff" strokeWidth="1" />;
          })}

          <g transform={`translate(${playerSvg.cx}, ${playerSvg.cy}) rotate(${headingDeg})`}>
            <polygon points="0,-6 5,5 0,2.5 -5,5" fill="#22c55e" stroke="#ffffff" strokeWidth="1.5" />
          </g>
        </svg>
      </div>
    );
  };

  // Top-Center Panoramic Rear-View Mirror ("Rétroviseur Central")
  const renderRearViewMirror = () => {
    if (!rearViewMirror) return null;

    const hClock = ((telemetry.dayTimeHours % 24) + 24) % 24;
    const isMirrorNight = hClock < 5.8 || hClock > 20.0;
    const isMirrorSunset = (hClock >= 5.8 && hClock < 7.2) || (hClock >= 17.5 && hClock <= 20.0);
    const skyColor =
      isMirrorNight
        ? '#090d16'
        : isMirrorSunset
        ? '#431407'
        : weather === 'rain' || weather === 'fog'
        ? '#334155'
        : '#1d4ed8';

    return (
      <div
        role="button"
        tabIndex={0}
        title="Maintenir pour regarder derrière (Touche B)"
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          setLookBackHeld(true);
          touchInputRef.current.lookBack = true;
        }}
        onPointerUp={() => {
          setLookBackHeld(false);
          touchInputRef.current.lookBack = false;
        }}
        onPointerCancel={() => {
          setLookBackHeld(false);
          touchInputRef.current.lookBack = false;
        }}
        onPointerLeave={() => {
          setLookBackHeld(false);
          touchInputRef.current.lookBack = false;
        }}
        className={`pointer-events-auto cursor-pointer select-none touch-none relative w-44 sm:w-64 h-12 sm:h-14 rounded-2xl border-2 overflow-hidden shadow-2xl transition-transform ${
          lookBackHeld || telemetry.lookingBack ? 'border-amber-400 scale-[1.03]' : 'border-slate-300/60 hover:border-white'
        }`}
      >
        <svg viewBox="0 0 240 56" className="w-full h-full">
          <rect x="0" y="0" width="240" height="24" fill={skyColor} />
          <rect x="0" y="24" width="240" height="32" fill="#2d3748" />
          <polygon points="95,24 145,24 225,56 15,56" fill="#1e242b" />
          <line x1="95" y1="24" x2="15" y2="56" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="145" y1="24" x2="225" y2="56" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="120" y1="24" x2="120" y2="56" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeDasharray="4 4" />

          {telemetry.rearOpponents.map((ro, idx) => {
            const depthRatio = Math.max(0, Math.min(1, 1 - ro.distanceMeters / 95));
            const carScale = 0.45 + depthRatio * 0.95;
            const cx = 120 + ro.lateralOffset * (32 + depthRatio * 48);
            const cy = 26 + depthRatio * 22;
            const w = 22 * carScale;
            const h = 11 * carScale;

            return (
              <g key={idx} transform={`translate(${cx}, ${cy})`}>
                <rect x={-w / 2} y={-h} width={w} height={h} rx={2 * carScale} fill={ro.color} stroke="#0f172a" strokeWidth="1" />
                <rect x={-w * 0.34} y={-h * 1.45} width={w * 0.68} height={h * 0.55} rx={1.5 * carScale} fill="#0f172a" />
                <circle cx={-w * 0.34} cy={-h * 0.45} r={1.8 * carScale} fill="#fef08a" />
                <circle cx={w * 0.34} cy={-h * 0.45} r={1.8 * carScale} fill="#fef08a" />
              </g>
            );
          })}
        </svg>

        <div className="absolute inset-x-0 bottom-0.5 flex items-center justify-between px-2.5 text-[9px] font-mono-num text-white/80 pointer-events-none">
          <span>RÉTROVISEUR</span>
          {telemetry.shifterPos === 'R' ? (
            <span className="text-red-400 font-bold">CAMÉRA RECUL [R]</span>
          ) : telemetry.rearOpponents.length > 0 ? (
            <span className="text-amber-300 font-semibold">
              −{Math.round(telemetry.rearOpponents[0].distanceMeters)} m
            </span>
          ) : (
            <span className="text-white/50">VOIE LIBRE</span>
          )}
        </div>
      </div>
    );
  };

  // Analog Tachometer + Digital Speedometer Dial + Fuel Level + Shifter Badge
  const renderTachometerDial = () => {
    const rpmClamped = Math.min(9000, Math.max(0, telemetry.rpm));
    const needleAngleDeg = -135 + (rpmClamped / 9000) * 270;
    const shifter = telemetry.shifterPos || 'D';
    const gearDisplay =
      shifter === 'P'
        ? 'P'
        : shifter === 'R'
        ? 'R'
        : shifter === 'N'
        ? 'N'
        : `D${Math.max(1, telemetry.gear)}`;

    const fuelPct = Math.round(telemetry.fuelPercent ?? 100);
    const tripValue = (telemetry.elapsedTime * 0.042 + 7.4).toFixed(1).padStart(6, '0');

    const ticks = [];
    for (let i = 0; i <= 45; i++) {
      const ratio = i / 45;
      const deg = -135 + ratio * 270;
      const rad = ((deg - 90) * Math.PI) / 180;
      const isMajor = i % 5 === 0;
      const isRedline = i >= 30;
      const rOuter = 82;
      const rInner = isMajor ? 70 : 75;
      const x1 = 100 + Math.cos(rad) * rInner;
      const y1 = 100 + Math.sin(rad) * rInner;
      const x2 = 100 + Math.cos(rad) * rOuter;
      const y2 = 100 + Math.sin(rad) * rOuter;

      ticks.push(
        <line
          key={`tick-${i}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={isRedline ? '#ef4444' : '#ffffff'}
          strokeWidth={isMajor ? '2.6' : '1.3'}
          strokeOpacity={isRedline ? 0.95 : 0.85}
        />
      );

      if (isMajor) {
        const num = i / 5;
        const rText = 58;
        const tx = 100 + Math.cos(rad) * rText;
        const ty = 100 + Math.sin(rad) * rText + 4;
        ticks.push(
          <text
            key={`num-${num}`}
            x={tx}
            y={ty}
            textAnchor="middle"
            fill={isRedline ? '#fca5a5' : '#f8fafc'}
            fontSize="12"
            fontWeight="700"
            fontFamily="sans-serif"
          >
            {num}
          </text>
        );
      }
    }

    return (
      <div className="flex items-end gap-2 pointer-events-none select-none">
        <div className="relative w-28 h-28 sm:w-36 sm:h-36 drop-shadow-lg">
          <svg viewBox="0 0 200 200" className="w-full h-full">
            <circle cx="100" cy="100" r="86" fill="rgba(15, 23, 42, 0.55)" stroke="rgba(255, 255, 255, 0.28)" strokeWidth="2" />

            {/* Blinking Turn Signal Arrows inside Instrument Cluster */}
            <polygon
              points="72,62 84,55 84,69"
              fill={telemetry.leftSignal || telemetry.hazardLights ? '#22c55e' : 'rgba(255,255,255,0.15)'}
            />
            <polygon
              points="128,62 116,55 116,69"
              fill={telemetry.rightSignal || telemetry.hazardLights ? '#22c55e' : 'rgba(255,255,255,0.15)'}
            />

            {ticks}

            <text
              x="100"
              y="102"
              textAnchor="middle"
              fill="#ffffff"
              fontSize="30"
              fontWeight="800"
              fontStyle="italic"
              fontFamily="sans-serif"
            >
              {telemetry.speedKmh}
            </text>
            <text
              x="100"
              y="116"
              textAnchor="middle"
              fill="rgba(241, 245, 249, 0.85)"
              fontSize="9.5"
              fontWeight="700"
              letterSpacing="0.8"
            >
              KM/H
            </text>

            <text
              x="100"
              y="134"
              textAnchor="middle"
              fill="#ffffff"
              fontSize="11"
              fontWeight="700"
              fontFamily="monospace"
            >
              {tripValue}
            </text>

            {/* Fuel Level Bar inside Tachometer */}
            <rect x="54" y="156" width="56" height="8" rx="4" fill="rgba(15,23,42,0.8)" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
            <rect
              x="55"
              y="157"
              width={Math.max(2, (54 * fuelPct) / 100)}
              height="6"
              rx="3"
              fill={fuelPct < 20 ? '#ef4444' : '#22c55e'}
            />
            <text x="82" y="152" textAnchor="middle" fill="#cbd5e1" fontSize="8.5" fontWeight="700">
              FUEL {fuelPct}%
            </text>

            <rect
              x="120"
              y="148"
              width="32"
              height="24"
              rx="5"
              fill="rgba(15, 23, 42, 0.85)"
              stroke={shifter === 'R' ? '#f87171' : shifter === 'P' ? '#fbbf24' : '#22c55e'}
              strokeWidth="2"
            />
            <text
              x="136"
              y="165"
              textAnchor="middle"
              fill={shifter === 'R' ? '#f87171' : shifter === 'P' ? '#fbbf24' : '#ffffff'}
              fontSize="13"
              fontWeight="800"
              fontFamily="sans-serif"
            >
              {gearDisplay}
            </text>

            <g transform={`translate(100, 100) rotate(${needleAngleDeg})`}>
              <polygon points="-2.5,10 2.5,10 1,-74 -1,-74" fill="#ef4444" />
              <circle cx="0" cy="0" r="6" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1.5" />
            </g>
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4 select-none"
    >
      {/* TOP BAR: Compact Minimap & Icon Strip (Left) + Rear-View Mirror (Center) + Camera & Action Icons (Right) */}
      <div className="flex items-start justify-between w-full gap-2">
        <div className="flex items-start gap-2">
          {renderCircularMinimap()}

          <div className="flex flex-col gap-1 pt-0.5">
            {/* Compact Icon-Only Cockpit Bar: Clignotants, Phares, Klaxon, Moteur, Piéton */}
            <div className="flex flex-wrap items-center gap-1 pointer-events-auto bg-slate-950/75 border border-white/20 rounded-xl p-1 shadow-lg">
              {/* Clignotant Gauche */}
              <button
                type="button"
                onClick={() => {
                  soundEngine.init();
                  soundEngine.playTurnSignalTick(true);
                  touchInputRef.current.leftSignal = !touchInputRef.current.leftSignal;
                  if (touchInputRef.current.leftSignal) touchInputRef.current.rightSignal = false;
                }}
                title="Clignotant Gauche"
                className={`w-7 h-7 rounded-lg text-xs font-bold border transition-all flex items-center justify-center ${
                  telemetry.leftSignal
                    ? 'bg-emerald-500 text-slate-950 border-emerald-200'
                    : 'bg-slate-900/90 text-slate-300 border-white/10 hover:text-white'
                }`}
              >
                ◄
              </button>

              {/* Warnings */}
              <button
                type="button"
                onClick={() => {
                  soundEngine.init();
                  soundEngine.playTurnSignalTick(false);
                  touchInputRef.current.hazardLights = !touchInputRef.current.hazardLights;
                }}
                title="Warnings"
                className={`w-7 h-7 rounded-lg border transition-all flex items-center justify-center ${
                  telemetry.hazardLights
                    ? 'bg-red-500 text-white border-red-200'
                    : 'bg-slate-900/90 text-red-400 border-white/10 hover:bg-slate-800'
                }`}
              >
                <TriangleAlert className="w-3.5 h-3.5" />
              </button>

              {/* Clignotant Droit */}
              <button
                type="button"
                onClick={() => {
                  soundEngine.init();
                  soundEngine.playTurnSignalTick(true);
                  touchInputRef.current.rightSignal = !touchInputRef.current.rightSignal;
                  if (touchInputRef.current.rightSignal) touchInputRef.current.leftSignal = false;
                }}
                title="Clignotant Droit"
                className={`w-7 h-7 rounded-lg text-xs font-bold border transition-all flex items-center justify-center ${
                  telemetry.rightSignal
                    ? 'bg-emerald-500 text-slate-950 border-emerald-200'
                    : 'bg-slate-900/90 text-slate-300 border-white/10 hover:text-white'
                }`}
              >
                ►
              </button>

              {/* Phares */}
              <button
                type="button"
                onClick={() => {
                  soundEngine.init();
                  touchInputRef.current.toggleHeadlightsQueued = true;
                }}
                title="Phares (L)"
                className={`w-7 h-7 rounded-lg border transition-all flex items-center justify-center ${
                  telemetry.headlightsOn
                    ? 'bg-sky-500/35 text-sky-200 border-sky-400'
                    : 'bg-slate-900/90 text-slate-400 border-white/10'
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5" />
              </button>

              {/* Klaxon */}
              <button
                type="button"
                onPointerDown={() => {
                  soundEngine.init();
                  soundEngine.playHorn(0.32);
                }}
                title="Klaxon (H)"
                className="w-7 h-7 rounded-lg border bg-slate-900/90 hover:bg-amber-500 hover:text-slate-950 text-amber-300 border-white/10 transition-colors flex items-center justify-center"
              >
                <Volume1 className="w-3.5 h-3.5" />
              </button>

              {/* Start / Stop Engine */}
              <button
                type="button"
                onClick={() => {
                  soundEngine.init();
                  soundEngine.playEngineStarter();
                  touchInputRef.current.toggleEngineQueued = true;
                }}
                title="Moteur Start/Stop"
                className={`w-7 h-7 rounded-lg border transition-all flex items-center justify-center ${
                  telemetry.engineRunning !== false
                    ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400/60'
                    : 'bg-rose-500/25 text-rose-300 border-rose-400/60'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
              </button>

              {/* Mode Piéton */}
              <button
                type="button"
                onClick={() => {
                  soundEngine.init();
                  touchInputRef.current.toggleWalkQueued = true;
                }}
                title="Descendre / Monter en voiture"
                className={`w-7 h-7 rounded-lg border transition-all flex items-center justify-center ${
                  telemetry.isWalking
                    ? 'bg-amber-500 text-slate-950 border-white shadow'
                    : 'bg-slate-900/90 text-cyan-300 border-cyan-400/50 hover:bg-cyan-500/20'
                }`}
              >
                <Footprints className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Compact Level / Parking Selector Pills (P1..P6 or N1..N5) */}
            <div className="flex items-center gap-1 pointer-events-auto">
              {gameMode === 'parking' && onSelectParkingChallenge
                ? PARKING_CHALLENGES.map((ch) => {
                    const active = ch.id === parkingChallengeId;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => onSelectParkingChallenge(ch.id)}
                        className={`w-6 h-6 rounded-md text-[10px] font-display font-bold border transition-all flex items-center justify-center ${
                          active
                            ? 'bg-emerald-500 text-slate-950 border-emerald-200 shadow'
                            : 'bg-black/55 text-white/80 border-white/20 hover:bg-black/80'
                        }`}
                      >
                        P{ch.id}
                      </button>
                    );
                  })
                : onSelectLevel &&
                  TRACKS.map((t) => {
                    const active = t.id === trackSpec.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onSelectLevel(t)}
                        className={`w-6 h-6 rounded-md text-[10px] font-display font-bold border transition-all flex items-center justify-center ${
                          active
                            ? 'bg-amber-500 text-slate-950 border-amber-300 shadow'
                            : 'bg-black/45 text-white/80 border-white/20 hover:bg-black/70'
                        }`}
                      >
                        N{t.levelNumber}
                      </button>
                    );
                  })}
            </div>
          </div>
        </div>

        {/* Top-Center: Compact Rear-View Mirror + Minimal Parking Distance Pill */}
        <div className="hidden sm:flex flex-col items-center gap-1">
          {renderRearViewMirror()}

          {gameMode === 'parking' && (
            <div className="pointer-events-auto bg-slate-950/85 border border-emerald-400/50 rounded-full px-3 py-1 flex items-center gap-2.5 shadow-lg">
              <span className="text-[11px] font-display font-extrabold text-emerald-400">
                [P{parkingChallengeId}]
              </span>
              <span className="font-mono-num text-xs font-extrabold text-white">
                {(telemetry.parkingDistanceMeters ?? 0).toFixed(1)} m
              </span>
              <div className="w-20 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    telemetry.parkingStatus === 'cone_hit'
                      ? 'bg-red-500'
                      : (telemetry.parkingProgressPct ?? 0) >= 85
                      ? 'bg-emerald-400'
                      : 'bg-amber-400'
                  }`}
                  style={{ width: `${telemetry.parkingProgressPct ?? 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Top-Right: Camera Selector + Essential Action Icons */}
        <div className="flex flex-col items-end gap-1 pointer-events-auto">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={onCycleCamera}
              title="Changer de caméra (Touche C)"
              aria-label="Changer de caméra"
              className="px-2.5 h-9 rounded-full bg-amber-500 hover:bg-amber-400 border border-white text-slate-950 flex items-center gap-1.5 transition-colors text-xs font-display font-black shadow-lg active:scale-95"
            >
              <Video className="w-4 h-4" />
              <span>CAMÉRA</span>
            </button>

            <button
              type="button"
              onClick={() => {
                touchInputRef.current.respawnQueued = true;
              }}
              title="Rétablir la voiture (Touche R)"
              aria-label="Rétablir la voiture"
              className="w-9 h-9 rounded-full bg-black/45 hover:bg-black/65 border border-amber-400/60 text-amber-300 flex items-center justify-center transition-colors shadow active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onCycleTimeOfDay}
              title={`Éclairage (${TIME_OF_DAY_LABELS[timeOfDay]})`}
              aria-label="Changer l'éclairage"
              className="w-9 h-9 rounded-full bg-black/45 hover:bg-black/65 border border-white/20 text-white/90 flex items-center justify-center transition-colors"
            >
              {telemetry.dayTimeHours < 6 || telemetry.dayTimeHours >= 19.5 ? (
                <Moon className="w-4 h-4 text-sky-300" />
              ) : (
                <Sun className="w-4 h-4 text-amber-300" />
              )}
            </button>

            <button
              type="button"
              onClick={onToggleSound}
              title={soundEnabled ? 'Couper le son' : 'Activer le son'}
              aria-label="Son"
              className="w-9 h-9 rounded-full bg-black/45 hover:bg-black/65 border border-white/20 text-white/90 flex items-center justify-center transition-colors"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-white/50" />}
            </button>

            <button
              type="button"
              onClick={onPauseClick}
              title="Pause"
              aria-label="Pause"
              className="w-9 h-9 rounded-full bg-black/45 hover:bg-black/65 border border-white/20 text-white/90 flex items-center justify-center transition-colors"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>

          {/* Ultra-Compact Direct Camera Pills (1, 2, 3, 4, 5) */}
          <div className="flex items-center gap-1 bg-slate-950/75 border border-white/20 rounded-full px-1.5 py-0.5">
            {(
              [
                { id: 'cockpit', label: '1·INT' },
                { id: 'hood', label: '2·ROUTE' },
                { id: 'chase_near', label: '3·AUTO' },
                { id: 'top_parking', label: '4·HAUT' },
                { id: 'orbit_360', label: '5·360°' },
              ] as { id: CameraMode; label: string }[]
            ).map((cam) => {
              const isSelected = cameraMode === cam.id;
              return (
                <button
                  key={cam.id}
                  type="button"
                  onClick={() => {
                    if (onSelectCamera) {
                      onSelectCamera(cam.id);
                    } else {
                      onCycleCamera();
                    }
                  }}
                  className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono-num font-extrabold transition-all ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 shadow'
                      : 'text-white/75 hover:text-white'
                  }`}
                >
                  {cam.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* CENTER VIEWPORT: Countdown, Gas Station Refuel Prompt, Cone Hit Retry, or Finish Banner */}
      <div className="flex flex-col items-center justify-center my-auto gap-2">
        {telemetry.raceFinished ? (
          <div className="bg-slate-950/90 border-2 border-amber-400 rounded-2xl overflow-hidden shadow-2xl min-w-[260px] sm:min-w-[340px]">
            <svg viewBox="0 0 240 16" preserveAspectRatio="none" className="w-full h-4 block">
              {Array.from({ length: 16 }).map((_, i) => (
                <React.Fragment key={i}>
                  <rect x={i * 15} y="0" width="15" height="8" fill={i % 2 === 0 ? '#ffffff' : '#0f172a'} />
                  <rect x={i * 15} y="8" width="15" height="8" fill={i % 2 === 0 ? '#0f172a' : '#ffffff'} />
                </React.Fragment>
              ))}
            </svg>
            <div className="px-8 py-4 text-center">
              <div className="font-display font-extrabold text-3xl sm:text-5xl text-emerald-400 tracking-wider">
                {gameMode === 'parking' ? 'STATIONNEMENT RÉUSSI !' : 'ARRIVÉE !'}
              </div>
              <div className="text-xs font-mono-num text-slate-300 mt-1">
                {gameMode === 'parking'
                  ? `Récompense : +$${activeParkingChallenge.rewardMoney.toLocaleString('fr-FR')} · Temps : ${formatRaceTime(telemetry.elapsedTime)}`
                  : gameMode === 'race'
                  ? `Position : ${telemetry.position === 1 ? '1er' : `${telemetry.position}e`} / ${telemetry.totalRacers}`
                  : formatRaceTime(telemetry.elapsedTime)}
              </div>
            </div>
            <svg viewBox="0 0 240 16" preserveAspectRatio="none" className="w-full h-4 block">
              {Array.from({ length: 16 }).map((_, i) => (
                <React.Fragment key={i}>
                  <rect x={i * 15} y="0" width="15" height="8" fill={i % 2 === 0 ? '#0f172a' : '#ffffff'} />
                  <rect x={i * 15} y="8" width="15" height="8" fill={i % 2 === 0 ? '#ffffff' : '#0f172a'} />
                </React.Fragment>
              ))}
            </svg>
          </div>
        ) : (
          <>
            {telemetry.countdown >= 0 && (
              <div className="bg-black/55 border border-amber-400/50 rounded-2xl px-9 py-4 text-center shadow-2xl">
                <div
                  className={`font-display font-bold text-5xl sm:text-6xl font-mono-num ${
                    telemetry.countdown === 0 ? 'text-emerald-400' : 'text-white'
                  }`}
                >
                  {telemetry.countdown === 0 ? 'GO !' : telemetry.countdown}
                </div>
              </div>
            )}

            {/* Gas Station Refuel Prompt */}
            {telemetry.nearGasStation && (telemetry.fuelPercent ?? 100) < 99 && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.init();
                  soundEngine.playCheckpointChime();
                  touchInputRef.current.refuelQueued = true;
                }}
                className="pointer-events-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-5 py-2.5 rounded-2xl font-display font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-2xl border-2 border-white active:scale-95 transition-transform"
              >
                <Fuel className="w-4 h-4" />
                <span>STATION-SERVICE : FAIRE LE PLEIN D’ESSENCE (100%)</span>
              </button>
            )}

            {/* Cone Hit Warning & Retry Button in Parking Mode */}
            {gameMode === 'parking' && telemetry.parkingStatus === 'cone_hit' && (
              <div className="pointer-events-auto bg-red-950/90 border-2 border-red-400 rounded-2xl px-6 py-3 text-center shadow-2xl flex flex-col items-center gap-2">
                <div className="font-display font-extrabold text-base sm:text-lg text-red-300">
                  CÔNE DE SIGNALISATION TOUCHÉ !
                </div>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.init();
                    touchInputRef.current.respawnQueued = true;
                  }}
                  className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-xs flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Recommencer la manœuvre</span>
                </button>
              </div>
            )}

            {telemetry.lastCheckpointBanner && telemetry.countdown < 0 && (
              <div className="bg-slate-950/80 border border-amber-400/50 rounded-xl px-5 py-2 text-center shadow-lg">
                <span className="font-display font-bold text-sm sm:text-base text-amber-300 tracking-wide">
                  {telemetry.lastCheckpointBanner}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* BOTTOM-CENTER: Analog Tachometer, Fuel Gauge & Digital Speedometer Dial */}
      <div className="w-full flex items-end justify-center pb-1 pointer-events-none">
        {renderTachometerDial()}
      </div>
    </div>
  );
};
