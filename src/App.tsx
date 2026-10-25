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
  PARKING_CHALLENGES,
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
  shifterPos: 'D',
  handbrakePulled: false,
  leftSignal: false,
  rightSignal: false,
  hazardLights: false,
  engineRunning: true,
  fuelPercent: 100,
  nearGasStation: false,
  refueling: false,
  isWalking: false,
  parkingChallengeIndex: 1,
  parkingStatus: 'approaching',
  parkingProgressPct: 0,
  parkingDistanceMeters: 0,
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
  dayTimeHours: 13.5,
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

const CAMERA_CYCLE: CameraMode[] = [
  'chase_near',
  'chase_far',
  'top_parking',
  'hood',
  'cockpit',
  'orbit_360',
];
const TIME_CYCLE: TimeOfDay[] = ['morning', 'afternoon', 'sunset', 'night'];
const WEATHER_CYCLE: WeatherType[] = ['clear', 'rain', 'fog', 'snow'];

const STORAGE_UPGRADES_KEY = 'apex_horizon_car_upgrades_v2';
const STORAGE_CUSTOMIZATION_KEY = 'apex_horizon_car_customization_v1';
const STORAGE_PROGRESS_KEY = 'apex_horizon_player_progress_v3';

const DEFAULT_PROGRESS: PlayerProgress = {
  xp: 0,
  money: 50000,
  driverLevel: 1,
  unlockedLevels: 1,
  stars: {},
  parkingStars: {},
  unlockedParkingLevel: 1,
  medals: {},
  bestLapTimes: {},
  bestTotalTimes: {},
  completedChallenges: {},
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

// Valide les données lues dans localStorage (elles peuvent être vides ou corrompues).
function sanitizeProgress(raw: unknown): PlayerProgress {
  if (!isRecord(raw)) return DEFAULT_PROGRESS;
  const num = (v: unknown, fallback: number, min: number, max = Infinity) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  const rec = (v: unknown) => (isRecord(v) ? v : {});
  return {
    ...DEFAULT_PROGRESS,
    ...(raw as Partial<PlayerProgress>),
    xp: num(raw.xp, 0, 0),
    money: Math.floor(num(raw.money, 50000, 0)),
    driverLevel: Math.floor(num(raw.driverLevel, 1, 1)),
    unlockedLevels: Math.floor(num(raw.unlockedLevels, 1, 1, TRACKS.length)),
    unlockedParkingLevel: Math.floor(
      num(raw.unlockedParkingLevel, 1, 1, PARKING_CHALLENGES.length)
    ),
    stars: rec(raw.stars) as PlayerProgress['stars'],
    parkingStars: rec(raw.parkingStars) as PlayerProgress['parkingStars'],
    medals: rec(raw.medals) as PlayerProgress['medals'],
    bestLapTimes: rec(raw.bestLapTimes) as PlayerProgress['bestLapTimes'],
    bestTotalTimes: rec(raw.bestTotalTimes) as PlayerProgress['bestTotalTimes'],
    completedChallenges: rec(raw.completedChallenges) as PlayerProgress['completedChallenges'],
  };
}

const MEDAL_RANK: Record<MedalTier, number> = {
  none: 0,
  bronze: 1,
  silver: 2,
  gold: 3,
};

export default function App() {
  const [selectedCar, setSelectedCar] = useState<CarSpec>(CARS[0]);
  const [customization, setCustomization] = useState<CarCustomization>(() => {
    const fallback: CarCustomization = {
      bodyColor: CARS[0].defaultColor,
      rimColor: CARS[0].defaultRimColor,
      rimStyle: 'amg_multi',
      bodyKit: 'stock',
      finish: 'metallic',
      headlightColor: '#ffffff',
      neonUnderglow: false,
      rideHeight: 0,
      camberAngleDeg: -1.5,
      wheelOffset: 0.01,
      windowTintOpacity: 0.55,
      tireSmokeColor: '#ffffff',
    };
    try {
      const raw = localStorage.getItem(STORAGE_CUSTOMIZATION_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isRecord(parsed)) {
          return { ...fallback, ...(parsed as Partial<CarCustomization>) };
        }
      }
    } catch {
      // Ignore storage errors
    }
    return fallback;
  });

  const [carUpgradesByCar, setCarUpgradesByCar] = useState<Record<string, CarPerformanceUpgrades>>(
    () => {
      try {
        const raw = localStorage.getItem(STORAGE_UPGRADES_KEY);
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (isRecord(parsed)) return parsed as Record<string, CarPerformanceUpgrades>;
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
        return sanitizeProgress(JSON.parse(raw));
      }
    } catch {
      // Ignore storage errors
    }
    return DEFAULT_PROGRESS;
  });

  // Sauvegarde dans localStorage (en dehors des fonctions de mise à jour du state, qui doivent rester pures)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PROGRESS_KEY, JSON.stringify(playerProgress));
    } catch {
      // Ignore storage errors
    }
  }, [playerProgress]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_UPGRADES_KEY, JSON.stringify(carUpgradesByCar));
    } catch {
      // Ignore storage errors
    }
  }, [carUpgradesByCar]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CUSTOMIZATION_KEY, JSON.stringify(customization));
    } catch {
      // Ignore storage errors
    }
  }, [customization]);

  const [selectedTrack, setSelectedTrack] = useState<TrackSpec>(TRACKS[0]);
  const [selectedMode, setSelectedMode] = useState<GameMode>('race');
  const [parkingChallengeId, setParkingChallengeId] = useState<number>(1);
  const [screenState, setScreenState] = useState<ScreenState>('main_menu');
  const [hasActiveSession, setHasActiveSession] = useState<boolean>(false);
  const [raceSessionId, setRaceSessionId] = useState<number>(1);
  const [lastEarnedStars, setLastEarnedStars] = useState<0 | 1 | 2 | 3>(0);

  const [settings, setSettings] = useState<GameSettings>({
    quality: 'auto',
    timeOfDay: TRACKS[0].defaultTimeOfDay,
    dynamicDayNight: true,
    dayNightSpeed: 1.0,
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
    shifterPos: 'D',
    handbrake: false,
    leftSignal: false,
    rightSignal: false,
    hazardLights: false,
    toggleHeadlightsQueued: false,
    toggleEngineQueued: false,
    toggleWalkQueued: false,
    refuelQueued: false,
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
        return { ...prev, [selectedCar.id]: nextForCar };
      });
    },
    [selectedCar.id]
  );

  const handleUpdateSettings = useCallback((patch: Partial<GameSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleStartNewRace = useCallback((modeOverride?: GameMode, challengeIdOverride?: number) => {
    soundEngine.init();
    const targetMode = modeOverride ?? selectedMode;
    if (modeOverride) {
      setSelectedMode(modeOverride);
    }
    if (challengeIdOverride !== undefined) {
      setParkingChallengeId(challengeIdOverride);
    }
    if (targetMode === 'parking') {
      setSettings((prev) => ({
        ...prev,
        cameraMode: 'cockpit',
      }));
    }
    Object.assign(touchInputRef.current, {
      throttle: false,
      brake: false,
      left: false,
      right: false,
      nitro: false,
      steerInput: 0,
      lookBack: false,
      shiftUpQueued: false,
      shiftDownQueued: false,
      shifterPos: 'D',
      handbrake: false,
      leftSignal: false,
      rightSignal: false,
      hazardLights: false,
      toggleHeadlightsQueued: false,
      toggleEngineQueued: false,
      toggleWalkQueued: false,
      refuelQueued: false,
    });
    setRaceSessionId((id) => id + 1);
    setHasActiveSession(true);
    setScreenState('playing');
  }, [selectedMode]);

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

      if (selectedMode === 'parking') {
        earnedStars = finalTelemetry.parkingStatus === 'cone_hit' ? 2 : 3;
        earnedMedal = earnedStars === 3 ? 'gold' : 'silver';
      } else if (selectedMode === 'race') {
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
        if (selectedMode === 'parking') {
          const activeChallenge =
            PARKING_CHALLENGES.find((c) => c.id === parkingChallengeId) || PARKING_CHALLENGES[0];
          const prevPStars = prev.parkingStars?.[activeChallenge.id] ?? 0;
          const bestPStars = Math.max(prevPStars, earnedStars) as 0 | 1 | 2 | 3;
          const currentUnlockedParking = prev.unlockedParkingLevel || 1;
          const nextUnlockedParking =
            activeChallenge.id >= currentUnlockedParking
              ? Math.min(PARKING_CHALLENGES.length, activeChallenge.id + 1)
              : currentUnlockedParking;
          const nextXp = prev.xp + 220;
          const nextLevel = Math.max(1, Math.floor(nextXp / 300) + 1);
          return {
            ...prev,
            xp: nextXp,
            money: (prev.money ?? 50000) + activeChallenge.rewardMoney,
            driverLevel: nextLevel,
            unlockedParkingLevel: nextUnlockedParking,
            parkingStars: {
              ...(prev.parkingStars || {}),
              [activeChallenge.id]: bestPStars,
            },
          };
        }

        const prevStars = prev.stars?.[selectedTrack.id] ?? 0;
        const bestStars = Math.max(prevStars, earnedStars) as 0 | 1 | 2 | 3;

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
        const moneyGain =
          earnedStars === 3 ? 5000 : earnedStars === 2 ? 3000 : 1500;

        const nextXp = prev.xp + xpGain;
        const nextLevel = Math.max(1, Math.floor(nextXp / 300) + 1);

        const nextProgress: PlayerProgress = {
          ...prev,
          xp: nextXp,
          money: (prev.money ?? 50000) + moneyGain,
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

        return nextProgress;
      });
    },
    [selectedMode, selectedTrack, parkingChallengeId]
  );

  const handleNextLevel = useCallback(() => {
    if (selectedMode === 'parking') {
      const nextPId = (parkingChallengeId % PARKING_CHALLENGES.length) + 1;
      setParkingChallengeId(nextPId);
      handleStartNewRace('parking', nextPId);
      return;
    }
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
  }, [selectedMode, parkingChallengeId, selectedTrack.id, handleStartNewRace]);

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
        parkingChallengeId={parkingChallengeId}
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
          parkingChallengeId={parkingChallengeId}
          playerMoney={playerProgress.money ?? 50000}
          soundEnabled={settings.soundEnabled}
          cameraMode={settings.cameraMode}
          timeOfDay={settings.timeOfDay}
          dynamicDayNight={settings.dynamicDayNight}
          weather={settings.weather}
          rearViewMirror={settings.rearViewMirror}
          showTouchControls={showTouchControls}
          touchInputRef={touchInputRef}
          onPauseClick={() => setScreenState('paused')}
          onToggleSound={() => handleUpdateSettings({ soundEnabled: !settings.soundEnabled })}
          onCycleCamera={handleCycleCamera}
          onSelectCamera={(mode) => handleUpdateSettings({ cameraMode: mode })}
          onToggleTouchControls={handleToggleTouchControls}
          onCycleTimeOfDay={handleCycleTimeOfDay}
          onToggleDynamicDayNight={() =>
            handleUpdateSettings({ dynamicDayNight: !settings.dynamicDayNight })
          }
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
          onSelectParkingChallenge={(id) => {
            setParkingChallengeId(id);
            handleStartNewRace('parking', id);
          }}
        />
      )}

      {/* Virtual Circular Steering Wheel, P-R-N-D Shifter, Handbrake & Pedals */}
      <TouchControls
        touchInputRef={touchInputRef}
        visible={showTouchControls}
        nitroAmount={telemetry.nitroAmount}
        nitroActive={telemetry.nitroActive}
        steerRatio={telemetry.steerRatio}
        transmission={settings.transmission}
        gear={telemetry.gear}
        shifterPos={telemetry.shifterPos}
        handbrakePulled={telemetry.handbrakePulled}
        isWalking={telemetry.isWalking}
      />

      {/* Menus, 5-Level Track Selector, Parking Challenges, Garage Mechanical/Stance Upgrades & Advanced Settings */}
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
        parkingChallengeId={parkingChallengeId}
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
        onSelectParkingChallenge={setParkingChallengeId}
        onUpdateSettings={handleUpdateSettings}
      />
    </main>
  );
}
