import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CameraMode,
  CARS,
  CarCustomization,
  CarPerformanceUpgrades,
  CarSpec,
  DEFAULT_UPGRADES,
  GameMode,
  GameSettings,
  getEffectiveCarSpec,
  MedalTier,
  PlayerProgress,
  ScreenState,
  TelemetryState,
  TimeOfDay,
  TRACKS,
  TrackSpec,
  WeatherType,
} from './types/game';
import { RacingCanvas, TouchInputState } from './components/RacingCanvas';
import { HUD } from './components/HUD';
import { TouchControls } from './components/TouchControls';
import { MainMenu } from './components/MainMenu';
import { soundEngine } from './audio/soundEngine';

const INITIAL_TELEMETRY: TelemetryState = {
  speedKmh: 0,
  rpm: 1000,
  gear: 1,
  lap: 1,
  totalLaps: 3,
  elapsedTime: 0,
  currentLapTime: 0,
  bestLapTime: null,
  position: 1,
  totalRacers: 6,
  countdown: 3,
  nitroAmount: 100,
  nitroActive: false,
  drifting: false,
  steerRatio: 0,
  surfaceType: 'asphalt',
  gripPercent: 100,
  headlightsOn: true,
  discoveredPoints: 0,
  totalDiscoveryPoints: 8,
  lastCheckpointBanner: null,
  fps: 60,
  activeQualityTier: 'high',
  lookingBack: false,
  minimapPoints: [],
  playerPos: { x: 0, z: 0, heading: 0 },
  opponentsPos: [],
  rearOpponents: [],
  discoveryBeacons: [],
};

const CAMERA_CYCLE: CameraMode[] = ['chase_near', 'chase_far', 'hood', 'cockpit'];
const TIME_CYCLE: TimeOfDay[] = ['morning', 'afternoon', 'sunset', 'night'];
const WEATHER_CYCLE: WeatherType[] = ['clear', 'rain', 'fog', 'snow'];

const STORAGE_UPGRADES_KEY = 'apex_horizon_car_upgrades_v2';
const STORAGE_PROGRESS_KEY = 'apex_horizon_player_progress_v3';

const DEFAULT_PROGRESS: PlayerProgress = {
  xp: 0,
  driverLevel: 1,
  unlockedLevels: 1,
  stars: {},
  medals: {},
  bestLapTimes: {},
  bestTotalTimes: {},
  completedChallenges: {},
};

const MEDAL_RANK: Record<MedalTier, number> = {
  none: 0,
  bronze: 1,
  silver: 2,
  gold: 3,
};

export default function App() {
  const [selectedCar, setSelectedCar] = useState<CarSpec>(CARS[0]);
  const [customization, setCustomization] = useState<CarCustomization>({
    bodyColor: CARS[0].defaultColor,
    rimColor: CARS[0].defaultRimColor,
    finish: 'metallic',
    headlightColor: '#ffffff',
    neonUnderglow: false,
  });

  const [carUpgradesByCar, setCarUpgradesByCar] = useState<Record<string, CarPerformanceUpgrades>>(
    () => {
      try {
        const raw = localStorage.getItem(STORAGE_UPGRADES_KEY);
        if (raw) {
          return JSON.parse(raw);
        }
      } catch {
        // Ignore storage errors
      }
      return {};
    }
  );

  const [playerProgress, setPlayerProgress] = useState<PlayerProgress>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_PROGRESS_KEY);
      if (raw) {
        return { ...DEFAULT_PROGRESS, ...JSON.parse(raw) };
      }
    } catch {
      // Ignore storage errors
    }
    return DEFAULT_PROGRESS;
  });

  const [selectedTrack, setSelectedTrack] = useState<TrackSpec>(TRACKS[0]);
  const [selectedMode, setSelectedMode] = useState<GameMode>('race');
  const [screenState, setScreenState] = useState<ScreenState>('main_menu');
  const [hasActiveSession, setHasActiveSession] = useState<boolean>(false);
  const [raceSessionId, setRaceSessionId] = useState<number>(1);
  const [lastEarnedStars, setLastEarnedStars] = useState<0 | 1 | 2 | 3>(0);

  const [settings, setSettings] = useState<GameSettings>({
    quality: 'auto',
    timeOfDay: TRACKS[0].defaultTimeOfDay,
    weather: TRACKS[0].defaultWeather,
    soundEnabled: true,
    volume: 0.7,
    touchControlsMode: 'always',
    steeringSensitivity: 1.0,
    cameraMode: 'chase_near',
    cameraFovOffset: 0,
    cameraDistanceOffset: 0,
    rearViewMirror: true,
    transmission: 'auto',
    drivingStyle: 'balanced',
    absEspEnabled: true,
    aiDifficulty: 'pro',
    aiCount: 5,
    trafficDensity: 'light',
  });

  const [telemetry, setTelemetry] = useState<TelemetryState>(INITIAL_TELEMETRY);
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(true);

  const touchInputRef = useRef<TouchInputState>({
    throttle: false,
    brake: false,
    left: false,
    right: false,
    nitro: false,
    steerInput: 0,
    lookBack: false,
    shiftUpQueued: false,
    shiftDownQueued: false,
  });

  useEffect(() => {
    const checkTouch = () => {
      const hasTouch =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches ||
        window.innerWidth < 1024;
      setIsTouchDevice(hasTouch);
    };
    checkTouch();
    window.addEventListener('resize', checkTouch);
    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  const currentCarUpgrades: CarPerformanceUpgrades = useMemo(
    () => carUpgradesByCar[selectedCar.id] ?? DEFAULT_UPGRADES,
    [carUpgradesByCar, selectedCar.id]
  );

  const effectiveCarSpec = useMemo(
    () => getEffectiveCarSpec(selectedCar, currentCarUpgrades),
    [selectedCar, currentCarUpgrades]
  );

  const handleSelectCar = useCallback((car: CarSpec) => {
    setSelectedCar(car);
    setCustomization((prev) => ({
      ...prev,
      bodyColor: car.defaultColor,
      rimColor: car.defaultRimColor,
    }));
  }, []);

  const handleUpdateCustomization = useCallback((patch: Partial<CarCustomization>) => {
    setCustomization((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleUpdateUpgrades = useCallback(
    (patch: Partial<CarPerformanceUpgrades>) => {
      setCarUpgradesByCar((prev) => {
        const current = prev[selectedCar.id] ?? DEFAULT_UPGRADES;
        const nextForCar = { ...current, ...patch };
        const updated = { ...prev, [selectedCar.id]: nextForCar };
        try {
          localStorage.setItem(STORAGE_UPGRADES_KEY, JSON.stringify(updated));
        } catch {
          // Ignore storage errors
        }
        return updated;
      });
    },
    [selectedCar.id]
  );

  const handleUpdateSettings = useCallback((patch: Partial<GameSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleStartNewRace = useCallback((modeOverride?: GameMode) => {
    soundEngine.init();
    if (modeOverride) {
      setSelectedMode(modeOverride);
    }
    touchInputRef.current = {
      throttle: false,
      brake: false,
      left: false,
      right: false,
      nitro: false,
      steerInput: 0,
      lookBack: false,
      shiftUpQueued: false,
      shiftDownQueued: false,
    };
    setRaceSessionId((id) => id + 1);
    setHasActiveSession(true);
    setScreenState('playing');
  }, []);

  const handleResumeRace = useCallback(() => {
    soundEngine.init();
    setScreenState('playing');
  }, []);

  const handlePauseToggle = useCallback(() => {
    setScreenState((prev) => (prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev));
  }, []);

  const handleRaceFinish = useCallback(
    (finalTelemetry: TelemetryState) => {
      setTelemetry(finalTelemetry);
      setHasActiveSession(false);
      setScreenState('finished');

      // 5. ÉTOILES : 1 étoile si on termine, 2 si on finit dans les 3 premiers, 3 si on gagne
      let earnedStars: 0 | 1 | 2 | 3 = 1;
      let earnedMedal: MedalTier = 'none';

      if (selectedMode === 'race') {
        if (finalTelemetry.position === 1) {
          earnedStars = 3;
          earnedMedal = 'gold';
        } else if (finalTelemetry.position <= 3) {
          earnedStars = 2;
          earnedMedal = finalTelemetry.position === 2 ? 'silver' : 'bronze';
        } else {
          earnedStars = 1;
          earnedMedal = 'none';
        }
      } else if (selectedMode === 'time_attack' && finalTelemetry.bestLapTime !== null) {
        if (finalTelemetry.bestLapTime <= selectedTrack.targetGoldSec) {
          earnedStars = 3;
          earnedMedal = 'gold';
        } else if (finalTelemetry.bestLapTime <= selectedTrack.targetSilverSec) {
          earnedStars = 2;
          earnedMedal = 'silver';
        } else {
          earnedStars = 1;
          earnedMedal = 'bronze';
        }
      } else if (selectedMode === 'exploration') {
        earnedStars = 3;
        earnedMedal = 'gold';
      }

      setLastEarnedStars(earnedStars);

      // 2. PROGRESSION : débloque le niveau suivant en terminant dans les 3 premiers (ou >= 2 étoiles). Sauvegarde dans localStorage.
      setPlayerProgress((prev) => {
        const prevStars = prev.stars?.[selectedTrack.id] ?? 0;
        const bestStars = (Math.max(prevStars, earnedStars) as 0 | 1 | 2 | 3);

        const prevMedal = prev.medals?.[selectedTrack.id] ?? 'none';
        const bestMedal =
          MEDAL_RANK[earnedMedal] > MEDAL_RANK[prevMedal] ? earnedMedal : prevMedal;

        const prevBestLap = prev.bestLapTimes?.[selectedTrack.id] ?? null;
        const newBestLap =
          finalTelemetry.bestLapTime !== null &&
          (prevBestLap === null || finalTelemetry.bestLapTime < prevBestLap)
            ? finalTelemetry.bestLapTime
            : prevBestLap;

        const prevBestTotal = prev.bestTotalTimes?.[selectedTrack.id] ?? null;
        const newBestTotal =
          finalTelemetry.elapsedTime > 0 &&
          (prevBestTotal === null || finalTelemetry.elapsedTime < prevBestTotal)
            ? finalTelemetry.elapsedTime
            : prevBestTotal;

        const qualifiedTop3 =
          (selectedMode === 'race' && finalTelemetry.position <= 3) || earnedStars >= 2;
        const currentUnlocked = prev.unlockedLevels || 1;
        const nextUnlockedLevels =
          qualifiedTop3 && selectedTrack.levelNumber >= currentUnlocked
            ? Math.min(TRACKS.length, selectedTrack.levelNumber + 1)
            : currentUnlocked;

        const xpGain =
          earnedStars === 3 ? 250 : earnedStars === 2 ? 160 : earnedStars === 1 ? 90 : 50;

        const nextXp = prev.xp + xpGain;
        const nextLevel = Math.max(1, Math.floor(nextXp / 300) + 1);

        const nextProgress: PlayerProgress = {
          xp: nextXp,
          driverLevel: nextLevel,
          unlockedLevels: nextUnlockedLevels,
          stars: {
            ...(prev.stars || {}),
            [selectedTrack.id]: bestStars,
          },
          medals: {
            ...(prev.medals || {}),
            [selectedTrack.id]: bestMedal,
          },
          bestLapTimes: {
            ...(prev.bestLapTimes || {}),
            [selectedTrack.id]: newBestLap,
          },
          bestTotalTimes: {
            ...(prev.bestTotalTimes || {}),
            [selectedTrack.id]: newBestTotal,
          },
          completedChallenges: {
            ...(prev.completedChallenges || {}),
            [selectedTrack.id]: bestStars === 3 || Boolean(prev.completedChallenges?.[selectedTrack.id]),
          },
        };

        try {
          localStorage.setItem(STORAGE_PROGRESS_KEY, JSON.stringify(nextProgress));
        } catch {
          // Ignore storage errors
        }

        return nextProgress;
      });
    },
    [selectedMode, selectedTrack]
  );

  const handleNextLevel = useCallback(() => {
    const idx = TRACKS.findIndex((t) => t.id === selectedTrack.id);
    if (idx >= 0 && idx + 1 < TRACKS.length) {
      const nextTrack = TRACKS[idx + 1];
      setSelectedTrack(nextTrack);
      setSettings((prev) => ({
        ...prev,
        timeOfDay: nextTrack.defaultTimeOfDay,
        weather: nextTrack.defaultWeather,
        aiCount: nextTrack.aiCount ?? prev.aiCount,
      }));
      handleStartNewRace('race');
    }
  }, [selectedTrack.id, handleStartNewRace]);

  const handleCycleCamera = useCallback(() => {
    setSettings((prev) => {
      const nextIdx = (CAMERA_CYCLE.indexOf(prev.cameraMode) + 1) % CAMERA_CYCLE.length;
      return {
        ...prev,
        cameraMode: CAMERA_CYCLE[nextIdx],
      };
    });
  }, []);

  const handleCycleTimeOfDay = useCallback(() => {
    setSettings((prev) => {
      const nextIdx = (TIME_CYCLE.indexOf(prev.timeOfDay) + 1) % TIME_CYCLE.length;
      return {
        ...prev,
        timeOfDay: TIME_CYCLE[nextIdx],
      };
    });
  }, []);

  const handleCycleWeather = useCallback(() => {
    setSettings((prev) => {
      const nextIdx = (WEATHER_CYCLE.indexOf(prev.weather) + 1) % WEATHER_CYCLE.length;
      return {
        ...prev,
        weather: WEATHER_CYCLE[nextIdx],
      };
    });
  }, []);

  const showTouchControls =
    screenState === 'playing' &&
    (settings.touchControlsMode === 'always' ||
      (settings.touchControlsMode === 'auto' && isTouchDevice));

  const handleToggleTouchControls = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      touchControlsMode: showTouchControls ? 'off' : 'always',
    }));
  }, [showTouchControls]);

  return (
    <main
      onContextMenu={(e) => e.preventDefault()}
      className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none touch-none"
    >
      {/* Persistent 3D WebGL Viewport */}
      <RacingCanvas
        carSpec={effectiveCarSpec}
        customization={customization}
        trackSpec={selectedTrack}
        gameMode={selectedMode}
        screenState={screenState}
        settings={settings}
        touchInputRef={touchInputRef}
        raceSessionId={raceSessionId}
        onTelemetryUpdate={setTelemetry}
        onPauseToggle={handlePauseToggle}
        onCycleCamera={handleCycleCamera}
        onRaceFinish={handleRaceFinish}
      />

      {/* In-Game HUD when Playing */}
      {screenState === 'playing' && (
        <HUD
          telemetry={telemetry}
          gameMode={selectedMode}
          trackSpec={selectedTrack}
          soundEnabled={settings.soundEnabled}
          cameraMode={settings.cameraMode}
          timeOfDay={settings.timeOfDay}
          weather={settings.weather}
          rearViewMirror={settings.rearViewMirror}
          showTouchControls={showTouchControls}
          touchInputRef={touchInputRef}
          onPauseClick={() => setScreenState('paused')}
          onToggleSound={() => handleUpdateSettings({ soundEnabled: !settings.soundEnabled })}
          onCycleCamera={handleCycleCamera}
          onToggleTouchControls={handleToggleTouchControls}
          onCycleTimeOfDay={handleCycleTimeOfDay}
          onCycleWeather={handleCycleWeather}
          onSelectLevel={(nextTrack) => {
            setSelectedTrack(nextTrack);
            setSettings((prev) => ({
              ...prev,
              timeOfDay: nextTrack.defaultTimeOfDay,
              weather: nextTrack.defaultWeather,
              aiCount: nextTrack.aiCount ?? prev.aiCount,
            }));
            handleStartNewRace('race');
          }}
        />
      )}

      {/* Virtual Circular Steering Wheel, Sequential Paddles & Pedals */}
      <TouchControls
        touchInputRef={touchInputRef}
        visible={showTouchControls}
        nitroAmount={telemetry.nitroAmount}
        nitroActive={telemetry.nitroActive}
        steerRatio={telemetry.steerRatio}
        transmission={settings.transmission}
        gear={telemetry.gear}
      />

      {/* Menus, 5-Level Track Selector, Garage Mechanical Upgrades & Advanced Settings */}
      <MainMenu
        screenState={screenState}
        hasActiveSession={hasActiveSession}
        selectedCar={selectedCar}
        customization={customization}
        upgrades={currentCarUpgrades}
        playerProgress={playerProgress}
        lastEarnedStars={lastEarnedStars}
        selectedTrack={selectedTrack}
        selectedMode={selectedMode}
        settings={settings}
        telemetry={telemetry}
        onSelectScreen={setScreenState}
        onStartNewRace={handleStartNewRace}
        onNextLevel={handleNextLevel}
        onResumeRace={handleResumeRace}
        onSelectCar={handleSelectCar}
        onUpdateCustomization={handleUpdateCustomization}
        onUpdateUpgrades={handleUpdateUpgrades}
        onSelectTrack={setSelectedTrack}
        onSelectMode={setSelectedMode}
        onUpdateSettings={handleUpdateSettings}
      />
    </main>
  );
}
