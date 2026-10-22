export type GameMode = 'race' | 'time_attack' | 'free_drive' | 'exploration';

export type ScreenState =
  | 'main_menu'
  | 'car_select'
  | 'track_select'
  | 'garage'
  | 'settings'
  | 'playing'
  | 'paused'
  | 'finished';

export type QualityPreset = 'auto' | 'high' | 'medium' | 'low';
export type TimeOfDay = 'morning' | 'afternoon' | 'sunset' | 'night';
export type WeatherType = 'clear' | 'rain' | 'fog' | 'snow';
export type TransmissionType = 'auto' | 'manual';
export type DrivingStyle = 'grip' | 'balanced' | 'drift';
export type TrafficDensity = 'off' | 'light' | 'dense';
export type CameraMode = 'chase_near' | 'chase_far' | 'hood' | 'cockpit';
export type PaintFinish = 'metallic' | 'matte' | 'chrome';
export type TrackBiome = 'savannah' | 'alpine' | 'countryside' | 'coastal' | 'canyon' | 'snow' | 'tropical' | 'volcano';
export type MedalTier = 'none' | 'bronze' | 'silver' | 'gold';

export interface CarSpec {
  id: string;
  name: string;
  category: string;
  tagline: string;
  maxSpeedKmh: number;
  acceleration: number; // m/s^2 factor
  handling: number; // rad/s factor
  braking: number;
  defaultColor: string;
  defaultRimColor: string;
  bodyStyle: 'street' | 'gt' | 'hyper' | 'muscle';
  stats: {
    speed: number; // 0-100
    accel: number; // 0-100
    handling: number; // 0-100
    braking: number; // 0-100
  };
}

export interface CarPerformanceUpgrades {
  engineLevel: 1 | 2 | 3;
  turboLevel: 1 | 2 | 3;
  tiresLevel: 1 | 2 | 3;
  brakesLevel: 1 | 2 | 3;
}

export interface CarCustomization {
  bodyColor: string;
  rimColor: string;
  finish: PaintFinish;
  headlightColor: string;
  neonUnderglow: boolean;
}

export interface TrackSpec {
  id: string;
  levelNumber: number;
  name: string;
  subtitle: string;
  location: string;
  lengthKm: number;
  defaultLaps: number;
  aiCount?: number;
  aiSpeedFactor?: number;
  aiAggression?: number;
  difficulty: 'Facile' | 'Intermédiaire' | 'Expert';
  defaultTimeOfDay: TimeOfDay;
  defaultWeather: WeatherType;
  roadWidth: number;
  theme: 'city' | 'circuit' | 'coastal';
  biome: TrackBiome;
  targetGoldSec: number;
  targetSilverSec: number;
  targetBronzeSec: number;
  challengeText: string;
  description: string;
  waypoints: Array<[number, number, number]>;
}

export interface GameSettings {
  quality: QualityPreset;
  timeOfDay: TimeOfDay;
  weather: WeatherType;
  transmission: TransmissionType;
  drivingStyle: DrivingStyle;
  absEspEnabled: boolean;
  cameraFovOffset: number; // -8 to +12 degrees
  cameraDistanceOffset: number; // -1.2 to +2.0 meters
  rearViewMirror: boolean;
  aiCount: number; // 1 to 7
  trafficDensity: TrafficDensity;
  soundEnabled: boolean;
  volume: number;
  touchControlsMode: 'auto' | 'always' | 'off';
  steeringSensitivity: number;
  cameraMode: CameraMode;
  aiDifficulty: 'normal' | 'pro' | 'legend';
}

export interface PlayerProgress {
  xp: number;
  driverLevel: number;
  unlockedLevels: number; // 1..5
  stars: Record<string, 0 | 1 | 2 | 3>;
  medals: Record<string, MedalTier>;
  bestLapTimes: Record<string, number | null>;
  bestTotalTimes: Record<string, number | null>;
  completedChallenges: Record<string, boolean>;
}

export interface RearOpponentInfo {
  name: string;
  color: string;
  lateralOffset: number; // -1 (left) to +1 (right) in mirror
  distanceMeters: number; // positive distance behind player
}

export interface RacerStanding {
  rank: number;
  name: string;
  color: string;
  isPlayer: boolean;
  finished: boolean;
  finishTime: number | null;
}

export interface TelemetryState {
  speedKmh: number;
  rpm: number; // 1000 - 8500
  gear: number; // -1 = R, 0 = N, 1..6
  lap: number;
  totalLaps: number;
  elapsedTime: number;
  currentLapTime: number;
  bestLapTime: number | null;
  position: number;
  totalRacers: number;
  countdown: number; // 3, 2, 1, 0 (GO), -1 (active)
  raceFinished?: boolean;
  standings?: RacerStanding[];
  nitroAmount: number; // 0 - 100
  nitroActive: boolean;
  drifting: boolean;
  steerRatio: number; // -1 (left) to +1 (right) for visual wheel sync
  surfaceType: 'asphalt' | 'kerb' | 'shoulder';
  gripPercent: number;
  headlightsOn: boolean;
  lookingBack: boolean;
  discoveredPoints: number;
  totalDiscoveryPoints: number;
  lastCheckpointBanner: string | null;
  fps: number;
  activeQualityTier: 'high' | 'medium' | 'low';
  minimapPoints: Array<{ x: number; z: number }>;
  playerPos: { x: number; z: number; heading: number };
  opponentsPos: Array<{ x: number; z: number; color: string; name: string }>;
  rearOpponents: RearOpponentInfo[];
  discoveryBeacons: Array<{ x: number; z: number; collected: boolean; label: string }>;
}

export const CAMERA_LABELS: Record<CameraMode, string> = {
  chase_near: 'Arrière Rapprochée',
  chase_far: 'Arrière Éloignée',
  hood: 'Vue Capot',
  cockpit: 'Vue Habitacle',
};

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  morning: 'Matin Clair',
  afternoon: 'Plein Jour Naturel',
  sunset: 'Soleil Couchant',
  night: 'Nuit Autoroutière',
};

export const WEATHER_LABELS: Record<WeatherType, string> = {
  clear: 'Ciel Dégagé (Sec)',
  rain: 'Pluie & Route Mouillée',
  fog: 'Brouillard Dense',
  snow: 'Neige Alpine',
};

export const TRANSMISSION_LABELS: Record<TransmissionType, string> = {
  auto: 'Automatique Sport',
  manual: 'Manuelle Séquentielle (Palettes)',
};

export const TRAFFIC_DENSITY_LABELS: Record<TrafficDensity, string> = {
  off: 'Aucun',
  light: 'Fluide',
  dense: 'Dense',
};

export const DRIVING_STYLE_LABELS: Record<DrivingStyle, string> = {
  grip: 'Adhérence GT',
  balanced: 'Équilibré Sport',
  drift: 'Mode Drift Pro',
};

export const DEFAULT_UPGRADES: CarPerformanceUpgrades = {
  engineLevel: 1,
  turboLevel: 1,
  tiresLevel: 1,
  brakesLevel: 1,
};

export function getEffectiveCarSpec(base: CarSpec, upgrades?: CarPerformanceUpgrades): CarSpec {
  const u = upgrades || DEFAULT_UPGRADES;
  const engBonus = (u.engineLevel - 1) * 0.06;
  const trbBonus = (u.turboLevel - 1) * 0.09;
  const tirBonus = (u.tiresLevel - 1) * 0.08;
  const brkBonus = (u.brakesLevel - 1) * 0.09;

  return {
    ...base,
    maxSpeedKmh: Math.round(base.maxSpeedKmh * (1 + engBonus + trbBonus * 0.25)),
    acceleration: Number((base.acceleration * (1 + trbBonus + engBonus * 0.3)).toFixed(1)),
    handling: Number((base.handling * (1 + tirBonus)).toFixed(2)),
    braking: Number((base.braking * (1 + brkBonus)).toFixed(1)),
    stats: {
      speed: Math.min(100, Math.round(base.stats.speed + (u.engineLevel - 1) * 5 + (u.turboLevel - 1) * 2)),
      accel: Math.min(100, Math.round(base.stats.accel + (u.turboLevel - 1) * 5 + (u.engineLevel - 1) * 2)),
      handling: Math.min(100, Math.round(base.stats.handling + (u.tiresLevel - 1) * 6)),
      braking: Math.min(100, Math.round(base.stats.braking + (u.brakesLevel - 1) * 6)),
    },
  };
}

export const CARS: CarSpec[] = [
  {
    id: 'vortex-rs',
    name: 'Civic EK-R Turbo',
    category: 'Coupé Sport & Street Tuner',
    tagline: 'Châssis large préparé, habitacle sport rouge visible, carrosserie vernie et échappement inox.',
    maxSpeedKmh: 295,
    acceleration: 39,
    handling: 3.2,
    braking: 54,
    defaultColor: '#1d4ed8',
    defaultRimColor: '#cbd5e1',
    bodyStyle: 'street',
    stats: { speed: 85, accel: 91, handling: 92, braking: 89 },
  },
  {
    id: 'apex-gt',
    name: 'Apex V12 GT',
    category: 'Grand Tourisme',
    tagline: 'Carrosserie fastback sculptée alliant vitesse de pointe et équilibre aérodynamique.',
    maxSpeedKmh: 325,
    acceleration: 37,
    handling: 2.85,
    braking: 50,
    defaultColor: '#dc2626',
    defaultRimColor: '#e2e8f0',
    bodyStyle: 'gt',
    stats: { speed: 90, accel: 86, handling: 88, braking: 88 },
  },
  {
    id: 'chronos-hyper',
    name: 'Chronos Hyperion',
    category: 'Hypercar Prototype',
    tagline: 'Aérodynamique active à effet de sol et V10 hybride de 1 180 ch.',
    maxSpeedKmh: 360,
    acceleration: 43,
    handling: 2.75,
    braking: 53,
    defaultColor: '#0284c7',
    defaultRimColor: '#0f172a',
    bodyStyle: 'hyper',
    stats: { speed: 95, accel: 93, handling: 87, braking: 90 },
  },
  {
    id: 'titan-gtr',
    name: 'Titan GTR-X',
    category: 'Track Muscle Widebody',
    tagline: 'Ailes élargies, capot ventilé et couple massif pour dominer les lignes droites.',
    maxSpeedKmh: 335,
    acceleration: 38,
    handling: 2.65,
    braking: 48,
    defaultColor: '#f8fafc',
    defaultRimColor: '#d4af37',
    bodyStyle: 'muscle',
    stats: { speed: 91, accel: 89, handling: 84, braking: 85 },
  },
];

export const PAINT_SWATCHES = [
  { name: 'Noir Onyx Brillant', hex: '#14171c' },
  { name: 'Rouge Corsa Métal', hex: '#dc2626' },
  { name: 'Bleu Alpine Nacré', hex: '#0284c7' },
  { name: 'Blanc Championship', hex: '#f8fafc' },
  { name: 'Or Solaire Métal', hex: '#f59e0b' },
  { name: 'Vert Émeraude Racing', hex: '#059669' },
  { name: 'Gris Nardo Titane', hex: '#64748b' },
  { name: 'Violet Midnight', hex: '#7c3aed' },
];

export const RIM_SWATCHES = [
  { name: 'Alliage Argent Poli', hex: '#cbd5e1' },
  { name: 'Carbone Forgé Noir', hex: '#18181b' },
  { name: 'Or Bronze JDM', hex: '#d4af37' },
  { name: 'Bronze Compétition', hex: '#a16207' },
  { name: 'Titane Gunmetal', hex: '#475569' },
];

export const HEADLIGHT_SWATCHES = [
  { name: 'LED Blanc Pur 6000K', hex: '#ffffff' },
  { name: 'Xénon Bleu Glace', hex: '#7dd3fc' },
  { name: 'Halogène Jaune GT', hex: '#fde047' },
];

import { LEVELS } from '../engine/levels';

export { LEVELS };
export const TRACKS: TrackSpec[] = LEVELS;

