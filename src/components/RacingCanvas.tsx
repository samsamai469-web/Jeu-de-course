import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  CARS,
  CarCustomization,
  CarSpec,
  GameMode,
  GameSettings,
  PARKING_CHALLENGES,
  RacerStanding,
  RearOpponentInfo,
  ScreenState,
  ShifterPosition,
  TelemetryState,
  TrackSpec,
} from '../types/game';
import { createProceduralTextures } from '../engine/textures';
import { buildSportsCarModel, CarRig } from '../engine/carBuilder';
import { buildTrackEnvironment, BuiltTrack } from '../engine/trackBuilder';
import { ParticlePool } from '../engine/particles';
import { soundEngine } from '../audio/soundEngine';
import { stepCarDynamicsSubsteps, type CarDynInput } from '../engine/carPhysics';

export interface TouchInputState {
  throttle: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
  nitro: boolean;
  steerInput: number; // Continuous analog steering from circular wheel: -1 (left) to +1 (right)
  lookBack?: boolean;
  shiftUpQueued?: boolean;
  shiftDownQueued?: boolean;
  respawnQueued?: boolean;
  shifterPos?: ShifterPosition;
  handbrake?: boolean;
  leftSignal?: boolean;
  rightSignal?: boolean;
  hazardLights?: boolean;
  toggleHeadlightsQueued?: boolean;
  toggleEngineQueued?: boolean;
  toggleWalkQueued?: boolean;
  refuelQueued?: boolean;
}

interface RacingCanvasProps {
  carSpec: CarSpec;
  customization: CarCustomization;
  trackSpec: TrackSpec;
  gameMode: GameMode;
  screenState: ScreenState;
  settings: GameSettings;
  touchInputRef: React.MutableRefObject<TouchInputState>;
  raceSessionId: number;
  parkingChallengeId?: number;
  onTelemetryUpdate: (telemetry: TelemetryState) => void;
  onPauseToggle: () => void;
  onCycleCamera: () => void;
  onRaceFinish: (finalTelemetry: TelemetryState) => void;
}

interface AICarEntity {
  rig: CarRig;
  name: string;
  color: string;
  t: number; // 0..1 along spline
  laps: number;
  lapCooldown: number;
  finished: boolean;
  finishTime: number | null;
  finishOrder: number | null;
  speedMs: number;
  baseMaxSpeedMs: number;
  laneOffset: number;
  targetLaneOffset: number;
  laneTimer: number;
  worldX: number;
  worldY: number;
  worldZ: number;
  heading: number;
  pitch: number;
}

// Module-scope pre-allocated math helpers (Zero GC in render loop)
const _camTargetPos = new THREE.Vector3();
const _camLookAt = new THREE.Vector3();
const _smoothedLookAt = new THREE.Vector3();
const _forwardVec = new THREE.Vector3();
const _rightVec = new THREE.Vector3();

const AI_NAMES = [
  'L. Moreau',
  'K. Tanaka',
  'M. Rossi',
  'S. Vance',
  'E. Lindqvist',
  'A. Kovacs',
  'D. Silva',
];
const AI_COLORS = ['#2563eb', '#9333ea', '#e11d48', '#eab308', '#0d9488', '#ea580c', '#16a34a'];

// La physique de la voiture (direction, Ackermann, adhérence, dérapage) vit dans
// src/engine/carPhysics.ts. On re-exporte ces fonctions pour rester compatible.
export {
  evalMaxAngleBySpeed,
  updateCarSteerAngle,
  computeCounterSteer,
  applyAckermann,
} from '../engine/carPhysics';

// Libère la mémoire GPU d'un objet 3D (géométries + matériaux).
// Les textures partagées sont libérées séparément (textures.dispose()).
function disposeObject3D(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (mat) {
      for (const m of Array.isArray(mat) ? mat : [mat]) m.dispose();
    }
  });
}

export const RacingCanvas: React.FC<RacingCanvasProps> = ({
  carSpec,
  customization,
  trackSpec,
  gameMode,
  screenState,
  settings,
  touchInputRef,
  raceSessionId,
  parkingChallengeId = 1,
  onTelemetryUpdate,
  onPauseToggle,
  onCycleCamera,
  onRaceFinish,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  const stateRef = useRef({
    carSpec,
    customization,
    trackSpec,
    gameMode,
    screenState,
    settings,
    raceSessionId,
    parkingChallengeId,
  });
  stateRef.current = {
    carSpec,
    customization,
    trackSpec,
    gameMode,
    screenState,
    settings,
    raceSessionId,
    parkingChallengeId,
  };

  const callbacksRef = useRef({
    onTelemetryUpdate,
    onPauseToggle,
    onCycleCamera,
    onRaceFinish,
  });
  callbacksRef.current = {
    onTelemetryUpdate,
    onPauseToggle,
    onCycleCamera,
    onRaceFinish,
  };

  const rebuildFlagRef = useRef({
    carDirty: false,
    trackDirty: false,
    sessionResetDirty: false,
    lightingDirty: false,
    aiDirty: false,
  });

  useEffect(() => {
    rebuildFlagRef.current.carDirty = true;
  }, [carSpec, customization]);

  useEffect(() => {
    rebuildFlagRef.current.lightingDirty = true;
    rebuildFlagRef.current.trackDirty = true;
    rebuildFlagRef.current.sessionResetDirty = true;
  }, [trackSpec, settings.quality]);

  useEffect(() => {
    rebuildFlagRef.current.lightingDirty = true;
  }, [settings.timeOfDay]);

  useEffect(() => {
    rebuildFlagRef.current.lightingDirty = true;
    rebuildFlagRef.current.trackDirty = true;
  }, [settings.weather]);

  useEffect(() => {
    rebuildFlagRef.current.aiDirty = true;
  }, [settings.aiCount, settings.trafficDensity, settings.aiDifficulty]);

  useEffect(() => {
    rebuildFlagRef.current.sessionResetDirty = true;
  }, [raceSessionId, gameMode, parkingChallengeId]);

  useEffect(() => {
    if (screenState === 'playing') {
      rebuildFlagRef.current.sessionResetDirty = true;
    }
  }, [screenState]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software-WebGL Guard per Three.js Skill Directive
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const isMobileDevice =
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      window.matchMedia('(pointer: coarse)').matches;

    const resolveQualityTier = (preset: GameSettings['quality']): 'high' | 'medium' | 'low' => {
      if (preset !== 'auto') return preset;
      if (isSoftwareGl) return 'low';
      if (isMobileDevice) return 'medium';
      return 'high';
    };

    let activeQualityTier = resolveQualityTier(stateRef.current.settings.quality);

    const getTargetPixelRatio = (tier: 'high' | 'medium' | 'low') => {
      if (isSoftwareGl) return 1;
      const dpr = window.devicePixelRatio || 1;
      if (tier === 'low') return Math.min(dpr, 1.5);
      if (tier === 'medium') return Math.min(dpr, 2.0);
      return Math.min(dpr, 2.5);
    };

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.45;

    renderer.setPixelRatio(getTargetPixelRatio(activeQualityTier));
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight, true);
    renderer.shadowMap.enabled = !isSoftwareGl && !isMobileDevice && activeQualityTier === 'high';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      52,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.15,
      920
    );

    // 2. Night-Sky PMREMGenerator Environment Map for Realistic Clearcoat Car Reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const outdoorEnvScene = new THREE.Scene();
    const envDomeGeo = new THREE.SphereGeometry(20, 32, 20);
    const envPos = envDomeGeo.attributes.position;
    const envColors: number[] = [];
    const cTop = new THREE.Color(0x0b1938);
    const cHorizon = new THREE.Color(0x4b79c8);
    const cGround = new THREE.Color(0x141923);
    const cTemp = new THREE.Color();
    for (let i = 0; i < envPos.count; i++) {
      const vx = envPos.getX(i);
      const vy = envPos.getY(i);
      const vz = envPos.getZ(i);
      const ny = vy / 20;
      if (ny >= 0) {
        cTemp.copy(cHorizon).lerp(cTop, Math.pow(ny, 0.52));
        // Subtle moonlight & highway light reflection bands in the upper hemisphere for clearcoat speculars
        const moonGlow = Math.max(0, (vx * 0.5 + vy * 0.7 + vz * 0.5) / 20);
        if (moonGlow > 0.72) {
          cTemp.lerp(new THREE.Color(0xdbeafe), Math.pow((moonGlow - 0.72) / 0.28, 2) * 0.85);
        }
      } else {
        cTemp.copy(cHorizon).lerp(cGround, Math.min(1, -ny * 3.2));
      }
      envColors.push(cTemp.r, cTemp.g, cTemp.b);
    }
    envDomeGeo.setAttribute('color', new THREE.Float32BufferAttribute(envColors, 3));
    const envDomeMesh = new THREE.Mesh(
      envDomeGeo,
      new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })
    );
    outdoorEnvScene.add(envDomeMesh);

    // Bright horizon & overhead softbox reflection strips inside PMREM scene for crisp automotive clearcoat highlights
    const stripGeo = new THREE.PlaneGeometry(16, 1.8);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, side: THREE.DoubleSide });
    const strip1 = new THREE.Mesh(stripGeo, stripMat);
    strip1.position.set(0, 8, -13);
    strip1.lookAt(0, 0, 0);
    const strip2 = new THREE.Mesh(stripGeo, new THREE.MeshBasicMaterial({ color: 0xfef08a, side: THREE.DoubleSide }));
    strip2.position.set(12, 6, 8);
    strip2.lookAt(0, 0, 0);
    const strip3 = new THREE.Mesh(stripGeo, new THREE.MeshBasicMaterial({ color: 0xbae6fd, side: THREE.DoubleSide }));
    strip3.position.set(-12, 6, 6);
    strip3.lookAt(0, 0, 0);
    outdoorEnvScene.add(strip1, strip2, strip3);

    const envMapTexture = pmremGenerator.fromScene(outdoorEnvScene, 0.025).texture;
    scene.environment = envMapTexture;
    envDomeGeo.dispose();
    stripGeo.dispose();
    pmremGenerator.dispose();

    // 3. Readable Night-Blue Lighting: AmbientLight(0x223355, 0.6), HemisphereLight(#3a5a9a, #1a1f2a) +60% Moonlight
    const ambientLight = new THREE.AmbientLight(0x223355, 0.6);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x3a5a9a, 0x1a1f2a, 0.65);
    hemiLight.position.set(0, 85, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xa5c8ff, 1.15);
    keyLight.position.set(60, 95, 45);
    keyLight.castShadow = !isSoftwareGl && !isMobileDevice && activeQualityTier === 'high';
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    const shadowBound = 68;
    keyLight.shadow.camera.left = -shadowBound;
    keyLight.shadow.camera.right = shadowBound;
    keyLight.shadow.camera.top = shadowBound;
    keyLight.shadow.camera.bottom = -shadowBound;
    keyLight.shadow.camera.near = 5;
    keyLight.shadow.camera.far = 250;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);
    scene.add(keyLight.target);

    const rimLight = new THREE.DirectionalLight(0x3a5a9a, 0.32);
    rimLight.position.set(-55, 45, -65);
    scene.add(rimLight);

    // Dedicated Luxury Showroom Car Keylight (Hotel Showroom Clearcoat Reflections)
    const carShowroomLight = new THREE.DirectionalLight(0xffffff, 2.2);
    carShowroomLight.position.set(0, 16, 0);
    scene.add(carShowroomLight);
    scene.add(carShowroomLight.target);

    // Pooled Streetlamp PointLights (disabled on mobile for 60 FPS shader speed; emissive road + halos handle mobile glow)
    const lampLightPoolSize = !isSoftwareGl && !isMobileDevice && activeQualityTier === 'high' ? 2 : 0;
    const lampPointLights: THREE.PointLight[] = [];
    for (let i = 0; i < lampLightPoolSize; i++) {
      const pl = new THREE.PointLight(0xfef08a, 6.8, 38, 1.7);
      pl.castShadow = false;
      scene.add(pl);
      lampPointLights.push(pl);
    }

    const timePresetToHours = (preset: GameSettings['timeOfDay']): number => {
      if (preset === 'morning') return 8.5;
      if (preset === 'afternoon') return 13.5;
      if (preset === 'sunset') return 18.6;
      return 22.8;
    };

    const _bgCol = new THREE.Color();
    const _fogCol = new THREE.Color();
    const _ambCol = new THREE.Color();
    const _hemiSkyCol = new THREE.Color();
    const _hemiGndCol = new THREE.Color();
    const _keyCol = new THREE.Color();

    const LIGHTING_KEYFRAMES = [
      {
        hour: 0.0,
        bg: new THREE.Color(0x0f1f3d),
        fog: new THREE.Color(0x13254a),
        amb: new THREE.Color(0x334b78),
        ambInt: 0.86,
        hemiSky: new THREE.Color(0x60a5fa),
        hemiGnd: new THREE.Color(0x1e293b),
        hemiInt: 0.90,
        key: new THREE.Color(0xbfdbfe),
        keyInt: 1.42,
        fogDens: 0.00056,
        exposure: 1.48,
        nightFactor: 1.0,
      },
      {
        hour: 5.0,
        bg: new THREE.Color(0x15284d),
        fog: new THREE.Color(0x1e3a70),
        amb: new THREE.Color(0x3b5284),
        ambInt: 0.88,
        hemiSky: new THREE.Color(0x7dd3fc),
        hemiGnd: new THREE.Color(0x1e293b),
        hemiInt: 0.92,
        key: new THREE.Color(0xbfdbfe),
        keyInt: 1.46,
        fogDens: 0.00054,
        exposure: 1.48,
        nightFactor: 0.92,
      },
      {
        hour: 6.4,
        bg: new THREE.Color(0x2563eb),
        fog: new THREE.Color(0xfdba74),
        amb: new THREE.Color(0x7c5846),
        ambInt: 0.92,
        hemiSky: new THREE.Color(0xfde68a),
        hemiGnd: new THREE.Color(0x3f3c34),
        hemiInt: 0.95,
        key: new THREE.Color(0xfdba74),
        keyInt: 1.62,
        fogDens: 0.00048,
        exposure: 1.50,
        nightFactor: 0.38,
      },
      {
        hour: 8.5,
        bg: new THREE.Color(0x38bdf8),
        fog: new THREE.Color(0x7dd3fc),
        amb: new THREE.Color(0x64748b),
        ambInt: 0.95,
        hemiSky: new THREE.Color(0xbae6fd),
        hemiGnd: new THREE.Color(0x3f4d34),
        hemiInt: 0.98,
        key: new THREE.Color(0xfef08a),
        keyInt: 1.72,
        fogDens: 0.00042,
        exposure: 1.52,
        nightFactor: 0.0,
      },
      {
        hour: 13.5,
        bg: new THREE.Color(0x2563eb),
        fog: new THREE.Color(0x60a5fa),
        amb: new THREE.Color(0x64748b),
        ambInt: 0.94,
        hemiSky: new THREE.Color(0x93c5fd),
        hemiGnd: new THREE.Color(0x334155),
        hemiInt: 0.96,
        key: new THREE.Color(0xffffff),
        keyInt: 1.75,
        fogDens: 0.00040,
        exposure: 1.52,
        nightFactor: 0.0,
      },
      {
        hour: 17.2,
        bg: new THREE.Color(0x2563eb),
        fog: new THREE.Color(0xfdba74),
        amb: new THREE.Color(0x78553a),
        ambInt: 0.90,
        hemiSky: new THREE.Color(0xfde68a),
        hemiGnd: new THREE.Color(0x3f2e21),
        hemiInt: 0.94,
        key: new THREE.Color(0xfde047),
        keyInt: 1.68,
        fogDens: 0.00046,
        exposure: 1.50,
        nightFactor: 0.15,
      },
      {
        hour: 18.6,
        bg: new THREE.Color(0x7c2d12),
        fog: new THREE.Color(0xc2410c),
        amb: new THREE.Color(0x78350f),
        ambInt: 0.88,
        hemiSky: new THREE.Color(0xfdba74),
        hemiGnd: new THREE.Color(0x431407),
        hemiInt: 0.92,
        key: new THREE.Color(0xfb923c),
        keyInt: 1.62,
        fogDens: 0.00052,
        exposure: 1.50,
        nightFactor: 0.62,
      },
      {
        hour: 20.6,
        bg: new THREE.Color(0x15284d),
        fog: new THREE.Color(0x172b54),
        amb: new THREE.Color(0x334b78),
        ambInt: 0.86,
        hemiSky: new THREE.Color(0x60a5fa),
        hemiGnd: new THREE.Color(0x1e293b),
        hemiInt: 0.92,
        key: new THREE.Color(0xbfdbfe),
        keyInt: 1.46,
        fogDens: 0.00056,
        exposure: 1.50,
        nightFactor: 0.95,
      },
      {
        hour: 24.0,
        bg: new THREE.Color(0x0f1f3d),
        fog: new THREE.Color(0x13254a),
        amb: new THREE.Color(0x334b78),
        ambInt: 0.86,
        hemiSky: new THREE.Color(0x60a5fa),
        hemiGnd: new THREE.Color(0x1e293b),
        hemiInt: 0.90,
        key: new THREE.Color(0xbfdbfe),
        keyInt: 1.42,
        fogDens: 0.00056,
        exposure: 1.48,
        nightFactor: 1.0,
      },
    ];

    scene.background = new THREE.Color(0x15284d);
    scene.fog = new THREE.FogExp2(0x162b52, 0.00055);

    const updateDynamicLighting = (dayTimeHours: number, weather: GameSettings['weather']) => {
      const h = ((dayTimeHours % 24) + 24) % 24;
      let k0 = LIGHTING_KEYFRAMES[0];
      let k1 = LIGHTING_KEYFRAMES[LIGHTING_KEYFRAMES.length - 1];
      for (let i = 0; i < LIGHTING_KEYFRAMES.length - 1; i++) {
        if (h >= LIGHTING_KEYFRAMES[i].hour && h <= LIGHTING_KEYFRAMES[i + 1].hour) {
          k0 = LIGHTING_KEYFRAMES[i];
          k1 = LIGHTING_KEYFRAMES[i + 1];
          break;
        }
      }
      const span = Math.max(0.001, k1.hour - k0.hour);
      const alpha = THREE.MathUtils.smoothstep((h - k0.hour) / span, 0, 1);

      _bgCol.copy(k0.bg).lerp(k1.bg, alpha);
      _fogCol.copy(k0.fog).lerp(k1.fog, alpha);
      _ambCol.copy(k0.amb).lerp(k1.amb, alpha);
      _hemiSkyCol.copy(k0.hemiSky).lerp(k1.hemiSky, alpha);
      _hemiGndCol.copy(k0.hemiGnd).lerp(k1.hemiGnd, alpha);
      _keyCol.copy(k0.key).lerp(k1.key, alpha);

      const nightFactor = THREE.MathUtils.lerp(k0.nightFactor, k1.nightFactor, alpha);
      let fogDensity = THREE.MathUtils.lerp(k0.fogDens, k1.fogDens, alpha);
      let keyIntensity = THREE.MathUtils.lerp(k0.keyInt, k1.keyInt, alpha);

      if (weather === 'fog') {
        fogDensity = 0.0014;
        keyIntensity *= 0.90;
        _fogCol.lerp(new THREE.Color(0x475569), 0.35);
      } else if (weather === 'rain') {
        fogDensity = 0.00095;
        keyIntensity *= 0.94;
      } else if (weather === 'snow') {
        fogDensity = 0.00095;
        keyIntensity *= 0.95;
      }

      if (scene.background instanceof THREE.Color) {
        scene.background.copy(_bgCol);
      }
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(_fogCol);
        scene.fog.density = fogDensity;
      }

      ambientLight.color.copy(_ambCol);
      ambientLight.intensity = THREE.MathUtils.lerp(k0.ambInt, k1.ambInt, alpha);
      hemiLight.color.copy(_hemiSkyCol);
      hemiLight.groundColor.copy(_hemiGndCol);
      hemiLight.intensity = THREE.MathUtils.lerp(k0.hemiInt, k1.hemiInt, alpha);
      keyLight.color.copy(_keyCol);
      keyLight.intensity = keyIntensity;
      renderer.toneMappingExposure = THREE.MathUtils.lerp(k0.exposure, k1.exposure, alpha);

      const lampIntensity = THREE.MathUtils.lerp(0.8, 7.8, nightFactor);
      for (const pl of lampPointLights) {
        pl.intensity = lampIntensity;
      }

      return nightFactor;
    };

    updateDynamicLighting(
      timePresetToHours(stateRef.current.settings.timeOfDay),
      stateRef.current.settings.weather
    );

    // 4. Procedural PBR Textures, Circular Smoke/Nitro/Spark Particle Pools & Weather Particles
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const textures = createProceduralTextures(maxAnisotropy);
    const smokeParticles = new ParticlePool(textures.particleTexture, 160, 0xcbd5e1, 0.44);
    const nitroParticles = new ParticlePool(textures.particleTexture, 90, 0x38bdf8, 0.38);
    const sparkParticles = new ParticlePool(textures.particleTexture, 90, 0xfbbf24, 0.22);
    scene.add(smokeParticles.points);
    scene.add(nitroParticles.points);
    scene.add(sparkParticles.points);

    // 3D Snow Flakes around Player Car (Circular radial gradient texture, reduced size, sizeAttenuation: true)
    const precipCount = 450;
    const precipGeo = new THREE.BufferGeometry();
    const precipPositions = new Float32Array(precipCount * 3);
    for (let i = 0; i < precipCount; i++) {
      precipPositions[i * 3] = (Math.random() - 0.5) * 65;
      precipPositions[i * 3 + 1] = Math.random() * 24;
      precipPositions[i * 3 + 2] = (Math.random() - 0.5) * 65;
    }
    precipGeo.setAttribute('position', new THREE.BufferAttribute(precipPositions, 3));
    const precipMat = new THREE.PointsMaterial({
      map: textures.particleTexture,
      color: 0xf8fafc,
      size: 0.15,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    const precipPoints = new THREE.Points(precipGeo, precipMat);
    precipPoints.frustumCulled = false;
    precipPoints.visible = false;
    scene.add(precipPoints);

    // 5. Track, Player Car & Detailed AI Cars State
    let builtTrack: BuiltTrack = buildTrackEnvironment(
      stateRef.current.trackSpec,
      stateRef.current.settings.timeOfDay,
      textures,
      activeQualityTier,
      stateRef.current.settings.weather
    );
    scene.add(builtTrack.group);

    let playerCar: CarRig = buildSportsCarModel(
      stateRef.current.carSpec,
      stateRef.current.customization,
      textures.contactShadowTexture,
      !isSoftwareGl,
      textures.carFlakeNormalMap,
      textures.tireTreadTexture,
      textures.leatherTexture,
      textures.headlightBeamTexture,
      textures.brakeHaloTexture,
      textures.wheelBlurTexture
    );
    playerCar.bodyMaterial.envMap = envMapTexture;
    scene.add(playerCar.root);

    let aiCars: AICarEntity[] = [];

    // =========================================================================
    // 5B. CAR PARKING MULTIPLAYER: 3D PARKING CHALLENGE COURSE, GAS STATION & FREE WALK AVATAR
    // =========================================================================
    const parkingGroup = new THREE.Group();
    scene.add(parkingGroup);

    const bayFillMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const bayBorderMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const parkingBayGroup = new THREE.Group();
    const bayPadMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 5.6), bayFillMat);
    bayPadMesh.rotation.x = -Math.PI / 2;
    bayPadMesh.position.y = 0.05;
    parkingBayGroup.add(bayPadMesh);

    // 4 Glowing Corner Borders + Direction Arrow inside the Parking Bay [P]
    const borderLongGeo = new THREE.PlaneGeometry(0.16, 5.6);
    borderLongGeo.rotateX(-Math.PI / 2);
    const borderShortGeo = new THREE.PlaneGeometry(2.9, 0.16);
    borderShortGeo.rotateX(-Math.PI / 2);
    for (const sx of [-1.42, 1.42]) {
      const m = new THREE.Mesh(borderLongGeo, bayBorderMat);
      m.position.set(sx, 0.055, 0);
      parkingBayGroup.add(m);
    }
    for (const sz of [-2.76, 2.76]) {
      const m = new THREE.Mesh(borderShortGeo, bayBorderMat);
      m.position.set(0, 0.055, sz);
      parkingBayGroup.add(m);
    }
    // Direction Arrow pointing toward -Z (Forward orientation inside bay)
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 1.3);
    arrowShape.lineTo(0.65, 0.2);
    arrowShape.lineTo(0.24, 0.2);
    arrowShape.lineTo(0.24, -1.2);
    arrowShape.lineTo(-0.24, -1.2);
    arrowShape.lineTo(-0.24, 0.2);
    arrowShape.lineTo(-0.65, 0.2);
    arrowShape.closePath();
    const arrowGeo = new THREE.ShapeGeometry(arrowShape);
    arrowGeo.rotateX(-Math.PI / 2);
    const arrowMesh = new THREE.Mesh(arrowGeo, bayBorderMat);
    arrowMesh.position.set(0, 0.06, 0);
    parkingBayGroup.add(arrowMesh);
    parkingGroup.add(parkingBayGroup);

    const coneOrangeMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      roughness: 0.4,
      emissive: 0xea580c,
      emissiveIntensity: 0.25,
    });
    const coneWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.3,
    });
    const coneBaseGeo = new THREE.BoxGeometry(0.46, 0.05, 0.46);
    const coneBodyGeo = new THREE.ConeGeometry(0.18, 0.68, 12);
    const coneStripeGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.20, 12);

    const activeCones: Array<{ group: THREE.Group; x: number; z: number; hit: boolean }> = [];
    let parkingBayTarget = { x: 0, z: -40, heading: 0 };

    const rebuildParkingCourse = () => {
      for (const c of activeCones) {
        parkingGroup.remove(c.group);
      }
      activeCones.length = 0;

      const isParking = stateRef.current.gameMode === 'parking';
      parkingGroup.visible = isParking;
      if (!isParking) return;

      const challenge =
        PARKING_CHALLENGES.find((c) => c.id === stateRef.current.parkingChallengeId) ||
        PARKING_CHALLENGES[0];

      const sRef = builtTrack.samples[4] || builtTrack.samples[0];
      const baseHeading = 0; // Along -Z on the flat start straight
      const originX = sRef.point.x;
      const originZ = sRef.point.z;

      // Bay world position (fwd along -Z, lat along +X)
      parkingBayTarget = {
        x: originX + challenge.bayLatOffset,
        z: originZ - challenge.bayForwardDist,
        heading: baseHeading + challenge.bayHeadingOffset,
      };
      parkingBayGroup.position.set(parkingBayTarget.x, 0, parkingBayTarget.z);
      parkingBayGroup.rotation.set(0, parkingBayTarget.heading, 0);

      for (const coneDef of challenge.cones) {
        const cg = new THREE.Group();
        const baseM = new THREE.Mesh(coneBaseGeo, coneOrangeMat);
        baseM.position.y = 0.025;
        const bodyM = new THREE.Mesh(coneBodyGeo, coneOrangeMat);
        bodyM.position.y = 0.36;
        const stripeM = new THREE.Mesh(coneStripeGeo, coneWhiteMat);
        stripeM.position.y = 0.40;
        cg.add(baseM, bodyM, stripeM);

        const cx = originX + coneDef.lat;
        const cz = originZ - coneDef.fwd;
        cg.position.set(cx, 0.02, cz);
        parkingGroup.add(cg);
        activeCones.push({ group: cg, x: cx, z: cz, hit: false });
      }
    };

    // 3D Roadside Gas Station (Station-Service 24/7)
    const gasStationGroup = new THREE.Group();
    const buildGasStation = () => {
      const canopyMat = new THREE.MeshStandardMaterial({
        color: 0x059669,
        emissive: 0x10b981,
        emissiveIntensity: 0.45,
        roughness: 0.3,
      });
      const pillarMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
      const pumpMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35 });
      const padMat = new THREE.MeshBasicMaterial({
        color: 0x22c55e,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const canopy = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.65, 11.0), canopyMat);
      canopy.position.set(0, 4.4, 0);
      gasStationGroup.add(canopy);

      for (const pz of [-4.2, 4.2]) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 4.4, 12), pillarMat);
        pillar.position.set(1.8, 2.2, pz);
        gasStationGroup.add(pillar);

        const pump = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.65, 0.95), pumpMat);
        pump.position.set(0.4, 0.85, pz * 0.5);
        gasStationGroup.add(pump);
      }

      const refuelPad = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 10.0), padMat);
      refuelPad.rotation.x = -Math.PI / 2;
      refuelPad.position.set(-1.5, 0.045, 0);
      gasStationGroup.add(refuelPad);
    };
    buildGasStation();
    scene.add(gasStationGroup);

    const positionGasStationOnTrack = () => {
      const sGas = builtTrack.samples[18] || builtTrack.samples[0];
      const roadHalf = builtTrack.roadWidth / 2;
      const gx = sGas.point.x + sGas.normal.x * (roadHalf + 4.8);
      const gz = sGas.point.z + sGas.normal.z * (roadHalf + 4.8);
      const gHeading = Math.atan2(-sGas.tangent.x, -sGas.tangent.z);
      gasStationGroup.position.set(gx, 0, gz);
      gasStationGroup.rotation.set(0, gHeading, 0);
    };
    positionGasStationOnTrack();

    // 3D Free-Walking Driver Avatar (Mode Piéton)
    const walkerGroup = new THREE.Group();
    const walkerLeftLeg = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.72, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 })
    );
    const walkerRightLeg = walkerLeftLeg.clone();
    walkerLeftLeg.position.set(-0.11, 0.36, 0);
    walkerRightLeg.position.set(0.11, 0.36, 0);
    const walkerTorso = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.62, 0.24),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 })
    );
    walkerTorso.position.set(0, 1.03, 0);
    const walkerHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 14, 14),
      new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.45 })
    );
    walkerHead.position.set(0, 1.52, 0);
    walkerGroup.add(walkerLeftLeg, walkerRightLeg, walkerTorso, walkerHead);
    walkerGroup.visible = false;
    scene.add(walkerGroup);

    const clearAICars = () => {
      for (const ai of aiCars) {
        scene.remove(ai.rig.root);
        disposeObject3D(ai.rig.root);
      }
      aiCars = [];
    };

    const spawnAICars = () => {
      clearAICars();
      const mode = stateRef.current.gameMode;
      const track = stateRef.current.trackSpec;
      if (mode === 'time_attack' || mode === 'exploration' || mode === 'parking') return;

      let count = 0;
      if (mode === 'race') {
        count = THREE.MathUtils.clamp(track.aiCount ?? stateRef.current.settings.aiCount, 1, 7);
      } else if (mode === 'free_drive') {
        const td = stateRef.current.settings.trafficDensity;
        count = td === 'off' ? 0 : td === 'light' ? 3 : 6;
      }

      const sampleLen = builtTrack.samples.length;

      for (let i = 0; i < count; i++) {
        const spec = CARS[(i + 1) % CARS.length];
        const aiColor = AI_COLORS[i % AI_COLORS.length];
        const aiRimStyles = ['amg_multi', 'gt_five_spoke', 'bbs_mesh', 'aero_turbine'] as const;
        const aiBodyKits = ['stock', 'sport_aero', 'gt3_widebody'] as const;
        const rig = buildSportsCarModel(
          spec,
          {
            bodyColor: aiColor,
            rimColor: '#e2e8f0',
            rimStyle: aiRimStyles[i % aiRimStyles.length],
            bodyKit: aiBodyKits[i % aiBodyKits.length],
            finish: 'metallic',
            headlightColor: '#ffffff',
            neonUnderglow: false,
          },
          textures.contactShadowTexture,
          false,
          textures.carFlakeNormalMap,
          textures.tireTreadTexture,
          textures.leatherTexture,
          textures.headlightBeamTexture,
          textures.brakeHaloTexture,
          textures.wheelBlurTexture
        );
        rig.bodyMaterial.envMap = envMapTexture;
        scene.add(rig.root);

        const isStraight = Boolean(track.isStraight);
        const gridLanes = [2.2, -5.4, 5.4, -2.2, 2.2, -5.4, 5.4];
        const lane = isStraight ? gridLanes[i % gridLanes.length] : (i % 2 === 0 ? -1 : 1) * 3.6;
        const startT = isStraight
          ? Math.max(0.004, 0.018 - (Math.floor(i / 2) + 1) * 0.004)
          : (mode === 'race' ? (0.988 - i * 0.006 + 1) % 1 : ((i + 1) / (count + 1)) % 1);
        const levelSpeedFactor = track.aiSpeedFactor ?? 0.82;
        const diffMod =
          mode === 'free_drive'
            ? 0.62
            : stateRef.current.settings.aiDifficulty === 'legend'
            ? levelSpeedFactor * 1.06
            : stateRef.current.settings.aiDifficulty === 'pro'
            ? levelSpeedFactor
            : levelSpeedFactor * 0.92;

        const s = builtTrack.getSampleAtT(startT);
        const wx = s.point.x + s.normal.x * lane;
        const wy = s.point.y + 0.04;
        const wz = s.point.z + s.normal.z * lane;
        const hd = Math.atan2(-s.tangent.x, -s.tangent.z);
        const pt = s.pitch;

        rig.root.position.set(wx, wy, wz);
        rig.root.rotation.set(pt, hd, 0, 'YXZ');
        rig.bodyGroup.rotation.set(0, 0, 0);
        rig.bodyGroup.position.set(0, 0, 0);

        aiCars.push({
          rig,
          name: AI_NAMES[i % AI_NAMES.length],
          color: aiColor,
          t: startT,
          laps: isStraight ? 1 : (mode === 'race' ? 0 : 1),
          lapCooldown: 0,
          finished: false,
          finishTime: null,
          finishOrder: null,
          speedMs: 0,
          baseMaxSpeedMs: (spec.maxSpeedKmh / 3.6) * diffMod * (0.95 + (i % 3) * 0.03),
          laneOffset: lane,
          targetLaneOffset: lane,
          laneTimer: 4.0 + i * 1.5,
          worldX: wx,
          worldY: wy,
          worldZ: wz,
          heading: hd,
          pitch: pt,
        });
      }
    };

    const syncAICarPose = (ai: AICarEntity, dt: number) => {
      const s = builtTrack.getSampleAtT(ai.t);

      ai.worldX = s.point.x + s.normal.x * ai.laneOffset;
      ai.worldY = THREE.MathUtils.damp(ai.worldY || s.point.y + 0.04, s.point.y + 0.04, 28, dt);
      ai.worldZ = s.point.z + s.normal.z * ai.laneOffset;

      const targetHeading = Math.atan2(-s.tangent.x, -s.tangent.z);
      let hDiff = targetHeading - ai.heading;
      while (hDiff > Math.PI) hDiff -= Math.PI * 2;
      while (hDiff < -Math.PI) hDiff += Math.PI * 2;
      ai.heading += hDiff * Math.min(1, dt * 18);

      ai.pitch = THREE.MathUtils.damp(ai.pitch, s.pitch, 18, dt);

      ai.rig.root.position.set(ai.worldX, ai.worldY, ai.worldZ);
      ai.rig.root.rotation.set(ai.pitch, ai.heading, 0, 'YXZ');
      ai.rig.bodyGroup.rotation.set(0, 0, 0);
      ai.rig.bodyGroup.position.set(0, 0, 0);
    };

    // Player Kinematics, Suspension & Race State
    const phys = {
      x: 0,
      y: 0,
      z: 0,
      heading: 0, // radians, 0 = -Z
      roadPitch: 0,
      speedMs: 0,
      prevSpeedMs: 0,
      longitudinalAccelG: 0,
      lateralVel: 0,
      yawRate: 0, // rad/s, vitesse de rotation réelle de la caisse
      steerAngle: 0, // radians
      steerAngleDeg: 0, // degrees matching Unity CarSteering
      frontLeftSteerDeg: 0,
      frontRightSteerDeg: 0,
      slipAngleDeg: 0,
      rpm: 1000,
      gear: 1,
      manualGear: 1,
      nitro: 100,
      nitroActive: false,
      drifting: false,
      surfaceType: 'asphalt' as 'asphalt' | 'kerb' | 'shoulder',
      gripFactor: 1.0,
      headlightsOn: true,
      cameraShake: 0,
      cameraLookAheadYaw: 0,
      hitstopTimer: 0,
      lap: 1,
      totalLaps: stateRef.current.trackSpec.defaultLaps,
      progressT: 0,
      maxProgressReached: 0,
      lapCooldown: 0,
      elapsedTime: 0,
      currentLapTime: 0,
      bestLapTime: null as number | null,
      countdownTimer: 3.0,
      goBannerTimer: 0,
      lastBeepSecond: 4,
      raceFinished: false,
      finishDelayTimer: 0,
      finishCallbackFired: false,
      finishCounter: 0,
      finishOrder: null as number | null,
      finalElapsedTime: null as number | null,
      finalPosition: null as number | null,
      finalStandings: null as RacerStanding[] | null,
      bannerText: null as string | null,
      bannerTimer: 0,
      showcaseAngle: 0.45,
      dayTimeHours: timePresetToHours(stateRef.current.settings.timeOfDay),
      // Car Parking Multiplayer State
      shifterPos: 'D' as ShifterPosition,
      handbrakePulled: false,
      leftSignal: false,
      rightSignal: false,
      hazardLights: false,
      lastSignalTickState: false,
      engineRunning: true,
      fuelPercent: 100,
      nearGasStation: false,
      isWalking: false,
      walkX: 0,
      walkZ: 0,
      walkHeading: 0,
      walkCycle: 0,
      parkingStatus: 'approaching' as 'approaching' | 'inside' | 'aligned' | 'parked_success' | 'cone_hit',
      parkingProgressPct: 0,
      parkingDistanceMeters: 0,
      parkingHoldTimer: 0,
    };

    const setBanner = (text: string, duration = 2.6) => {
      phys.bannerText = text;
      phys.bannerTimer = duration;
    };

    const computeStandings = (): RacerStanding[] => {
      if (phys.finalStandings) {
        return phys.finalStandings;
      }

      const entries: Array<{
        name: string;
        color: string;
        isPlayer: boolean;
        finished: boolean;
        finishTime: number | null;
        finishOrder: number | null;
        score: number;
      }> = [
        {
          name: `Vous (${stateRef.current.carSpec.name})`,
          color: stateRef.current.customization.bodyColor,
          isPlayer: true,
          finished: phys.raceFinished,
          finishTime: phys.finalElapsedTime,
          finishOrder: phys.finishOrder,
          score: (phys.lap - 1) + phys.progressT,
        },
        ...aiCars.map((ai) => ({
          name: ai.name,
          color: ai.color,
          isPlayer: false,
          finished: ai.finished,
          finishTime: ai.finishTime,
          finishOrder: ai.finishOrder,
          score: (ai.laps - 1) + ai.t,
        })),
      ];

      entries.sort((a, b) => {
        if (a.finished && b.finished) {
          return (a.finishOrder ?? 999) - (b.finishOrder ?? 999);
        }
        if (a.finished !== b.finished) {
          return a.finished ? -1 : 1;
        }
        return b.score - a.score;
      });

      return entries.map((e, idx) => ({
        rank: idx + 1,
        name: e.name,
        color: e.color,
        isPlayer: e.isPlayer,
        finished: e.finished,
        finishTime: e.finishTime,
      }));
    };

    const resetSession = () => {
      const isStraight = Boolean(stateRef.current.trackSpec.isStraight);
      const isParking = stateRef.current.gameMode === 'parking';
      const sStart = isStraight && !isParking ? builtTrack.samples[12] : (builtTrack.samples[4] || builtTrack.samples[0]);

      rebuildParkingCourse();
      positionGasStationOnTrack();

      if (isParking) {
        const challenge =
          PARKING_CHALLENGES.find((c) => c.id === stateRef.current.parkingChallengeId) ||
          PARKING_CHALLENGES[0];
        phys.x = sStart.point.x + challenge.startLatOffset;
        phys.y = 0.04;
        phys.z = sStart.point.z - challenge.startForwardDist;
        phys.heading = challenge.startHeadingOffset;
        phys.shifterPos = 'D';
        touchInputRef.current.shifterPos = 'D';
        phys.countdownTimer = 0;
      } else {
        const spawnLatOffset = isStraight ? -2.2 : 2.8;
        phys.x = isStraight ? -2.2 : (sStart.point.x - sStart.normal.x * spawnLatOffset);
        phys.y = 0.04;
        phys.z = isStraight ? sStart.point.z : (sStart.point.z - sStart.normal.z * spawnLatOffset);
        phys.heading = 0; // Perfectly aligned straight ahead along -Z on the starting grid
        phys.shifterPos = 'D';
        touchInputRef.current.shifterPos = 'D';
        phys.countdownTimer = 0;
      }

      phys.roadPitch = 0;
      phys.speedMs = 0;
      phys.prevSpeedMs = 0;
      phys.longitudinalAccelG = 0;
      phys.lateralVel = 0;
      phys.yawRate = 0;
      phys.steerAngle = 0;
      phys.steerAngleDeg = 0;
      phys.frontLeftSteerDeg = 0;
      phys.frontRightSteerDeg = 0;
      phys.slipAngleDeg = 0;
      phys.rpm = 1000;
      phys.gear = 1;
      phys.manualGear = 1;
      phys.nitro = 100;
      phys.nitroActive = false;
      phys.drifting = false;
      phys.surfaceType = 'asphalt';
      phys.gripFactor = 1.0;
      phys.headlightsOn = true;
      phys.cameraShake = 0;
      phys.cameraLookAheadYaw = 0;
      phys.hitstopTimer = 0;
      phys.lap = 1;
      phys.totalLaps = stateRef.current.trackSpec.defaultLaps;
      phys.progressT = sStart.t;
      phys.maxProgressReached = 0;
      phys.lapCooldown = 0;
      phys.elapsedTime = 0;
      phys.currentLapTime = 0;
      phys.bestLapTime = null;
      phys.goBannerTimer = 0;
      phys.lastBeepSecond = 4;
      phys.raceFinished = false;
      phys.finishDelayTimer = 0;
      phys.finishCallbackFired = false;
      phys.finishCounter = 0;
      phys.finishOrder = null;
      phys.finalElapsedTime = null;
      phys.finalPosition = null;
      phys.finalStandings = null;
      phys.bannerText = null;
      phys.bannerTimer = 0;
      phys.handbrakePulled = false;
      phys.engineRunning = true;
      phys.fuelPercent = 100;
      phys.isWalking = false;
      walkerGroup.visible = false;
      phys.parkingStatus = 'approaching';
      phys.parkingProgressPct = 0;
      phys.parkingHoldTimer = 0;

      // Clear any residual steering or pedal state so the car never moves or turns at start
      touchInputRef.current.steerInput = 0;
      touchInputRef.current.left = false;
      touchInputRef.current.right = false;
      touchInputRef.current.throttle = false;
      touchInputRef.current.brake = false;
      touchInputRef.current.nitro = false;
      touchInputRef.current.handbrake = false;

      for (const b of builtTrack.beacons) {
        b.collected = false;
        b.mesh.visible = stateRef.current.gameMode === 'exploration';
      }

      spawnAICars();

      const rideOffset = Number(playerCar.bodyGroup.userData.rideHeightOffset || 0);
      playerCar.root.position.set(phys.x, phys.y, phys.z);
      playerCar.root.rotation.set(0, phys.heading, 0, 'YXZ');
      playerCar.bodyGroup.position.set(0, rideOffset, 0);
      playerCar.bodyGroup.rotation.set(0, 0, 0);
      playerCar.frontLeftPivot.rotation.set(0, 0, 0);
      playerCar.frontRightPivot.rotation.set(0, 0, 0);
      playerCar.steeringWheel.rotation.set(0, 0, 0);

      const sinH = Math.sin(phys.heading);
      const cosH = Math.cos(phys.heading);
      const camMode = stateRef.current.settings.cameraMode;
      const distOffset = stateRef.current.settings.cameraDistanceOffset || 0;
      const isNear = camMode === 'chase_near';
      const distBack = (isNear ? 4.65 : 8.2) + distOffset;
      const camHeight = (isNear ? 1.98 : 3.2) + distOffset * 0.18;
      const lookAheadDist = isNear ? 6.2 : 10.0;
      const lookHeight = isNear ? 0.88 : 1.15;

      camera.position.set(phys.x + sinH * distBack, phys.y + camHeight, phys.z + cosH * distBack);
      _smoothedLookAt.set(phys.x - sinH * lookAheadDist, phys.y + lookHeight, phys.z - cosH * lookAheadDist);
      camera.lookAt(_smoothedLookAt);
    };

    const respawnCar = () => {
      const closest = builtTrack.getClosestSample(phys.x, phys.z);
      const trackHeading = Math.atan2(-closest.sample.tangent.x, -closest.sample.tangent.z);
      phys.x = closest.sample.point.x;
      phys.y = closest.sample.point.y + 0.05;
      phys.z = closest.sample.point.z;
      phys.heading = trackHeading;
      phys.roadPitch = closest.sample.pitch;
      phys.speedMs = Math.max(10, Math.abs(phys.speedMs));
      phys.steerAngle = 0;
      phys.steerAngleDeg = 0;
      phys.frontLeftSteerDeg = 0;
      phys.frontRightSteerDeg = 0;
      phys.slipAngleDeg = 0;
      phys.lateralVel = 0;
      phys.yawRate = 0;
      phys.longitudinalAccelG = 0;
      phys.cameraShake = 0.06;
      soundEngine.playCheckpointChime();
      setBanner('VÉHICULE RÉTABLI SUR LA PISTE', 2.0);
    };

    resetSession();

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 6. Keyboard Input Handling (including Manual Shift E/PageUp/PageDown, Look Back KeyB & Respawn KeyR)
    const keys = {
      up: false,
      down: false,
      left: false,
      right: false,
      nitro: false,
      lookBack: false,
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      soundEngine.init();
      const code = e.code;
      if (code === 'ArrowUp' || code === 'KeyW' || code === 'KeyZ') keys.up = true;
      if (code === 'ArrowDown' || code === 'KeyS') keys.down = true;
      if (code === 'ArrowLeft' || code === 'KeyA' || code === 'KeyQ') keys.left = true;
      if (code === 'ArrowRight' || code === 'KeyD') keys.right = true;
      if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'Space') keys.nitro = true;
      if (code === 'KeyB') keys.lookBack = true;

      if (code === 'KeyE' || code === 'PageUp') {
        touchInputRef.current.shiftUpQueued = true;
      }
      if (code === 'PageDown') {
        touchInputRef.current.shiftDownQueued = true;
      }
      if (code === 'KeyR' && stateRef.current.screenState === 'playing') {
        if (stateRef.current.gameMode === 'parking') {
          resetSession();
        } else {
          respawnCar();
        }
      }
      if (code === 'KeyP' && stateRef.current.screenState === 'playing') {
        touchInputRef.current.shifterPos = touchInputRef.current.shifterPos === 'P' ? 'D' : 'P';
        touchInputRef.current.handbrake = touchInputRef.current.shifterPos === 'P';
      }
      if (code === 'KeyH' && stateRef.current.screenState === 'playing') {
        soundEngine.playHorn(0.32);
      }

      if (code === 'Escape' && (stateRef.current.screenState === 'playing' || stateRef.current.screenState === 'paused')) {
        e.preventDefault();
        callbacksRef.current.onPauseToggle();
      }
      if (code === 'KeyL' && stateRef.current.screenState === 'playing') {
        phys.headlightsOn = !phys.headlightsOn;
      }
      if (code === 'KeyC' && stateRef.current.screenState === 'playing') {
        callbacksRef.current.onCycleCamera();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'ArrowUp' || code === 'KeyW' || code === 'KeyZ') keys.up = false;
      if (code === 'ArrowDown' || code === 'KeyS') keys.down = false;
      if (code === 'ArrowLeft' || code === 'KeyA' || code === 'KeyQ') keys.left = false;
      if (code === 'ArrowRight' || code === 'KeyD') keys.right = false;
      if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'Space') keys.nitro = false;
      if (code === 'KeyB') keys.lookBack = false;
    };

    const handleBlur = () => {
      keys.up = false;
      keys.down = false;
      keys.left = false;
      keys.right = false;
      keys.nitro = false;
      keys.lookBack = false;
    };

    const preventGesture = (e: Event) => {
      if (stateRef.current.screenState === 'playing') {
        e.preventDefault();
      }
    };

    // Interactive 360° Showroom Camera Drag (Car Parking Multiplayer Garage/Hub)
    let isDraggingShowroom = false;
    let dragLastX = 0;
    let showcaseUserControlTimer = 0;

    const handleShowroomPointerDown = (e: PointerEvent) => {
      if (stateRef.current.screenState === 'playing') return;
      isDraggingShowroom = true;
      dragLastX = e.clientX;
      showcaseUserControlTimer = 4.5;
    };
    const handleShowroomPointerMove = (e: PointerEvent) => {
      if (!isDraggingShowroom || stateRef.current.screenState === 'playing') return;
      const dx = e.clientX - dragLastX;
      dragLastX = e.clientX;
      phys.showcaseAngle -= dx * 0.0085;
      showcaseUserControlTimer = 4.5;
    };
    const handleShowroomPointerUp = () => {
      isDraggingShowroom = false;
    };

    window.addEventListener('pointerdown', handleShowroomPointerDown);
    window.addEventListener('pointermove', handleShowroomPointerMove);
    window.addEventListener('pointerup', handleShowroomPointerUp);
    window.addEventListener('pointercancel', handleShowroomPointerUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('gesturestart', preventGesture, { passive: false });
    window.addEventListener('gesturechange', preventGesture, { passive: false });

    const handleResize = () => {
      if (!container) return;
      const w = window.innerWidth || container.clientWidth;
      const h = window.innerHeight || container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(getTargetPixelRatio(activeQualityTier));
      renderer.setSize(w, h, true);
    };
    const handleOrientationChange = () => {
      handleResize();
      window.setTimeout(handleResize, 120);
      window.setTimeout(handleResize, 320);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    // 7. Main Simulation & Render Loop
    const clock = new THREE.Clock();
    let frameId = 0;
    let unmounted = false;
    let fpsFrames = 0;
    let fpsAccum = 0;
    let currentFps = 60;
    let telemetryEmitAccum = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (unmounted) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function tick() {
      if (unmounted) return;

      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsed = clock.getElapsedTime();

      fpsFrames++;
      fpsAccum += rawDt;
      if (fpsAccum >= 1.0) {
        currentFps = Math.round(fpsFrames / fpsAccum);
        fpsFrames = 0;
        fpsAccum = 0;
      }

      if (rebuildFlagRef.current.lightingDirty) {
        rebuildFlagRef.current.lightingDirty = false;
        phys.dayTimeHours = timePresetToHours(stateRef.current.settings.timeOfDay);
        updateDynamicLighting(phys.dayTimeHours, stateRef.current.settings.weather);
        builtTrack.updateDayNight(phys.dayTimeHours, stateRef.current.settings.weather);
      }

      if (rebuildFlagRef.current.trackDirty) {
        rebuildFlagRef.current.trackDirty = false;
        activeQualityTier = resolveQualityTier(stateRef.current.settings.quality);
        renderer.setPixelRatio(getTargetPixelRatio(activeQualityTier));
        scene.remove(builtTrack.group);
        builtTrack.dispose();
        builtTrack = buildTrackEnvironment(
          stateRef.current.trackSpec,
          stateRef.current.settings.timeOfDay,
          textures,
          activeQualityTier,
          stateRef.current.settings.weather
        );
        scene.add(builtTrack.group);
        resetSession();
        spawnAICars();
      }

      if (rebuildFlagRef.current.carDirty) {
        rebuildFlagRef.current.carDirty = false;
        scene.remove(playerCar.root);
        disposeObject3D(playerCar.root);
        playerCar = buildSportsCarModel(
          stateRef.current.carSpec,
          stateRef.current.customization,
          textures.contactShadowTexture,
          !isSoftwareGl,
          textures.carFlakeNormalMap,
          textures.tireTreadTexture,
          textures.leatherTexture,
          textures.headlightBeamTexture,
          textures.brakeHaloTexture,
          textures.wheelBlurTexture
        );
        playerCar.bodyMaterial.envMap = envMapTexture;
        playerCar.root.position.set(phys.x, phys.y, phys.z);
        playerCar.root.rotation.set(phys.roadPitch, phys.heading, 0, 'YXZ');
        scene.add(playerCar.root);
      }

      if (rebuildFlagRef.current.aiDirty) {
        rebuildFlagRef.current.aiDirty = false;
        spawnAICars();
      }

      if (rebuildFlagRef.current.sessionResetDirty) {
        rebuildFlagRef.current.sessionResetDirty = false;
        resetSession();
      }

      soundEngine.setMuted(!stateRef.current.settings.soundEnabled);
      soundEngine.setVolume(stateRef.current.settings.volume);

      const currentScreen = stateRef.current.screenState;
      const isPlaying = currentScreen === 'playing';
      const currentWeather = stateRef.current.settings.weather;

      // PROGRESSIVE DYNAMIC DAY/NIGHT CYCLE (Visible in Free Drive, Race, Time Attack, Exploration & Menu)
      if (stateRef.current.settings.dynamicDayNight && currentScreen !== 'paused') {
        const cycleSpeed = stateRef.current.settings.dayNightSpeed || 1.0;
        // 1 full 24h cycle in ~110 seconds at 1x speed (~0.22 hours per real second)
        phys.dayTimeHours = (phys.dayTimeHours + dt * 0.22 * cycleSpeed) % 24;
      }
      const nightFactor = updateDynamicLighting(phys.dayTimeHours, currentWeather);
      builtTrack.updateDayNight(phys.dayTimeHours, currentWeather);

      // Update 3D Snow Particles around the Car (Removed for rain so no blurry squares float on screen)
      if (currentWeather === 'snow') {
        precipPoints.visible = true;
        precipMat.color.setHex(0xf8fafc);
        precipMat.size = 0.15;
        precipMat.opacity = 0.65;
        const posAttr = precipGeo.attributes.position as THREE.BufferAttribute;
        const fallSpeed = 7.5;
        for (let i = 0; i < precipCount; i++) {
          let py = posAttr.getY(i) - fallSpeed * dt;
          let px = posAttr.getX(i) + Math.sin(elapsed * 2 + i) * 1.5 * dt;
          let pz = posAttr.getZ(i);
          if (py < phys.y - 1) {
            py = phys.y + 22 + Math.random() * 4;
            px = phys.x + (Math.random() - 0.5) * 65;
            pz = phys.z + (Math.random() - 0.5) * 65;
          }
          posAttr.setXYZ(i, px, py, pz);
        }
        posAttr.needsUpdate = true;
      } else {
        precipPoints.visible = false;
      }

      if (stateRef.current.gameMode === 'exploration') {
        builtTrack.updateBeacons(elapsed);
      }

      const effectiveHeadlightsOn = phys.headlightsOn && (nightFactor > 0.28 || currentWeather !== 'clear');
      const headIntensity = effectiveHeadlightsOn ? 3.5 : 1.1;
      playerCar.headlightMaterial.emissiveIntensity = headIntensity;
      for (const spot of playerCar.headlightSpots) {
        spot.intensity = effectiveHeadlightsOn ? 95 : 0;
      }
      for (const beam of playerCar.headlightBeams) {
        beam.visible = effectiveHeadlightsOn;
      }

      const isLookingBack = Boolean(keys.lookBack || touchInputRef.current.lookBack);

      if (currentScreen !== 'playing' && currentScreen !== 'paused' && currentScreen !== 'finished') {
        // SHOWCASE / GARAGE / MENU CAMERA ORBIT + INTERACTIVE 360° DRAG AROUND CAR
        if (showcaseUserControlTimer > 0) {
          showcaseUserControlTimer = Math.max(0, showcaseUserControlTimer - dt);
        } else {
          phys.showcaseAngle += dt * 0.24;
        }
        const isGarageView = currentScreen === 'garage' || currentScreen === 'car_select';
        const radius = isGarageView ? 6.1 : 6.6;
        const height = isGarageView ? 2.05 : 2.2;
        const angleOffset = phys.showcaseAngle;
        const targetX = phys.x + Math.sin(phys.heading + angleOffset) * radius;
        const targetZ = phys.z + Math.cos(phys.heading + angleOffset) * radius;

        camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX, 8, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, phys.y + height, 8, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 8, dt);
        _camLookAt.set(
          phys.x,
          phys.y + (isGarageView ? 0.78 : 0.88),
          phys.z
        );
        camera.lookAt(_camLookAt);

        // Animate AI cars visibly cruising along the highway in the background
        for (let i = 0; i < aiCars.length; i++) {
          const ai = aiCars[i];
          ai.speedMs = THREE.MathUtils.damp(ai.speedMs, ai.baseMaxSpeedMs * 0.75, 1.8, dt);
          ai.t = (ai.t + (ai.speedMs * dt) / builtTrack.totalLength) % 1;
          syncAICarPose(ai, dt);
          for (const w of ai.rig.wheels) {
            w.rotation.x -= ai.speedMs * dt * 2.5;
          }
        }
        playerCar.bodyGroup.rotation.set(0, 0, 0);
        const garageRideHeightOffset = Number(playerCar.bodyGroup.userData.rideHeightOffset || 0);
        playerCar.bodyGroup.position.set(0, garageRideHeightOffset, 0);
        playerCar.root.position.set(phys.x, phys.y, phys.z);
        playerCar.root.rotation.set(phys.roadPitch, phys.heading, 0, 'YXZ');
        for (const m of playerCar.cockpitOccludingMeshes) {
          m.visible = true;
        }

        soundEngine.updateEngine(1000, 0, false, false);
      } else if (isPlaying) {
        // 3 - 2 - 1 - GO Countdown Phase before every start
        if (phys.countdownTimer > 0) {
          phys.countdownTimer -= dt;
          const ceilSec = Math.ceil(phys.countdownTimer);
          if (ceilSec < phys.lastBeepSecond && ceilSec >= 1) {
            phys.lastBeepSecond = ceilSec;
            soundEngine.playCountdownBeep(false);
          } else if (phys.countdownTimer <= 0 && phys.lastBeepSecond !== 0) {
            phys.lastBeepSecond = 0;
            phys.goBannerTimer = 1.0;
            soundEngine.playCountdownBeep(true);
          }
        } else if (phys.goBannerTimer > 0) {
          phys.goBannerTimer = Math.max(0, phys.goBannerTimer - dt);
        }

        if (phys.bannerTimer > 0) {
          phys.bannerTimer -= dt;
          if (phys.bannerTimer <= 0) phys.bannerText = null;
        }

        const canDrive = phys.countdownTimer <= 0;

        if (phys.raceFinished) {
          // 3. VOITURE APRÈS L'ARRIVÉE : coupe les commandes, freinage automatique progressif jusqu'à l'arrêt, son moteur retombe doucement
          phys.finishDelayTimer = Math.max(0, phys.finishDelayTimer - dt);
          phys.nitroActive = false;
          phys.drifting = false;
          phys.prevSpeedMs = phys.speedMs;

          if (phys.speedMs > 0.15) {
            const autoDecel = stateRef.current.carSpec.braking * 0.55;
            phys.speedMs = Math.max(0, THREE.MathUtils.damp(phys.speedMs, 0, 2.4, dt) - autoDecel * dt);
          } else {
            phys.speedMs = 0;
          }

          const rawAccelG = (phys.speedMs - phys.prevSpeedMs) / Math.max(0.008, dt) / 28;
          phys.longitudinalAccelG = THREE.MathUtils.damp(
            phys.longitudinalAccelG,
            THREE.MathUtils.clamp(rawAccelG, -1.2, 1.2),
            10,
            dt
          );

          phys.steerAngle = THREE.MathUtils.damp(phys.steerAngle, 0, 8, dt);
          phys.lateralVel = THREE.MathUtils.damp(phys.lateralVel, 0, 8, dt);

          const forwardX = -Math.sin(phys.heading);
          const forwardZ = -Math.cos(phys.heading);
          phys.x += forwardX * phys.speedMs * dt;
          phys.z += forwardZ * phys.speedMs * dt;

          const closest = builtTrack.getClosestSample(phys.x, phys.z);
          phys.y = THREE.MathUtils.damp(phys.y, closest.sample.point.y + 0.04, 28, dt);
          phys.roadPitch = THREE.MathUtils.damp(phys.roadPitch, closest.sample.pitch, 18, dt);

          const trackHeading = Math.atan2(-closest.sample.tangent.x, -closest.sample.tangent.z);
          let headingDiff = trackHeading - phys.heading;
          while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
          while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
          phys.heading += headingDiff * Math.min(1, dt * 5);

          // Keep AI cars cruising along the track
          for (let i = 0; i < aiCars.length; i++) {
            const ai = aiCars[i];
            ai.speedMs = THREE.MathUtils.damp(ai.speedMs, ai.baseMaxSpeedMs * 0.6, 2.0, dt);
            ai.t = (ai.t + (ai.speedMs * dt) / builtTrack.totalLength) % 1;
            syncAICarPose(ai, dt);
            for (const w of ai.rig.wheels) {
              w.rotation.x -= ai.speedMs * dt * 2.5;
            }
          }

          playerCar.root.position.set(phys.x, phys.y, phys.z);
          playerCar.root.rotation.set(phys.roadPitch, phys.heading, 0, 'YXZ');
          playerCar.frontLeftPivot.rotation.y = -phys.frontLeftSteerDeg * (Math.PI / 180.0);
          playerCar.frontRightPivot.rotation.y = -phys.frontRightSteerDeg * (Math.PI / 180.0);
          playerCar.steeringWheel.rotation.z = -phys.steerAngleDeg * (Math.PI / 180.0) * 2.4;
          for (const w of playerCar.wheels) {
            w.rotation.x -= phys.speedMs * dt * 2.55;
          }
          playerCar.bodyGroup.rotation.x = THREE.MathUtils.damp(
            playerCar.bodyGroup.rotation.x,
            -phys.longitudinalAccelG * 0.012,
            10,
            dt
          );
          playerCar.bodyGroup.rotation.z = THREE.MathUtils.damp(playerCar.bodyGroup.rotation.z, 0, 10, dt);
          const speedKmh = Math.abs(phys.speedMs) * 3.6;
          const isAutoBraking = phys.speedMs > 0.5;
          playerCar.brakeLightMaterial.emissiveIntensity = isAutoBraking ? 6.8 : 1.8;
          playerCar.brakeHaloMaterial.opacity = isAutoBraking ? 0.92 : 0.42;
          playerCar.wheelBlurMaterial.opacity = THREE.MathUtils.clamp((speedKmh - 65) / 170, 0, 0.62);
          playerCar.tailTrailMaterial.opacity = THREE.MathUtils.clamp((speedKmh - 75) / 180, 0, 0.36);

          phys.rpm = THREE.MathUtils.damp(phys.rpm, 820, 3.2, dt);
          if (speedKmh < 15) phys.gear = 1;
          soundEngine.updateEngine(phys.rpm, speedKmh, false, true, Math.max(1, phys.gear), false, 0);
        } else if (phys.hitstopTimer > 0) {
          phys.hitstopTimer -= dt;
        } else if (canDrive) {
          phys.elapsedTime += dt;
          phys.currentLapTime += dt;
          if (phys.lapCooldown > 0) {
            phys.lapCooldown = Math.max(0, phys.lapCooldown - dt);
          }

          const tInput = touchInputRef.current;
          const throttlePressed = keys.up || tInput.throttle;
          const brakePressed = keys.down || tInput.brake;
          const nitroPressed = keys.nitro || tInput.nitro;

          // Sync Car Parking Multiplayer Cockpit Controls
          if (tInput.shifterPos) {
            phys.shifterPos = tInput.shifterPos;
          }
          // Pédale AVANCER / GAZ : passe automatiquement en D (Marche Avant), desserre le frein à main et démarre le moteur
          if (throttlePressed) {
            phys.shifterPos = 'D';
            tInput.shifterPos = 'D';
            tInput.brake = false;
            if (tInput.handbrake) {
              tInput.handbrake = false;
            }
            if (!phys.engineRunning) {
              phys.engineRunning = true;
            }
          } else if (brakePressed) {
            if (tInput.handbrake) {
              tInput.handbrake = false;
            }
            if (!phys.engineRunning) {
              phys.engineRunning = true;
            }
            if (phys.speedMs <= 0.25) {
              phys.shifterPos = 'R';
              tInput.shifterPos = 'R';
            }
          }
          phys.handbrakePulled = Boolean(tInput.handbrake);
          phys.leftSignal = Boolean(tInput.leftSignal);
          phys.rightSignal = Boolean(tInput.rightSignal);
          phys.hazardLights = Boolean(tInput.hazardLights);

          if (tInput.toggleHeadlightsQueued) {
            tInput.toggleHeadlightsQueued = false;
            phys.headlightsOn = !phys.headlightsOn;
          }
          if (tInput.toggleEngineQueued) {
            tInput.toggleEngineQueued = false;
            phys.engineRunning = !phys.engineRunning;
            setBanner(phys.engineRunning ? 'MOTEUR DÉMARRÉ' : 'MOTEUR ARRÊTÉ', 1.8);
          }
          if (tInput.toggleWalkQueued) {
            tInput.toggleWalkQueued = false;
            if (!phys.isWalking && Math.abs(phys.speedMs) < 3.5) {
              phys.isWalking = true;
              phys.speedMs = 0;
              phys.shifterPos = 'P';
              tInput.shifterPos = 'P';
              const rX = Math.cos(phys.heading);
              const rZ = -Math.sin(phys.heading);
              phys.walkX = phys.x - rX * 1.85;
              phys.walkZ = phys.z - rZ * 1.85;
              phys.walkHeading = phys.heading;
              walkerGroup.visible = true;
              walkerGroup.position.set(phys.walkX, 0.04, phys.walkZ);
              walkerGroup.rotation.set(0, phys.walkHeading, 0);
              setBanner('MODE PIÉTON ACTIF — MARCHEZ AUTOUR DU VÉHICULE', 2.4);
            } else if (phys.isWalking) {
              phys.isWalking = false;
              walkerGroup.visible = false;
              phys.shifterPos = 'D';
              tInput.shifterPos = 'D';
              setBanner('À BORD DU VÉHICULE', 1.8);
            } else {
              setBanner('ARRÊTEZ LA VOITURE POUR SORTIR À PIED', 2.0);
            }
          }

          // Check Gas Station Proximity & Refueling
          const gDx = phys.x - gasStationGroup.position.x;
          const gDz = phys.z - gasStationGroup.position.z;
          phys.nearGasStation = gDx * gDx + gDz * gDz < 14 * 14;
          if (tInput.refuelQueued || (phys.nearGasStation && Math.abs(phys.speedMs) < 0.8 && phys.fuelPercent < 99.5)) {
            if (tInput.refuelQueued) {
              tInput.refuelQueued = false;
              phys.fuelPercent = 100;
              setBanner('PLEIN D’ESSENCE EFFECTUÉ (100%) !', 2.4);
            } else {
              phys.fuelPercent = Math.min(100, phys.fuelPercent + dt * 18);
            }
          }

          const isManual = stateRef.current.settings.transmission === 'manual';

          // Check for queued car respawn / unstick
          if (tInput.respawnQueued) {
            tInput.respawnQueued = false;
            if (stateRef.current.gameMode === 'parking') {
              resetSession();
            } else {
              respawnCar();
            }
          }

          // 1. Steering Input: -1 (Gauche) to +1 (Droite)
          const keySteer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
          const rawWheelSteer = tInput.steerInput;
          const rawSteerInput = Math.abs(rawWheelSteer) > 0.01 ? rawWheelSteer : keySteer;
          const steerInput = THREE.MathUtils.clamp(rawSteerInput, -1.0, 1.0);

          if (phys.isWalking) {
            // Free-Walking Pedestrian Movement around the Parked Car
            const walkTurn = -steerInput * 2.4 * dt;
            phys.walkHeading += walkTurn;
            const walkSpeed = throttlePressed ? 4.2 : brakePressed ? -2.8 : 0;
            const wfX = -Math.sin(phys.walkHeading);
            const wfZ = -Math.cos(phys.walkHeading);
            phys.walkX += wfX * walkSpeed * dt;
            phys.walkZ += wfZ * walkSpeed * dt;

            // Keep walker from walking inside the parked car box
            const cdx = phys.walkX - phys.x;
            const cdz = phys.walkZ - phys.z;
            const cDistSq = cdx * cdx + cdz * cdz;
            if (cDistSq < 2.1 * 2.1 && cDistSq > 0.001) {
              const cDist = Math.sqrt(cDistSq);
              phys.walkX = phys.x + (cdx / cDist) * 2.1;
              phys.walkZ = phys.z + (cdz / cDist) * 2.1;
            }

            if (Math.abs(walkSpeed) > 0.1) {
              phys.walkCycle += dt * 9;
              walkerLeftLeg.rotation.x = Math.sin(phys.walkCycle) * 0.55;
              walkerRightLeg.rotation.x = -Math.sin(phys.walkCycle) * 0.55;
            } else {
              walkerLeftLeg.rotation.x = 0;
              walkerRightLeg.rotation.x = 0;
            }
            walkerGroup.position.set(phys.walkX, 0.04, phys.walkZ);
            walkerGroup.rotation.set(0, phys.walkHeading, 0);
            soundEngine.updateEngine(phys.engineRunning ? 820 : 0, 0, false, phys.engineRunning, 1, false, 0);
          } else {
            // Nitro Logic
            if (
              nitroPressed &&
              phys.nitro > 5 &&
              throttlePressed &&
              Math.abs(phys.speedMs) > 10 &&
              phys.shifterPos === 'D' &&
              phys.engineRunning &&
              phys.fuelPercent > 0
            ) {
              phys.nitroActive = true;
              phys.nitro = Math.max(0, phys.nitro - dt * 28);
            } else {
              phys.nitroActive = false;
              phys.nitro = Math.min(100, phys.nitro + dt * 9);
            }

            // Fuel consumption
            if (phys.engineRunning && phys.fuelPercent > 0) {
              const burnRate = throttlePressed ? 0.32 : 0.05;
              phys.fuelPercent = Math.max(0, phys.fuelPercent - burnRate * dt);
            }

            // Track surface classification & base friction
            const closest = builtTrack.getClosestSample(phys.x, phys.z);
            const halfRoad = builtTrack.roadWidth / 2;
            const absLat = Math.abs(closest.signedLateralDist);

            let baseSurfaceGrip = 1.0;
            if (absLat <= halfRoad - 0.2) {
              phys.surfaceType = 'asphalt';
              baseSurfaceGrip = currentWeather === 'rain' ? 0.88 : currentWeather === 'snow' ? 0.72 : 1.0;
            } else if (absLat <= halfRoad + 0.85) {
              phys.surfaceType = 'kerb';
              baseSurfaceGrip = 0.84;
            } else {
              phys.surfaceType = 'shoulder';
              baseSurfaceGrip = 0.58;
            }

            let speedAbs = Math.abs(phys.speedMs);
            let speedKmh = speedAbs * 3.6;
            const isReversing = phys.speedMs < -0.1 || phys.shifterPos === 'R';

            // 5. Appui aérodynamique & charge verticale
            const downforceFactor = 1.0 + (30.0 / 1200.0) * THREE.MathUtils.clamp(speedKmh / 100.0, 0, 2.5);
            phys.gripFactor = baseSurfaceGrip * downforceFactor;

            // 6. PHYSIQUE : vitesse avant + latérale, boîte P-R-N-D
            phys.prevSpeedMs = phys.speedMs;
            const baseMaxSpeed =
              (stateRef.current.carSpec.maxSpeedKmh / 3.6) * (phys.nitroActive ? 1.18 : 1.0);
            const maxSpeed =
              phys.surfaceType === 'shoulder' ? Math.min(baseMaxSpeed, 28) : baseMaxSpeed;

            const dynInput: CarDynInput = {
              steerInput,
              throttle: Boolean(throttlePressed),
              brake: Boolean(brakePressed),
              canDrive: canDrive && phys.parkingStatus !== 'cone_hit',
              nitroActive: phys.nitroActive,
              sensitivity: stateRef.current.settings.steeringSensitivity,
              gripFactor: phys.gripFactor,
              maxSpeedMs: maxSpeed,
              acceleration: stateRef.current.carSpec.acceleration,
              braking: stateRef.current.carSpec.braking,
              handling: stateRef.current.carSpec.handling,
              offRoad: phys.surfaceType === 'shoulder',
              shifterPos: phys.shifterPos,
              handbrake: phys.handbrakePulled,
              engineRunning: phys.engineRunning,
              outOfFuel: phys.fuelPercent <= 0,
              parkingMode: stateRef.current.gameMode === 'parking',
            };
            stepCarDynamicsSubsteps(phys, dynInput, dt);

            speedAbs = Math.abs(phys.speedMs);
            speedKmh = speedAbs * 3.6;

            // 8. Electronic Stability Program (ESP) — Anti-spin only during actual high-angle skids
            const espActive = stateRef.current.settings.absEspEnabled !== false;
            if (espActive && speedAbs > 15 && Math.abs(phys.slipAngleDeg) > 10 && stateRef.current.gameMode !== 'parking') {
              const trackHeading = Math.atan2(-closest.sample.tangent.x, -closest.sample.tangent.z);
              let headingDiff = trackHeading - phys.heading;
              while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
              while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;

              if (Math.abs(headingDiff) > 0.52) {
                const antiSpinDamp = THREE.MathUtils.clamp((speedKmh / 280.0) * 1.6, 0.5, 1.8);
                phys.heading += headingDiff * antiSpinDamp * dt;
              }
            }

            // Flat, rock-steady road height & pitch alignment
            phys.y = 0.04;
            phys.roadPitch = 0;
            phys.longitudinalAccelG = 0;

            // Smooth Anti-Stick Guardrail Collision & Glancing Deflection
            const maxBarrierDist = stateRef.current.gameMode === 'parking' ? halfRoad + 14.0 : halfRoad + 1.85;
            if (absLat > maxBarrierDist) {
              const sign = closest.signedLateralDist >= 0 ? 1 : -1;
              const outwardX = closest.sample.normal.x * sign;
              const outwardZ = closest.sample.normal.z * sign;
              const inwardX = -outwardX;
              const inwardZ = -outwardZ;

              const fwdX = -Math.sin(phys.heading);
              const fwdZ = -Math.cos(phys.heading);
              const velOutward = (fwdX * outwardX + fwdZ * outwardZ) * phys.speedMs;

              if (velOutward > 0) {
                phys.x = closest.sample.point.x + closest.sample.normal.x * sign * maxBarrierDist + inwardX * 0.25;
                phys.z = closest.sample.point.z + closest.sample.normal.z * sign * maxBarrierDist + inwardZ * 0.25;

                if (stateRef.current.gameMode !== 'parking') {
                  const trackHeading = Math.atan2(-closest.sample.tangent.x, -closest.sample.tangent.z);
                  let headingDiff = trackHeading - phys.heading;
                  while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
                  while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
                  phys.heading += headingDiff * Math.min(1.0, dt * 4.0);
                }

                phys.speedMs *= Math.exp(-2.45 * dt);

                if (speedAbs > 9) {
                  soundEngine.playCollision(Math.min(1.0, speedAbs / 30));
                  phys.cameraShake = Math.min(0.18, speedAbs * 0.005);
                }
              } else if (absLat > maxBarrierDist + 1.2) {
                phys.x = closest.sample.point.x + closest.sample.normal.x * sign * (maxBarrierDist + 1.2);
                phys.z = closest.sample.point.z + closest.sample.normal.z * sign * (maxBarrierDist + 1.2);
              }
            }

            // ===================================================================
            // CAR PARKING MULTIPLAYER: PRECISION PARKING CHALLENGE EVALUATION
            // ===================================================================
            if (stateRef.current.gameMode === 'parking' && !phys.raceFinished) {
              // 1. Cone Collision Check
              for (const cone of activeCones) {
                if (cone.hit) continue;
                const cdx = phys.x - cone.x;
                const cdz = phys.z - cone.z;
                if (cdx * cdx + cdz * cdz < 1.32 * 1.32) {
                  cone.hit = true;
                  cone.group.rotation.x = 1.35;
                  cone.group.position.y = 0.14;
                  phys.speedMs = 0;
                  phys.parkingStatus = 'cone_hit';
                  soundEngine.playCollision(0.75);
                  setBanner('CÔNE TOUCHÉ ! CLIQUEZ SUR RÉTABLIR POUR RÉESSAYER', 4.0);
                }
              }

              // 2. Bay Alignment & Distance Check
              const bDx = phys.x - parkingBayTarget.x;
              const bDz = phys.z - parkingBayTarget.z;
              const bayDist = Math.hypot(bDx, bDz);
              phys.parkingDistanceMeters = bayDist;

              let hDiff = parkingBayTarget.heading - phys.heading;
              while (hDiff > Math.PI) hDiff -= Math.PI * 2;
              while (hDiff < -Math.PI) hDiff += Math.PI * 2;
              const absAngleErr = Math.abs(hDiff);

              if (phys.parkingStatus !== 'cone_hit') {
                const distScore = THREE.MathUtils.clamp(1 - bayDist / 8.0, 0, 1) * 65;
                const angleScore = THREE.MathUtils.clamp(1 - absAngleErr / 0.8, 0, 1) * 35;
                phys.parkingProgressPct = Math.round(distScore + angleScore);

                if (bayDist < 1.75 && absAngleErr < 0.34) {
                  phys.parkingStatus = 'aligned';
                  bayFillMat.color.setHex(0x22c55e);
                  bayFillMat.opacity = 0.55;
                  if (speedAbs < 0.35 || phys.shifterPos === 'P') {
                    phys.parkingHoldTimer += dt;
                    phys.parkingProgressPct = 100;
                    if (phys.parkingHoldTimer >= 0.55) {
                      phys.parkingStatus = 'parked_success';
                      phys.raceFinished = true;
                      phys.finalElapsedTime = phys.elapsedTime;
                      phys.finishDelayTimer = 1.6;
                      phys.finishCallbackFired = false;
                      soundEngine.playCheckpointChime();
                      setBanner('STATIONNEMENT PARFAIT VALIDÉ !', 3.0);
                    }
                  } else {
                    phys.parkingHoldTimer = 0;
                    setBanner('BIEN ALIGNÉ ! FREINEZ OU PASSEZ EN [P] POUR VALIDER', 1.2);
                  }
                } else if (bayDist < 3.2) {
                  phys.parkingStatus = 'inside';
                  phys.parkingHoldTimer = 0;
                  bayFillMat.color.setHex(0x38bdf8);
                  bayFillMat.opacity = 0.42;
                } else {
                  phys.parkingStatus = 'approaching';
                  phys.parkingHoldTimer = 0;
                  bayFillMat.color.setHex(0xf59e0b);
                  bayFillMat.opacity = 0.32;
                }
              } else {
                bayFillMat.color.setHex(0xef4444);
              }
            }

            // Gear & RPM computation
            const topSpeedMs = stateRef.current.carSpec.maxSpeedKmh / 3.6;
            if (phys.shifterPos === 'R') {
              phys.gear = -1;
            } else if (phys.shifterPos === 'N' || phys.shifterPos === 'P') {
              phys.gear = 0;
            } else if (isManual) {
              if (tInput.shiftUpQueued) {
                phys.manualGear = Math.min(6, phys.manualGear + 1);
                tInput.shiftUpQueued = false;
              }
              if (tInput.shiftDownQueued) {
                phys.manualGear = Math.max(1, phys.manualGear - 1);
                tInput.shiftDownQueued = false;
              }
              phys.gear = phys.manualGear;
            } else {
              const speedFrac = Math.max(0, speedAbs) / topSpeedMs;
              phys.gear = Math.min(6, Math.max(1, Math.floor(speedFrac * 6) + 1));
            }
            const activeGearAbs = Math.max(1, Math.abs(phys.gear));
            const gearMaxSpeed = (topSpeedMs / 6) * activeGearAbs;
            const gearMinSpeed = (topSpeedMs / 6) * (activeGearAbs - 1);
            const gearProgress = THREE.MathUtils.clamp(
              (speedAbs - gearMinSpeed) / Math.max(1, gearMaxSpeed - gearMinSpeed),
              0,
              1
            );
            const targetRpm = !phys.engineRunning
              ? 0
              : phys.shifterPos === 'N' || phys.shifterPos === 'P'
              ? throttlePressed
                ? 6200
                : 850
              : throttlePressed
              ? 1200 + gearProgress * 6200
              : 850 + gearProgress * 2200;
            phys.rpm = THREE.MathUtils.damp(phys.rpm, targetRpm, 10, dt);

            // 1. DÉTECTION : Lap Progress & Checkpoint Validation
            const isStraight = Boolean(stateRef.current.trackSpec.isStraight);
            const prevT = phys.progressT;
            const newT = closest.sample.t;

            const crossedFinish =
              stateRef.current.gameMode !== 'parking' &&
              (isStraight
                ? newT >= 0.94 && prevT < 0.94 && phys.lapCooldown <= 0
                : prevT > 0.75 && newT < 0.25 && phys.maxProgressReached > 0.40 && phys.lapCooldown <= 0);

            if (!isStraight && newT > 0.25 && newT < 0.85) {
              phys.maxProgressReached = Math.max(phys.maxProgressReached, newT);
            }

            if (crossedFinish) {
              phys.maxProgressReached = 0;
              phys.lapCooldown = 4.0;
              if (phys.bestLapTime === null || phys.currentLapTime < phys.bestLapTime) {
                phys.bestLapTime = phys.currentLapTime;
              }

              if (stateRef.current.gameMode === 'race' || stateRef.current.gameMode === 'time_attack') {
                const nextLap = phys.lap + 1;
                if (nextLap > phys.totalLaps) {
                  if (!phys.raceFinished) {
                    phys.raceFinished = true;
                    phys.lap = phys.totalLaps;
                    phys.finalElapsedTime = phys.elapsedTime;
                    phys.finishOrder = ++phys.finishCounter;
                    phys.finishDelayTimer = 2.0;
                    phys.finishCallbackFired = false;
                    const lockedStandings = computeStandings();
                    phys.finalStandings = lockedStandings;
                    const playerEntry = lockedStandings.find((s) => s.isPlayer);
                    phys.finalPosition = playerEntry ? playerEntry.rank : 1;
                    soundEngine.playCheckpointChime();
                    setBanner('ARRIVÉE ! SPRINT TERMINÉ !', 2.8);
                  }
                } else {
                  phys.lap = nextLap;
                  phys.currentLapTime = 0;
                  soundEngine.playCheckpointChime();
                  setBanner(`SECTION ${phys.lap} / ${phys.totalLaps}`, 2.5);
                }
              } else {
                phys.lap += 1;
                phys.currentLapTime = 0;
                soundEngine.playCheckpointChime();
                setBanner(`SECTION FRANCHIE`, 2.2);
              }
            }

            if (isStraight && phys.z <= -2520) {
              phys.z += 2450;
              phys.progressT = 0.02;
            } else {
              phys.progressT = newT;
            }

            // Exploration Mode Beacons Check
            if (stateRef.current.gameMode === 'exploration') {
              for (const b of builtTrack.beacons) {
                if (!b.collected) {
                  const dx = phys.x - b.position.x;
                  const dz = phys.z - b.position.z;
                  if (dx * dx + dz * dz < 42) {
                    b.collected = true;
                    b.mesh.visible = false;
                    soundEngine.playCheckpointChime();
                    const collectedCount = builtTrack.beacons.filter((x) => x.collected).length;
                    setBanner(`${b.label} découvert (${collectedCount}/${builtTrack.beacons.length})`, 3.0);
                    if (collectedCount === builtTrack.beacons.length && !phys.raceFinished) {
                      phys.raceFinished = true;
                      phys.finalElapsedTime = phys.elapsedTime;
                      phys.finishDelayTimer = 2.0;
                      phys.finishCallbackFired = false;
                    }
                  }
                }
              }
            }

            // 5. ADVERSAIRES : Update AI Opponents
            const aiAggression = stateRef.current.trackSpec.aiAggression ?? 0.5;
            for (let i = 0; i < aiCars.length; i++) {
              const ai = aiCars[i];
              if (ai.lapCooldown > 0) {
                ai.lapCooldown = Math.max(0, ai.lapCooldown - dt);
              }
              const targetAiSpeed = ai.finished ? ai.baseMaxSpeedMs * 0.45 : ai.baseMaxSpeedMs;
              ai.speedMs = THREE.MathUtils.damp(ai.speedMs, targetAiSpeed, 1.8 + aiAggression, dt);
              const prevAiT = ai.t;
              if (isStraight) {
                ai.t = Math.min(1.0, ai.t + (ai.speedMs * dt) / builtTrack.totalLength);
                if (ai.t >= 0.94 && prevAiT < 0.94 && ai.lapCooldown <= 0) {
                  ai.lapCooldown = 4.0;
                  if (!ai.finished) {
                    ai.laps += 1;
                    if (stateRef.current.gameMode === 'race' && ai.laps > phys.totalLaps) {
                      ai.laps = phys.totalLaps;
                      ai.finished = true;
                      ai.finishTime = phys.elapsedTime;
                      ai.finishOrder = ++phys.finishCounter;
                    }
                  }
                }
                if (ai.t >= 0.98 && !ai.finished) {
                  ai.t = 0.02;
                }
              } else {
                ai.t = (ai.t + (ai.speedMs * dt) / builtTrack.totalLength) % 1;
                if (prevAiT > 0.75 && ai.t < 0.25 && ai.lapCooldown <= 0) {
                  ai.lapCooldown = ai.laps === 0 ? 2.5 : 5.0;
                  if (!ai.finished) {
                    ai.laps += 1;
                    if (stateRef.current.gameMode === 'race' && ai.laps > phys.totalLaps) {
                      ai.laps = phys.totalLaps;
                      ai.finished = true;
                      ai.finishTime = phys.elapsedTime;
                      ai.finishOrder = ++phys.finishCounter;
                    }
                  }
                }
              }

              ai.laneOffset = THREE.MathUtils.damp(ai.laneOffset, ai.targetLaneOffset, 2.5, dt);
              syncAICarPose(ai, dt);

              for (const w of ai.rig.wheels) {
                w.rotation.x -= ai.speedMs * dt * 2.5;
              }
              const aiSpeedKmh = Math.abs(ai.speedMs) * 3.6;
              ai.rig.wheelBlurMaterial.opacity = THREE.MathUtils.clamp((aiSpeedKmh - 65) / 170, 0, 0.58);

              const dx = phys.x - ai.worldX;
              const dz = phys.z - ai.worldZ;
              const distSq = dx * dx + dz * dz;
              if (distSq < 11.5 && distSq > 0.001) {
                const dist = Math.sqrt(distSq);
                const overlap = (3.4 - dist) * 0.5;
                const nx = dx / dist;
                const nz = dz / dist;
                phys.x += nx * overlap;
                phys.z += nz * overlap;
                phys.speedMs *= Math.exp(-5.0 * dt);
                soundEngine.playCollision(0.45);
                phys.cameraShake = 0.18;
              }
            }

            // Update Player Car Visual Rig (preserving custom suspension ride height)
            const rideOffset = Number(playerCar.bodyGroup.userData.rideHeightOffset || 0);
            playerCar.root.position.set(phys.x, phys.y, phys.z);
            playerCar.root.rotation.set(0, phys.heading, 0, 'YXZ');

            playerCar.frontLeftPivot.rotation.y = -phys.frontLeftSteerDeg * (Math.PI / 180.0);
            playerCar.frontRightPivot.rotation.y = -phys.frontRightSteerDeg * (Math.PI / 180.0);
            playerCar.steeringWheel.rotation.z = -phys.steerAngleDeg * (Math.PI / 180.0) * 2.4;

            for (const w of playerCar.wheels) {
              w.rotation.x -= phys.speedMs * dt * 2.55;
            }

            playerCar.bodyGroup.rotation.set(0, 0, 0);
            playerCar.bodyGroup.position.set(0, rideOffset, 0);

            // Taillights, Brake Lights, Reverse Lights & Authentic Turn Signals / Hazard Lights
            const isBrakingVisual = brakePressed || phys.handbrakePulled || phys.shifterPos === 'P';
            playerCar.brakeLightMaterial.emissiveIntensity = isBrakingVisual ? 6.8 : phys.headlightsOn ? 1.8 : 0.8;
            playerCar.brakeHaloMaterial.opacity = isBrakingVisual ? 0.95 : phys.headlightsOn ? 0.42 : 0.18;
            playerCar.reverseLightMaterial.emissiveIntensity = isReversing ? 4.5 : 0.15;

            const signalActive =
              phys.leftSignal || phys.rightSignal || phys.hazardLights || Math.abs(phys.steerAngle) > 0.36;
            const blinkOn = Math.sin(elapsed * 9.5) > 0;
            if ((phys.leftSignal || phys.rightSignal || phys.hazardLights) && blinkOn !== phys.lastSignalTickState) {
              phys.lastSignalTickState = blinkOn;
              soundEngine.playTurnSignalTick(blinkOn);
            }
            playerCar.turnSignalMaterial.emissiveIntensity = signalActive && blinkOn ? 4.2 : 0.0;

            for (let hIdx = 0; hIdx < playerCar.brakeHaloSprites.length; hIdx++) {
              const isCenter = hIdx === 1;
              const boost = isBrakingVisual ? 1.38 : 1.0;
              playerCar.brakeHaloSprites[hIdx].scale.set(
                (isCenter ? 1.45 : 0.95) * boost,
                (isCenter ? 0.52 : 0.68) * boost,
                1
              );
            }

            playerCar.wheelBlurMaterial.opacity = THREE.MathUtils.clamp((speedKmh - 65) / 170, 0, 0.62);
            const trailRatio = THREE.MathUtils.clamp((speedKmh - 75) / 180, 0, 1);
            playerCar.tailTrailMaterial.opacity = trailRatio * (isBrakingVisual ? 0.52 : 0.32);
            const trailScaleZ = 0.35 + trailRatio * 1.25;
            for (const tr of playerCar.tailTrailMeshes) {
              tr.scale.set(1, 1, trailScaleZ);
            }

            // Custom Tire Smoke Color from Garage
            const customSmokeHex = stateRef.current.customization.tireSmokeColor || '#f8fafc';
            (smokeParticles.points.material as THREE.PointsMaterial).color.set(customSmokeHex);

            if (
              phys.drifting ||
              (brakePressed && speedKmh > 38) ||
              (phys.surfaceType === 'shoulder' && speedKmh > 15) ||
              (currentWeather === 'rain' && speedKmh > 65)
            ) {
              const fX = -Math.sin(phys.heading);
              const fZ = -Math.cos(phys.heading);
              const rX = Math.cos(phys.heading);
              const rZ = -Math.sin(phys.heading);
              smokeParticles.spawn(
                phys.x - fX * 2.1 + rX * 1.15,
                phys.y + 0.22,
                phys.z - fZ * 2.1 + rZ * 1.15,
                (Math.random() - 0.5) * 2.0,
                0.5 + Math.random() * 0.8,
                (Math.random() - 0.5) * 2.0,
                0.42
              );
              smokeParticles.spawn(
                phys.x - fX * 2.1 - rX * 1.15,
                phys.y + 0.22,
                phys.z - fZ * 2.1 - rZ * 1.15,
                (Math.random() - 0.5) * 2.0,
                0.5 + Math.random() * 0.8,
                (Math.random() - 0.5) * 2.0,
                0.42
              );
            }

            if ((brakePressed && speedKmh > 65) || (phys.surfaceType === 'kerb' && speedKmh > 105)) {
              const fX = -Math.sin(phys.heading);
              const fZ = -Math.cos(phys.heading);
              const rX = Math.cos(phys.heading);
              const rZ = -Math.sin(phys.heading);
              const sideSign = Math.random() > 0.5 ? 1 : -1;
              sparkParticles.spawn(
                phys.x - fX * 1.85 + rX * 1.05 * sideSign,
                phys.y + 0.14,
                phys.z - fZ * 1.85 + rZ * 1.05 * sideSign,
                -fX * (3 + Math.random() * 4) + (Math.random() - 0.5) * 3.2,
                1.2 + Math.random() * 2.4,
                -fZ * (3 + Math.random() * 4) + (Math.random() - 0.5) * 3.2,
                0.24
              );
            }

            if (phys.nitroActive) {
              const fX = -Math.sin(phys.heading);
              const fZ = -Math.cos(phys.heading);
              const rX = Math.cos(phys.heading);
              const rZ = -Math.sin(phys.heading);
              nitroParticles.spawn(
                phys.x - fX * 2.95 + rX * 0.55,
                phys.y + 0.38,
                phys.z - fZ * 2.95 + rZ * 0.55,
                -fX * 6,
                0.2,
                -fZ * 6,
                0.18
              );
              nitroParticles.spawn(
                phys.x - fX * 2.95 - rX * 0.55,
                phys.y + 0.38,
                phys.z - fZ * 2.95 - rZ * 0.55,
                -fX * 6,
                0.2,
                -fZ * 6,
                0.18
              );
            }

            // Synthesized engine audio
            soundEngine.updateEngine(
              phys.rpm,
              speedKmh,
              phys.drifting || (brakePressed && speedKmh > 30),
              phys.engineRunning && phys.fuelPercent > 0,
              Math.max(1, Math.abs(phys.gear)),
              throttlePressed,
              Math.abs(phys.steerAngle) / 0.46
            );
          }
        } else {
          // During 3-2-1 countdown: keep car 100% stationary, level, and wheels straight
          const rideOffset = Number(playerCar.bodyGroup.userData.rideHeightOffset || 0);
          phys.speedMs = 0;
          phys.lateralVel = 0;
          phys.yawRate = 0;
          phys.steerAngle = 0;
          phys.steerAngleDeg = 0;
          phys.frontLeftSteerDeg = 0;
          phys.frontRightSteerDeg = 0;
          playerCar.root.position.set(phys.x, phys.y, phys.z);
          playerCar.root.rotation.set(0, phys.heading, 0, 'YXZ');
          playerCar.bodyGroup.rotation.set(0, 0, 0);
          playerCar.bodyGroup.position.set(0, rideOffset, 0);
          playerCar.frontLeftPivot.rotation.set(0, 0, 0);
          playerCar.frontRightPivot.rotation.set(0, 0, 0);
          playerCar.steeringWheel.rotation.set(0, 0, 0);

          const rev = keys.up || touchInputRef.current.throttle;
          phys.rpm = THREE.MathUtils.damp(phys.rpm, rev ? 5800 : 820, 6, dt);
          soundEngine.updateEngine(phys.rpm, 0, false, true, 1, rev, 0);
        }

        smokeParticles.update(dt);
        nitroParticles.update(dt);
        sparkParticles.update(dt);

        // Orbit keyLight smoothly according to phys.dayTimeHours
        const hNow = ((phys.dayTimeHours % 24) + 24) % 24;
        const isNightNow = hNow < 5.8 || hNow > 19.6;
        const orbitFrac = !isNightNow
          ? (hNow - 5.8) / 13.8
          : (hNow >= 19.6 ? hNow - 19.6 : hNow + 4.4) / 10.2;
        const sunElev = Math.sin(orbitFrac * Math.PI) * 85 + 22;
        const sunAzim = (orbitFrac - 0.5) * Math.PI * 0.9;
        keyLight.position.set(
          phys.x + Math.sin(sunAzim) * 75,
          phys.y + sunElev,
          phys.z - Math.cos(sunAzim) * 65
        );
        keyLight.target.position.set(phys.x, phys.y, phys.z);
        keyLight.target.updateMatrixWorld();

        carShowroomLight.position.set(phys.x + 3.8, phys.y + 11.0, phys.z + 4.8);
        carShowroomLight.target.position.set(phys.x, phys.y + 0.45, phys.z);
        carShowroomLight.target.updateMatrixWorld();

        // 8. Camera Choreography (Including Free-Walk Camera, Top-Down Parking Cam & 360° Orbit Cam)
        const camMode = stateRef.current.settings.cameraMode;
        const fovOffset = stateRef.current.settings.cameraFovOffset || 0;
        const distOffset = stateRef.current.settings.cameraDistanceOffset || 0;

        const sinH = Math.sin(phys.heading);
        const cosH = Math.cos(phys.heading);
        _forwardVec.set(-sinH, Math.sin(phys.roadPitch), -cosH).normalize();
        _rightVec.set(cosH, 0, -sinH);

        const speedKmh = Math.abs(phys.speedMs) * 3.6;
        const baseFov =
          (camMode === 'cockpit' ? 64 : camMode === 'hood' ? 58 : camMode === 'chase_near' ? 48 : 54) + fovOffset;
        const speedFovBoost = (speedKmh / 350) * (camMode === 'chase_near' ? 8 : 12) + (phys.nitroActive ? 4.0 : 0);
        camera.fov = THREE.MathUtils.damp(camera.fov, THREE.MathUtils.clamp(baseFov + speedFovBoost, 40, 88), 5, dt);
        camera.updateProjectionMatrix();

        if (phys.cameraShake > 0) {
          phys.cameraShake = Math.max(0, phys.cameraShake - dt * 1.4);
        }
        const shakeX = (Math.random() - 0.5) * phys.cameraShake;
        const shakeY = (Math.random() - 0.5) * phys.cameraShake;

        phys.cameraLookAheadYaw = THREE.MathUtils.damp(
          phys.cameraLookAheadYaw,
          -phys.steerAngle * 3.2,
          7.0,
          dt
        );

        const hideCockpitRoof = camMode === 'cockpit' && !phys.isWalking && !isLookingBack;
        for (const m of playerCar.cockpitOccludingMeshes) {
          m.visible = !hideCockpitRoof;
        }

        if (phys.isWalking) {
          // 3rd-Person Free-Walk Camera following the Pedestrian around the Car
          const wSin = Math.sin(phys.walkHeading);
          const wCos = Math.cos(phys.walkHeading);
          camera.position.x = THREE.MathUtils.damp(camera.position.x, phys.walkX + wSin * 3.8, 12, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, 2.15, 12, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, phys.walkZ + wCos * 3.8, 12, dt);
          _camLookAt.set(phys.x, phys.y + 0.85, phys.z);
          camera.lookAt(_camLookAt);
        } else if (isLookingBack) {
          const distFront = 5.2 + distOffset * 0.5;
          camera.position.set(
            phys.x + _forwardVec.x * distFront,
            phys.y + 2.05,
            phys.z + _forwardVec.z * distFront
          );
          _camLookAt.set(
            phys.x - _forwardVec.x * 18,
            phys.y + 1.0,
            phys.z - _forwardVec.z * 18
          );
          camera.lookAt(_camLookAt);
        } else if (camMode === 'top_parking') {
          // Overhead Top-Down Parking Camera (Car Parking Multiplayer precision view)
          _camTargetPos.set(
            phys.x + _forwardVec.x * 1.5,
            phys.y + 14.5 + distOffset * 1.5,
            phys.z + _forwardVec.z * 1.5 + 3.2
          );
          camera.position.x = THREE.MathUtils.damp(camera.position.x, _camTargetPos.x, 12, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, _camTargetPos.y, 12, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, _camTargetPos.z, 12, dt);
          _camLookAt.set(phys.x + _forwardVec.x * 2.0, phys.y + 0.5, phys.z + _forwardVec.z * 2.0);
          camera.lookAt(_camLookAt);
        } else if (camMode === 'orbit_360') {
          phys.showcaseAngle += dt * 0.45;
          const orbR = 6.2 + distOffset;
          camera.position.set(
            phys.x + Math.sin(phys.heading + phys.showcaseAngle) * orbR,
            phys.y + 2.2,
            phys.z + Math.cos(phys.heading + phys.showcaseAngle) * orbR
          );
          _camLookAt.set(phys.x, phys.y + 0.85, phys.z);
          camera.lookAt(_camLookAt);
        } else if (camMode === 'cockpit') {
          // Elevated Panoramic Driver-Seat In-Car POV (3D Steering Wheel at bottom + 100% Unobstructed Road Ahead)
          const rideOffset = Number(playerCar.bodyGroup.userData.rideHeightOffset || 0) * 1.36;
          _camTargetPos.set(
            phys.x - _rightVec.x * 0.38 + _forwardVec.x * 0.14 + shakeX * 0.2,
            phys.y + 1.56 + rideOffset + shakeY * 0.2,
            phys.z - _rightVec.z * 0.38 + _forwardVec.z * 0.14
          );
          camera.position.copy(_camTargetPos);
          const cockpitLookDist = 11.0;
          _camLookAt.set(
            phys.x - _rightVec.x * 0.15 + _forwardVec.x * cockpitLookDist + _rightVec.x * phys.cameraLookAheadYaw * 0.65,
            phys.y + 0.38 + rideOffset + _forwardVec.y * cockpitLookDist,
            phys.z - _rightVec.z * 0.15 + _forwardVec.z * cockpitLookDist + _rightVec.z * phys.cameraLookAheadYaw * 0.65
          );
          camera.lookAt(_camLookAt);
        } else if (camMode === 'hood') {
          const rideOffset = Number(playerCar.bodyGroup.userData.rideHeightOffset || 0) * 1.36;
          _camTargetPos.set(
            phys.x + _forwardVec.x * 0.95 + shakeX * 0.25,
            phys.y + 1.48 + rideOffset + shakeY * 0.25,
            phys.z + _forwardVec.z * 0.95
          );
          camera.position.copy(_camTargetPos);
          _camLookAt.set(
            phys.x + _forwardVec.x * 12.5 + _rightVec.x * phys.cameraLookAheadYaw * 0.65,
            phys.y + 0.42 + rideOffset + _forwardVec.y * 12.5,
            phys.z + _forwardVec.z * 12.5 + _rightVec.z * phys.cameraLookAheadYaw * 0.65
          );
          camera.lookAt(_camLookAt);
        } else {
          const isNear = camMode === 'chase_near';
          const distBack = Math.max(3.2, (isNear ? 4.65 : 8.2) + distOffset);
          const camHeight = (isNear ? 1.98 : 3.2) + distOffset * 0.18;

          const cornerSwing = phys.steerAngle * 0.65;

          _camTargetPos.set(
            phys.x - _forwardVec.x * distBack + _rightVec.x * cornerSwing + shakeX,
            phys.y + camHeight + shakeY,
            phys.z - _forwardVec.z * distBack + _rightVec.z * cornerSwing
          );

          camera.position.x = THREE.MathUtils.damp(camera.position.x, _camTargetPos.x, 14.0, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, _camTargetPos.y, 11.5, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, _camTargetPos.z, 14.0, dt);

          const lookAheadDist = isNear ? 6.2 : 10.0;
          const lookHeight = isNear ? 0.88 : 1.15;
          _camLookAt.set(
            phys.x + _forwardVec.x * lookAheadDist + _rightVec.x * phys.cameraLookAheadYaw,
            phys.y + lookHeight + _forwardVec.y * lookAheadDist,
            phys.z + _forwardVec.z * lookAheadDist + _rightVec.z * phys.cameraLookAheadYaw
          );
          _smoothedLookAt.lerp(_camLookAt, 1 - Math.exp(-18 * dt));
          camera.lookAt(_smoothedLookAt);
        }
      } else {
        soundEngine.updateEngine(1000, 0, false, false);
      }

      // Compute Player Race Position & Full Standings against AI
      const standings = stateRef.current.gameMode === 'race' ? computeStandings() : [];
      const playerStanding = standings.find((s) => s.isPlayer);
      const rank = phys.finalPosition ?? (playerStanding ? playerStanding.rank : 1);

      telemetryEmitAccum += rawDt;
      const emitInterval = currentScreen === 'playing' ? 0.1 : 0.25;
      if (telemetryEmitAccum >= emitInterval || phys.raceFinished) {
        telemetryEmitAccum = 0;
        const discoveredCount = builtTrack.beacons.filter((b) => b.collected).length;

        // Compute Rear Opponents for the Central Rear-View Mirror
        const sinH = Math.sin(phys.heading);
        const cosH = Math.cos(phys.heading);
        const fwdX = -sinH;
        const fwdZ = -cosH;
        const rgtX = cosH;
        const rgtZ = -sinH;
        const rearOpponents: RearOpponentInfo[] = [];

        for (const ai of aiCars) {
          const dx = ai.worldX - phys.x;
          const dz = ai.worldZ - phys.z;
          const projFwd = dx * fwdX + dz * fwdZ; // negative when behind player
          if (projFwd < -1.5 && projFwd > -110) {
            const projRight = dx * rgtX + dz * rgtZ;
            rearOpponents.push({
              name: ai.name,
              color: ai.color,
              distanceMeters: -projFwd,
              lateralOffset: THREE.MathUtils.clamp(-projRight / 14, -1, 1),
            });
          }
        }
        rearOpponents.sort((a, b) => a.distanceMeters - b.distanceMeters);

        const telemetryPayload: TelemetryState = {
          speedKmh: Math.round(Math.abs(phys.speedMs) * 3.6),
          rpm: Math.round(phys.rpm),
          gear: phys.gear,
          shifterPos: phys.shifterPos,
          handbrakePulled: phys.handbrakePulled,
          leftSignal: phys.leftSignal,
          rightSignal: phys.rightSignal,
          hazardLights: phys.hazardLights,
          engineRunning: phys.engineRunning,
          fuelPercent: phys.fuelPercent,
          nearGasStation: phys.nearGasStation,
          isWalking: phys.isWalking,
          parkingChallengeIndex: stateRef.current.parkingChallengeId,
          parkingStatus: phys.parkingStatus,
          parkingProgressPct: phys.parkingProgressPct,
          parkingDistanceMeters: phys.parkingDistanceMeters,
          lap: phys.lap,
          totalLaps: phys.totalLaps,
          elapsedTime: phys.finalElapsedTime ?? phys.elapsedTime,
          currentLapTime: phys.currentLapTime,
          bestLapTime: phys.bestLapTime,
          position: rank,
          totalRacers: aiCars.length + 1,
          countdown:
            phys.countdownTimer > 0
              ? Math.ceil(phys.countdownTimer)
              : phys.goBannerTimer > 0
              ? 0
              : -1,
          raceFinished: phys.raceFinished,
          standings,
          nitroAmount: Math.round(phys.nitro),
          nitroActive: phys.nitroActive,
          drifting: phys.drifting,
          steerRatio: THREE.MathUtils.clamp(-phys.steerAngle / 0.46, -1, 1),
          surfaceType: phys.surfaceType,
          gripPercent: Math.round(phys.gripFactor * 100),
          headlightsOn: effectiveHeadlightsOn,
          dayTimeHours: phys.dayTimeHours,
          lookingBack: isLookingBack,
          discoveredPoints: discoveredCount,
          totalDiscoveryPoints: builtTrack.beacons.length,
          lastCheckpointBanner: phys.bannerText,
          fps: currentFps,
          activeQualityTier,
          minimapPoints: builtTrack.minimapPoints,
          playerPos: { x: phys.x, z: phys.z, heading: phys.heading },
          opponentsPos: aiCars.map((ai) => ({
            x: ai.worldX,
            z: ai.worldZ,
            color: ai.color,
            name: ai.name,
          })),
          rearOpponents,
          discoveryBeacons: builtTrack.beacons.map((b) => ({
            x: b.position.x,
            z: b.position.z,
            collected: b.collected,
            label: b.label,
          })),
        };

        callbacksRef.current.onTelemetryUpdate(telemetryPayload);
        if (
          phys.raceFinished &&
          phys.finishDelayTimer <= 0 &&
          !phys.finishCallbackFired &&
          currentScreen === 'playing'
        ) {
          phys.finishCallbackFired = true;
          callbacksRef.current.onRaceFinish(telemetryPayload);
        }
      }

      // Update Pooled Streetlamp PointLights to the 4 Closest Streetlamps around the Player Car
      const lampPositions = builtTrack.lampLightPositions;
      if (lampPositions && lampPositions.length >= lampPointLights.length) {
        let bestIdx0 = 0;
        let bestDistSq = Infinity;
        for (let i = 0; i < lampPositions.length; i += 2) {
          const lp = lampPositions[i];
          const dx = lp.x - phys.x;
          const dz = lp.z - phys.z;
          const dSq = dx * dx + dz * dz;
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestIdx0 = i;
          }
        }
        for (let k = 0; k < lampPointLights.length; k++) {
          const idx = (bestIdx0 + k) % lampPositions.length;
          lampPointLights[k].position.copy(lampPositions[idx]);
        }
      }

      // Keep the Sky Sphere & Starfield centered on the camera at all times
      builtTrack.skyGroup.position.copy(camera.position);

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      unmounted = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('pointerdown', handleShowroomPointerDown);
      window.removeEventListener('pointermove', handleShowroomPointerMove);
      window.removeEventListener('pointerup', handleShowroomPointerUp);
      window.removeEventListener('pointercancel', handleShowroomPointerUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('gesturestart', preventGesture);
      window.removeEventListener('gesturechange', preventGesture);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      soundEngine.updateEngine(0, 0, false, false);
      clearAICars();
      scene.remove(playerCar.root);
      disposeObject3D(playerCar.root);
      builtTrack.dispose();
      smokeParticles.dispose();
      nitroParticles.dispose();
      sparkParticles.dispose();
      envMapTexture.dispose();
      precipGeo.dispose();
      precipMat.dispose();
      textures.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full z-0 bg-slate-950 overflow-hidden touch-none select-none">
      <div
        ref={canvasMountRef}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-full"
        aria-label="Scène de course 3D"
      />
      {/* Edge-only subtle vignette (100% transparent center so the 3D scene stays crystal-clear) */}
      <div
        className="pointer-events-none fixed inset-0 z-10"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, transparent 0%, transparent 74%, rgba(2, 6, 23, 0.28) 100%)',
        }}
      />
    </div>
  );
};
