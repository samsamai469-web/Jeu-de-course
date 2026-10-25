import React, { useState } from 'react';
import {
  BODY_KIT_OPTIONS,
  CAMERA_LABELS,
  CameraMode,
  CARS,
  CarCustomization,
  CarPerformanceUpgrades,
  CarSpec,
  computeCarDynoStats,
  DRIVING_STYLE_LABELS,
  DrivingStyle,
  ENGINE_SWAP_OPTIONS,
  GameMode,
  GameSettings,
  getEffectiveCarSpec,
  HEADLIGHT_SWATCHES,
  MedalTier,
  PAINT_SWATCHES,
  PaintFinish,
  PARKING_CHALLENGES,
  PlayerProgress,
  QualityPreset,
  RIM_STYLE_OPTIONS,
  RIM_SWATCHES,
  ScreenState,
  TelemetryState,
  TIME_OF_DAY_LABELS,
  TimeOfDay,
  TRACKS,
  TrackSpec,
  TRAFFIC_DENSITY_LABELS,
  TrafficDensity,
  TRANSMISSION_LABELS,
  TransmissionType,
  WEATHER_LABELS,
  WeatherType,
} from '../types/game';
import { formatClock24h, formatRaceTime } from './HUD';
import {
  Play,
  Car,
  Wrench,
  Settings,
  RotateCcw,
  Trophy,
  Clock,
  Compass,
  Navigation,
  ChevronLeft,
  ChevronRight,
  Check,
  Award,
  Gauge,
  CloudRain,
  Eye,
  Sliders,
  Star,
  Lock,
} from 'lucide-react';

interface MainMenuProps {
  screenState: ScreenState;
  hasActiveSession: boolean;
  selectedCar: CarSpec;
  customization: CarCustomization;
  upgrades: CarPerformanceUpgrades;
  playerProgress: PlayerProgress;
  lastEarnedStars: 0 | 1 | 2 | 3;
  selectedTrack: TrackSpec;
  selectedMode: GameMode;
  parkingChallengeId: number;
  settings: GameSettings;
  telemetry: TelemetryState;
  onSelectScreen: (screen: ScreenState) => void;
  onStartNewRace: (mode?: GameMode, challengeId?: number) => void;
  onNextLevel: () => void;
  onResumeRace: () => void;
  onSelectCar: (car: CarSpec) => void;
  onUpdateCustomization: (patch: Partial<CarCustomization>) => void;
  onUpdateUpgrades: (patch: Partial<CarPerformanceUpgrades>) => void;
  onSelectTrack: (track: TrackSpec) => void;
  onSelectMode: (mode: GameMode) => void;
  onSelectParkingChallenge: (id: number) => void;
  onUpdateSettings: (patch: Partial<GameSettings>) => void;
}

const MODE_OPTIONS: Array<{
  id: GameMode;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'race',
    title: 'Course contre l’IA',
    subtitle: 'Affrontez les pilotes IA sur plusieurs tours pour la 1re place.',
    icon: Trophy,
  },
  {
    id: 'parking',
    title: 'Défis Parking Précision',
    subtitle: 'Manœuvrez avec la boîte P-R-N-D entre les cônes dans la zone [P].',
    icon: Award,
  },
  {
    id: 'free_drive',
    title: 'Monde Ouvert & Station-Service',
    subtitle: 'Conduisez librement, faites le plein et marchez à pied.',
    icon: Navigation,
  },
  {
    id: 'time_attack',
    title: 'Contre-la-montre',
    subtitle: 'Battez les chronos Or, Argent et Bronze sur trajectoire pure.',
    icon: Clock,
  },
  {
    id: 'exploration',
    title: 'Mode exploration',
    subtitle: 'Explorez le niveau et découvrez les 8 balises d’intérêt.',
    icon: Compass,
  },
];

const TIRE_SMOKE_SWATCHES = [
  { name: 'Blanc Classique', hex: '#ffffff' },
  { name: 'Bleu Drift', hex: '#38bdf8' },
  { name: 'Rouge Compétition', hex: '#ef4444' },
  { name: 'Jaune Or', hex: '#facc15' },
  { name: 'Violet Néon', hex: '#a855f7' },
  { name: 'Vert Émeraude', hex: '#10b981' },
];

function renderMedalBadge(medal: MedalTier | undefined) {
  if (medal === 'gold') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[11px] font-semibold">
        <Award className="w-3 h-3 text-amber-400" />
        Médaille d’Or
      </span>
    );
  }
  if (medal === 'silver') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-300/20 border border-slate-300/40 text-slate-200 text-[11px] font-semibold">
        <Award className="w-3 h-3 text-slate-300" />
        Médaille d’Argent
      </span>
    );
  }
  if (medal === 'bronze') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-500/20 border border-orange-400/40 text-orange-300 text-[11px] font-semibold">
        <Award className="w-3 h-3 text-orange-400" />
        Médaille de Bronze
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 border border-white/10 text-slate-500 text-[11px] font-medium">
      Non classé
    </span>
  );
}

function renderStarRating(stars: number, sizeClass = 'w-4 h-4') {
  return (
    <div className="inline-flex items-center gap-1" aria-label={`${stars} sur 3 étoiles`}>
      {[1, 2, 3].map((idx) => {
        const filled = idx <= stars;
        return (
          <Star
            key={idx}
            className={`${sizeClass} ${
              filled
                ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]'
                : 'text-slate-600 fill-slate-800/80'
            }`}
          />
        );
      })}
    </div>
  );
}

export const MainMenu: React.FC<MainMenuProps> = ({
  screenState,
  hasActiveSession,
  selectedCar,
  customization,
  upgrades,
  playerProgress,
  lastEarnedStars,
  selectedTrack,
  selectedMode,
  parkingChallengeId,
  settings,
  telemetry,
  onSelectScreen,
  onStartNewRace,
  onNextLevel,
  onResumeRace,
  onSelectCar,
  onUpdateCustomization,
  onUpdateUpgrades,
  onSelectTrack,
  onSelectMode,
  onSelectParkingChallenge,
  onUpdateSettings,
}) => {
  const [garageTab, setGarageTab] = useState<'engine' | 'exterior' | 'suspension' | 'gearbox'>('engine');
  const [showStartModal, setShowStartModal] = useState<boolean>(false);
  const [startModalTab, setStartModalTab] = useState<'levels' | 'singleplayer' | 'race'>('levels');

  if (screenState === 'playing') return null;

  const effectiveCar = getEffectiveCarSpec(selectedCar, upgrades);
  const dynoStats = computeCarDynoStats(selectedCar, upgrades);
  const playerMoney = playerProgress.money ?? 50000;
  const unlockedLevels = playerProgress.unlockedLevels || 1;
  const totalTrackStars = TRACKS.reduce((sum, t) => sum + (playerProgress.stars?.[t.id] ?? 0), 0);
  const totalParkingStars = PARKING_CHALLENGES.reduce(
    (sum, c) => sum + (playerProgress.parkingStars?.[c.id] ?? 0),
    0
  );
  const totalStarsEarned = totalTrackStars + totalParkingStars;
  const maxPossibleStars = (TRACKS.length + PARKING_CHALLENGES.length) * 3;
  const activeParkingChallenge =
    PARKING_CHALLENGES.find((c) => c.id === parkingChallengeId) || PARKING_CHALLENGES[0];
  const currentCarIndex = Math.max(0, CARS.findIndex((c) => c.id === selectedCar.id));
  const prevCar = CARS[(currentCarIndex - 1 + CARS.length) % CARS.length];
  const nextCar = CARS[(currentCarIndex + 1) % CARS.length];

  // Helper to render the Live SVG Dyno Curve (HP & Nm vs RPM) like Car Parking Multiplayer
  const renderDynoGraph = () => {
    const maxHpScale = 1800;
    const maxNmScale = 2000;
    const rpmPoints = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000];
    const hpFactors = [0.22, 0.38, 0.56, 0.74, 0.88, 0.96, 1.0, 0.94];
    const nmFactors = [0.55, 0.78, 0.94, 1.0, 0.98, 0.91, 0.82, 0.72];

    const toX = (idx: number) => 28 + (idx / (rpmPoints.length - 1)) * 230;
    const toYHp = (val: number) => 108 - Math.min(1, val / maxHpScale) * 88;
    const toYNm = (val: number) => 108 - Math.min(1, val / maxNmScale) * 88;

    const hpPath = rpmPoints
      .map((_, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toYHp(dynoStats.hp * hpFactors[i]).toFixed(1)}`)
      .join(' ');
    const nmPath = rpmPoints
      .map((_, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toYNm(dynoStats.nm * nmFactors[i]).toFixed(1)}`)
      .join(' ');

    return (
      <div className="bg-slate-950/95 border border-white/15 rounded-xl p-2.5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="font-display font-bold text-slate-300 uppercase tracking-wider">
            Banc d’Essai Dyno
          </span>
          <div className="flex items-center gap-2 font-mono-num font-bold">
            <span className="text-amber-400">{dynoStats.hp} HP @ 7000</span>
            <span className="text-emerald-400">{dynoStats.nm} Nm @ 4500</span>
          </div>
        </div>
        <svg viewBox="0 0 270 124" className="w-full h-24 overflow-visible">
          {[25, 52, 80, 108].map((gy) => (
            <line
              key={gy}
              x1="28"
              y1={gy}
              x2="258"
              y2={gy}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="3 3"
            />
          ))}
          <path d={nmPath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
          <path d={hpPath} fill="none" stroke="#f59e0b" strokeWidth="2.8" strokeLinecap="round" />
          {rpmPoints.map((rpm, i) => (
            <text
              key={rpm}
              x={toX(i)}
              y="120"
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="8"
              fontFamily="monospace"
            >
              {rpm / 1000}k
            </text>
          ))}
        </svg>
      </div>
    );
  };

  // 1. PAUSE MODAL
  if (screenState === 'paused') {
    return (
      <div className="fixed inset-0 z-30 bg-slate-950/80 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-white/15 rounded-2xl p-6 shadow-2xl">
          <div className="text-xs font-semibold text-amber-400 tracking-wider">
            {selectedMode === 'parking'
              ? `MISSION PARKING P${activeParkingChallenge.id} · EN PAUSE`
              : selectedMode === 'free_drive'
              ? `MONDE OUVERT · EN PAUSE`
              : `NIVEAU ${selectedTrack.levelNumber} · EN PAUSE`}
          </div>
          <h2 className="font-display font-bold text-3xl text-white mt-1">
            {selectedMode === 'parking' ? activeParkingChallenge.title : selectedTrack.name}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {selectedCar.name} ({dynoStats.hp} HP / {dynoStats.nm} Nm) ·{' '}
            {WEATHER_LABELS[settings.weather]}
          </p>

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onResumeRace}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-base flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Reprendre la conduite</span>
            </button>

            <button
              type="button"
              onClick={() => onStartNewRace()}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Recommencer</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectScreen('settings')}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Settings className="w-4 h-4" />
              <span>Paramètres & Contrôles</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowStartModal(false);
                onSelectScreen('main_menu');
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/10 text-slate-300 font-medium text-sm transition-colors whitespace-nowrap shrink-0"
            >
              Retour au Showroom (Garage 3D)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. RACE / PARKING FINISHED SUMMARY MODAL
  if (screenState === 'finished') {
    const isParking = selectedMode === 'parking';
    const earnedStars =
      lastEarnedStars ||
      (isParking
        ? playerProgress.parkingStars?.[activeParkingChallenge.id]
        : playerProgress.stars?.[selectedTrack.id]) ||
      1;
    const hasNextLevel = isParking
      ? activeParkingChallenge.id < PARKING_CHALLENGES.length
      : selectedTrack.levelNumber < TRACKS.length;
    const isNextLevelUnlocked = isParking
      ? true
      : hasNextLevel &&
        (unlockedLevels >= selectedTrack.levelNumber + 1 ||
          telemetry.position <= 3 ||
          earnedStars >= 2);
    const standings =
      !isParking && telemetry.standings && telemetry.standings.length > 0
        ? telemetry.standings
        : [];

    return (
      <div className="fixed inset-0 z-30 bg-slate-950/88 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <div className="w-full max-w-lg bg-slate-900 border border-emerald-400/40 rounded-2xl p-5 sm:p-7 shadow-2xl my-auto">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-emerald-400 tracking-wider">
              {isParking
                ? `MISSION PARKING P${activeParkingChallenge.id} RÉUSSIE`
                : `FIN DE COURSE · NIVEAU ${selectedTrack.levelNumber}`}
            </div>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-xs font-semibold font-mono-num">
              {isParking
                ? `+$${activeParkingChallenge.rewardMoney.toLocaleString()}`
                : `+$${(earnedStars === 3 ? 5000 : earnedStars === 2 ? 3000 : 1500).toLocaleString()}`}
            </span>
          </div>

          <h2 className="font-display font-bold text-2xl sm:text-3xl text-white mt-1">
            {isParking
              ? `${activeParkingChallenge.title} Validé !`
              : telemetry.position === 1
              ? 'Victoire — 1re Place !'
              : telemetry.position <= 3
              ? `Podium — ${telemetry.position}e Place !`
              : 'Course Terminée'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            {isParking ? activeParkingChallenge.subtitle : selectedTrack.name} · {selectedCar.name}
          </p>

          <div className="my-4 py-3 px-4 rounded-2xl bg-slate-950/90 border border-amber-400/25 flex flex-col items-center justify-center gap-1.5">
            {renderStarRating(earnedStars, 'w-9 h-9')}
            <div className="text-xs font-semibold text-amber-300 text-center">
              {isParking
                ? earnedStars === 3
                  ? '3 Étoiles — Stationnement Parfait (0 cône touché) !'
                  : '2 Étoiles — Stationnement Validé !'
                : earnedStars === 3
                ? '3 Étoiles — Victoire (1re place) !'
                : earnedStars === 2
                ? '2 Étoiles — Top 3 atteint (Niveau suivant débloqué)'
                : '1 Étoile — Course terminée'}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 mb-4">
            <div className="bg-slate-950 border border-white/10 rounded-xl p-3">
              <div className="text-[11px] text-slate-400">
                {isParking ? 'Précision [P]' : 'Classement'}
              </div>
              <div className="font-display font-bold text-2xl text-amber-400 font-mono-num mt-0.5">
                {isParking ? (
                  '100%'
                ) : (
                  <>
                    {telemetry.position === 1 ? '1er' : `${telemetry.position}e`}{' '}
                    <span className="text-xs text-slate-500">/ {telemetry.totalRacers}</span>
                  </>
                )}
              </div>
            </div>

            <div className="bg-slate-950 border border-white/10 rounded-xl p-3">
              <div className="text-[11px] text-slate-400">Temps Total</div>
              <div className="font-mono-num font-bold text-base sm:text-lg text-white mt-1">
                {formatRaceTime(telemetry.elapsedTime)}
              </div>
            </div>

            <div className="bg-slate-950 border border-white/10 rounded-xl p-3">
              <div className="text-[11px] text-slate-400">
                {isParking ? 'Récompense' : 'Meilleur Tour'}
              </div>
              <div className="font-mono-num font-bold text-base sm:text-lg text-emerald-400 mt-1">
                {isParking
                  ? `+$${activeParkingChallenge.rewardMoney.toLocaleString()}`
                  : formatRaceTime(telemetry.bestLapTime ?? telemetry.elapsedTime)}
              </div>
            </div>
          </div>

          {standings.length > 0 && (
            <div className="bg-slate-950/90 border border-white/10 rounded-xl p-3 mb-4 max-h-40 overflow-y-auto">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Classement Final
              </div>
              <div className="space-y-1.5">
                {standings.map((r) => (
                  <div
                    key={`${r.rank}-${r.name}`}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs ${
                      r.isPlayer
                        ? 'bg-amber-500/20 border border-amber-400/50 text-white font-semibold'
                        : 'bg-slate-900/80 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-5 text-center font-mono-num font-bold ${
                          r.rank <= 3 ? 'text-amber-400' : 'text-slate-500'
                        }`}
                      >
                        {r.rank}.
                      </span>
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/30"
                        style={{ backgroundColor: r.color }}
                      />
                      <span className="truncate">{r.name}</span>
                    </div>
                    <span className="font-mono-num text-[11px] text-slate-300 shrink-0 ml-2">
                      {r.finished && r.finishTime !== null
                        ? formatRaceTime(r.finishTime)
                        : 'En piste'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => onStartNewRace()}
              className="flex-1 min-h-[50px] py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-white font-display font-bold text-base flex items-center justify-center gap-2 transition-all whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-5 h-5" />
              <span>Rejouer</span>
            </button>

            {hasNextLevel && (
              <button
                type="button"
                disabled={!isNextLevelUnlocked}
                onClick={onNextLevel}
                className={`flex-1 min-h-[50px] py-3.5 px-4 rounded-xl font-display font-bold text-base flex items-center justify-center gap-2 transition-all whitespace-nowrap shrink-0 ${
                  isNextLevelUnlocked
                    ? 'bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 shadow-lg'
                    : 'bg-slate-950 border border-white/10 text-slate-500 cursor-not-allowed'
                }`}
              >
                {isNextLevelUnlocked ? (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    <span>{isParking ? 'Mission suivante' : 'Niveau suivant'}</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Top 3 requis</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => onSelectScreen('main_menu')}
              className="min-h-[50px] py-3.5 px-5 rounded-xl bg-slate-950 hover:bg-slate-800 active:scale-[0.98] border border-white/15 text-slate-200 font-display font-bold text-base transition-all whitespace-nowrap shrink-0"
            >
              Showroom
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. DEALERSHIP / CAR SELECT SCREEN ("Acheter / Choisir Voitures")
  if (screenState === 'car_select') {
    return (
      <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 sm:p-5">
        {/* Top Bar */}
        <div className="flex items-center justify-between pointer-events-auto bg-slate-950/90 border border-white/15 rounded-2xl px-4 py-2.5 max-w-6xl w-full mx-auto shadow-xl">
          <button
            type="button"
            onClick={() => onSelectScreen('main_menu')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs font-display font-bold text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>RETOUR SHOWROOM</span>
          </button>

          <div className="text-center">
            <div className="text-[10px] font-mono-num text-amber-400 font-bold uppercase tracking-wider">
              CONCESSIONNAIRE OFFICIEL · VOITURE #{currentCarIndex + 1} / {CARS.length}
            </div>
            <div className="font-display font-extrabold text-base sm:text-xl text-white">
              {selectedCar.name}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-mono-num font-extrabold text-xs">
              $ {playerMoney.toLocaleString('fr-FR')}
            </span>
            <button
              type="button"
              onClick={() => onSelectScreen('garage')}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>TUNING / DYNO</span>
            </button>
          </div>
        </div>

        {/* Center Left / Right Car Switcher Arrows (3D Car stays 100% visible in center) */}
        <div className="flex items-center justify-between max-w-6xl w-full mx-auto my-auto px-2">
          <button
            type="button"
            onClick={() => onSelectCar(prevCar)}
            aria-label="Voiture précédente"
            className="pointer-events-auto w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-950/85 border-2 border-white/25 hover:border-amber-400 text-white flex items-center justify-center shadow-2xl active:scale-95 transition-all"
          >
            <ChevronLeft className="w-7 h-7" />
          </button>
          <button
            type="button"
            onClick={() => onSelectCar(nextCar)}
            aria-label="Voiture suivante"
            className="pointer-events-auto w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-950/85 border-2 border-white/25 hover:border-amber-400 text-white flex items-center justify-center shadow-2xl active:scale-95 transition-all"
          >
            <ChevronRight className="w-7 h-7" />
          </button>
        </div>

        {/* Bottom Docked Car Specs & Selector Strip */}
        <div className="pointer-events-auto bg-slate-950/92 border border-white/15 rounded-2xl p-3.5 sm:p-4 max-w-6xl w-full mx-auto shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-display font-extrabold text-[10px]">
                  {selectedCar.category}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono-num text-xs font-bold">
                  {dynoStats.hp} HP · {dynoStats.nm} Nm
                </span>
                <span className="text-xs font-mono-num text-slate-400">
                  {effectiveCar.maxSpeedKmh} KM/H
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1.5">{selectedCar.tagline}</p>

              <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-1">
                {CARS.map((car, idx) => (
                  <button
                    key={car.id}
                    type="button"
                    onClick={() => onSelectCar(car)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-display font-bold transition-all whitespace-nowrap shrink-0 border ${
                      car.id === selectedCar.id
                        ? 'bg-amber-500 text-slate-950 border-amber-300 shadow'
                        : 'bg-slate-900 border-white/10 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    #{idx + 1} {car.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-4 grid grid-cols-2 gap-2.5 text-xs">
              <div className="bg-slate-900/90 border border-white/10 rounded-xl p-2">
                <div className="flex justify-between text-slate-400 text-[10px]">
                  <span>VITESSE MAX</span>
                  <span className="font-mono-num font-bold text-white">{effectiveCar.maxSpeedKmh} km/h</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-amber-400" style={{ width: `${effectiveCar.stats.speed}%` }} />
                </div>
              </div>
              <div className="bg-slate-900/90 border border-white/10 rounded-xl p-2">
                <div className="flex justify-between text-slate-400 text-[10px]">
                  <span>ACCÉLÉRATION</span>
                  <span className="font-mono-num font-bold text-white">{effectiveCar.stats.accel}/100</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-emerald-400" style={{ width: `${effectiveCar.stats.accel}%` }} />
                </div>
              </div>
              <div className="bg-slate-900/90 border border-white/10 rounded-xl p-2">
                <div className="flex justify-between text-slate-400 text-[10px]">
                  <span>TENUE DE ROUTE</span>
                  <span className="font-mono-num font-bold text-white">{effectiveCar.stats.handling}/100</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-cyan-400" style={{ width: `${effectiveCar.stats.handling}%` }} />
                </div>
              </div>
              <div className="bg-slate-900/90 border border-white/10 rounded-xl p-2">
                <div className="flex justify-between text-slate-400 text-[10px]">
                  <span>FREINAGE</span>
                  <span className="font-mono-num font-bold text-white">{effectiveCar.stats.braking}/100</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-rose-400" style={{ width: `${effectiveCar.stats.braking}%` }} />
                </div>
              </div>
            </div>

            <div className="lg:col-span-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => onSelectScreen('main_menu')}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-colors"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>SÉLECTIONNER CE VÉHICULE</span>
              </button>
              <button
                type="button"
                onClick={() => onStartNewRace('free_drive')}
                className="w-full py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>ESSAYER EN MONDE OUVERT</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. CAR PARKING MULTIPLAYER GARAGE (Bottom-Docked Drawer so Top 58% of 3D Showroom stays 100% visible!)
  if (screenState === 'garage') {
    const upgradeItems: Array<{
      key: 'engineLevel' | 'turboLevel' | 'tiresLevel' | 'brakesLevel';
      title: string;
      statLabel: string;
      level: 1 | 2 | 3;
    }> = [
      {
        key: 'engineLevel',
        title: 'Bloc Forgé & Puce (Chip Tuning)',
        statLabel: `+${(upgrades.engineLevel - 1) * 14} km/h`,
        level: upgrades.engineLevel,
      },
      {
        key: 'turboLevel',
        title: 'Triple Turbo & Intercooler',
        statLabel: `+${(upgrades.turboLevel - 1) * 12}% Boost`,
        level: upgrades.turboLevel,
      },
      {
        key: 'tiresLevel',
        title: 'Pneus Sport & Grip (Tires)',
        statLabel: `+${(upgrades.tiresLevel - 1) * 8}% Grip`,
        level: upgrades.tiresLevel,
      },
      {
        key: 'brakesLevel',
        title: 'Freins Céramique (Brake)',
        statLabel: `+${(upgrades.brakesLevel - 1) * 13}% Frein`,
        level: upgrades.brakesLevel,
      },
    ];

    const currentRideHeight = customization.rideHeight ?? 0;
    const currentCamber = customization.camberAngleDeg ?? -1.5;
    const currentWheelOffset = customization.wheelOffset ?? 0.01;
    const currentTint = customization.windowTintOpacity ?? 0.55;
    const currentSmoke = customization.tireSmokeColor ?? '#ffffff';

    return (
      <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4">
        {/* Top Bar with Car Parking Multiplayer Garage Categories + Live Dyno Readout */}
        <div className="flex flex-wrap items-center justify-between gap-2 pointer-events-auto bg-slate-950/92 border border-white/15 rounded-2xl px-3.5 py-2.5 max-w-6xl w-full mx-auto shadow-2xl">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectScreen('main_menu')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-xs font-display font-bold text-white transition-colors whitespace-nowrap shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>SHOWROOM</span>
            </button>

            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-900 border border-white/10">
              <span className="font-display font-bold text-xs text-white">{selectedCar.name}</span>
              <span className="text-amber-400 font-mono-num font-extrabold text-xs">
                {dynoStats.hp} HP
              </span>
              <span className="text-emerald-400 font-mono-num font-extrabold text-xs">
                {dynoStats.nm} Nm
              </span>
            </div>
          </div>

          {/* 4 Official Car Parking Multiplayer Garage Tabs */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-white/10 overflow-x-auto">
            <button
              type="button"
              onClick={() => setGarageTab('engine')}
              className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold transition-colors whitespace-nowrap shrink-0 ${
                garageTab === 'engine'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              AMÉLIORATION MOTEUR
            </button>
            <button
              type="button"
              onClick={() => setGarageTab('exterior')}
              className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold transition-colors whitespace-nowrap shrink-0 ${
                garageTab === 'exterior'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              EXTÉRIEUR
            </button>
            <button
              type="button"
              onClick={() => setGarageTab('suspension')}
              className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold transition-colors whitespace-nowrap shrink-0 ${
                garageTab === 'suspension'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              SUSPENSION
            </button>
            <button
              type="button"
              onClick={() => setGarageTab('gearbox')}
              className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold transition-colors whitespace-nowrap shrink-0 ${
                garageTab === 'gearbox'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              BOÎTE & CHÂSSIS
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-mono-num font-extrabold text-xs">
              $ {playerMoney.toLocaleString('fr-FR')}
            </span>
            <button
              type="button"
              onClick={() => onStartNewRace('free_drive')}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-xs flex items-center gap-1.5 shadow-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>ESSAYER</span>
            </button>
          </div>
        </div>

        {/* Center hint: 3D Car is 100% unobstructed and rotatable by dragging */}
        <div className="mx-auto my-auto pointer-events-none select-none">
          <div className="px-3 py-1 rounded-full bg-black/35 border border-white/15 text-[10px] font-mono-num text-white/75">
            GLISSEZ SUR L’ÉCRAN POUR TOURNER À 360° AUTOUR DU VÉHICULE
          </div>
        </div>

        {/* Bottom-Docked Garage Panel (compact height so 3D car stays clearly visible!) */}
        <div className="pointer-events-auto bg-slate-950/92 border border-white/15 rounded-2xl p-3.5 sm:p-4 max-w-6xl w-full mx-auto shadow-2xl max-h-[44vh] overflow-y-auto">
          {garageTab === 'engine' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
              {/* Left: Live SVG Dyno Curve */}
              <div className="lg:col-span-4">{renderDynoGraph()}</div>

              {/* Center: Engine Swaps (Stock, V6, V8, V10, W16 1600 HP) */}
              <div className="lg:col-span-5 bg-slate-900/90 border border-white/10 rounded-xl p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-display font-bold text-xs text-amber-400 uppercase">
                    1. Moteurs (Engine Swap V6 / V8 / V10 / W16)
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateUpgrades({ exhaustSport: !upgrades.exhaustSport })}
                    className={`px-2 py-0.5 rounded-md border text-[10px] font-bold transition-colors ${
                      upgrades.exhaustSport
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-slate-950 border-white/15 text-slate-400'
                    }`}
                  >
                    Échappement Titane (+25 HP) : {upgrades.exhaustSport ? 'OUI' : 'NON'}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {ENGINE_SWAP_OPTIONS.map((eng) => {
                    const active = (upgrades.engineSwap || 'stock') === eng.id;
                    return (
                      <button
                        key={eng.id}
                        type="button"
                        onClick={() => onUpdateUpgrades({ engineSwap: eng.id })}
                        className={`p-2 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          active
                            ? 'bg-amber-500/25 border-amber-400 text-white shadow'
                            : 'bg-slate-950 border-white/10 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="font-display font-bold text-[11px] text-white leading-tight">
                          {eng.name}
                        </div>
                        <div className="mt-1.5 pt-1 border-t border-white/10 text-[10px] font-mono-num text-amber-300 font-bold">
                          {eng.hpBonus > 0 ? `+${eng.hpBonus} HP` : 'Série'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right: Turbo, Tires, Brakes, Chip Tuning */}
              <div className="lg:col-span-3 grid grid-cols-1 gap-1.5">
                {upgradeItems.map((item) => (
                  <div
                    key={item.key}
                    className="bg-slate-900/90 border border-white/10 rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-display font-bold text-[11px] text-white truncate">
                        {item.title}
                      </div>
                      <div className="text-[10px] font-mono-num text-amber-300">{item.statLabel}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {([1, 2, 3] as const).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => onUpdateUpgrades({ [item.key]: lvl })}
                          className={`w-7 h-7 rounded-lg font-mono-num font-bold text-xs border transition-colors ${
                            item.level === lvl
                              ? 'bg-amber-500 text-slate-950 border-amber-300'
                              : 'bg-slate-950 text-slate-400 border-white/10 hover:text-white'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {garageTab === 'exterior' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
              {/* Paint & Finish */}
              <div className="lg:col-span-4 bg-slate-900/85 border border-white/10 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-display font-bold text-white">
                    Peinture Carrosserie & Vernis
                  </span>
                  <label className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 border border-white/20 text-[10px] text-amber-300 cursor-pointer">
                    <input
                      type="color"
                      value={customization.bodyColor}
                      onChange={(e) => onUpdateCustomization({ bodyColor: e.target.value })}
                      className="w-3.5 h-3.5 bg-transparent border-0 cursor-pointer"
                    />
                    <span>Palette</span>
                  </label>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {PAINT_SWATCHES.map((swatch) => {
                    const active =
                      customization.bodyColor.toLowerCase() === swatch.hex.toLowerCase();
                    return (
                      <button
                        key={swatch.hex}
                        type="button"
                        onClick={() => onUpdateCustomization({ bodyColor: swatch.hex })}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-transform ${
                          active ? 'border-white scale-110' : 'border-white/20'
                        }`}
                        style={{ backgroundColor: swatch.hex }}
                      >
                        {active && <Check className="w-3 h-3 text-slate-950 stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-3 gap-1 pt-1">
                  {(['metallic', 'matte', 'chrome'] as PaintFinish[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => onUpdateCustomization({ finish: f })}
                      className={`py-1 px-2 rounded-lg text-[10px] font-bold border transition-colors ${
                        customization.finish === f
                          ? 'bg-amber-500 text-slate-950 border-amber-300'
                          : 'bg-slate-950 border-white/10 text-slate-300'
                      }`}
                    >
                      {f === 'metallic' ? 'Métallisé' : f === 'matte' ? 'Mat' : 'Chrome'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bodykits & Rims */}
              <div className="lg:col-span-5 bg-slate-900/85 border border-white/10 rounded-xl p-3 space-y-2.5">
                <div className="text-xs font-display font-bold text-white">
                  Kits Carrosserie 3D & Jantes ({RIM_STYLE_OPTIONS.length} Modèles)
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {BODY_KIT_OPTIONS.map((kit) => {
                    const active = (customization.bodyKit || 'stock') === kit.id;
                    return (
                      <button
                        key={kit.id}
                        type="button"
                        onClick={() => onUpdateCustomization({ bodyKit: kit.id })}
                        className={`p-2 rounded-xl border text-left transition-all ${
                          active
                            ? 'border-amber-400 bg-amber-500/20 text-white'
                            : 'border-white/10 bg-slate-950 text-slate-300'
                        }`}
                      >
                        <div className="font-display font-bold text-[11px] truncate">{kit.name}</div>
                        <div className="text-[9px] text-amber-300 font-mono-num mt-0.5">
                          {kit.aeroBonusText}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {RIM_STYLE_OPTIONS.map((rim) => {
                    const active = (customization.rimStyle || 'amg_multi') === rim.id;
                    return (
                      <button
                        key={rim.id}
                        type="button"
                        onClick={() => onUpdateCustomization({ rimStyle: rim.id })}
                        className={`p-1.5 rounded-lg border text-center text-[10px] font-bold transition-all truncate ${
                          active
                            ? 'border-emerald-400 bg-emerald-500/20 text-white'
                            : 'border-white/10 bg-slate-950 text-slate-300'
                        }`}
                      >
                        {rim.name}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pt-0.5">
                  {RIM_SWATCHES.map((swatch) => {
                    const active =
                      customization.rimColor.toLowerCase() === swatch.hex.toLowerCase();
                    return (
                      <button
                        key={swatch.hex}
                        type="button"
                        onClick={() => onUpdateCustomization({ rimColor: swatch.hex })}
                        className={`px-2 py-0.5 rounded-md border text-[10px] flex items-center gap-1 shrink-0 ${
                          active
                            ? 'border-amber-400 bg-amber-500/20 text-white'
                            : 'border-white/10 bg-slate-950 text-slate-400'
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: swatch.hex }}
                        />
                        <span>{swatch.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Window Tint, Tire Smoke & Neon */}
              <div className="lg:col-span-3 bg-slate-900/85 border border-white/10 rounded-xl p-3 flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                    <span className="font-bold">Vitres Teintées</span>
                    <span className="font-mono-num text-amber-400 font-bold">
                      {Math.round(currentTint * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.25}
                    max={0.95}
                    step={0.05}
                    value={currentTint}
                    onChange={(e) =>
                      onUpdateCustomization({ windowTintOpacity: parseFloat(e.target.value) })
                    }
                    className="w-full accent-amber-500"
                  />
                </div>

                <div>
                  <div className="text-[11px] font-bold text-slate-300 mb-1">Fumée de Pneus</div>
                  <div className="flex flex-wrap gap-1.5">
                    {TIRE_SMOKE_SWATCHES.map((s) => {
                      const active = currentSmoke.toLowerCase() === s.hex.toLowerCase();
                      return (
                        <button
                          key={s.hex}
                          type="button"
                          onClick={() => onUpdateCustomization({ tireSmokeColor: s.hex })}
                          className={`w-6 h-6 rounded-full border-2 ${
                            active ? 'border-white scale-110' : 'border-white/20'
                          }`}
                          style={{ backgroundColor: s.hex }}
                          title={s.name}
                        />
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onUpdateCustomization({ neonUnderglow: !customization.neonUnderglow })
                  }
                  className={`w-full py-1.5 px-3 rounded-xl border text-[11px] font-bold flex items-center justify-between ${
                    customization.neonUnderglow
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                      : 'border-white/10 bg-slate-950 text-slate-400'
                  }`}
                >
                  <span>Néon Châssis</span>
                  <span>{customization.neonUnderglow ? 'ON' : 'OFF'}</span>
                </button>
              </div>
            </div>
          )}

          {garageTab === 'suspension' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
              <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-900/90 border border-white/10 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-display font-bold text-xs text-white">
                      Inclinaison (Camber)
                    </span>
                    <span className="font-mono-num text-xs font-bold text-amber-400">
                      {currentCamber.toFixed(1)}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-12}
                    max={0}
                    step={0.5}
                    value={currentCamber}
                    onChange={(e) =>
                      onUpdateCustomization({ camberAngleDeg: parseFloat(e.target.value) })
                    }
                    className="w-full accent-amber-500 my-2"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono-num">
                    <span>-12° Stance</span>
                    <span>0° Série</span>
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-white/10 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-display font-bold text-xs text-white">
                      Hauteur Ressorts
                    </span>
                    <span className="font-mono-num text-xs font-bold text-cyan-400">
                      {currentRideHeight >= 0
                        ? `+${Math.round(currentRideHeight * 100)} cm`
                        : `${Math.round(currentRideHeight * 100)} cm`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-0.05}
                    max={0.05}
                    step={0.005}
                    value={currentRideHeight}
                    onChange={(e) =>
                      onUpdateCustomization({ rideHeight: parseFloat(e.target.value) })
                    }
                    className="w-full accent-cyan-400 my-2"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono-num">
                    <span>-5 cm Bas</span>
                    <span>+5 cm Haut</span>
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-white/10 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-display font-bold text-xs text-white">
                      Déport Roues (Offset)
                    </span>
                    <span className="font-mono-num text-xs font-bold text-emerald-400">
                      +{Math.round(currentWheelOffset * 100)} cm
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.06}
                    step={0.005}
                    value={currentWheelOffset}
                    onChange={(e) =>
                      onUpdateCustomization({ wheelOffset: parseFloat(e.target.value) })
                    }
                    className="w-full accent-emerald-400 my-2"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono-num">
                    <span>0 cm</span>
                    <span>+6 cm Large</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 bg-slate-900/90 border border-white/10 rounded-xl p-3 flex flex-col justify-between gap-1.5">
                <div className="text-xs font-display font-bold text-white">
                  Préréglages Stance Car Parking
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateCustomization({ rideHeight: 0, camberAngleDeg: -1.0, wheelOffset: 0.005 })
                    }
                    className="py-2 px-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-white/10 text-[10px] font-bold text-white"
                  >
                    Origine OEM
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateCustomization({ rideHeight: -0.025, camberAngleDeg: -3.5, wheelOffset: 0.025 })
                    }
                    className="py-2 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-[10px] font-bold text-amber-300"
                  >
                    Track GT3
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateCustomization({ rideHeight: -0.045, camberAngleDeg: -9.5, wheelOffset: 0.05 })
                    }
                    className="py-2 px-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-[10px] font-bold text-cyan-300"
                  >
                    Stance -9.5°
                  </button>
                </div>
              </div>
            </div>
          )}

          {garageTab === 'gearbox' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="bg-slate-900/90 border border-white/10 rounded-xl p-3">
                <div className="text-xs font-display font-bold text-white mb-2">
                  Transmission (P-R-N-D / Séquentielle)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(['auto', 'manual'] as TransmissionType[]).map((tr) => (
                    <button
                      key={tr}
                      type="button"
                      onClick={() => onUpdateSettings({ transmission: tr })}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border ${
                        settings.transmission === tr
                          ? 'bg-amber-500 text-slate-950 border-amber-300'
                          : 'bg-slate-950 border-white/10 text-slate-300'
                      }`}
                    >
                      {TRANSMISSION_LABELS[tr]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900/90 border border-white/10 rounded-xl p-3">
                <div className="text-xs font-display font-bold text-white mb-2">
                  Comportement Pneus & Drift
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['grip', 'balanced', 'drift'] as DrivingStyle[]).map((ds) => (
                    <button
                      key={ds}
                      type="button"
                      onClick={() => onUpdateSettings({ drivingStyle: ds })}
                      className={`py-2 px-2 rounded-xl text-[11px] font-bold border ${
                        settings.drivingStyle === ds
                          ? 'bg-amber-500 text-slate-950 border-amber-300'
                          : 'bg-slate-950 border-white/10 text-slate-300'
                      }`}
                    >
                      {DRIVING_STYLE_LABELS[ds]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900/90 border border-white/10 rounded-xl p-3 flex flex-col justify-between">
                <div className="text-xs font-display font-bold text-white mb-2">
                  Aides Électroniques (ABS / ESP / TCS)
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ absEspEnabled: !settings.absEspEnabled })}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-between ${
                    settings.absEspEnabled
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-slate-950 border-white/10 text-slate-400'
                  }`}
                >
                  <span>Stabilité ABS & ESP</span>
                  <span>{settings.absEspEnabled ? 'ACTIF' : 'DÉSACTIVÉ (DRIFT)'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 5. EXPANDED SETTINGS SCREEN ("Paramètres")
  if (screenState === 'settings') {
    return (
      <div className="fixed inset-0 z-20 bg-slate-950/88 flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-4xl bg-slate-900 border border-white/15 rounded-2xl p-5 sm:p-7 shadow-2xl my-auto">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <div className="text-xs font-semibold text-amber-400">
                PARAMÈTRES CAR PARKING MULTIPLAYER
              </div>
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-white">
                Contrôles, Caméra, Graphismes & Météo
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onSelectScreen(hasActiveSession ? 'paused' : 'main_menu')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
            >
              Fermer
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 my-5">
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2">
                  <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                  <span>Météo Dynamique & Adhérence Piste</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['clear', 'rain', 'fog', 'snow'] as WeatherType[]).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => onUpdateSettings({ weather: w })}
                      className={`py-2 px-2.5 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                        settings.weather === w
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                          : 'bg-slate-950 border-white/10 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {WEATHER_LABELS[w]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-300">
                    Cycle Jour / Nuit Dynamique 24h
                  </label>
                  <span className="font-mono-num text-xs font-bold text-amber-400">
                    Heure : {formatClock24h(telemetry.dayTimeHours ?? 13.5)}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                  {(['morning', 'afternoon', 'sunset', 'night'] as TimeOfDay[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onUpdateSettings({ timeOfDay: t })}
                      className={`py-2 px-2.5 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                        settings.timeOfDay === t
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                          : 'bg-slate-950 border-white/10 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {TIME_OF_DAY_LABELS[t]}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ dynamicDayNight: !settings.dynamicDayNight })
                  }
                  className={`w-full py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-between transition-colors ${
                    settings.dynamicDayNight
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-slate-950 border-white/10 text-slate-400'
                  }`}
                >
                  <span>Passage du Temps Automatique 24h</span>
                  <span>{settings.dynamicDayNight ? 'ACTIVÉ' : 'FIXE'}</span>
                </button>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2">
                  <Gauge className="w-3.5 h-3.5 text-amber-400" />
                  <span>Boîte de Vitesses</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['auto', 'manual'] as TransmissionType[]).map((tr) => (
                    <button
                      key={tr}
                      type="button"
                      onClick={() => onUpdateSettings({ transmission: tr })}
                      className={`py-2 px-3 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                        settings.transmission === tr
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                          : 'bg-slate-950 border-white/10 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {TRANSMISSION_LABELS[tr]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2">
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Vue Caméra (Touche C)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(
                    [
                      'chase_near',
                      'chase_far',
                      'top_parking',
                      'hood',
                      'cockpit',
                      'orbit_360',
                    ] as CameraMode[]
                  ).map((cam) => (
                    <button
                      key={cam}
                      type="button"
                      onClick={() => onUpdateSettings({ cameraMode: cam })}
                      className={`py-2 px-2.5 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                        settings.cameraMode === cam
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                          : 'bg-slate-950 border-white/10 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {CAMERA_LABELS[cam]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Densité du Trafic (Monde Ouvert)
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['off', 'light', 'dense'] as TrafficDensity[]).map((td) => (
                      <button
                        key={td}
                        type="button"
                        onClick={() => onUpdateSettings({ trafficDensity: td })}
                        className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                          settings.trafficDensity === td
                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                            : 'bg-slate-950 border-white/10 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {TRAFFIC_DENSITY_LABELS[td]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Qualité Graphique 3D
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(
                      [
                        { id: 'auto', label: 'Auto' },
                        { id: 'high', label: 'Haute' },
                        { id: 'medium', label: 'Moy.' },
                        { id: 'low', label: 'Éco' },
                      ] as Array<{ id: QualityPreset; label: string }>
                    ).map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => onUpdateSettings({ quality: q.id })}
                        className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                          settings.quality === q.id
                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                            : 'bg-slate-950 border-white/10 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-950 border border-white/10 rounded-xl p-3">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-300">Audio Moteur</span>
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
                      className="text-amber-400 font-semibold"
                    >
                      {settings.soundEnabled ? 'Activé' : 'Muet'}
                    </button>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.volume}
                    onChange={(e) => onUpdateSettings({ volume: parseFloat(e.target.value) })}
                    className="w-full accent-amber-500"
                  />
                </div>

                <div className="bg-slate-950 border border-white/10 rounded-xl p-3">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-300">Sensibilité Direction</span>
                    <span className="font-mono-num text-amber-400">
                      {Math.round(settings.steeringSensitivity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.6}
                    max={1.5}
                    step={0.05}
                    value={settings.steeringSensitivity}
                    onChange={(e) =>
                      onUpdateSettings({ steeringSensitivity: parseFloat(e.target.value) })
                    }
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => onSelectScreen(hasActiveSession ? 'paused' : 'main_menu')}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm transition-colors whitespace-nowrap shrink-0"
            >
              Enregistrer et Retourner
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 6. ARCHITECTURE PRINCIPALE CAR PARKING MULTIPLAYER — SHOWROOM 3D INTERACTIF
  // ============================================================================
  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-2.5 sm:p-5 select-none">
      {/* TOP BAR CAR PARKING MULTIPLAYER: Profil + Argent ($) + Fiche Voiture (HP / Nm) + Réglages */}
      <div className="flex flex-wrap items-center justify-between gap-2 pointer-events-auto bg-slate-950/88 border border-white/15 rounded-2xl px-3.5 py-2.5 shadow-2xl max-w-7xl w-full mx-auto">
        {/* Left: Driver Rank + Money ($) + Stars */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-900 border border-white/15">
            <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-display font-black text-xs flex items-center justify-center">
              CPM
            </div>
            <div>
              <div className="font-display font-extrabold text-xs sm:text-sm text-white leading-none">
                CAR PARKING <span className="text-amber-400">3D</span>
              </div>
              <div className="text-[10px] font-mono-num text-slate-400 mt-0.5">
                PILOTE NIV. {playerProgress.driverLevel || 1}
              </div>
            </div>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-mono-num font-extrabold text-xs sm:text-sm flex items-center gap-1 shadow">
            <span>$</span>
            <span>{playerMoney.toLocaleString('fr-FR')}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-300 font-mono-num font-bold text-xs">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span>
              {totalStarsEarned}/{maxPossibleStars}
            </span>
          </div>
        </div>

        {/* Center: Active Car Live Dyno & Spec Strip */}
        <div className="flex items-center gap-2 bg-slate-900/95 border border-white/15 rounded-xl px-3 py-1.5">
          <button
            type="button"
            onClick={() => onSelectCar(prevCar)}
            title="Voiture précédente"
            className="p-1 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="text-center px-2">
            <div className="flex items-center justify-center gap-1.5">
              <span className="font-display font-extrabold text-xs sm:text-sm text-white">
                {selectedCar.name}
              </span>
              <span className="px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-mono-num font-black text-[10px]">
                #{currentCarIndex + 1}/{CARS.length}
              </span>
            </div>
            <div className="flex items-center justify-center gap-2 text-[10px] font-mono-num mt-0.5">
              <span className="text-amber-400 font-bold">{dynoStats.hp} HP</span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400 font-bold">{dynoStats.nm} Nm</span>
              <span className="text-slate-600">•</span>
              <span className="text-sky-300 font-bold">{effectiveCar.maxSpeedKmh} KM/H</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectCar(nextCar)}
            title="Voiture suivante"
            className="p-1 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Environment Quick Toggles + Settings */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const order: TimeOfDay[] = ['morning', 'afternoon', 'sunset', 'night'];
              const next = order[(order.indexOf(settings.timeOfDay) + 1) % order.length];
              onUpdateSettings({ timeOfDay: next });
            }}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-xs font-mono-num font-bold text-amber-300 flex items-center gap-1"
            title="Changer l'éclairage du Showroom"
          >
            <span>{TIME_OF_DAY_LABELS[settings.timeOfDay]}</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectScreen('settings')}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-white transition-colors"
            title="Paramètres"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MIDDLE AREA: Left Sidebar Navigation (Car Parking Multiplayer Architecture) + Open 3D Car Center */}
      <div className="flex-1 flex items-center justify-between max-w-7xl w-full mx-auto my-2 pointer-events-none">
        {/* Left Navigation Stack (COMMENCER / GARAGE / ACHETER VOITURES / PARAMÈTRES) */}
        <div className="flex flex-col gap-2.5 pointer-events-auto w-48 sm:w-56">
          <button
            type="button"
            onClick={() => {
              setStartModalTab('levels');
              setShowStartModal(true);
            }}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 active:scale-[0.98] text-slate-950 font-display font-black text-sm sm:text-base flex items-center justify-between shadow-2xl shadow-emerald-500/30 border-2 border-white/40 transition-all"
          >
            <span>COMMENCER</span>
            <Play className="w-5 h-5 fill-current" />
          </button>

          <button
            type="button"
            onClick={() => {
              setGarageTab('engine');
              onSelectScreen('garage');
            }}
            className="w-full py-3 px-4 rounded-2xl bg-slate-950/90 hover:bg-slate-900 active:scale-[0.98] border-2 border-amber-400/60 text-white font-display font-extrabold text-xs sm:text-sm flex items-center justify-between shadow-xl transition-all"
          >
            <div className="text-left">
              <div>GARAGE & DYNO</div>
              <div className="text-[10px] font-mono-num text-amber-400 font-bold">
                Moteur · Extérieur · Suspension
              </div>
            </div>
            <Wrench className="w-4 h-4 text-amber-400 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onSelectScreen('car_select')}
            className="w-full py-3 px-4 rounded-2xl bg-slate-950/90 hover:bg-slate-900 active:scale-[0.98] border border-white/20 text-white font-display font-extrabold text-xs sm:text-sm flex items-center justify-between shadow-xl transition-all"
          >
            <div className="text-left">
              <div>VOITURES</div>
              <div className="text-[10px] font-mono-num text-slate-400">
                Concessionnaire ({CARS.length} modèles)
              </div>
            </div>
            <Car className="w-4 h-4 text-sky-400 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onSelectScreen('settings')}
            className="w-full py-2.5 px-4 rounded-2xl bg-slate-950/90 hover:bg-slate-900 active:scale-[0.98] border border-white/15 text-slate-200 font-display font-bold text-xs sm:text-sm flex items-center justify-between shadow-xl transition-all"
          >
            <span>PARAMÈTRES</span>
            <Settings className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          {hasActiveSession && (
            <button
              type="button"
              onClick={onResumeRace}
              className="w-full py-2.5 px-4 rounded-2xl bg-amber-500/25 hover:bg-amber-500/35 border border-amber-400 text-amber-300 font-display font-bold text-xs flex items-center justify-between shadow-xl transition-all"
            >
              <span>REPRENDRE PARTIE</span>
              <RotateCcw className="w-4 h-4 shrink-0" />
            </button>
          )}
        </div>

        {/* Right Side: Live Car Spec Card (Car Parking Multiplayer Showroom Spec Box) */}
        <div className="hidden md:flex flex-col gap-2 pointer-events-auto w-60 bg-slate-950/85 border border-white/15 rounded-2xl p-3.5 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-[10px] font-mono-num font-bold text-amber-400 uppercase">
              FICHE DYNO SHOWROOM
            </span>
            <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-mono-num text-white font-bold">
              {selectedCar.category}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono-num">
            <div className="bg-slate-900/90 rounded-xl p-2 border border-white/10">
              <div className="text-[9px] text-slate-400">PUISSANCE</div>
              <div className="font-extrabold text-sm text-amber-400">{dynoStats.hp} HP</div>
            </div>
            <div className="bg-slate-900/90 rounded-xl p-2 border border-white/10">
              <div className="text-[9px] text-slate-400">COUPLE</div>
              <div className="font-extrabold text-sm text-emerald-400">{dynoStats.nm} Nm</div>
            </div>
            <div className="bg-slate-900/90 rounded-xl p-2 border border-white/10">
              <div className="text-[9px] text-slate-400">VITESSE MAX</div>
              <div className="font-extrabold text-sm text-white">{effectiveCar.maxSpeedKmh} km/h</div>
            </div>
            <div className="bg-slate-900/90 rounded-xl p-2 border border-white/10">
              <div className="text-[9px] text-slate-400">CARROSSAGE</div>
              <div className="font-extrabold text-sm text-cyan-300">
                {(customization.camberAngleDeg ?? -1.5).toFixed(1)}°
              </div>
            </div>
          </div>

          <div className="flex gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => {
                setGarageTab('exterior');
                onSelectScreen('garage');
              }}
              className="flex-1 py-1.5 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-[10px] font-display font-bold text-amber-300"
            >
              PEINTURE & JANTES
            </button>
            <button
              type="button"
              onClick={() => {
                setGarageTab('suspension');
                onSelectScreen('garage');
              }}
              className="flex-1 py-1.5 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-[10px] font-display font-bold text-cyan-300"
            >
              STANCE / CAMBER
            </button>
          </div>
        </div>
      </div>

      {/* BOTTOM BAR: Direct 1-Click Launch Strip (Missions Parking / Monde Ouvert / Course IA) */}
      <div className="max-w-7xl w-full mx-auto pointer-events-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-slate-950/90 border border-white/15 rounded-2xl px-3.5 py-2.5 shadow-2xl">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono-num font-bold text-[10px]">
            360° SHOWROOM
          </span>
          <span className="truncate">
            Glissez sur la voiture 3D pour tourner autour · Cliquez sur un mode pour conduire immédiatement
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onStartNewRace('parking', parkingChallengeId)}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-display font-black text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>NIVEAUX PARKING (MISSION P{parkingChallengeId})</span>
          </button>

          <button
            type="button"
            onClick={() => onStartNewRace('free_drive')}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 active:scale-95 text-slate-950 font-display font-black text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all whitespace-nowrap"
          >
            <Navigation className="w-3.5 h-3.5 fill-current" />
            <span>MONDE OUVERT (VILLE & STATION)</span>
          </button>

          <button
            type="button"
            onClick={() => onStartNewRace('race')}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-display font-black text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all whitespace-nowrap"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>COURSE IA ({selectedTrack.name})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================
          MODAL "COMMENCER" CAR PARKING MULTIPLAYER :
          Onglet 1 : NIVEAUX (Missions Parking Précision P1–P6)
          Onglet 2 : MONDE OUVERT (SinglePlayer : Ville, Autoroute, Désert, Montagne)
          Onglet 3 : COURSE & CONTRE-LA-MONTRE
         ======================================================================== */}
      {showStartModal && (
        <div className="fixed inset-0 z-30 pointer-events-auto bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-5xl bg-slate-900 border-2 border-white/20 rounded-3xl p-4 sm:p-6 shadow-2xl max-h-[90vh] flex flex-col justify-between overflow-hidden">
            {/* Modal Header + 3 Tabs (NIVEAUX / MONDE OUVERT / COURSE) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-white/15 shrink-0">
              <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-white/15">
                <button
                  type="button"
                  onClick={() => setStartModalTab('levels')}
                  className={`px-4 py-2 rounded-xl font-display font-extrabold text-xs sm:text-sm transition-all ${
                    startModalTab === 'levels'
                      ? 'bg-emerald-500 text-slate-950 shadow-lg'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  1. NIVEAUX (PARKING)
                </button>
                <button
                  type="button"
                  onClick={() => setStartModalTab('singleplayer')}
                  className={`px-4 py-2 rounded-xl font-display font-extrabold text-xs sm:text-sm transition-all ${
                    startModalTab === 'singleplayer'
                      ? 'bg-sky-400 text-slate-950 shadow-lg'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  2. MONDE OUVERT (FREE DRIVE)
                </button>
                <button
                  type="button"
                  onClick={() => setStartModalTab('race')}
                  className={`px-4 py-2 rounded-xl font-display font-extrabold text-xs sm:text-sm transition-all ${
                    startModalTab === 'race'
                      ? 'bg-amber-500 text-slate-950 shadow-lg'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  3. COURSE & CHRONO
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowStartModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-display font-bold text-white"
              >
                FERMER ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="my-4 flex-1 overflow-y-auto pr-1">
              {startModalTab === 'levels' && (
                <div className="space-y-3">
                  <div className="bg-slate-950/90 border border-emerald-400/35 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-display font-bold text-sm text-emerald-300">
                        Missions d’École de Stationnement (Car Parking Multiplayer Levels)
                      </div>
                      <p className="text-xs text-slate-400">
                        Manœuvrez sans toucher les cônes orange jusqu’au cadre vert [P]. Utilisez la boîte P-R-N-D ou les pédales GAZ / FREIN.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {PARKING_CHALLENGES.map((ch) => {
                      const pStars = playerProgress.parkingStars?.[ch.id] ?? 0;
                      const isSel = parkingChallengeId === ch.id;
                      return (
                        <div
                          key={ch.id}
                          onClick={() => onSelectParkingChallenge(ch.id)}
                          className={`cursor-pointer rounded-2xl p-4 border-2 transition-all flex flex-col justify-between gap-3 ${
                            isSel
                              ? 'bg-emerald-500/15 border-emerald-400 shadow-xl'
                              : 'bg-slate-950/90 border-white/10 hover:border-emerald-400/50'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500 text-slate-950 font-mono-num font-black text-xs">
                                MISSION {ch.id}
                              </span>
                              {renderStarRating(pStars, 'w-4 h-4')}
                            </div>
                            <h3 className="font-display font-bold text-base text-white mt-2">
                              {ch.title.replace(/^Niveau \d+ — /, '')}
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">{ch.subtitle}</p>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-white/10">
                            <span className="font-mono-num font-extrabold text-sm text-emerald-400">
                              +${ch.rewardMoney.toLocaleString('fr-FR')}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowStartModal(false);
                                onSelectParkingChallenge(ch.id);
                                onStartNewRace('parking', ch.id);
                              }}
                              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-xs flex items-center gap-1.5 shadow-lg"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>ACCEPTER</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {startModalTab === 'singleplayer' && (
                <div className="space-y-4">
                  <div className="bg-slate-950/90 border border-sky-400/35 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-display font-bold text-sm text-sky-300">
                        Monde Ouvert (SinglePlayer Free Drive) — Choisissez votre Carte
                      </div>
                      <p className="text-xs text-slate-400">
                        Conduite libre avec trafic IA, Station-Service 24/7 pour faire le plein d’essence, clignotants et Mode Piéton (sortir du véhicule à pied).
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {TRACKS.map((track) => {
                      const active = track.id === selectedTrack.id;
                      return (
                        <div
                          key={track.id}
                          onClick={() => onSelectTrack(track)}
                          className={`cursor-pointer rounded-2xl p-3.5 border-2 transition-all flex flex-col justify-between ${
                            active
                              ? 'bg-sky-500/20 border-sky-400 shadow-xl'
                              : 'bg-slate-950/90 border-white/10 hover:border-sky-400/50'
                          }`}
                        >
                          <div>
                            <div className="text-[10px] font-mono-num text-sky-400 font-bold">
                              CARTE #{track.levelNumber} · {track.lengthKm} KM
                            </div>
                            <div className="font-display font-bold text-sm text-white mt-1">
                              {track.name}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                              {track.description}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowStartModal(false);
                              onSelectTrack(track);
                              onStartNewRace('free_drive');
                            }}
                            className="mt-3 w-full py-2 px-3 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-display font-extrabold text-xs flex items-center justify-center gap-1.5"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>ENTRER</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {startModalTab === 'race' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/90 border border-amber-400/35 rounded-2xl p-3">
                    <div className="font-display font-bold text-sm text-amber-300">
                      5 Circuits Officiels — Course contre l’IA ou Contre-la-Montre
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(['race', 'time_attack', 'exploration'] as GameMode[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => onSelectMode(m)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                            selectedMode === m
                              ? 'bg-amber-500 text-slate-950 border-amber-300'
                              : 'bg-slate-900 border-white/10 text-slate-300'
                          }`}
                        >
                          {m === 'race' ? 'Course IA' : m === 'time_attack' ? 'Chrono' : 'Exploration'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {TRACKS.map((track) => {
                      const stars = playerProgress.stars?.[track.id] ?? 0;
                      const isSel = track.id === selectedTrack.id;
                      return (
                        <div
                          key={track.id}
                          onClick={() => onSelectTrack(track)}
                          className={`cursor-pointer rounded-2xl p-3.5 border-2 transition-all flex flex-col justify-between ${
                            isSel
                              ? 'bg-amber-500/20 border-amber-400 shadow-xl'
                              : 'bg-slate-950/90 border-white/10 hover:border-amber-400/50'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono-num font-bold text-[10px]">
                                NIVEAU {track.levelNumber}
                              </span>
                              {renderStarRating(stars, 'w-3.5 h-3.5')}
                            </div>
                            <div className="font-display font-bold text-sm text-white mt-1.5">
                              {track.name}
                            </div>
                            <div className="text-[11px] text-amber-300/90 mt-0.5">
                              {track.aiCount ?? 3} IA · {track.defaultLaps} Tours
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowStartModal(false);
                              onSelectTrack(track);
                              onStartNewRace(
                                selectedMode === 'parking' || selectedMode === 'free_drive'
                                  ? 'race'
                                  : selectedMode
                              );
                            }}
                            className="mt-3 w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-extrabold text-xs flex items-center justify-center gap-1.5"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>LANCER</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
