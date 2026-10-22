import React, { useState } from 'react';
import {
  CAMERA_LABELS,
  CameraMode,
  CARS,
  CarCustomization,
  CarPerformanceUpgrades,
  CarSpec,
  DRIVING_STYLE_LABELS,
  DrivingStyle,
  GameMode,
  GameSettings,
  getEffectiveCarSpec,
  HEADLIGHT_SWATCHES,
  MedalTier,
  PAINT_SWATCHES,
  PaintFinish,
  PlayerProgress,
  QualityPreset,
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
import { formatRaceTime } from './HUD';
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
  settings: GameSettings;
  telemetry: TelemetryState;
  onSelectScreen: (screen: ScreenState) => void;
  onStartNewRace: (mode?: GameMode) => void;
  onNextLevel: () => void;
  onResumeRace: () => void;
  onSelectCar: (car: CarSpec) => void;
  onUpdateCustomization: (patch: Partial<CarCustomization>) => void;
  onUpdateUpgrades: (patch: Partial<CarPerformanceUpgrades>) => void;
  onSelectTrack: (track: TrackSpec) => void;
  onSelectMode: (mode: GameMode) => void;
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
    id: 'time_attack',
    title: 'Contre-la-montre',
    subtitle: 'Battez les chronos Or, Argent et Bronze sur trajectoire pure.',
    icon: Clock,
  },
  {
    id: 'free_drive',
    title: 'Course libre',
    subtitle: 'Conduisez librement à haute vitesse avec trafic réglable.',
    icon: Navigation,
  },
  {
    id: 'exploration',
    title: 'Mode exploration',
    subtitle: 'Explorez le niveau et découvrez les 8 balises d’intérêt.',
    icon: Compass,
  },
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
  onUpdateSettings,
}) => {
  const [garageTab, setGarageTab] = useState<'tuning' | 'paint'>('tuning');

  if (screenState === 'playing') return null;

  const effectiveCar = getEffectiveCarSpec(selectedCar, upgrades);
  const unlockedLevels = playerProgress.unlockedLevels || 1;
  const totalStarsEarned = TRACKS.reduce(
    (sum, t) => sum + (playerProgress.stars?.[t.id] ?? 0),
    0
  );
  const maxPossibleStars = TRACKS.length * 3;

  // 1. PAUSE MODAL
  if (screenState === 'paused') {
    return (
      <div className="fixed inset-0 z-30 bg-slate-950/80 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-white/15 rounded-2xl p-6 shadow-2xl">
          <div className="text-xs font-semibold text-amber-400 tracking-wider">
            NIVEAU {selectedTrack.levelNumber} · COURSE EN PAUSE
          </div>
          <h2 className="font-display font-bold text-3xl text-white mt-1">{selectedTrack.name}</h2>
          <p className="text-sm text-slate-400 mt-1">
            {selectedCar.name} · {MODE_OPTIONS.find((m) => m.id === selectedMode)?.title} ·{' '}
            {WEATHER_LABELS[settings.weather]}
          </p>

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onResumeRace}
              className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-base flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Reprendre la partie</span>
            </button>

            <button
              type="button"
              onClick={() => onStartNewRace()}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Recommencer la course</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectScreen('settings')}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Settings className="w-4 h-4" />
              <span>Paramètres & Réglages</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectScreen('main_menu')}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/10 text-slate-300 font-medium text-sm transition-colors whitespace-nowrap shrink-0"
            >
              Retour au menu principal
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. RACE FINISHED SUMMARY MODAL (4. ÉCRAN DE RÉSULTAT)
  if (screenState === 'finished') {
    const earnedStars = lastEarnedStars || playerProgress.stars?.[selectedTrack.id] || 1;
    const hasNextLevel = selectedTrack.levelNumber < TRACKS.length;
    const isNextLevelUnlocked =
      hasNextLevel &&
      (unlockedLevels >= selectedTrack.levelNumber + 1 ||
        telemetry.position <= 3 ||
        earnedStars >= 2);
    const standings = telemetry.standings && telemetry.standings.length > 0 ? telemetry.standings : [];

    return (
      <div className="fixed inset-0 z-30 bg-slate-950/88 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <div className="w-full max-w-lg bg-slate-900 border border-amber-400/40 rounded-2xl p-5 sm:p-7 shadow-2xl my-auto">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-amber-400 tracking-wider">
              FIN DE COURSE · NIVEAU {selectedTrack.levelNumber}
            </div>
            {isNextLevelUnlocked && (
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-xs font-semibold">
                Niveau {selectedTrack.levelNumber + 1} Débloqué !
              </span>
            )}
          </div>

          <h2 className="font-display font-bold text-2xl sm:text-3xl text-white mt-1">
            {telemetry.position === 1
              ? 'Victoire — 1re Place !'
              : telemetry.position <= 3
              ? `Podium — ${telemetry.position}e Place !`
              : 'Course Terminée'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            {selectedTrack.name} · {selectedCar.name}
          </p>

          {/* Prominent 3-Star Award Display */}
          <div className="my-4 py-3 px-4 rounded-2xl bg-slate-950/90 border border-amber-400/25 flex flex-col items-center justify-center gap-1.5">
            {renderStarRating(earnedStars, 'w-9 h-9')}
            <div className="text-xs font-semibold text-amber-300 text-center">
              {earnedStars === 3
                ? '3 Étoiles — Victoire (1re place) !'
                : earnedStars === 2
                ? '2 Étoiles — Top 3 atteint (Niveau suivant débloqué)'
                : '1 Étoile — Course terminée (Finissez dans le Top 3 pour débloquer la suite)'}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 mb-4">
            <div className="bg-slate-950 border border-white/10 rounded-xl p-3">
              <div className="text-[11px] text-slate-400">Classement</div>
              <div className="font-display font-bold text-2xl text-amber-400 font-mono-num mt-0.5">
                {telemetry.position === 1 ? '1er' : `${telemetry.position}e`}{' '}
                <span className="text-xs text-slate-500">/ {telemetry.totalRacers}</span>
              </div>
            </div>

            <div className="bg-slate-950 border border-white/10 rounded-xl p-3">
              <div className="text-[11px] text-slate-400">Temps Total</div>
              <div className="font-mono-num font-bold text-base sm:text-lg text-white mt-1">
                {formatRaceTime(telemetry.elapsedTime)}
              </div>
            </div>

            <div className="bg-slate-950 border border-white/10 rounded-xl p-3">
              <div className="text-[11px] text-slate-400">Meilleur Tour</div>
              <div className="font-mono-num font-bold text-base sm:text-lg text-emerald-400 mt-1">
                {formatRaceTime(telemetry.bestLapTime ?? telemetry.elapsedTime)}
              </div>
            </div>
          </div>

          {/* Full Race Classification Table (Player + Opponents) */}
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
                        : 'En piste (Classé)'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Large Mobile-Friendly Action Buttons: Rejouer, Niveau suivant, Menu */}
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
                    ? 'bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 shadow-lg'
                    : 'bg-slate-950 border border-white/10 text-slate-500 cursor-not-allowed'
                }`}
              >
                {isNextLevelUnlocked ? (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    <span>Niveau suivant</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Niveau suivant (Top 3 requis)</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => onSelectScreen('main_menu')}
              className="min-h-[50px] py-3.5 px-5 rounded-xl bg-slate-950 hover:bg-slate-800 active:scale-[0.98] border border-white/15 text-slate-200 font-display font-bold text-base transition-all whitespace-nowrap shrink-0"
            >
              Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. CAR SELECTION SCREEN ("Choisir sa voiture")
  if (screenState === 'car_select') {
    const currentIndex = CARS.findIndex((c) => c.id === selectedCar.id);
    const prevCar = CARS[(currentIndex - 1 + CARS.length) % CARS.length];
    const nextCar = CARS[(currentIndex + 1) % CARS.length];

    return (
      <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 sm:p-6">
        <div className="flex items-center justify-between pointer-events-auto bg-slate-950/90 border border-white/10 rounded-2xl px-5 py-3.5 max-w-5xl w-full mx-auto shadow-xl">
          <button
            type="button"
            onClick={() => onSelectScreen('main_menu')}
            className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Menu Principal</span>
          </button>
          <div className="font-display font-bold text-lg sm:text-xl text-white">Choisir sa Voiture</div>
          <button
            type="button"
            onClick={() => onSelectScreen('garage')}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-300 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Préparation & Garage</span>
          </button>
        </div>

        <div className="flex items-center justify-between max-w-5xl w-full mx-auto my-auto px-2">
          <button
            type="button"
            onClick={() => onSelectCar(prevCar)}
            aria-label="Voiture précédente"
            className="pointer-events-auto w-12 h-12 rounded-full bg-slate-950/90 border border-white/15 hover:border-amber-400 text-white flex items-center justify-center shadow-xl transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={() => onSelectCar(nextCar)}
            aria-label="Voiture suivante"
            className="pointer-events-auto w-12 h-12 rounded-full bg-slate-950/90 border border-white/15 hover:border-amber-400 text-white flex items-center justify-center shadow-xl transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        <div className="pointer-events-auto bg-slate-950/92 border border-white/15 rounded-2xl p-4 sm:p-6 max-w-5xl w-full mx-auto shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
            <div className="lg:col-span-5">
              <div className="text-xs text-amber-400 font-medium">{selectedCar.category}</div>
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-white mt-0.5">
                {selectedCar.name}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">{selectedCar.tagline}</p>

              <div className="flex flex-wrap gap-2 mt-4">
                {CARS.map((car) => (
                  <button
                    key={car.id}
                    type="button"
                    onClick={() => onSelectCar(car)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      car.id === selectedCar.id
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-900 border border-white/10 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {car.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Vitesse Max</span>
                  <span className="font-mono-num font-semibold text-white">
                    {effectiveCar.maxSpeedKmh} km/h
                  </span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all"
                    style={{ width: `${effectiveCar.stats.speed}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Accélération</span>
                  <span className="font-mono-num font-semibold text-white">
                    {effectiveCar.stats.accel}/100
                  </span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all"
                    style={{ width: `${effectiveCar.stats.accel}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Tenue de route</span>
                  <span className="font-mono-num font-semibold text-white">
                    {effectiveCar.stats.handling}/100
                  </span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 transition-all"
                    style={{ width: `${effectiveCar.stats.handling}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Freinage</span>
                  <span className="font-mono-num font-semibold text-white">
                    {effectiveCar.stats.braking}/100
                  </span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-400 transition-all"
                    style={{ width: `${effectiveCar.stats.braking}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => onStartNewRace()}
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Piloter cette voiture</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectScreen('main_menu')}
                className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                Confirmer la sélection
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. GARAGE CUSTOMIZATION & MECHANICAL UPGRADES SCREEN ("Garage")
  if (screenState === 'garage') {
    const upgradeItems: Array<{
      key: keyof CarPerformanceUpgrades;
      title: string;
      desc: string;
      statLabel: string;
      level: 1 | 2 | 3;
    }> = [
      {
        key: 'engineLevel',
        title: 'Cartographie Moteur V8/V10',
        desc: 'Augmente la vitesse de pointe et le couple à haut régime.',
        statLabel: `+${(upgrades.engineLevel - 1) * 14} km/h Vitesse Max`,
        level: upgrades.engineLevel,
      },
      {
        key: 'turboLevel',
        title: 'Compresseur Bi-Turbo & Nitro',
        desc: 'Améliore les reprises et la poussée d’accélération pure.',
        statLabel: `+${(upgrades.turboLevel - 1) * 12}% Accélération`,
        level: upgrades.turboLevel,
      },
      {
        key: 'tiresLevel',
        title: 'Pneumatiques Semi-Slicks Michelins',
        desc: 'Renforce l’adhérence latérale en courbe et sous la pluie.',
        statLabel: `+${(upgrades.tiresLevel - 1) * 8}% Grip Latéral`,
        level: upgrades.tiresLevel,
      },
      {
        key: 'brakesLevel',
        title: 'Freins Carbone-Céramique Ventilés',
        desc: 'Réduit les distances de freinage à l’approche des épingles.',
        statLabel: `+${(upgrades.brakesLevel - 1) * 13}% Puissance Frein`,
        level: upgrades.brakesLevel,
      },
    ];

    return (
      <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pointer-events-auto bg-slate-950/90 border border-white/10 rounded-2xl px-5 py-3.5 max-w-5xl w-full mx-auto shadow-xl">
          <button
            type="button"
            onClick={() => onSelectScreen('main_menu')}
            className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Menu Principal</span>
          </button>

          <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setGarageTab('tuning')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                garageTab === 'tuning'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Préparation Mécanique
            </button>
            <button
              type="button"
              onClick={() => setGarageTab('paint')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                garageTab === 'paint'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Carrosserie & Esthétique
            </button>
          </div>

          <button
            type="button"
            onClick={() => onStartNewRace()}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Essayer sur piste</span>
          </button>
        </div>

        <div className="pointer-events-auto bg-slate-950/92 border border-white/15 rounded-2xl p-4 sm:p-6 max-w-5xl w-full mx-auto shadow-2xl">
          {/* Top live performance summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-4 mb-4 border-b border-white/10 text-xs">
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Vitesse Max</span>
                <span className="font-mono-num font-bold text-amber-400">
                  {effectiveCar.maxSpeedKmh} km/h
                </span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all"
                  style={{ width: `${effectiveCar.stats.speed}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Accélération</span>
                <span className="font-mono-num font-bold text-emerald-400">
                  {effectiveCar.stats.accel}/100
                </span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all"
                  style={{ width: `${effectiveCar.stats.accel}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Tenue de route</span>
                <span className="font-mono-num font-bold text-cyan-400">
                  {effectiveCar.stats.handling}/100
                </span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-400 transition-all"
                  style={{ width: `${effectiveCar.stats.handling}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Freinage</span>
                <span className="font-mono-num font-bold text-rose-400">
                  {effectiveCar.stats.braking}/100
                </span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-400 transition-all"
                  style={{ width: `${effectiveCar.stats.braking}%` }}
                />
              </div>
            </div>
          </div>

          {garageTab === 'tuning' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {upgradeItems.map((item) => (
                <div
                  key={item.key}
                  className="bg-slate-900/90 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-display font-bold text-sm text-white">{item.title}</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/40 text-amber-300 font-mono-num text-[11px] font-semibold whitespace-nowrap shrink-0">
                      {item.statLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {([1, 2, 3] as const).map((lvl) => {
                      const active = item.level === lvl;
                      return (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => onUpdateUpgrades({ [item.key]: lvl })}
                          className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                            active
                              ? 'bg-amber-500 text-slate-950 border-amber-400'
                              : 'bg-slate-950 border-white/10 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          {lvl === 1 ? 'Niv. 1 Série' : lvl === 2 ? 'Niv. 2 Sport' : 'Niv. 3 Course'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <div className="text-xs font-semibold text-slate-300 mb-2.5">Teinte de Carrosserie</div>
                <div className="flex flex-wrap gap-2">
                  {PAINT_SWATCHES.map((swatch) => {
                    const active = customization.bodyColor.toLowerCase() === swatch.hex.toLowerCase();
                    return (
                      <button
                        key={swatch.hex}
                        type="button"
                        onClick={() => onUpdateCustomization({ bodyColor: swatch.hex })}
                        title={swatch.name}
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-transform ${
                          active ? 'border-white scale-110' : 'border-white/20 hover:scale-105'
                        }`}
                        style={{ backgroundColor: swatch.hex }}
                      >
                        {active && <Check className="w-4 h-4 text-slate-950 stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>

                <div className="text-xs font-semibold text-slate-300 mt-4 mb-2">Finition Peinture</div>
                <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-white/10">
                  {(['metallic', 'matte', 'chrome'] as PaintFinish[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => onUpdateCustomization({ finish: f })}
                      className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        customization.finish === f
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {f === 'metallic' ? 'Métallisée' : f === 'matte' ? 'Mate Satin' : 'Chrome Pur'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-300 mb-2.5">Couleur des Jantes Forgées</div>
                <div className="flex flex-wrap gap-2">
                  {RIM_SWATCHES.map((swatch) => {
                    const active = customization.rimColor.toLowerCase() === swatch.hex.toLowerCase();
                    return (
                      <button
                        key={swatch.hex}
                        type="button"
                        onClick={() => onUpdateCustomization({ rimColor: swatch.hex })}
                        title={swatch.name}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'border-amber-400 bg-amber-500/15 text-white'
                            : 'border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full border border-white/30"
                          style={{ backgroundColor: swatch.hex }}
                        />
                        <span>{swatch.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-300 mb-2.5">Optiques de Phares LED</div>
                  <div className="flex flex-wrap gap-2">
                    {HEADLIGHT_SWATCHES.map((swatch) => {
                      const active =
                        customization.headlightColor.toLowerCase() === swatch.hex.toLowerCase();
                      return (
                        <button
                          key={swatch.hex}
                          type="button"
                          onClick={() => onUpdateCustomization({ headlightColor: swatch.hex })}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                            active
                              ? 'border-amber-400 bg-amber-500/15 text-white'
                              : 'border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: swatch.hex }}
                          />
                          <span>{swatch.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateCustomization({ neonUnderglow: !customization.neonUnderglow })
                      }
                      className={`w-full py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-colors ${
                        customization.neonUnderglow
                          ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200'
                          : 'border-white/10 bg-slate-900 text-slate-400'
                      }`}
                    >
                      <span>Éclairage Châssis Néon</span>
                      <span>{customization.neonUnderglow ? 'ACTIVÉ' : 'DÉSACTIVÉ'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Note: 'track_select' and 'main_menu' now both render the full 7-Level Hub directly below


  // 6. EXPANDED SETTINGS SCREEN ("Paramètres")
  if (screenState === 'settings') {
    return (
      <div className="fixed inset-0 z-20 bg-slate-950/88 flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-4xl bg-slate-900 border border-white/15 rounded-2xl p-5 sm:p-7 shadow-2xl my-auto">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <div className="text-xs font-semibold text-amber-400">
                CONFIGURATION & AIDES AU PILOTAGE
              </div>
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-white">
                Paramètres Avancés du Jeu
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
            {/* LEFT COLUMN: Environment, Weather & Driving Physics */}
            <div className="space-y-4">
              {/* Weather */}
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

              {/* Time of Day */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Moment de la Journée & Éclairage Solaire
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
              </div>

              {/* Transmission */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2">
                  <Gauge className="w-3.5 h-3.5 text-amber-400" />
                  <span>Boîte de Vitesses (Touches E / R ou Palettes Tactiles)</span>
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

              {/* Driving Style & ABS/ESP */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2">
                  <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Comportement Châssis & Mode Drift</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['grip', 'balanced', 'drift'] as DrivingStyle[]).map((ds) => (
                    <button
                      key={ds}
                      type="button"
                      onClick={() => onUpdateSettings({ drivingStyle: ds })}
                      className={`py-2 px-2.5 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                        settings.drivingStyle === ds
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                          : 'bg-slate-950 border-white/10 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {DRIVING_STYLE_LABELS[ds]}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ absEspEnabled: !settings.absEspEnabled })
                    }
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-between transition-colors whitespace-nowrap shrink-0 ${
                      settings.absEspEnabled
                        ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300'
                        : 'bg-slate-950 border-white/10 text-slate-400'
                    }`}
                  >
                    <span>Aides ABS & ESP</span>
                    <span>{settings.absEspEnabled ? 'ACTIVES' : 'OFF'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ rearViewMirror: !settings.rearViewMirror })
                    }
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-between transition-colors whitespace-nowrap shrink-0 ${
                      settings.rearViewMirror
                        ? 'bg-sky-500/15 border-sky-400 text-sky-300'
                        : 'bg-slate-950 border-white/10 text-slate-400'
                    }`}
                  >
                    <span>Rétroviseur Central</span>
                    <span>{settings.rearViewMirror ? 'AFFICHÉ' : 'MASQUÉ'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Camera, FOV, Traffic, AI & Audio */}
            <div className="space-y-4">
              {/* Camera Mode */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2">
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Vue Caméra (Touche C · Regarder derrière : Touche B)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['chase_near', 'chase_far', 'hood', 'cockpit'] as CameraMode[]).map((cam) => (
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

                {/* Camera FOV & Distance Sliders */}
                <div className="grid grid-cols-2 gap-3 mt-2.5">
                  <div className="bg-slate-950 border border-white/10 rounded-xl p-2.5">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-300 font-medium">Champ de Vision (FOV)</span>
                      <span className="font-mono-num text-amber-400">
                        {settings.cameraFovOffset >= 0
                          ? `+${settings.cameraFovOffset}°`
                          : `${settings.cameraFovOffset}°`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-8}
                      max={12}
                      step={2}
                      value={settings.cameraFovOffset}
                      onChange={(e) =>
                        onUpdateSettings({ cameraFovOffset: parseFloat(e.target.value) })
                      }
                      className="w-full accent-amber-500"
                    />
                  </div>

                  <div className="bg-slate-950 border border-white/10 rounded-xl p-2.5">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-300 font-medium">Distance Caméra</span>
                      <span className="font-mono-num text-amber-400">
                        {settings.cameraDistanceOffset >= 0
                          ? `+${settings.cameraDistanceOffset.toFixed(1)}m`
                          : `${settings.cameraDistanceOffset.toFixed(1)}m`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-1.2}
                      max={2.0}
                      step={0.2}
                      value={settings.cameraDistanceOffset}
                      onChange={(e) =>
                        onUpdateSettings({ cameraDistanceOffset: parseFloat(e.target.value) })
                      }
                      className="w-full accent-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Opponents Count, AI Difficulty & Traffic Density */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Difficulté IA & Opposants ({settings.aiCount})
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 mb-2">
                    {(
                      [
                        { id: 'normal', label: 'Standard' },
                        { id: 'pro', label: 'Pro' },
                        { id: 'legend', label: 'Légende' },
                      ] as const
                    ).map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => onUpdateSettings({ aiDifficulty: d.id })}
                        className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                          settings.aiDifficulty === d.id
                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                            : 'bg-slate-950 border-white/10 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={7}
                    step={1}
                    value={settings.aiCount}
                    onChange={(e) =>
                      onUpdateSettings({ aiCount: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Densité du Trafic (Course Libre)
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
              </div>

              {/* Graphics Quality & Touch Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Volant Tactile à l’Écran
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'auto', label: 'Auto' },
                        { id: 'always', label: 'Afficher' },
                        { id: 'off', label: 'Masquer' },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onUpdateSettings({ touchControlsMode: m.id })}
                        className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                          settings.touchControlsMode === m.id
                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                            : 'bg-slate-950 border-white/10 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Audio & Steering Sensitivity */}
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

  // 7. MENU DES NIVEAUX (5 Niveaux avec étoiles 0-3, cadenas et gros boutons tactiles)
  const handleQuickStartSelectedTrack = () => {
    onUpdateSettings({
      timeOfDay: selectedTrack.defaultTimeOfDay,
      weather: selectedTrack.defaultWeather,
      aiCount: selectedTrack.aiCount ?? 3,
    });
    onStartNewRace('race');
  };

  return (
    <div className="fixed inset-0 z-20 pointer-events-auto flex flex-col justify-between p-2.5 sm:p-5 overflow-hidden bg-slate-950/65 backdrop-blur-[2px]">
      {/* Top Header & Navigation Bar */}
      <div className="max-w-7xl w-full mx-auto shrink-0">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-2.5 bg-slate-950/95 border border-white/15 rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-2xl">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <svg className="w-8 h-8 sm:w-9 sm:h-9 text-amber-400 shrink-0" viewBox="0 0 48 48" fill="none">
                <path
                  d="M6 34L16 14H34L42 24L32 34H6Z"
                  stroke="currentColor"
                  strokeWidth="3.2"
                  strokeLinejoin="round"
                />
                <path d="M16 24H36" stroke="#38bdf8" strokeWidth="2.8" strokeLinecap="round" />
                <circle cx="16" cy="34" r="4" fill="currentColor" />
                <circle cx="32" cy="34" r="4" fill="currentColor" />
              </svg>
              <div>
                <h1 className="font-display font-bold text-lg sm:text-2xl tracking-tight text-white leading-none">
                  APEX HORIZON <span className="text-amber-400">3D</span>
                </h1>
                <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
                  5 Niveaux · Top 3 pour débloquer la suite
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-amber-400/30 text-xs text-amber-300 font-semibold font-mono-num shrink-0 sm:hidden">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>
                {totalStarsEarned}/{maxPossibleStars}
              </span>
            </div>
          </div>

          {/* Primary Play Button + Secondary Controls */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleQuickStartSelectedTrack}
              className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all whitespace-nowrap shrink-0"
            >
              <Play className="w-4 h-4 fill-current shrink-0" />
              <span>COMMENCER (NIVEAU {selectedTrack.levelNumber})</span>
            </button>

            <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-amber-400/30 text-xs text-amber-300 font-semibold font-mono-num">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span>
                {totalStarsEarned} / {maxPossibleStars} Étoiles
              </span>
            </div>

            {hasActiveSession && (
              <button
                type="button"
                onClick={onResumeRace}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-300 font-display font-bold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reprendre</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onSelectScreen('car_select')}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Car className="w-3.5 h-3.5 text-amber-400" />
              <span>{selectedCar.name}</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectScreen('garage')}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Wrench className="w-3.5 h-3.5 text-emerald-400" />
              <span>Garage</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectScreen('settings')}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Settings className="w-3.5 h-3.5 text-slate-300" />
              <span>Réglages</span>
            </button>
          </div>

          {/* Quick 5-Level Selector Strip (Always visible on mobile & desktop) */}
          <div className="w-full pt-1.5 border-t border-white/10 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {TRACKS.map((t) => {
              const active = t.id === selectedTrack.id;
              const roadSwatch: Record<number, string> = {
                1: '#38bdf8',
                2: '#facc15',
                3: '#fb923c',
                4: '#22d3ee',
                5: '#ef4444',
              };
              const dotColor = roadSwatch[t.levelNumber] || '#fbbf24';
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    onSelectTrack(t);
                    onUpdateSettings({
                      timeOfDay: t.defaultTimeOfDay,
                      weather: t.defaultWeather,
                      aiCount: t.aiCount ?? 3,
                    });
                    const el = document.getElementById(`level-card-${t.levelNumber}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  }}
                  className={`flex-1 min-w-[64px] min-h-[38px] px-2.5 py-1.5 rounded-xl font-display font-bold text-xs flex items-center justify-center gap-1.5 border transition-all shrink-0 ${
                    active
                      ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md'
                      : 'bg-slate-900/90 text-slate-200 border-white/15 hover:border-amber-400/60'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/30"
                    style={{ backgroundColor: dotColor }}
                  />
                  <span>Niv. {t.levelNumber}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content: 5 LEVEL CARDS (Niveau 1 à 5) */}
      <div className="max-w-7xl w-full mx-auto my-2 sm:my-3 flex-1 min-h-0 overflow-y-auto pr-0.5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 pb-2">
          {TRACKS.map((track) => {
            const isProgressionLocked = track.levelNumber > unlockedLevels;
            const isSelected = track.id === selectedTrack.id;
            const stars = playerProgress.stars?.[track.id] ?? 0;
            const bestLap = playerProgress.bestLapTimes?.[track.id] ?? null;
            const bestTotal = playerProgress.bestTotalTimes?.[track.id] ?? null;

            // Compute normalized 2D SVG points for the track's unique spline waypoints
            const xs = track.waypoints.map((w) => w[0]);
            const zs = track.waypoints.map((w) => w[2]);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minZ = Math.min(...zs);
            const maxZ = Math.max(...zs);
            const spanX = Math.max(1, maxX - minX);
            const spanZ = Math.max(1, maxZ - minZ);
            const pad = 12;
            const svgW = 160;
            const svgH = 84;
            const scale = Math.min((svgW - pad * 2) / spanX, (svgH - pad * 2) / spanZ);
            const offsetX = (svgW - spanX * scale) / 2;
            const offsetZ = (svgH - spanZ * scale) / 2;
            const svgPts = track.waypoints.map(([wx, , wz]) => ({
              x: offsetX + (wx - minX) * scale,
              y: offsetZ + (wz - minZ) * scale,
            }));
            const pathD =
              svgPts
                .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                .join(' ') + ' Z';
            const startPt = svgPts[0] || { x: 80, y: 42 };
            const strokePalette: Record<number, string> = {
              1: '#38bdf8',
              2: '#facc15',
              3: '#fb923c',
              4: '#22d3ee',
              5: '#ef4444',
            };
            const trackStroke = strokePalette[track.levelNumber] || '#fbbf24';

            const handleStartThisTrack = (e: React.MouseEvent) => {
              e.stopPropagation();
              onSelectTrack(track);
              onUpdateSettings({
                timeOfDay: track.defaultTimeOfDay,
                weather: track.defaultWeather,
                aiCount: track.aiCount ?? 3,
              });
              onStartNewRace('race');
            };

            return (
              <div
                id={`level-card-${track.levelNumber}`}
                key={track.id}
                onClick={() => {
                  onSelectTrack(track);
                  onUpdateSettings({
                    timeOfDay: track.defaultTimeOfDay,
                    weather: track.defaultWeather,
                    aiCount: track.aiCount ?? 3,
                  });
                }}
                className={`relative rounded-2xl p-3.5 sm:p-4 border transition-all flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900/95 border-amber-400 shadow-2xl ring-2 ring-amber-400/40'
                    : 'bg-slate-950/90 border-white/15 hover:border-amber-400/50 hover:bg-slate-900/85'
                }`}
              >
                <div>
                  {/* Top Row: Level Number Badge + Stars + Quick Play Button */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`px-2.5 py-1 rounded-lg font-display font-bold text-xs tracking-wide ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-amber-500/20 border border-amber-400/50 text-amber-300'
                      }`}
                    >
                      NIVEAU {track.levelNumber}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {isProgressionLocked && (
                        <span
                          title={`Terminez dans le Top 3 au Niveau ${track.levelNumber - 1}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 border border-white/10 text-slate-400 text-[10px] font-semibold"
                        >
                          <Lock className="w-3 h-3 text-slate-400" />
                        </span>
                      )}
                      {renderStarRating(stars, 'w-3.5 h-3.5 sm:w-4 sm:h-4')}
                    </div>
                  </div>

                  {/* Mini SVG Circuit Layout Preview */}
                  <div className="w-full h-16 sm:h-20 rounded-xl bg-slate-950/90 border border-white/10 flex items-center justify-center mb-2 overflow-hidden relative">
                    <svg
                      viewBox={`0 0 ${svgW} ${svgH}`}
                      className="w-full h-full"
                      aria-label={`Tracé ${track.name}`}
                    >
                      <path
                        d={pathD}
                        fill="none"
                        stroke="rgba(255,255,255,0.14)"
                        strokeWidth="6"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                      <path
                        d={pathD}
                        fill="none"
                        stroke={trackStroke}
                        strokeWidth="2.8"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                      <circle
                        cx={startPt.x}
                        cy={startPt.y}
                        r="3.8"
                        fill="#ffffff"
                        stroke={trackStroke}
                        strokeWidth="2"
                      />
                    </svg>
                    <span className="absolute bottom-1 right-2 text-[10px] font-mono-num text-slate-400">
                      {track.lengthKm} km
                    </span>
                  </div>

                  {/* Circuit Name & Subtitle */}
                  <h3 className="font-display font-bold text-base sm:text-lg text-white leading-snug">
                    {track.name}
                  </h3>
                  <div className="text-xs text-amber-300/90 font-semibold mt-0.5">
                    {track.aiCount ?? 3} Adversaires · {track.defaultLaps} Tours · {track.difficulty}
                  </div>
                  <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                    {track.description}
                  </p>

                  {/* Ambiance & Best Time Row */}
                  <div className="mt-2 pt-1.5 border-t border-white/10 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-1 font-mono-num">
                    <span>
                      {TIME_OF_DAY_LABELS[track.defaultTimeOfDay]} · {WEATHER_LABELS[track.defaultWeather]}
                    </span>
                    <span className="text-emerald-400 font-semibold">
                      {bestTotal
                        ? formatRaceTime(bestTotal)
                        : bestLap
                        ? `${bestLap.toFixed(1)}s`
                        : '—'}
                    </span>
                  </div>
                </div>

                {/* Large Mobile Touch Action Button */}
                <div className="mt-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleStartThisTrack}
                    className={`w-full min-h-[46px] py-2.5 px-4 rounded-xl font-display font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all whitespace-nowrap shrink-0 shadow-lg ${
                      isSelected
                        ? 'bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950'
                        : 'bg-slate-800 hover:bg-amber-500 hover:text-slate-950 active:scale-[0.98] text-white border border-white/15'
                    }`}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>JOUER NIVEAU {track.levelNumber}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky Bottom Action Bar + Legend */}
      <div className="max-w-7xl w-full mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-slate-950/95 border border-white/15 rounded-2xl px-3.5 py-2.5 shrink-0 shadow-2xl">
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300">
          <span>
            ★ 1 Étoile : Terminer · ★★ 2 Étoiles : Top 3 · ★★★ 3 Étoiles : 1re Place
          </span>
          <span className="text-slate-500">|</span>
          <span>
            Voiture : <strong className="text-white">{selectedCar.name}</strong>
          </span>
        </div>

        <button
          type="button"
          onClick={handleQuickStartSelectedTrack}
          className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:scale-[0.99] text-slate-950 font-display font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-xl shadow-amber-500/30 transition-all"
        >
          <Play className="w-5 h-5 fill-current shrink-0" />
          <span>
            COMMENCER LA COURSE — NIVEAU {selectedTrack.levelNumber} ({selectedTrack.name})
          </span>
        </button>
      </div>
    </div>
  );
};
