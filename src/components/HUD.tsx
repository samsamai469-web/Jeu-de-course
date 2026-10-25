import React, { useState } from 'react';
import {
  CAMERA_LABELS,
  CameraMode,
  GameMode,
  TelemetryState,
  TIME_OF_DAY_LABELS,
  TimeOfDay,
  TRACKS,
  TrackSpec,
  WEATHER_LABELS,
  WeatherType,
} from '../types/game';
import { TouchInputState } from './RacingCanvas';
import { Pause, Volume2, VolumeX, Video, Sun, Gamepad2, Settings, CloudRain, Eye, Smartphone, RotateCcw } from 'lucide-react';

interface HUDProps {
  telemetry: TelemetryState;
  gameMode: GameMode;
  trackSpec: TrackSpec;
  soundEnabled: boolean;
  cameraMode: CameraMode;
  timeOfDay: TimeOfDay;
  weather: WeatherType;
  rearViewMirror: boolean;
  showTouchControls: boolean;
  touchInputRef: React.MutableRefObject<TouchInputState>;
  onPauseClick: () => void;
  onToggleSound: () => void;
  onCycleCamera: () => void;
  onToggleTouchControls: () => void;
  onCycleTimeOfDay: () => void;
  onCycleWeather: () => void;
  onSelectLevel?: (track: TrackSpec) => void;
}

export function formatRaceTime(seconds: number | null): string {
  if (seconds === null || Number.isNaN(seconds)) return '--:--.--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hundredths = Math.floor((seconds % 1) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

export const HUD: React.FC<HUDProps> = ({
  telemetry,
  gameMode,
  trackSpec,
  soundEnabled,
  cameraMode,
  timeOfDay,
  weather,
  rearViewMirror,
  showTouchControls,
  touchInputRef,
  onPauseClick,
  onToggleSound,
  onCycleCamera,
  onToggleTouchControls,
  onCycleTimeOfDay,
  onCycleWeather,
  onSelectLevel,
}) => {
  const [lookBackHeld, setLookBackHeld] = useState(false);

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
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-black/50 border-2 border-white/30 overflow-hidden shadow-lg shrink-0">
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
            <polygon points="0,-6 5,5 0,2.5 -5,5" fill="#0f172a" stroke="#ffffff" strokeWidth="1.5" />
          </g>
        </svg>
      </div>
    );
  };

  // Top-Center Panoramic Rear-View Mirror ("Rétroviseur Central")
  const renderRearViewMirror = () => {
    if (!rearViewMirror) return null;

    const skyColor =
      timeOfDay === 'night'
        ? '#090d16'
        : timeOfDay === 'sunset'
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
          {/* Sky & Horizon inside Mirror */}
          <rect x="0" y="0" width="240" height="24" fill={skyColor} />
          <rect x="0" y="24" width="240" height="32" fill="#2d3748" />
          {/* Receding Rear Road Perspective */}
          <polygon points="95,24 145,24 225,56 15,56" fill="#1e242b" />
          <line x1="95" y1="24" x2="15" y2="56" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="145" y1="24" x2="225" y2="56" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="120" y1="24" x2="120" y2="56" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeDasharray="4 4" />

          {/* Pursuing Cars Behind Player */}
          {telemetry.rearOpponents.map((ro, idx) => {
            const depthRatio = Math.max(0, Math.min(1, 1 - ro.distanceMeters / 95));
            const carScale = 0.45 + depthRatio * 0.95;
            const cx = 120 + ro.lateralOffset * (32 + depthRatio * 48);
            const cy = 26 + depthRatio * 22;
            const w = 22 * carScale;
            const h = 11 * carScale;

            return (
              <g key={idx} transform={`translate(${cx}, ${cy})`}>
                {/* Car Body Silhouette + Headlights */}
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
          {telemetry.rearOpponents.length > 0 ? (
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

  // Analog Tachometer + Digital Speedometer Dial (Bottom-Left beside the steering wheel)
  const renderTachometerDial = () => {
    const rpmClamped = Math.min(9000, Math.max(0, telemetry.rpm));
    const needleAngleDeg = -135 + (rpmClamped / 9000) * 270;
    const gearLabel =
      telemetry.speedKmh < 1 && telemetry.gear === 1
        ? 'N'
        : telemetry.gear === -1
        ? 'R'
        : String(telemetry.gear);

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
      <div className="relative w-28 h-28 sm:w-36 sm:h-36 pointer-events-none select-none drop-shadow-lg">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <circle cx="100" cy="100" r="86" fill="rgba(15, 23, 42, 0.32)" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="2" />

          <path
            d="M 22 135 A 86 86 0 0 0 48 168"
            fill="none"
            stroke="rgba(255, 255, 255, 0.65)"
            strokeWidth="2.5"
          />
          <path
            d="M 178 135 A 86 86 0 0 1 152 168"
            fill="none"
            stroke="rgba(255, 255, 255, 0.65)"
            strokeWidth="2.5"
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

          <rect
            x="128"
            y="152"
            width="22"
            height="22"
            rx="4"
            fill="rgba(15, 23, 42, 0.55)"
            stroke="#ffffff"
            strokeWidth="2"
          />
          <text
            x="139"
            y="168"
            textAnchor="middle"
            fill={telemetry.gear === -1 ? '#f87171' : '#ffffff'}
            fontSize="14"
            fontWeight="800"
            fontFamily="sans-serif"
          >
            {gearLabel}
          </text>

          <g transform={`translate(100, 100) rotate(${needleAngleDeg})`}>
            <polygon points="-2.5,10 2.5,10 1,-74 -1,-74" fill="#ef4444" />
            <circle cx="0" cy="0" r="6" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1.5" />
          </g>
        </svg>
      </div>
    );
  };

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-4 select-none"
    >
      {/* TOP BAR: Circular Minimap (Left) + Rear-View Mirror (Center) + Discreet Action Icons (Right) */}
      <div className="flex items-start justify-between w-full gap-2">
        <div className="flex items-start gap-2.5 sm:gap-3">
          {renderCircularMinimap()}

          <div className="flex flex-col gap-2 pt-0.5">
            <div className="flex items-center gap-1.5 pointer-events-auto">
              <button
                type="button"
                onClick={onCycleTimeOfDay}
                title={`Éclairage : ${TIME_OF_DAY_LABELS[timeOfDay]}`}
                aria-label="Changer l'éclairage"
                className="w-9 h-9 rounded-full bg-black/25 hover:bg-black/45 border border-white/20 text-white/85 hover:text-white flex items-center justify-center transition-colors"
              >
                <Sun className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onCycleWeather}
                title={`Météo : ${WEATHER_LABELS[weather]}`}
                aria-label="Changer la météo"
                className="w-9 h-9 rounded-full bg-black/25 hover:bg-black/45 border border-white/20 text-white/85 hover:text-white flex items-center justify-center transition-colors"
              >
                <CloudRain className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onToggleTouchControls}
                title="Afficher / Masquer les commandes tactiles"
                aria-label="Commandes tactiles"
                className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${
                  showTouchControls
                    ? 'bg-white/20 border-white/40 text-white'
                    : 'bg-black/25 border-white/20 text-white/70 hover:text-white'
                }`}
              >
                <Gamepad2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={async () => {
                  try {
                    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                      await document.documentElement.requestFullscreen();
                    }
                    const orient = window.screen?.orientation as unknown as {
                      lock?: (mode: string) => Promise<void>;
                    };
                    if (orient && typeof orient.lock === 'function') {
                      await orient.lock('landscape');
                    }
                  } catch {
                    // Orientation lock or fullscreen not supported in this browser context
                  }
                }}
                title="Mode Paysage / Plein Écran (Tourner le téléphone)"
                aria-label="Mode Paysage Plein Écran"
                className="px-2.5 h-9 rounded-full bg-amber-500/85 hover:bg-amber-400 border border-amber-300 text-slate-950 font-display font-bold text-[10px] flex items-center gap-1 shadow transition-colors"
              >
                <Smartphone className="w-3.5 h-3.5 rotate-90" />
                <span className="hidden xs:inline">PAYSAGE</span>
              </button>
            </div>

            {(gameMode === 'race' || gameMode === 'time_attack' || gameMode === 'exploration') && (
              <div className="flex items-center gap-2 bg-black/35 border border-white/20 rounded-lg px-2.5 py-1 text-white/95 text-xs font-mono-num">
                {gameMode === 'race' && (
                  <>
                    <span className="font-bold text-amber-300">
                      {telemetry.position}/{telemetry.totalRacers}
                    </span>
                    <span className="text-white/40">·</span>
                  </>
                )}
                {(gameMode === 'race' || gameMode === 'time_attack') && (
                  <>
                    {telemetry.lap >= telemetry.totalLaps ? (
                      <span className="font-bold text-amber-300 tracking-wider">FINAL</span>
                    ) : (
                      <span>
                        T {telemetry.lap}/{telemetry.totalLaps}
                      </span>
                    )}
                    <span className="text-white/40">·</span>
                  </>
                )}
                {gameMode === 'exploration' && (
                  <>
                    <span className="text-cyan-300">
                      {telemetry.discoveredPoints}/{telemetry.totalDiscoveryPoints}
                    </span>
                    <span className="text-white/40">·</span>
                  </>
                )}
                <span>{formatRaceTime(telemetry.elapsedTime)}</span>
              </div>
            )}

            {/* Quick Level Switcher (N1 à N5) directly accessible in HUD */}
            {onSelectLevel && (
              <div className="flex items-center gap-1 pointer-events-auto">
                {TRACKS.map((t) => {
                  const active = t.id === trackSpec.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onSelectLevel(t)}
                      title={`Passer au Niveau ${t.levelNumber} : ${t.name}`}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-display font-bold border transition-all ${
                        active
                          ? 'bg-amber-500 text-slate-950 border-amber-300 shadow'
                          : 'bg-black/45 text-white/85 border-white/20 hover:bg-black/70'
                      }`}
                    >
                      N{t.levelNumber}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Top-Center: Live Panoramic Rear-View Mirror */}
        <div className="hidden sm:flex flex-col items-center">
          {renderRearViewMirror()}
        </div>

        {/* Top-Right: Discreet Semi-Transparent Icons (Look Back, Sound, Settings, Camera, Pause) */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
          <button
            type="button"
            title="Maintenir pour regarder derrière (Touche B)"
            aria-label="Regarder derrière"
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
            className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors touch-none ${
              lookBackHeld || telemetry.lookingBack
                ? 'bg-amber-500 text-slate-950 border-amber-300'
                : 'bg-black/25 hover:bg-black/45 border-white/20 text-white/85 hover:text-white'
            }`}
          >
            <Eye className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => {
              touchInputRef.current.respawnQueued = true;
            }}
            title="Rétablir la voiture sur la piste en cas d'accident (Touche R)"
            aria-label="Rétablir la voiture sur la piste"
            className="w-10 h-10 rounded-full bg-amber-500/25 hover:bg-amber-500/45 border border-amber-400/60 text-amber-300 hover:text-white flex items-center justify-center transition-colors shadow-lg active:scale-95"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onToggleSound}
            title={soundEnabled ? 'Couper le son' : 'Activer le son'}
            aria-label={soundEnabled ? 'Couper le son' : 'Activer le son'}
            className="w-10 h-10 rounded-full bg-black/25 hover:bg-black/45 border border-white/20 text-white/85 hover:text-white flex items-center justify-center transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-white/50" />}
          </button>

          <button
            type="button"
            onClick={onPauseClick}
            title="Pause / Paramètres (Échap)"
            aria-label="Pause et paramètres"
            className="w-10 h-10 rounded-full bg-black/25 hover:bg-black/45 border border-white/20 text-white/85 hover:text-white flex items-center justify-center transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onCycleCamera}
            title={`Caméra : ${CAMERA_LABELS[cameraMode]} (C)`}
            aria-label="Changer de caméra"
            className="w-10 h-10 rounded-full bg-black/25 hover:bg-black/45 border border-white/20 text-white/85 hover:text-white flex items-center justify-center transition-colors"
          >
            <Video className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onPauseClick}
            title="Pause (Échap)"
            aria-label="Mettre en pause"
            className="w-10 h-10 rounded-full bg-black/25 hover:bg-black/45 border border-white/20 text-white/85 hover:text-white flex items-center justify-center transition-colors"
          >
            <Pause className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* CENTER VIEWPORT: 3-2-1-GO start countdown, Checkered Flag ARRIVÉE ! banner, or Checkpoint banner */}
      <div className="flex flex-col items-center justify-center my-auto gap-2">
        {telemetry.raceFinished ? (
          <div className="bg-slate-950/90 border-2 border-amber-400 rounded-2xl overflow-hidden shadow-2xl min-w-[260px] sm:min-w-[340px]">
            {/* Top Checkered Strip (Damier) */}
            <svg viewBox="0 0 240 16" preserveAspectRatio="none" className="w-full h-4 block">
              {Array.from({ length: 16 }).map((_, i) => (
                <React.Fragment key={i}>
                  <rect x={i * 15} y="0" width="15" height="8" fill={i % 2 === 0 ? '#ffffff' : '#0f172a'} />
                  <rect x={i * 15} y="8" width="15" height="8" fill={i % 2 === 0 ? '#0f172a' : '#ffffff'} />
                </React.Fragment>
              ))}
            </svg>
            <div className="px-8 py-4 text-center">
              <div className="font-display font-extrabold text-4xl sm:text-5xl text-amber-400 tracking-wider">
                ARRIVÉE !
              </div>
              <div className="text-xs font-mono-num text-slate-300 mt-1">
                {gameMode === 'race'
                  ? `Position : ${telemetry.position === 1 ? '1er' : `${telemetry.position}e`} / ${telemetry.totalRacers}`
                  : formatRaceTime(telemetry.elapsedTime)}
              </div>
            </div>
            {/* Bottom Checkered Strip (Damier) */}
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
            {telemetry.lastCheckpointBanner && telemetry.countdown < 0 && (
              <div className="bg-slate-950/75 border border-amber-400/50 rounded-xl px-5 py-2 text-center shadow-lg">
                <span className="font-display font-bold text-sm sm:text-base text-amber-300 tracking-wide">
                  {telemetry.lastCheckpointBanner}
                </span>
              </div>
            )}
            {telemetry.speedKmh < 3 && telemetry.countdown < 0 && !telemetry.raceFinished && (
              <button
                type="button"
                onClick={() => {
                  touchInputRef.current.respawnQueued = true;
                }}
                className="pointer-events-auto bg-amber-500 hover:bg-amber-400 text-slate-950 px-3.5 py-1.5 rounded-xl font-display font-bold text-xs flex items-center gap-1.5 shadow-2xl border border-white/80 active:scale-95 transition-transform mt-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>ACCIDENT / BLOQUÉ ? RÉTABLIR SUR LA PISTE</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* BOTTOM-LEFT-CENTER: Analog Tachometer & Digital Speedometer Dial */}
      <div className="w-full flex items-end justify-start pl-40 sm:pl-52 pb-1">
        {renderTachometerDial()}
      </div>
    </div>
  );
};
