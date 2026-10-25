import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  CARS,
  CarCustomization,
  CarSpec,
  GameMode,
  GameSettings,
  RacerStanding,
  RearOpponentInfo,
  ScreenState,
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
  });
  stateRef.current = {
    carSpec,
    customization,
    trackSpec,
    gameMode,
    screenState,
    settings,
    raceSessionId,
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
    rebuildFlagRef.current.trackDirty = true;
  }, [settings.timeOfDay, settings.weather]);

  useEffect(() => {
    rebuildFlagRef.current.aiDirty = true;
  }, [settings.aiCount, settings.trafficDensity, settings.aiDifficulty]);

  useEffect(() => {
    rebuildFlagRef.current.sessionResetDirty = true;
  }, [raceSessionId, gameMode]);

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

    const applySkyAndLighting = (timeOfDay: GameSettings['timeOfDay'], weather: GameSettings['weather']) => {
      const lvl = stateRef.current.trackSpec.levelNumber;
      let fogColor = 0x162b52;
      let fogDensity = 0.00055;

      if (timeOfDay === 'morning') {
        // Bright Sunlit Morning (Level 2 default)
        scene.background = new THREE.Color(0x38bdf8);
        fogColor = 0x7dd3fc;
        fogDensity = 0.00042;
        ambientLight.color.setHex(0x64748b);
        ambientLight.intensity = 0.95;
        hemiLight.color.setHex(0xbae6fd);
        hemiLight.groundColor.setHex(0x3f4d34);
        hemiLight.intensity = 0.98;
        keyLight.color.setHex(0xfef08a);
        keyLight.intensity = 1.7;
        renderer.toneMappingExposure = 1.52;
      } else if (timeOfDay === 'afternoon') {
        // Crisp Daylight Blue
        scene.background = new THREE.Color(0x2563eb);
        fogColor = 0x60a5fa;
        fogDensity = 0.00042;
        ambientLight.color.setHex(0x64748b);
        ambientLight.intensity = 0.92;
        hemiLight.color.setHex(0x93c5fd);
        hemiLight.groundColor.setHex(0x334155);
        hemiLight.intensity = 0.95;
        keyLight.color.setHex(0xffffff);
        keyLight.intensity = 1.7;
        renderer.toneMappingExposure = 1.52;
      } else if (timeOfDay === 'sunset') {
        // Golden Amber Canyon Sunset (Level 3 default)
        scene.background = new THREE.Color(0x7c2d12);
        fogColor = 0xc2410c;
        fogDensity = 0.00052;
        ambientLight.color.setHex(0x78350f);
        ambientLight.intensity = 0.88;
        hemiLight.color.setHex(0xfdba74);
        hemiLight.groundColor.setHex(0x431407);
        hemiLight.intensity = 0.92;
        keyLight.color.setHex(0xfb923c);
        keyLight.intensity = 1.62;
        renderer.toneMappingExposure = 1.5;
      } else {
        // Clear, Luminous Cobalt Night (Levels 1, 4, 5)
        const nightTint = lvl === 5 ? 0x1e1b4b : lvl === 4 ? 0x0f294a : 0x15284d;
        scene.background = new THREE.Color(nightTint);
        fogColor = nightTint;
        fogDensity = 0.00058;
        ambientLight.color.setHex(0x334b78);
        ambientLight.intensity = 0.86;
        hemiLight.color.setHex(0x60a5fa);
        hemiLight.groundColor.setHex(0x1e293b);
        hemiLight.intensity = 0.92;
        keyLight.color.setHex(0xbfdbfe);
        keyLight.intensity = 1.48;
        renderer.toneMappingExposure = 1.52;
      }

      const lampIntensity = timeOfDay === 'night' ? 7.5 : timeOfDay === 'sunset' ? 5.2 : 2.5;
      for (const pl of lampPointLights) {
        pl.intensity = lampIntensity;
      }

      if (weather === 'fog') {
        fogDensity = 0.0014;
        keyLight.intensity *= 0.92;
      } else if (weather === 'rain') {
        fogDensity = 0.00095;
        keyLight.intensity *= 0.95;
      } else if (weather === 'snow') {
        fogDensity = 0.00095;
        keyLight.intensity *= 0.95;
      }

      scene.fog = new THREE.FogExp2(fogColor, fogDensity);
    };

    applySkyAndLighting(stateRef.current.settings.timeOfDay, stateRef.current.settings.weather);

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
      if (mode === 'time_attack' || mode === 'exploration') return;

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
        const rig = buildSportsCarModel(
          spec,
          {
            bodyColor: aiColor,
            rimColor: '#e2e8f0',
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
      const sStart = isStraight ? builtTrack.samples[12] : (builtTrack.samples[1] || builtTrack.samples[0]);
      const spawnLatOffset = isStraight ? -2.2 : 2.8;
      phys.x = isStraight ? -2.2 : (sStart.point.x - sStart.normal.x * spawnLatOffset);
      phys.y = sStart.point.y + 0.04;
      phys.z = isStraight ? sStart.point.z : (sStart.point.z - sStart.normal.z * spawnLatOffset);
      phys.heading = isStraight ? 0 : Math.atan2(-sStart.tangent.x, -sStart.tangent.z);
      phys.roadPitch = isStraight ? 0 : sStart.pitch;
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
      phys.countdownTimer = 3.0;
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

      for (const b of builtTrack.beacons) {
        b.collected = false;
        b.mesh.visible = stateRef.current.gameMode === 'exploration';
      }

      spawnAICars();

      playerCar.root.position.set(phys.x, phys.y, phys.z);
      playerCar.root.rotation.set(phys.roadPitch, phys.heading, 0, 'YXZ');

      const sinH = Math.sin(phys.heading);
      const cosH = Math.cos(phys.heading);
      camera.position.set(phys.x + sinH * 4.65, phys.y + 1.98, phys.z + cosH * 4.65);
      _smoothedLookAt.set(phys.x - sinH * 6.2, phys.y + 0.88, phys.z - cosH * 6.2);
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
        respawnCar();
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
        applySkyAndLighting(stateRef.current.settings.timeOfDay, stateRef.current.settings.weather);
        phys.headlightsOn = true;
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

      const headIntensity = phys.headlightsOn ? 3.5 : 0.25;
      playerCar.headlightMaterial.emissiveIntensity = headIntensity;
      for (const spot of playerCar.headlightSpots) {
        spot.intensity = phys.headlightsOn ? 95 : 0;
      }
      for (const beam of playerCar.headlightBeams) {
        beam.visible = phys.headlightsOn;
      }

      const isLookingBack = Boolean(keys.lookBack || touchInputRef.current.lookBack);

      if (currentScreen !== 'playing' && currentScreen !== 'paused' && currentScreen !== 'finished') {
        // SHOWCASE / GARAGE / MENU CAMERA ORBIT + VISIBLE CARS DRIVING ON THE HIGHWAY
        phys.showcaseAngle += dt * 0.22;
        const isGarageView = currentScreen === 'garage' || currentScreen === 'car_select';
        const radius = isGarageView ? 6.6 : 8.5;
        const height = isGarageView ? 2.25 : 3.2;
        const angleOffset = isGarageView ? phys.showcaseAngle : Math.sin(phys.showcaseAngle) * 0.55;
        const targetX = phys.x + Math.sin(phys.heading + angleOffset) * radius;
        const targetZ = phys.z + Math.cos(phys.heading + angleOffset) * radius;

        camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX, 5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, phys.y + height, 5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 5, dt);
        _camLookAt.set(
          phys.x - Math.sin(phys.heading) * (isGarageView ? 0 : 12),
          phys.y + (isGarageView ? 0.95 : 1.35),
          phys.z - Math.cos(phys.heading) * (isGarageView ? 0 : 12)
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
        playerCar.bodyGroup.position.set(0, 0, 0);
        playerCar.root.position.set(phys.x, phys.y, phys.z);
        playerCar.root.rotation.set(phys.roadPitch, phys.heading, 0, 'YXZ');

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

          const isManual = stateRef.current.settings.transmission === 'manual';

          // Nitro Logic
          if (nitroPressed && phys.nitro > 5 && throttlePressed && Math.abs(phys.speedMs) > 10) {
            phys.nitroActive = true;
            phys.nitro = Math.max(0, phys.nitro - dt * 28);
          } else {
            phys.nitroActive = false;
            phys.nitro = Math.min(100, phys.nitro + dt * 9);
          }

          // Check for queued car respawn / unstick
          if (tInput.respawnQueued) {
            tInput.respawnQueued = false;
            respawnCar();
          }

          // 1. Steering Input: -1 (Gauche) to +1 (Droite) matching Unity CarSteering
          const keySteer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
          const rawWheelSteer = tInput.steerInput;
          const rawSteerInput = Math.abs(rawWheelSteer) > 0.01 ? rawWheelSteer : keySteer;
          const steerInput = THREE.MathUtils.clamp(rawSteerInput, -1.0, 1.0);

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

          const speedAbs = Math.abs(phys.speedMs);
          const speedKmh = speedAbs * 3.6;
          const isReversing = phys.speedMs < -0.1 || (brakePressed && phys.speedMs < 0.2);

          // 5. Appui aérodynamique & charge verticale (Unity CarSteering: downforce = 30f)
          const downforceFactor = 1.0 + (30.0 / 1200.0) * THREE.MathUtils.clamp(speedKmh / 100.0, 0, 2.5);
          phys.gripFactor = baseSurfaceGrip * downforceFactor;

          // 6. PHYSIQUE : vitesse avant + latérale, adhérence limitée, sous-pas fixes (120 Hz max)
          phys.prevSpeedMs = phys.speedMs;
          const baseMaxSpeed =
            (stateRef.current.carSpec.maxSpeedKmh / 3.6) * (phys.nitroActive ? 1.18 : 1.0);
          const maxSpeed =
            phys.surfaceType === 'shoulder' ? Math.min(baseMaxSpeed, 28) : baseMaxSpeed;

          const dynInput: CarDynInput = {
            steerInput,
            throttle: Boolean(throttlePressed),
            brake: Boolean(brakePressed),
            canDrive,
            nitroActive: phys.nitroActive,
            sensitivity: stateRef.current.settings.steeringSensitivity,
            gripFactor: phys.gripFactor,
            maxSpeedMs: maxSpeed,
            acceleration: stateRef.current.carSpec.acceleration,
            braking: stateRef.current.carSpec.braking,
            handling: stateRef.current.carSpec.handling,
            offRoad: phys.surfaceType === 'shoulder',
          };
          stepCarDynamicsSubsteps(phys, dynInput, dt);

          // 8. Electronic Stability Program (ESP) & Direction Assistée
          const espActive = stateRef.current.settings.absEspEnabled !== false;
          if (espActive && speedAbs > 8) {
            const trackHeading = Math.atan2(-closest.sample.tangent.x, -closest.sample.tangent.z);
            let headingDiff = trackHeading - phys.heading;
            while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
            while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;

            const isActivelySteering = Math.abs(steerInput) > 0.02;
            if (!isActivelySteering && phys.surfaceType === 'asphalt') {
              if (Math.abs(headingDiff) < 0.24) {
                const alignSpeed = stateRef.current.trackSpec.isStraight ? 2.5 : 3.5;
                phys.heading += headingDiff * alignSpeed * dt;
              }
            } else if (isActivelySteering && Math.abs(headingDiff) > 0.45) {
              const antiSpinDamp = THREE.MathUtils.clamp((speedKmh / 280.0) * 2.0, 0.6, 2.2);
              phys.heading += headingDiff * antiSpinDamp * dt;
            }
          }

          // Road height & pitch alignment
          phys.y = THREE.MathUtils.damp(phys.y, closest.sample.point.y + 0.04, 28, dt);
          phys.roadPitch = THREE.MathUtils.damp(phys.roadPitch, closest.sample.pitch, 18, dt);

          // Longitudinal acceleration for body dive/squat and camera
          const rawAccelG = (phys.speedMs - phys.prevSpeedMs) / Math.max(0.008, dt) / 28;
          phys.longitudinalAccelG = THREE.MathUtils.damp(
            phys.longitudinalAccelG,
            THREE.MathUtils.clamp(rawAccelG, -1.2, 1.2),
            10,
            dt
          );

          // Smooth Anti-Stick Guardrail Collision & Glancing Deflection
          const maxBarrierDist = halfRoad + 1.85;
          if (absLat > maxBarrierDist) {
            const sign = closest.signedLateralDist >= 0 ? 1 : -1;
            const outwardX = closest.sample.normal.x * sign;
            const outwardZ = closest.sample.normal.z * sign;
            const inwardX = -outwardX;
            const inwardZ = -outwardZ;

            const fwdX = -Math.sin(phys.heading);
            const fwdZ = -Math.cos(phys.heading);

            // Velocity component pointing outward towards the barrier
            const velOutward = (fwdX * outwardX + fwdZ * outwardZ) * phys.speedMs;

            if (velOutward > 0) {
              // Car is driving INTO the barrier:
              // 1. Keep the car 25cm inside the barrier without clamping it permanently
              phys.x = closest.sample.point.x + closest.sample.normal.x * sign * maxBarrierDist + inwardX * 0.25;
              phys.z = closest.sample.point.z + closest.sample.normal.z * sign * maxBarrierDist + inwardZ * 0.25;

              // 2. Smoothly deflect heading towards track tangent so car glances forward instead of sticking nose-first
              const trackHeading = Math.atan2(-closest.sample.tangent.x, -closest.sample.tangent.z);
              let headingDiff = trackHeading - phys.heading;
              while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
              while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
              phys.heading += headingDiff * Math.min(1.0, dt * 4.0);

              // 3. Glancing friction (only damp slightly, never kill speed to 0 so the car can keep moving!)
              phys.speedMs = Math.max(0, phys.speedMs * Math.exp(-2.45 * dt)); // ≈ 0.96/image à 60 FPS, indépendant des FPS

              if (speedAbs > 9) {
                soundEngine.playCollision(Math.min(1.0, speedAbs / 30));
                phys.cameraShake = Math.min(0.18, speedAbs * 0.005);
              }
            } else {
              // Car is REVERSING or steering AWAY from the barrier:
              // DO NOT block movement! Allow backing up freely towards the center of the road!
              if (absLat > maxBarrierDist + 1.2) {
                phys.x = closest.sample.point.x + closest.sample.normal.x * sign * (maxBarrierDist + 1.2);
                phys.z = closest.sample.point.z + closest.sample.normal.z * sign * (maxBarrierDist + 1.2);
              }
            }
          }

          // Gear & RPM computation
          const topSpeedMs = (stateRef.current.carSpec.maxSpeedKmh / 3.6);
          if (isManual) {
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
          const gearMaxSpeed = (topSpeedMs / 6) * phys.gear;
          const gearMinSpeed = (topSpeedMs / 6) * (phys.gear - 1);
          const gearProgress = THREE.MathUtils.clamp(
            (speedAbs - gearMinSpeed) / Math.max(1, gearMaxSpeed - gearMinSpeed),
            0,
            1
          );
          const targetRpm = throttlePressed
            ? 1200 + gearProgress * 6200
            : 850 + gearProgress * 2200;
          phys.rpm = THREE.MathUtils.damp(phys.rpm, targetRpm, 10, dt);

          // 1. DÉTECTION : Lap Progress & Checkpoint Validation with Anti-Doublon Cooldown
          const isStraight = Boolean(stateRef.current.trackSpec.isStraight);
          const prevT = phys.progressT;
          const newT = closest.sample.t;

          const crossedFinish = isStraight
            ? newT >= 0.94 && prevT < 0.94 && phys.lapCooldown <= 0
            : prevT > 0.75 && newT < 0.25 && phys.maxProgressReached > 0.40 && phys.lapCooldown <= 0;

          if (!isStraight && newT > 0.25 && newT < 0.85) {
            phys.maxProgressReached = Math.max(phys.maxProgressReached, newT);
          }

          if (crossedFinish) {
            phys.maxProgressReached = 0;
            phys.lapCooldown = 4.0; // Délai anti-doublon sur la ligne d'arrivée
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
                  phys.finishDelayTimer = 2.0; // 2 secondes d'affichage « ARRIVÉE ! » avec damier
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

          // En mode ligne droite, si le joueur dépasse la fin de la piste, boucler vers l'avant
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

          // 5. ADVERSAIRES : Update AI Opponents & Classify When Finishing Laps
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
                ai.t = 0.02; // boucle en roue libre si la course continue
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

            // Stable racing line without random lane swerving or tilting
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
              phys.speedMs *= Math.exp(-5.0 * dt); // ≈ 0.92/image à 60 FPS, indépendant des FPS
              soundEngine.playCollision(0.45);
              phys.cameraShake = 0.18;
            }
          }

          // Update Player Car Visual Rig
          playerCar.root.position.set(phys.x, phys.y, phys.z);
          playerCar.root.rotation.set(phys.roadPitch, phys.heading, 0, 'YXZ');

          // Sync visual wheel meshes with authentic Ackermann angles (Unity CarSteering: SyncMesh)
          playerCar.frontLeftPivot.rotation.y = -phys.frontLeftSteerDeg * (Math.PI / 180.0);
          playerCar.frontRightPivot.rotation.y = -phys.frontRightSteerDeg * (Math.PI / 180.0);
          playerCar.steeringWheel.rotation.z = -phys.steerAngleDeg * (Math.PI / 180.0) * 2.4;

          for (const w of playerCar.wheels) {
            w.rotation.x -= phys.speedMs * dt * 2.55;
          }

          // Anti-Roll bar balance & aerodynamic downforce stability (Unity CarSteering: antiRollForce = 6000f)
          playerCar.bodyGroup.rotation.x = -phys.longitudinalAccelG * 0.016;
          playerCar.bodyGroup.rotation.z = THREE.MathUtils.damp(
            playerCar.bodyGroup.rotation.z,
            -(phys.steerAngleDeg * (Math.PI / 180.0)) * (speedKmh / 160.0) * 0.035,
            12,
            dt
          );
          playerCar.bodyGroup.position.y = 0;

          // Taillights, Brake Lights, Reverse Lights & Turn Signals
          playerCar.brakeLightMaterial.emissiveIntensity = brakePressed && !isReversing ? 6.8 : phys.headlightsOn ? 1.8 : 0.8;
          playerCar.brakeHaloMaterial.opacity = brakePressed && !isReversing ? 0.95 : phys.headlightsOn ? 0.42 : 0.18;
          playerCar.reverseLightMaterial.emissiveIntensity = isReversing ? 4.2 : 0.15;
          playerCar.turnSignalMaterial.emissiveIntensity =
            Math.abs(phys.steerAngle) > 0.28 && Math.sin(elapsed * 9) > 0 ? 3.8 : 0.0;

          for (let hIdx = 0; hIdx < playerCar.brakeHaloSprites.length; hIdx++) {
            const isCenter = hIdx === 1;
            const boost = brakePressed ? 1.38 : 1.0;
            playerCar.brakeHaloSprites[hIdx].scale.set(
              (isCenter ? 1.45 : 0.95) * boost,
              (isCenter ? 0.52 : 0.68) * boost,
              1
            );
          }

          // Wheels high-speed blur & aerodynamic light trails
          playerCar.wheelBlurMaterial.opacity = THREE.MathUtils.clamp((speedKmh - 65) / 170, 0, 0.62);
          const trailRatio = THREE.MathUtils.clamp((speedKmh - 75) / 180, 0, 1);
          playerCar.tailTrailMaterial.opacity = trailRatio * (brakePressed ? 0.52 : 0.32);
          const trailScaleZ = 0.35 + trailRatio * 1.25;
          for (const tr of playerCar.tailTrailMeshes) {
            tr.scale.set(1, 1, trailScaleZ);
          }

          // Tire Smoke, Drift Scrub & Off-Track Dust
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

          // Friction sparks on hard braking / high-speed kerb
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
            true,
            phys.gear,
            throttlePressed,
            Math.abs(phys.steerAngle) / 0.46
          );
        } else {
          const rev = keys.up || touchInputRef.current.throttle;
          phys.rpm = THREE.MathUtils.damp(phys.rpm, rev ? 5800 : 820, 6, dt);
          soundEngine.updateEngine(phys.rpm, 0, false, true, 1, rev, 0);
        }

        smokeParticles.update(dt);
        nitroParticles.update(dt);
        sparkParticles.update(dt);

        keyLight.position.set(phys.x + 50, phys.y + 85, phys.z + 40);
        keyLight.target.position.set(phys.x, phys.y, phys.z);
        keyLight.target.updateMatrixWorld();

        carShowroomLight.position.set(phys.x + 3.8, phys.y + 11.0, phys.z + 4.8);
        carShowroomLight.target.position.set(phys.x, phys.y + 0.45, phys.z);
        carShowroomLight.target.updateMatrixWorld();

        // 8. Camera Choreography with FOV Offset, Distance Offset & 180° Look-Back Support
        const camMode = stateRef.current.settings.cameraMode;
        const fovOffset = stateRef.current.settings.cameraFovOffset || 0;
        const distOffset = stateRef.current.settings.cameraDistanceOffset || 0;

        const sinH = Math.sin(phys.heading);
        const cosH = Math.cos(phys.heading);
        _forwardVec.set(-sinH, Math.sin(phys.roadPitch), -cosH).normalize();
        _rightVec.set(cosH, 0, -sinH);

        const speedKmh = Math.abs(phys.speedMs) * 3.6;
        const baseFov =
          (camMode === 'cockpit' ? 64 : camMode === 'hood' ? 58 : camMode === 'chase_near' ? 48 : 56) + fovOffset;
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

        if (isLookingBack) {
          // 180° Rear Look-Back View (Placed in front of car looking straight back behind the car)
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
        } else if (camMode === 'cockpit') {
          _camTargetPos.set(
            phys.x - _rightVec.x * 0.42 + _forwardVec.x * 0.05 + shakeX * 0.35,
            phys.y + 1.38 + shakeY * 0.35,
            phys.z - _rightVec.z * 0.42 + _forwardVec.z * 0.05
          );
          camera.position.copy(_camTargetPos);
          _camLookAt.set(
            phys.x + _forwardVec.x * 26 + _rightVec.x * phys.cameraLookAheadYaw,
            phys.y + 1.28 + _forwardVec.y * 26,
            phys.z + _forwardVec.z * 26 + _rightVec.z * phys.cameraLookAheadYaw
          );
          camera.lookAt(_camLookAt);
        } else if (camMode === 'hood') {
          _camTargetPos.set(
            phys.x + _forwardVec.x * 0.65 + shakeX * 0.45,
            phys.y + 1.54 + shakeY * 0.45,
            phys.z + _forwardVec.z * 0.65
          );
          camera.position.copy(_camTargetPos);
          _camLookAt.set(
            phys.x + _forwardVec.x * 28 + _rightVec.x * phys.cameraLookAheadYaw,
            phys.y + 1.35 + _forwardVec.y * 28,
            phys.z + _forwardVec.z * 28 + _rightVec.z * phys.cameraLookAheadYaw
          );
          camera.lookAt(_camLookAt);
        } else {
          const isNear = camMode === 'chase_near';
          const baseDistBack = (isNear ? 4.65 : 8.2) + distOffset;
          const distBack = Math.max(3.2, baseDistBack + phys.longitudinalAccelG * 0.32);
          const camHeight = (isNear ? 1.98 : 3.2) + distOffset * 0.18 - phys.longitudinalAccelG * 0.08;

          const cornerSwing = phys.steerAngle * 0.95 - phys.lateralVel * 0.1;

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
          headlightsOn: phys.headlightsOn,
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
