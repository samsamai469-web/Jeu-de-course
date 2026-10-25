import * as THREE from 'three';
import { TimeOfDay, TrackBiome, TrackSpec, WeatherType } from '../types/game';
import { ProceduralTextureSet } from './textures';

export interface TrackSample {
  point: THREE.Vector3;
  tangent: THREE.Vector3;
  normal: THREE.Vector3; // Right-hand horizontal perpendicular
  pitch: number; // Longitudinal slope angle in radians
  curvature: number; // Signed horizontal turn rate
  t: number; // 0..1 along closed curve
}

export interface DiscoveryBeacon {
  id: number;
  label: string;
  position: THREE.Vector3;
  mesh: THREE.Group;
  collected: boolean;
}

export interface BuiltTrack {
  group: THREE.Group;
  skyGroup: THREE.Group;
  curve: THREE.CatmullRomCurve3;
  samples: TrackSample[];
  roadWidth: number;
  totalLength: number;
  minimapPoints: Array<{ x: number; z: number }>;
  beacons: DiscoveryBeacon[];
  lampLightPositions: THREE.Vector3[];
  getSampleAtT: (t: number) => TrackSample;
  getClosestSample: (
    x: number,
    z: number
  ) => {
    sample: TrackSample;
    distSq: number;
    signedLateralDist: number;
    index: number;
  };
  updateBeacons: (elapsedTime: number) => void;
  dispose: () => void;
}

const DISCOVERY_LABELS = [
  'Pont à Haubans Nord',
  'Viaduc Panoramique',
  'Belvédère du Lac',
  'Vallée des Grands Pins',
  'Portique Méridional',
  'Corniche des Sommets',
  'Grande Ligne Droite',
  'Col des Roches',
];

// ============================================================================
// 1. MULTI-OCTAVE SIMPLEX / PERLIN NOISE FOR MOUNTAIN TERRAIN
// ============================================================================
function hash2D(ix: number, iz: number): number {
  const h = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return h - Math.floor(h);
}

function valueNoise2D(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3.0 - 2.0 * fx);
  const uz = fz * fz * (3.0 - 2.0 * fz);

  const n00 = hash2D(ix, iz);
  const n10 = hash2D(ix + 1, iz);
  const n01 = hash2D(ix, iz + 1);
  const n11 = hash2D(ix + 1, iz + 1);

  const nx0 = n00 + (n10 - n00) * ux;
  const nx1 = n01 + (n11 - n01) * ux;
  return nx0 + (nx1 - nx0) * uz;
}

/**
 * Multi-octave Simplex/Perlin FBM + ridged mountain noise (5 octaves).
 */
function fbmMountainNoise(x: number, z: number, octaves = 5): number {
  let value = 0;
  let amplitude = 0.52;
  let frequency = 1.0;
  let px = x;
  let pz = z;

  for (let i = 0; i < octaves; i++) {
    const n = valueNoise2D(px * frequency, pz * frequency);
    // Blend standard Perlin FBM with sharp alpine ridge noise
    const ridge = 1.0 - Math.abs(n * 2.0 - 1.0);
    const blended = n * 0.45 + ridge * ridge * 0.55;
    value += blended * amplitude;

    // Domain rotation between octaves to eliminate grid axis alignment
    const nx = px * 0.8 - pz * 0.6;
    const nz = px * 0.6 + pz * 0.8;
    px = nx;
    pz = nz;

    frequency *= 2.04;
    amplitude *= 0.48;
  }
  return value;
}

// ============================================================================
// 2. SKY SPHERE FOLLOWING CAMERA + ~800 DISCREET STARS (createSky)
// ============================================================================
export function createSky(
  group: THREE.Group,
  timeOfDay: TimeOfDay,
  biome: TrackBiome,
  weather: WeatherType,
  textures: ProceduralTextureSet
): THREE.Group {
  const skyGroup = new THREE.Group();

  // Distinct, bright sky gradients per time of day & level
  const zenithColor =
    timeOfDay === 'morning'
      ? new THREE.Color(0x1d4ed8)
      : timeOfDay === 'afternoon'
      ? new THREE.Color(0x1e40af)
      : timeOfDay === 'sunset'
      ? new THREE.Color(0x311042)
      : new THREE.Color(0x0c1e42);

  const horizonColor =
    timeOfDay === 'morning'
      ? new THREE.Color(0x7dd3fc)
      : timeOfDay === 'afternoon'
      ? new THREE.Color(0x93c5fd)
      : timeOfDay === 'sunset'
      ? new THREE.Color(0xfb923c)
      : new THREE.Color(0x1e3a70);

  if (biome === 'canyon' && timeOfDay !== 'night') {
    horizonColor.lerp(new THREE.Color(0xfdba74), 0.35);
  }

  if (weather === 'rain' || weather === 'fog') {
    zenithColor.lerp(new THREE.Color(0x1e293b), 0.3);
    horizonColor.lerp(new THREE.Color(0x334155), 0.35);
  }

  // Large sphere (SphereGeometry, BackSide, fog: false) that follows the camera
  const skyRadius = 680;
  const skyGeo = new THREE.SphereGeometry(skyRadius, 36, 28);
  const posAttr = skyGeo.attributes.position;
  const skyColors = new Float32Array(posAttr.count * 3);
  const tmpColor = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const y = posAttr.getY(i);
    // Normalized elevation: 0 at horizon (y <= 0), 1 at zenith (y = skyRadius)
    const elev = THREE.MathUtils.clamp(y / skyRadius, 0, 1);
    const blend = Math.pow(elev, 0.65);
    tmpColor.copy(horizonColor).lerp(zenithColor, blend);
    skyColors[i * 3] = tmpColor.r;
    skyColors[i * 3 + 1] = tmpColor.g;
    skyColors[i * 3 + 2] = tmpColor.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(skyColors, 3));

  const skyMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });

  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.frustumCulled = false;
  skyMesh.renderOrder = -2;
  skyGroup.add(skyMesh);

  // ~800 Discreet Stars (Points with circular radial-gradient texture)
  const starOpacity = timeOfDay === 'night' ? 0.82 : timeOfDay === 'sunset' ? 0.45 : 0.0;
  if (starOpacity > 0.01) {
    const starCount = 800;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      // Distribute across upper dome above horizon (elev > 0.08)
      const u = 0.08 + Math.random() * 0.92;
      const phi = Math.acos(THREE.MathUtils.clamp(u, -1, 1));
      const r = 640;
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const brightness = 0.55 + Math.random() * 0.45;
      const tint =
        i % 6 === 0
          ? new THREE.Color(0xbfdbfe)
          : i % 9 === 0
          ? new THREE.Color(0xfef08a)
          : new THREE.Color(0xf8fafc);
      starColors[i * 3] = tint.r * brightness;
      starColors[i * 3 + 1] = tint.g * brightness;
      starColors[i * 3 + 2] = tint.b * brightness;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
      map: textures.particleTexture,
      size: 2.2,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: starOpacity,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
    });

    const starPoints = new THREE.Points(starGeo, starMat);
    starPoints.frustumCulled = false;
    starPoints.renderOrder = -1;
    skyGroup.add(starPoints);
  }

  group.add(skyGroup);
  return skyGroup;
}

// ============================================================================
// 3. MULTI-OCTAVE SIMPLEX/PERLIN MOUNTAINS WITH ALTITUDE COLORING (createMountains)
// ============================================================================
export function createMountains(
  group: THREE.Group,
  spec: TrackSpec,
  getClosestSample: BuiltTrack['getClosestSample'],
  biome: TrackBiome,
  isNight: boolean,
  isSnowy: boolean,
  textures: ProceduralTextureSet
): void {
  const isStraight = Boolean(spec.isStraight);
  const terrainSize = isStraight ? 3800 : 2400;
  const segments = 52;
  const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);
  const lvl = spec.levelNumber;
  const seedOffset = lvl * 47.3;

  const lowRockCol = new THREE.Color(
    lvl === 3
      ? 0x451a03
      : lvl === 2
      ? 0x1e3a1e
      : lvl === 4
      ? 0x0f172a
      : lvl === 5
      ? 0x1c1917
      : isNight
      ? 0x0f172a
      : 0x1e293b
  );
  const midRockCol = new THREE.Color(
    lvl === 3
      ? 0x7c2d12
      : lvl === 2
      ? 0x365314
      : lvl === 4
      ? 0x1e293b
      : lvl === 5
      ? 0x3f2320
      : isNight
      ? 0x1e293b
      : 0x334155
  );
  const highRockCol = new THREE.Color(
    lvl === 3 ? 0x9a3412 : lvl === 5 ? 0x57302c : isNight ? 0x334155 : 0x475569
  );
  const snowCapCol = new THREE.Color(
    lvl === 5 ? 0xfca5a5 : lvl === 3 ? 0xfed7aa : isNight ? 0xcbd5e1 : 0xf8fafc
  );
  const tmpCol = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);

    const closest = getClosestSample(vx, vz);
    const distFromRoad = Math.sqrt(closest.distSq);

    // Smooth corridor mask around each level's specific road trajectory
    const roadClearance = THREE.MathUtils.smoothstep(distFromRoad, 36, 195);

    if (roadClearance <= 0.001) {
      posAttr.setY(i, -3.2);
      tmpCol.copy(lowRockCol);
    } else {
      const nMacro = Math.max(
        0,
        fbmMountainNoise(vx * 0.0022 + seedOffset, vz * 0.0022 - seedOffset * 0.7, 3)
      );
      const nMid = fbmMountainNoise(vx * 0.0065 + 11.4 + seedOffset, vz * 0.0065 - 7.2, 2);
      const nDetail = valueNoise2D(vx * 0.025 + seedOffset, vz * 0.025) - 0.5;

      const radialDist = Math.hypot(vx, vz);
      const horizonBoost = THREE.MathUtils.smoothstep(radialDist, 260, 920) * 1.45;
      const heightScale = lvl === 3 ? 1.25 : lvl === 2 ? 0.72 : lvl === 5 ? 1.35 : 1.0;

      const rawElevation =
        (Math.pow(nMacro, 1.45) * (95 + horizonBoost * 95) + nMid * 26 + nDetail * 6) *
        heightScale;
      const elevation = -2.8 + rawElevation * roadClearance;
      posAttr.setY(i, elevation);

      const snowThreshold = isSnowy ? 18 : 54 - nMid * 12;
      if (elevation > snowThreshold) {
        const snowBlend = THREE.MathUtils.clamp((elevation - snowThreshold) / 26, 0, 1);
        tmpCol.copy(highRockCol).lerp(snowCapCol, snowBlend);
      } else if (elevation > 16) {
        const rockBlend = THREE.MathUtils.clamp((elevation - 16) / 36, 0, 1);
        tmpCol.copy(midRockCol).lerp(highRockCol, rockBlend);
      } else {
        const baseBlend = THREE.MathUtils.clamp((elevation + 2.8) / 18.8, 0, 1);
        tmpCol.copy(lowRockCol).lerp(midRockCol, baseBlend);
      }
    }

    colors[i * 3] = tmpCol.r;
    colors[i * 3 + 1] = tmpCol.g;
    colors[i * 3 + 2] = tmpCol.b;
  }

  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    map: textures.mountainRockTexture,
    normalMap: textures.rockNormalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.04,
    envMapIntensity: 0.25,
  });

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.position.set(0, 0, isStraight ? -1250 : 0);
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);
}

// ============================================================================
// 4. LEVEL-SPECIFIC ROAD, MARKINGS & CURBSTONE TEXTURE GENERATOR
// ============================================================================
interface LevelRoadTextures {
  roadMap: THREE.CanvasTexture;
  roadEmissive: THREE.CanvasTexture;
  kerbMap: THREE.CanvasTexture;
  gantryMap: THREE.CanvasTexture;
  dispose: () => void;
}

function createLevelRoadTextures(spec: TrackSpec, maxAnisotropy = 16): LevelRoadTextures {
  const lvl = spec.levelNumber;
  const aniso = Math.max(8, maxAnisotropy);

  // 1. Level-Specific Asphalt & Lane Markings Canvas (1024x1024)
  const rCanvas = document.createElement('canvas');
  rCanvas.width = 1024;
  rCanvas.height = 1024;
  const rCtx = rCanvas.getContext('2d')!;

  const reCanvas = document.createElement('canvas');
  reCanvas.width = 1024;
  reCanvas.height = 1024;
  const reCtx = reCanvas.getContext('2d')!;
  // Crisp dark base in emissive map so the white/neon road lines pop with razor-sharp contrast against the tarmac
  reCtx.fillStyle =
    lvl === 2
      ? '#1c1a17'
      : lvl === 3
      ? '#1e1612'
      : lvl === 4
      ? '#111822'
      : lvl === 5
      ? '#161820'
      : '#141923';
  reCtx.fillRect(0, 0, 1024, 1024);

  // Much Lighter, Visually Distinct Asphalt Base Gradient per Level
  const grad = rCtx.createLinearGradient(0, 0, 1024, 0);
  if (lvl === 1) {
    // Level 1: Bright Blue-Grey Highway Asphalt (#586375 -> #68758a)
    grad.addColorStop(0.0, '#4a5464');
    grad.addColorStop(0.15, '#5a6578');
    grad.addColorStop(0.5, '#68758a');
    grad.addColorStop(0.85, '#5a6578');
    grad.addColorStop(1.0, '#4a5464');
  } else if (lvl === 2) {
    // Level 2: Bright Sunlit Sand-Concrete Tarmac (#827b6e -> #968f80)
    grad.addColorStop(0.0, '#736c60');
    grad.addColorStop(0.15, '#857e70');
    grad.addColorStop(0.5, '#968f80');
    grad.addColorStop(0.85, '#857e70');
    grad.addColorStop(1.0, '#736c60');
  } else if (lvl === 3) {
    // Level 3: Bright Canyon Ochre-Terracotta Tarmac (#7a5f50 -> #8f7160)
    grad.addColorStop(0.0, '#695042');
    grad.addColorStop(0.15, '#7d6252');
    grad.addColorStop(0.5, '#8f7160');
    grad.addColorStop(0.85, '#7d6252');
    grad.addColorStop(1.0, '#695042');
  } else if (lvl === 4) {
    // Level 4: Bright Coastal Slate-Azure Viaduct Asphalt (#4f6378 -> #637b94)
    grad.addColorStop(0.0, '#435568');
    grad.addColorStop(0.2, '#53687e');
    grad.addColorStop(0.5, '#637b94');
    grad.addColorStop(0.8, '#53687e');
    grad.addColorStop(1.0, '#435568');
  } else {
    // Level 5: Bright Silver-Grey Grand Prix Competition Tarmac (#606675 -> #757c8d)
    grad.addColorStop(0.0, '#525766');
    grad.addColorStop(0.18, '#63697a');
    grad.addColorStop(0.5, '#757c8d');
    grad.addColorStop(0.82, '#63697a');
    grad.addColorStop(1.0, '#525766');
  }

  rCtx.fillStyle = grad;
  rCtx.fillRect(0, 0, 1024, 1024);

  // Fine mineral aggregate micro-grain (fast startup)
  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const v = 85 + Math.floor(Math.random() * 45);
    rCtx.fillStyle = `rgba(${v}, ${v + 2}, ${v + 5}, 0.28)`;
    rCtx.fillRect(x, y, 4, 4);
  }

  // Extra-Wide, High-Visibility Road Markings per Level!
  if (lvl === 1) {
    // Level 1: Wide Neon Cyan Outer Bands + Wide Pure White Edge Lines + Wide Dashed Center Line
    rCtx.fillStyle = '#38bdf8';
    rCtx.fillRect(28, 0, 20, 1024);
    rCtx.fillRect(976, 0, 20, 1024);
    reCtx.fillStyle = '#38bdf8';
    reCtx.fillRect(28, 0, 20, 1024);
    reCtx.fillRect(976, 0, 20, 1024);

    rCtx.fillStyle = '#ffffff';
    rCtx.fillRect(54, 0, 28, 1024);
    rCtx.fillRect(942, 0, 28, 1024);
    reCtx.fillStyle = '#ffffff';
    reCtx.fillRect(54, 0, 28, 1024);
    reCtx.fillRect(942, 0, 28, 1024);

    for (let y = 0; y < 1024; y += 128) {
      rCtx.fillStyle = '#ffffff';
      rCtx.fillRect(498, y + 14, 28, 78);
      reCtx.fillStyle = '#ffffff';
      reCtx.fillRect(498, y + 14, 28, 78);

      // Glowing Cyan Cat's-Eye Highway Studs
      rCtx.fillStyle = '#38bdf8';
      rCtx.fillRect(502, y + 100, 20, 16);
      reCtx.fillStyle = '#38bdf8';
      reCtx.fillRect(502, y + 100, 20, 16);
    }
  } else if (lvl === 2) {
    // Level 2: Sunlit Concrete — Wide White Edge Lines + Extra-Wide Double Golden Yellow Center Line + Lane Dashes
    rCtx.fillStyle = '#ffffff';
    rCtx.fillRect(44, 0, 30, 1024);
    rCtx.fillRect(950, 0, 30, 1024);
    reCtx.fillStyle = '#ffffff';
    reCtx.fillRect(44, 0, 30, 1024);
    reCtx.fillRect(950, 0, 30, 1024);

    // Double Golden Yellow Center Line
    rCtx.fillStyle = '#facc15';
    rCtx.fillRect(484, 0, 20, 1024);
    rCtx.fillRect(520, 0, 20, 1024);
    reCtx.fillStyle = '#facc15';
    reCtx.fillRect(484, 0, 20, 1024);
    reCtx.fillRect(520, 0, 20, 1024);

    for (let y = 0; y < 1024; y += 128) {
      rCtx.fillStyle = '#fef08a';
      rCtx.fillRect(268, y + 24, 14, 64);
      rCtx.fillRect(742, y + 24, 14, 64);
      reCtx.fillStyle = '#fef08a';
      reCtx.fillRect(268, y + 24, 14, 64);
      reCtx.fillRect(742, y + 24, 14, 64);
    }
  } else if (lvl === 3) {
    // Level 3: Canyon Sunset — Wide Fluorescent Yellow Edge Lines + Orange/Yellow Center Chevrons & Double Dashes
    rCtx.fillStyle = '#fde047';
    rCtx.fillRect(42, 0, 32, 1024);
    rCtx.fillRect(950, 0, 32, 1024);
    reCtx.fillStyle = '#fde047';
    reCtx.fillRect(42, 0, 32, 1024);
    reCtx.fillRect(950, 0, 32, 1024);

    for (let y = 0; y < 1024; y += 128) {
      rCtx.fillStyle = '#fb923c';
      rCtx.fillRect(482, y + 10, 20, 88);
      rCtx.fillRect(522, y + 10, 20, 88);
      reCtx.fillStyle = '#fb923c';
      reCtx.fillRect(482, y + 10, 20, 88);
      reCtx.fillRect(522, y + 10, 20, 88);

      // Center Yellow Reflector Diamond
      rCtx.fillStyle = '#fde047';
      rCtx.fillRect(504, y + 104, 16, 16);
      reCtx.fillStyle = '#fde047';
      reCtx.fillRect(504, y + 104, 16, 16);
    }
  } else if (lvl === 4) {
    // Level 4: Coastal Azure Viaduct — Double Neon Turquoise + Crisp White Edge Bands + 3-Lane White & Cyan Dividers
    rCtx.fillStyle = '#22d3ee';
    rCtx.fillRect(30, 0, 22, 1024);
    rCtx.fillRect(972, 0, 22, 1024);
    reCtx.fillStyle = '#22d3ee';
    reCtx.fillRect(30, 0, 22, 1024);
    reCtx.fillRect(972, 0, 22, 1024);

    rCtx.fillStyle = '#ffffff';
    rCtx.fillRect(58, 0, 24, 1024);
    rCtx.fillRect(942, 0, 24, 1024);
    reCtx.fillStyle = '#ffffff';
    reCtx.fillRect(58, 0, 24, 1024);
    reCtx.fillRect(942, 0, 24, 1024);

    for (let y = 0; y < 1024; y += 128) {
      rCtx.fillStyle = '#22d3ee';
      rCtx.fillRect(500, y + 10, 24, 76);
      reCtx.fillStyle = '#22d3ee';
      reCtx.fillRect(500, y + 10, 24, 76);

      rCtx.fillStyle = '#ffffff';
      rCtx.fillRect(280, y + 24, 18, 64);
      rCtx.fillRect(726, y + 24, 18, 64);
      reCtx.fillStyle = '#ffffff';
      reCtx.fillRect(280, y + 24, 18, 64);
      reCtx.fillRect(726, y + 24, 18, 64);
    }
  } else {
    // Level 5: Grand Prix Pro Circuit — Wide Red/White Racing Edge Strips + Central White & Red Apex Line
    for (let y = 0; y < 1024; y += 64) {
      const col = (y / 64) % 2 === 0 ? '#ef4444' : '#ffffff';
      rCtx.fillStyle = col;
      rCtx.fillRect(26, y, 30, 64);
      rCtx.fillRect(968, y, 30, 64);
      reCtx.fillStyle = col;
      reCtx.fillRect(26, y, 30, 64);
      reCtx.fillRect(968, y, 30, 64);
    }
    rCtx.fillStyle = '#ffffff';
    rCtx.fillRect(62, 0, 22, 1024);
    rCtx.fillRect(940, 0, 22, 1024);
    reCtx.fillStyle = '#ffffff';
    reCtx.fillRect(62, 0, 22, 1024);
    reCtx.fillRect(940, 0, 22, 1024);

    for (let y = 0; y < 1024; y += 128) {
      rCtx.fillStyle = '#ffffff';
      rCtx.fillRect(498, y + 12, 28, 72);
      reCtx.fillStyle = '#ffffff';
      reCtx.fillRect(498, y + 12, 28, 72);

      rCtx.fillStyle = '#ef4444';
      rCtx.fillRect(502, y + 94, 20, 22);
      reCtx.fillStyle = '#ef4444';
      reCtx.fillRect(502, y + 94, 20, 22);
    }
  }

  const roadMap = new THREE.CanvasTexture(rCanvas);
  roadMap.colorSpace = THREE.SRGBColorSpace;
  roadMap.wrapS = THREE.RepeatWrapping;
  roadMap.wrapT = THREE.RepeatWrapping;
  roadMap.anisotropy = aniso;

  const roadEmissive = new THREE.CanvasTexture(reCanvas);
  roadEmissive.colorSpace = THREE.SRGBColorSpace;
  roadEmissive.wrapS = THREE.RepeatWrapping;
  roadEmissive.wrapT = THREE.RepeatWrapping;
  roadEmissive.anisotropy = aniso;

  // 2. Level-Specific Curbstone (Vibreurs) Texture (512x512 for crisp edges)
  const kCanvas = document.createElement('canvas');
  kCanvas.width = 512;
  kCanvas.height = 512;
  const kCtx = kCanvas.getContext('2d')!;

  const [kerbPrimary, kerbSecondary] =
    lvl === 1
      ? ['#0284c7', '#f8fafc'] // Level 1: Cyan-Blue & White
      : lvl === 2
      ? ['#16a34a', '#fef08a'] // Level 2: Emerald Green & Warm Gold
      : lvl === 3
      ? ['#ea580c', '#f8fafc'] // Level 3: Blaze Orange & White
      : lvl === 4
      ? ['#facc15', '#1e293b'] // Level 4: Coastal Hazard Yellow & Dark Slate
      : ['#dc2626', '#ffffff']; // Level 5: Grand Prix Crimson Red & White

  kCtx.fillStyle = kerbPrimary;
  kCtx.fillRect(0, 0, 512, 256);
  kCtx.fillStyle = kerbSecondary;
  kCtx.fillRect(0, 256, 512, 256);
  kCtx.fillStyle = '#0f172a';
  kCtx.fillRect(0, 246, 512, 10);
  kCtx.fillRect(0, 502, 512, 10);

  const kerbMap = new THREE.CanvasTexture(kCanvas);
  kerbMap.colorSpace = THREE.SRGBColorSpace;
  kerbMap.wrapS = THREE.RepeatWrapping;
  kerbMap.wrapT = THREE.RepeatWrapping;
  kerbMap.anisotropy = aniso;

  // 3. Level-Specific Overhead Gantry Sign Texture (1024x256)
  const gCanvas = document.createElement('canvas');
  gCanvas.width = 1024;
  gCanvas.height = 256;
  const gCtx = gCanvas.getContext('2d')!;

  const bgColors: Record<number, string> = {
    1: '#0369a1',
    2: '#15803d',
    3: '#c2410c',
    4: '#0f172a',
    5: '#991b1b',
  };
  const accentColors: Record<number, string> = {
    1: '#38bdf8',
    2: '#fde047',
    3: '#fdba74',
    4: '#22d3ee',
    5: '#facc15',
  };

  gCtx.fillStyle = bgColors[lvl] || '#0369a1';
  gCtx.fillRect(0, 0, 1024, 256);
  gCtx.strokeStyle = accentColors[lvl] || '#ffffff';
  gCtx.lineWidth = 10;
  gCtx.strokeRect(10, 10, 1004, 236);

  gCtx.fillStyle = accentColors[lvl] || '#facc15';
  gCtx.font = 'bold 34px sans-serif';
  gCtx.fillText(`NIVEAU ${lvl} · APEX HORIZON`, 40, 82);

  gCtx.fillStyle = '#ffffff';
  gCtx.font = 'bold 44px sans-serif';
  gCtx.fillText(spec.name.toUpperCase(), 40, 148);

  gCtx.fillStyle = '#e2e8f0';
  gCtx.font = 'bold 24px monospace';
  gCtx.fillText(`${spec.location.toUpperCase()} · ${spec.defaultLaps} TOURS`, 40, 205);

  const gantryMap = new THREE.CanvasTexture(gCanvas);
  gantryMap.colorSpace = THREE.SRGBColorSpace;
  gantryMap.anisotropy = aniso;

  return {
    roadMap,
    roadEmissive,
    kerbMap,
    gantryMap,
    dispose: () => {
      roadMap.dispose();
      roadEmissive.dispose();
      kerbMap.dispose();
      gantryMap.dispose();
    },
  };
}

// ============================================================================
// 4B. TRACK ASPHALT, WHITE/YELLOW LINES, CORNER CURBSTONES, GRAVEL & GRASS (createTrack)
// ============================================================================
export function createTrack(
  group: THREE.Group,
  spec: TrackSpec,
  samples: TrackSample[],
  totalLength: number,
  biome: TrackBiome,
  isNight: boolean,
  isRainy: boolean,
  isSnowy: boolean,
  textures: ProceduralTextureSet,
  levelTex: LevelRoadTextures
): { halfW: number; kerbW: number; railOffset: number; outerShoulderOffset: number } {
  const sampleCount = samples.length;
  const lvl = spec.levelNumber;
  const halfW = spec.roadWidth / 2;
  const kerbW = lvl === 5 ? 1.25 : 1.05;
  const gravelW = 3.6;
  const grassW = 8.5;
  const railOffset = halfW + kerbW + 1.25;
  const outerShoulderOffset = halfW + kerbW + gravelW + grassW;

  const roadPositions: number[] = [];
  const roadNormals: number[] = [];
  const roadUvs: number[] = [];
  const roadIndices: number[] = [];

  const kerbPositions: number[] = [];
  const kerbNormals: number[] = [];
  const kerbUvs: number[] = [];
  const kerbColors: number[] = [];
  const kerbIndices: number[] = [];

  const gravelPositions: number[] = [];
  const gravelNormals: number[] = [];
  const gravelUvs: number[] = [];
  const gravelIndices: number[] = [];

  const grassPositions: number[] = [];
  const grassNormals: number[] = [];
  const grassUvs: number[] = [];
  const grassIndices: number[] = [];

  const CROSS_DIVS = 4;
  const isStraight = Boolean(spec.isStraight);
  const numSteps = isStraight ? sampleCount - 1 : sampleCount;

  for (let i = 0; i <= numSteps; i++) {
    const idx = Math.min(i, sampleCount - 1);
    const s = samples[idx];
    const roadY = s.point.y + 0.04;
    const vCoord = (i / numSteps) * (totalLength / 14);

    // Subdivide road into 4 cross-sections to eliminate diagonal twisting/creases
    for (let c = 0; c <= CROSS_DIVS; c++) {
      const u = c / CROSS_DIVS;
      const latOffset = -halfW + u * (halfW * 2);
      const rx = s.point.x + s.normal.x * latOffset;
      const rz = s.point.z + s.normal.z * latOffset;
      const crown = Math.sin(u * Math.PI) * 0.015;
      roadPositions.push(rx, roadY + crown, rz);
      roadNormals.push(0, 1, 0);
      roadUvs.push(u, vCoord);
    }

    const cornerFactor = THREE.MathUtils.clamp(Math.abs(s.curvature) / 0.0035, 0, 1);
    const kerbLift = 0.025 + cornerFactor * 0.035;
    const leftKerbOuterX = s.point.x - s.normal.x * (halfW + kerbW);
    const leftKerbOuterZ = s.point.z - s.normal.z * (halfW + kerbW);
    const rightKerbOuterX = s.point.x + s.normal.x * (halfW + kerbW);
    const rightKerbOuterZ = s.point.z + s.normal.z * (halfW + kerbW);
    const leftEdgeX = s.point.x - s.normal.x * halfW;
    const leftEdgeZ = s.point.z - s.normal.z * halfW;
    const rightEdgeX = s.point.x + s.normal.x * halfW;
    const rightEdgeZ = s.point.z + s.normal.z * halfW;

    const kV = (i / sampleCount) * (totalLength / 2.6);
    kerbPositions.push(
      leftKerbOuterX,
      roadY + kerbLift,
      leftKerbOuterZ,
      leftEdgeX,
      roadY + 0.005,
      leftEdgeZ,
      rightEdgeX,
      roadY + 0.005,
      rightEdgeZ,
      rightKerbOuterX,
      roadY + kerbLift,
      rightKerbOuterZ
    );
    kerbNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    kerbUvs.push(0, kV, 1, kV, 1, kV, 0, kV);

    const cBright = 0.75 + cornerFactor * 0.25;
    for (let k = 0; k < 4; k++) {
      kerbColors.push(cBright, cBright, cBright);
    }

    // Immediate Gravel Verge on Both Sides
    const leftGravelOuterX = s.point.x - s.normal.x * (halfW + kerbW + gravelW);
    const leftGravelOuterZ = s.point.z - s.normal.z * (halfW + kerbW + gravelW);
    const rightGravelOuterX = s.point.x + s.normal.x * (halfW + kerbW + gravelW);
    const rightGravelOuterZ = s.point.z + s.normal.z * (halfW + kerbW + gravelW);

    const gvV = (i / sampleCount) * (totalLength / 5.0);
    gravelPositions.push(
      leftGravelOuterX,
      roadY - 0.06,
      leftGravelOuterZ,
      leftKerbOuterX,
      roadY + 0.015,
      leftKerbOuterZ,
      rightKerbOuterX,
      roadY + 0.015,
      rightKerbOuterZ,
      rightGravelOuterX,
      roadY - 0.06,
      rightGravelOuterZ
    );
    gravelNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    gravelUvs.push(0, gvV, 1, gvV, 0, gvV, 1, gvV);

    // Outer Grass / Biome Verge on Both Sides
    const leftGrassOuterX = s.point.x - s.normal.x * outerShoulderOffset;
    const leftGrassOuterZ = s.point.z - s.normal.z * outerShoulderOffset;
    const rightGrassOuterX = s.point.x + s.normal.x * outerShoulderOffset;
    const rightGrassOuterZ = s.point.z + s.normal.z * outerShoulderOffset;

    const grV = (i / sampleCount) * (totalLength / 8.0);
    grassPositions.push(
      leftGrassOuterX,
      roadY - 0.35,
      leftGrassOuterZ,
      leftGravelOuterX,
      roadY - 0.06,
      leftGravelOuterZ,
      rightGravelOuterX,
      roadY - 0.06,
      rightGravelOuterZ,
      rightGrassOuterX,
      roadY - 0.35,
      rightGrassOuterZ
    );
    grassNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    grassUvs.push(0, grV, 1, grV, 0, grV, 1, grV);

    if (i < numSteps) {
      const row0 = i * (CROSS_DIVS + 1);
      const row1 = (i + 1) * (CROSS_DIVS + 1);
      for (let c = 0; c < CROSS_DIVS; c++) {
        const p00 = row0 + c;
        const p10 = row0 + c + 1;
        const p01 = row1 + c;
        const p11 = row1 + c + 1;
        roadIndices.push(p00, p01, p10, p10, p01, p11);
      }

      const kBase = i * 4;
      kerbIndices.push(kBase, kBase + 1, kBase + 4, kBase + 1, kBase + 5, kBase + 4);
      kerbIndices.push(kBase + 2, kBase + 3, kBase + 6, kBase + 3, kBase + 7, kBase + 6);

      gravelIndices.push(kBase, kBase + 1, kBase + 4, kBase + 1, kBase + 5, kBase + 4);
      gravelIndices.push(kBase + 2, kBase + 3, kBase + 6, kBase + 3, kBase + 7, kBase + 6);

      grassIndices.push(kBase, kBase + 1, kBase + 4, kBase + 1, kBase + 5, kBase + 4);
      grassIndices.push(kBase + 2, kBase + 3, kBase + 6, kBase + 3, kBase + 7, kBase + 6);
    }
  }

  // 1. Level-Specific Procedural Asphalt Road Mesh
  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
  roadGeo.setAttribute('normal', new THREE.Float32BufferAttribute(roadNormals, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
  roadGeo.setIndex(roadIndices);
  roadGeo.computeVertexNormals();
  roadGeo.computeTangents();

  const roadRoughness = isRainy || lvl === 4 ? 0.48 : lvl === 5 ? 0.62 : 0.68;
  const roadMetalness = isRainy || lvl === 4 ? 0.16 : 0.06;

  const roadMat = new THREE.MeshStandardMaterial({
    map: levelTex.roadMap,
    color: 0xffffff,
    normalMap: textures.roadNormalMap,
    normalScale: new THREE.Vector2(0.06, 0.06),
    roughnessMap: textures.roadRoughnessMap,
    roughness: roadRoughness,
    metalness: roadMetalness,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: levelTex.roadEmissive,
    emissiveIntensity: isNight ? 0.92 : 0.68,
    envMapIntensity: isRainy || lvl === 4 ? 0.55 : 0.35,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // 2. Level-Specific Corner Curbstones Mesh (with Emissive Lift for Maximum Visibility)
  const kerbGeo = new THREE.BufferGeometry();
  kerbGeo.setAttribute('position', new THREE.Float32BufferAttribute(kerbPositions, 3));
  kerbGeo.setAttribute('normal', new THREE.Float32BufferAttribute(kerbNormals, 3));
  kerbGeo.setAttribute('uv', new THREE.Float32BufferAttribute(kerbUvs, 2));
  kerbGeo.setAttribute('color', new THREE.Float32BufferAttribute(kerbColors, 3));
  kerbGeo.setIndex(kerbIndices);
  kerbGeo.computeVertexNormals();

  const kerbMat = new THREE.MeshStandardMaterial({
    map: levelTex.kerbMap,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: levelTex.kerbMap,
    emissiveIntensity: isNight ? 0.42 : 0.25,
    vertexColors: true,
    roughness: 0.58,
    metalness: 0.08,
    envMapIntensity: 0.4,
  });
  const kerbMesh = new THREE.Mesh(kerbGeo, kerbMat);
  kerbMesh.receiveShadow = true;
  group.add(kerbMesh);

  // 3. Level-Specific Gravel Verge Mesh
  const gravelGeo = new THREE.BufferGeometry();
  gravelGeo.setAttribute('position', new THREE.Float32BufferAttribute(gravelPositions, 3));
  gravelGeo.setAttribute('normal', new THREE.Float32BufferAttribute(gravelNormals, 3));
  gravelGeo.setAttribute('uv', new THREE.Float32BufferAttribute(gravelUvs, 2));
  gravelGeo.setIndex(gravelIndices);

  const gravelColor =
    lvl === 2
      ? 0xd6bfa3
      : lvl === 3
      ? 0x9a3412
      : lvl === 4
      ? 0x334155
      : lvl === 5
      ? 0x7f1d1d
      : 0x64748b;

  const gravelMat = new THREE.MeshStandardMaterial({
    map: textures.gravelTexture,
    color: gravelColor,
    roughness: 0.94,
    metalness: 0.02,
    envMapIntensity: 0.2,
  });
  const gravelMesh = new THREE.Mesh(gravelGeo, gravelMat);
  gravelMesh.receiveShadow = true;
  group.add(gravelMesh);

  // 4. Level-Specific Grass / Outer Verge Mesh
  const grassGeo = new THREE.BufferGeometry();
  grassGeo.setAttribute('position', new THREE.Float32BufferAttribute(grassPositions, 3));
  grassGeo.setAttribute('normal', new THREE.Float32BufferAttribute(grassNormals, 3));
  grassGeo.setAttribute('uv', new THREE.Float32BufferAttribute(grassUvs, 2));
  grassGeo.setIndex(grassIndices);

  const grassColor =
    lvl === 2
      ? 0x4d7c0f
      : lvl === 3
      ? 0x573b26
      : lvl === 4
      ? 0x164e63
      : lvl === 5
      ? 0x1e293b
      : isNight
      ? 0x1e3a2f
      : isSnowy
      ? 0x94a3b8
      : 0x365314;

  const grassMat = new THREE.MeshStandardMaterial({
    map: textures.grassGroundTexture,
    color: grassColor,
    roughness: 0.92,
    metalness: 0.02,
    envMapIntensity: 0.22,
  });
  const grassMesh = new THREE.Mesh(grassGeo, grassMat);
  grassMesh.receiveShadow = true;
  group.add(grassMesh);

  // Start Checkered Line at Sample 10
  const startIdx = isStraight ? 10 : 0;
  const startSample = samples[startIdx];
  const startAngle = Math.atan2(startSample.tangent.x, startSample.tangent.z);
  const startLineGeo = new THREE.PlaneGeometry(spec.roadWidth * 0.94, 3.2);
  const startLineMesh = new THREE.Mesh(
    startLineGeo,
    new THREE.MeshBasicMaterial({
      map: textures.checkeredTexture,
      transparent: true,
      opacity: 0.94,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  startLineMesh.position.set(startSample.point.x, startSample.point.y + 0.06, startSample.point.z);
  startLineMesh.rotation.set(-Math.PI / 2, 0, startAngle);
  group.add(startLineMesh);

  // Finish Checkered Line near the end of the straight road
  if (isStraight) {
    const finishIdx = sampleCount - 15;
    const finishSample = samples[finishIdx];
    const finishAngle = Math.atan2(finishSample.tangent.x, finishSample.tangent.z);
    const finishLineMesh = new THREE.Mesh(
      startLineGeo,
      new THREE.MeshBasicMaterial({
        map: textures.checkeredTexture,
        transparent: true,
        opacity: 0.96,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    finishLineMesh.position.set(finishSample.point.x, finishSample.point.y + 0.06, finishSample.point.z);
    finishLineMesh.rotation.set(-Math.PI / 2, 0, finishAngle);
    group.add(finishLineMesh);
  }

  return { halfW, kerbW, railOffset, outerShoulderOffset };
}

// ============================================================================
// 5. ROADSIDE GUARDRAILS, CHEVRON TURN SIGNS, BOLLARDS, STREETLAMPS & LANDMARKS
// ============================================================================
export function createRoadsideProps(
  group: THREE.Group,
  spec: TrackSpec,
  samples: TrackSample[],
  totalLength: number,
  halfW: number,
  kerbW: number,
  railOffset: number,
  biome: TrackBiome,
  timeOfDay: TimeOfDay,
  weather: WeatherType,
  qualityTier: 'high' | 'medium' | 'low',
  textures: ProceduralTextureSet,
  levelTex: LevelRoadTextures
): THREE.Vector3[] {
  const sampleCount = samples.length;
  const lvl = spec.levelNumber;
  const dummy = new THREE.Object3D();
  const isNight = timeOfDay === 'night';

  // 5a. Level-Styled Guardrails (Glissières de sécurité)
  const isStraight = Boolean(spec.isStraight);
  const numSteps = isStraight ? sampleCount - 1 : sampleCount;
  const railPositions: number[] = [];
  const railNormals: number[] = [];
  const railUvs: number[] = [];
  const railIndices: number[] = [];

  for (let i = 0; i <= numSteps; i++) {
    const idx = Math.min(i, sampleCount - 1);
    const s = samples[idx];
    const roadY = s.point.y + 0.04;
    const leftRailX = s.point.x - s.normal.x * railOffset;
    const leftRailZ = s.point.z - s.normal.z * railOffset;
    const rightRailX = s.point.x + s.normal.x * railOffset;
    const rightRailZ = s.point.z + s.normal.z * railOffset;

    const rV = (i / numSteps) * (totalLength / 4.0);
    railPositions.push(
      leftRailX,
      roadY + 0.42,
      leftRailZ,
      leftRailX,
      roadY + 0.78,
      leftRailZ,
      rightRailX,
      roadY + 0.42,
      rightRailZ,
      rightRailX,
      roadY + 0.78,
      rightRailZ
    );
    railNormals.push(
      s.normal.x,
      0,
      s.normal.z,
      s.normal.x,
      0,
      s.normal.z,
      -s.normal.x,
      0,
      -s.normal.z,
      -s.normal.x,
      0,
      -s.normal.z
    );
    railUvs.push(rV, 1, rV, 0, rV, 1, rV, 0);

    if (i < numSteps) {
      const kBase = i * 4;
      railIndices.push(kBase, kBase + 1, kBase + 4, kBase + 1, kBase + 5, kBase + 4);
      railIndices.push(kBase + 2, kBase + 6, kBase + 3, kBase + 3, kBase + 6, kBase + 7);
    }
  }

  const railGeo = new THREE.BufferGeometry();
  railGeo.setAttribute('position', new THREE.Float32BufferAttribute(railPositions, 3));
  railGeo.setAttribute('normal', new THREE.Float32BufferAttribute(railNormals, 3));
  railGeo.setAttribute('uv', new THREE.Float32BufferAttribute(railUvs, 2));
  railGeo.setIndex(railIndices);

  const railColor =
    lvl === 2
      ? 0xb45309
      : lvl === 3
      ? 0xf97316
      : lvl === 4
      ? 0x38bdf8
      : lvl === 5
      ? 0xef4444
      : 0xcbd5e1;

  const railMat = new THREE.MeshStandardMaterial({
    map: textures.guardrailTexture,
    color: railColor,
    roughness: 0.36,
    metalness: 0.72,
    envMapIntensity: 0.65,
    side: THREE.DoubleSide,
  });
  const railMesh = new THREE.Mesh(railGeo, railMat);
  railMesh.receiveShadow = true;
  group.add(railMesh);

  // Guardrail Posts
  const postGeo = new THREE.BoxGeometry(0.12, 0.78, 0.12);
  postGeo.translate(0, 0.39, 0);
  const postStep = 3;
  const postCount = Math.floor(sampleCount / postStep) * 2;
  const railPostInst = new THREE.InstancedMesh(postGeo, railMat, postCount);
  let rpIdx = 0;
  for (let i = 0; i < sampleCount; i += postStep) {
    const s = samples[i];
    const baseAngle = Math.atan2(s.tangent.x, s.tangent.z);
    for (const side of [-1, 1]) {
      dummy.position.set(
        s.point.x + s.normal.x * side * railOffset,
        s.point.y,
        s.point.z + s.normal.z * side * railOffset
      );
      dummy.rotation.set(0, baseAngle, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      if (rpIdx < postCount) railPostInst.setMatrixAt(rpIdx++, dummy.matrix);
    }
  }
  railPostInst.instanceMatrix.needsUpdate = true;
  railPostInst.computeBoundingSphere();
  group.add(railPostInst);

  // 5b. Roadside Reflector Bollards with Level-Specific Glow Color
  const bollardOffset = halfW + kerbW + 0.45;
  const bollardStep = 4;
  const bollardCount = Math.floor(sampleCount / bollardStep) * 2;

  const bollardBodyGeo = new THREE.CylinderGeometry(0.07, 0.08, 0.92, 6);
  bollardBodyGeo.translate(0, 0.46, 0);
  const bollardRefGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.2, 6);
  bollardRefGeo.translate(0, 0.72, 0);

  const bollardBodyMat = new THREE.MeshStandardMaterial({
    color: lvl === 5 ? 0x1e293b : 0xf1f5f9,
    roughness: 0.55,
    metalness: 0.1,
  });
  const bollardGlowColor =
    lvl === 1
      ? 0x38bdf8
      : lvl === 2
      ? 0xfacc15
      : lvl === 3
      ? 0xf97316
      : lvl === 4
      ? 0x22d3ee
      : 0xef4444;

  const bollardRefMat = new THREE.MeshStandardMaterial({
    color: bollardGlowColor,
    emissive: bollardGlowColor,
    emissiveIntensity: isNight ? 2.6 : 1.1,
    roughness: 0.2,
  });

  const bollardBodyInst = new THREE.InstancedMesh(bollardBodyGeo, bollardBodyMat, bollardCount);
  const bollardRefInst = new THREE.InstancedMesh(bollardRefGeo, bollardRefMat, bollardCount);

  let bolIdx = 0;
  for (let i = 0; i < sampleCount; i += bollardStep) {
    const s = samples[i];
    const baseAngle = Math.atan2(s.tangent.x, s.tangent.z);
    for (const side of [-1, 1]) {
      dummy.position.set(
        s.point.x + s.normal.x * side * bollardOffset,
        s.point.y + 0.02,
        s.point.z + s.normal.z * side * bollardOffset
      );
      dummy.rotation.set(0, baseAngle, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      if (bolIdx < bollardCount) {
        bollardBodyInst.setMatrixAt(bolIdx, dummy.matrix);
        bollardRefInst.setMatrixAt(bolIdx, dummy.matrix);
        bolIdx++;
      }
    }
  }
  bollardBodyInst.instanceMatrix.needsUpdate = true;
  bollardRefInst.instanceMatrix.needsUpdate = true;
  bollardBodyInst.computeBoundingSphere();
  bollardRefInst.computeBoundingSphere();
  group.add(bollardBodyInst, bollardRefInst);

  // 5c. Curve Warning Chevron Signs (Panneaux de virage dans les courbes)
  const chevronPlacements: Array<{ x: number; y: number; z: number; rotY: number }> = [];
  for (let i = 0; i < sampleCount; i += 4) {
    const s = samples[i];
    if (Math.abs(s.curvature) > 0.0032) {
      const outsideSide = s.curvature > 0 ? -1 : 1;
      const signDist = railOffset + 0.65;
      const sx = s.point.x + s.normal.x * outsideSide * signDist;
      const sz = s.point.z + s.normal.z * outsideSide * signDist;
      const faceAngle = Math.atan2(-s.tangent.x, -s.tangent.z) + outsideSide * 0.35;
      chevronPlacements.push({ x: sx, y: s.point.y, z: sz, rotY: faceAngle });
    }
  }

  if (chevronPlacements.length > 0) {
    const signPostGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.85, 6);
    signPostGeo.translate(0, 0.92, 0);
    const signBoardGeo = new THREE.BoxGeometry(1.35, 0.72, 0.06);
    signBoardGeo.translate(0, 1.65, 0);

    const signBoardMat = new THREE.MeshStandardMaterial({
      map: textures.chevronSignTexture,
      emissive: 0xffffff,
      emissiveMap: textures.chevronSignTexture,
      emissiveIntensity: isNight ? 0.7 : 0.22,
      roughness: 0.3,
      metalness: 0.2,
    });

    const cPostInst = new THREE.InstancedMesh(signPostGeo, railMat, chevronPlacements.length);
    const cBoardInst = new THREE.InstancedMesh(signBoardGeo, signBoardMat, chevronPlacements.length);

    for (let i = 0; i < chevronPlacements.length; i++) {
      const cp = chevronPlacements[i];
      dummy.position.set(cp.x, cp.y, cp.z);
      dummy.rotation.set(0, cp.rotY, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      cPostInst.setMatrixAt(i, dummy.matrix);
      cBoardInst.setMatrixAt(i, dummy.matrix);
    }
    cPostInst.instanceMatrix.needsUpdate = true;
    cBoardInst.instanceMatrix.needsUpdate = true;
    cPostInst.computeBoundingSphere();
    cBoardInst.computeBoundingSphere();
    group.add(cPostInst, cBoardInst);
  }

  // 5d. Highway Streetlamps with Level-Tinted Bulbs & Luminous Halos
  const lampStep = qualityTier === 'low' ? 12 : 8;
  const lampIndices: number[] = [];
  for (let i = 2; i < sampleCount; i += lampStep) {
    lampIndices.push(i);
  }
  const lampCount = lampIndices.length * 2;

  const poleGeo = new THREE.CylinderGeometry(0.09, 0.15, 8.8, 8);
  poleGeo.translate(0, 4.4, 0);
  const armGeo = new THREE.BoxGeometry(2.8, 0.11, 0.11);
  armGeo.translate(1.3, 8.65, 0);
  const bulbGeo = new THREE.BoxGeometry(0.72, 0.12, 0.32);
  bulbGeo.translate(2.45, 8.56, 0);

  const poleMat = new THREE.MeshStandardMaterial({
    color: lvl === 5 ? 0x991b1b : lvl === 3 ? 0x7c2d12 : 0x64748b,
    metalness: 0.82,
    roughness: 0.28,
  });
  const bulbColor =
    lvl === 1
      ? 0xfef08a
      : lvl === 2
      ? 0xfde68a
      : lvl === 3
      ? 0xfb923c
      : lvl === 4
      ? 0x7dd3fc
      : 0xfca5a5;

  const bulbMat = new THREE.MeshStandardMaterial({
    color: bulbColor,
    emissive: bulbColor,
    emissiveIntensity: timeOfDay === 'afternoon' && weather === 'clear' ? 0.55 : 3.6,
  });

  const poleInst = new THREE.InstancedMesh(poleGeo, poleMat, lampCount);
  const armInst = new THREE.InstancedMesh(armGeo, poleMat, lampCount);
  const bulbInst = new THREE.InstancedMesh(bulbGeo, bulbMat, lampCount);

  const haloPositions: number[] = [];
  const lampLightPositions: THREE.Vector3[] = [];

  let lampIdx = 0;
  for (const sIdx of lampIndices) {
    const s = samples[sIdx];
    const baseAngle = Math.atan2(s.tangent.x, s.tangent.z);

    // Left roadside streetlamp
    const lx = s.point.x - s.normal.x * (railOffset + 0.45);
    const lz = s.point.z - s.normal.z * (railOffset + 0.45);
    dummy.position.set(lx, s.point.y, lz);
    dummy.rotation.set(0, baseAngle, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    poleInst.setMatrixAt(lampIdx, dummy.matrix);
    armInst.setMatrixAt(lampIdx, dummy.matrix);
    bulbInst.setMatrixAt(lampIdx, dummy.matrix);
    lampIdx++;

    const leftBulbX = lx + s.normal.x * 2.45;
    const leftBulbY = s.point.y + 8.45;
    const leftBulbZ = lz + s.normal.z * 2.45;
    haloPositions.push(leftBulbX, leftBulbY, leftBulbZ);
    lampLightPositions.push(new THREE.Vector3(leftBulbX, leftBulbY - 0.3, leftBulbZ));

    // Right roadside streetlamp
    const rx = s.point.x + s.normal.x * (railOffset + 0.45);
    const rz = s.point.z + s.normal.z * (railOffset + 0.45);
    dummy.position.set(rx, s.point.y, rz);
    dummy.rotation.set(0, baseAngle + Math.PI, 0);
    dummy.updateMatrix();
    poleInst.setMatrixAt(lampIdx, dummy.matrix);
    armInst.setMatrixAt(lampIdx, dummy.matrix);
    bulbInst.setMatrixAt(lampIdx, dummy.matrix);
    lampIdx++;

    const rightBulbX = rx - s.normal.x * 2.45;
    const rightBulbY = s.point.y + 8.45;
    const rightBulbZ = rz - s.normal.z * 2.45;
    haloPositions.push(rightBulbX, rightBulbY, rightBulbZ);
    lampLightPositions.push(new THREE.Vector3(rightBulbX, rightBulbY - 0.3, rightBulbZ));
  }

  poleInst.instanceMatrix.needsUpdate = true;
  armInst.instanceMatrix.needsUpdate = true;
  bulbInst.instanceMatrix.needsUpdate = true;
  poleInst.computeBoundingSphere();
  armInst.computeBoundingSphere();
  bulbInst.computeBoundingSphere();
  group.add(poleInst, armInst, bulbInst);

  // Subtle Circular Luminous Halo Sprites around Streetlamp Bulbs
  const haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute('position', new THREE.Float32BufferAttribute(haloPositions, 3));
  const haloMat = new THREE.PointsMaterial({
    map: textures.lampHaloTexture,
    color: bulbColor,
    size: isNight ? 2.1 : 1.3,
    sizeAttenuation: true,
    transparent: true,
    opacity: isNight ? 0.62 : 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: true,
  });
  const haloPoints = new THREE.Points(haloGeo, haloMat);
  haloPoints.frustumCulled = false;
  group.add(haloPoints);

  // 5e. Level-Specific Overhead Signage Gantries
  const buildGantry = (sampleIdx: number) => {
    const gs = samples[sampleIdx % sampleCount];
    const gAngle = Math.atan2(gs.tangent.x, gs.tangent.z);
    const frame = new THREE.Group();
    frame.position.copy(gs.point);
    frame.rotation.y = gAngle;

    const gantryWidth = halfW * 2 + 4.8;
    const gantryHeight = 10.8;
    const steelMat = new THREE.MeshStandardMaterial({
      color:
        lvl === 1
          ? 0x0284c7
          : lvl === 2
          ? 0x15803d
          : lvl === 3
          ? 0xc2410c
          : lvl === 4
          ? 0x0e7490
          : 0xb91c1c,
      roughness: 0.38,
      metalness: 0.78,
    });

    for (const side of [-1, 1]) {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.38, gantryHeight, 8),
        steelMat
      );
      col.position.set(side * (halfW + 2.0), gantryHeight / 2 - 0.4, 0);
      frame.add(col);
    }

    const beam = new THREE.Mesh(new THREE.BoxGeometry(gantryWidth, 0.85, 0.85), steelMat);
    beam.position.set(0, gantryHeight - 1.1, 0);
    frame.add(beam);

    const signMat = new THREE.MeshBasicMaterial({ map: levelTex.gantryMap });
    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(14.2, 3.4, 0.28), signMat);
    signBoard.position.set(0, gantryHeight - 2.4, 0.45);
    frame.add(signBoard);

    group.add(frame);
  };

  buildGantry(10);
  buildGantry(Math.floor(sampleCount * 0.5));
  if (isStraight) {
    buildGantry(sampleCount - 15);
  }

  // 5f. UNIQUE LEVEL ARCHITECTURAL LANDMARKS ALONG THE ROAD
  if (lvl === 1) {
    // Level 1: Illuminated Cyan Highway Suspension Arches
    const archMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.5,
      roughness: 0.25,
      metalness: 0.7,
    });
    for (let i = 45; i < sampleCount; i += 55) {
      const s = samples[i];
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(halfW + 3.2, 0.38, 8, 24, Math.PI),
        archMat
      );
      arch.position.copy(s.point);
      arch.rotation.y = Math.atan2(s.tangent.x, s.tangent.z);
      group.add(arch);
    }
  } else if (lvl === 2) {
    // Level 2: Dawn Valley Scenic Timber-Gold Portal Gates & Windmills
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x92400e,
      roughness: 0.75,
      metalness: 0.15,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.8,
    });
    for (let i = 35; i < sampleCount; i += 48) {
      const s = samples[i];
      const gate = new THREE.Group();
      gate.position.copy(s.point);
      gate.rotation.y = Math.atan2(s.tangent.x, s.tangent.z);
      for (const side of [-1, 1]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.85, 8.5, 0.85), woodMat);
        pillar.position.set(side * (halfW + 3.0), 4.2, 0);
        gate.add(pillar);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.6, 1.3), goldMat);
        cap.position.set(side * (halfW + 3.0), 8.6, 0);
        gate.add(cap);
      }
      group.add(gate);
    }
  } else if (lvl === 3) {
    // Level 3: Towering Red-Rock Canyon Monoliths & Fog Warning Towers along the Switchbacks
    const rockPillarMat = new THREE.MeshStandardMaterial({
      map: textures.mountainRockTexture,
      color: 0x9a3412,
      roughness: 0.92,
      metalness: 0.05,
    });
    const fogBeaconMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xf97316,
      emissiveIntensity: 2.8,
    });
    for (let i = 20; i < sampleCount; i += 22) {
      const s = samples[i];
      const side = i % 44 === 20 ? 1 : -1;
      const dist = halfW + 7.5 + (i % 7);
      const h = 14 + (i % 5) * 4.5;
      const monolith = new THREE.Mesh(
        new THREE.ConeGeometry(3.8 + (i % 3), h, 6),
        rockPillarMat
      );
      monolith.position.set(
        s.point.x + s.normal.x * side * dist,
        s.point.y + h * 0.42,
        s.point.z + s.normal.z * side * dist
      );
      monolith.rotation.y = i * 0.7;
      group.add(monolith);

      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), fogBeaconMat);
      beacon.position.set(
        s.point.x - s.normal.x * side * (railOffset + 0.8),
        s.point.y + 2.2,
        s.point.z - s.normal.z * side * (railOffset + 0.8)
      );
      group.add(beacon);
    }
  } else if (lvl === 4) {
    // Level 4: Shimmering Coastal Ocean Bay + Neon Cyan Viaduct Arches
    const waterGeo = new THREE.PlaneGeometry(1600, 1600);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x082f49,
      emissive: 0x0369a1,
      emissiveIntensity: 0.28,
      roughness: 0.18,
      metalness: 0.82,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.set(-220, -1.6, -20);
    group.add(waterMesh);

    const viaductMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x0891b2,
      emissiveIntensity: 1.9,
      roughness: 0.2,
      metalness: 0.8,
    });
    for (let i = 28; i < sampleCount; i += 36) {
      const s = samples[i];
      const frame = new THREE.Group();
      frame.position.copy(s.point);
      frame.rotation.y = Math.atan2(s.tangent.x, s.tangent.z);
      const rib = new THREE.Mesh(
        new THREE.TorusGeometry(halfW + 2.4, 0.32, 8, 20, Math.PI),
        viaductMat
      );
      frame.add(rib);
      group.add(frame);
    }
  } else if (lvl === 5) {
    // Level 5: Grand Prix Crimson & Gold Illuminated Racing Portals over Hairpins & Straights
    const gpRedMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 2.2,
      roughness: 0.25,
      metalness: 0.75,
    });
    const gpGoldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xeab308,
      emissiveIntensity: 2.0,
      roughness: 0.25,
      metalness: 0.8,
    });
    for (let i = 24; i < sampleCount; i += 32) {
      const s = samples[i];
      const portal = new THREE.Group();
      portal.position.copy(s.point);
      portal.rotation.y = Math.atan2(s.tangent.x, s.tangent.z);
      const mat = (i / 32) % 2 === 0 ? gpRedMat : gpGoldMat;
      const topBar = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 5.2, 0.55, 0.65), mat);
      topBar.position.set(0, 7.6, 0);
      portal.add(topBar);
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.55, 7.8, 0.65), mat);
        leg.position.set(side * (halfW + 2.35), 3.8, 0);
        portal.add(leg);
      }
      group.add(portal);
    }
  }

  return lampLightPositions;
}

// ============================================================================
// 6. VARIED PINES & FOLIAGE BUSHES VIA INSTANCEDMESH (createTrees)
// ============================================================================
function createTaperedBarkTrunkGeometry(): THREE.BufferGeometry {
  const radialSegs = 7;
  const parts: Array<{ rBot: number; rTop: number; len: number; rotX: number; rotZ: number; tx: number; ty: number; tz: number }> = [
    { rBot: 0.32, rTop: 0.14, len: 4.5, rotX: 0.02, rotZ: -0.02, tx: 0, ty: 0, tz: 0 },
    { rBot: 0.14, rTop: 0.06, len: 2.1, rotX: 0.28, rotZ: 0.48, tx: -0.05, ty: 2.5, tz: 0.04 },
    { rBot: 0.13, rTop: 0.05, len: 2.0, rotX: -0.3, rotZ: -0.45, tx: 0.05, ty: 2.8, tz: -0.04 },
  ];

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  const mat4 = new THREE.Matrix4();
  const normalMat = new THREE.Matrix3();
  const euler = new THREE.Euler();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const trans = new THREE.Vector3();
  const v = new THREE.Vector3();

  for (const p of parts) {
    const cyl = new THREE.CylinderGeometry(p.rTop, p.rBot, p.len, radialSegs, 2, false);
    cyl.translate(0, p.len / 2, 0);

    euler.set(p.rotX, 0, p.rotZ);
    quat.setFromEuler(euler);
    trans.set(p.tx, p.ty, p.tz);
    mat4.compose(trans, quat, scale);
    normalMat.getNormalMatrix(mat4);

    const posAttr = cyl.attributes.position;
    const normAttr = cyl.attributes.normal;
    const uvAttr = cyl.attributes.uv;
    const idxAttr = cyl.getIndex()!;

    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i).applyMatrix4(mat4);
      positions.push(v.x, v.y, v.z);
      v.fromBufferAttribute(normAttr, i).applyMatrix3(normalMat).normalize();
      normals.push(v.x, v.y, v.z);
      uvs.push(uvAttr.getX(i), uvAttr.getY(i) * 2);
    }
    for (let i = 0; i < idxAttr.count; i++) {
      indices.push(idxAttr.getX(i) + vertexOffset);
    }
    vertexOffset += posAttr.count;
    cyl.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  merged.setIndex(indices);
  return merged;
}

function createMultiTieredPineFoliageGeometry(): THREE.BufferGeometry {
  // Multi-tiered conical pine boughs with serrated silhouette + crossed foliage cards (zero cylindrical look!)
  const tiers = [
    { y: 1.4, rBot: 2.7, rTop: 0.7, h: 2.3 },
    { y: 2.9, rBot: 2.25, rTop: 0.55, h: 2.1 },
    { y: 4.3, rBot: 1.75, rTop: 0.4, h: 1.9 },
    { y: 5.5, rBot: 1.25, rTop: 0.18, h: 1.7 },
    { y: 6.6, rBot: 0.75, rTop: 0.04, h: 1.4 },
  ];

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  for (let tIdx = 0; tIdx < tiers.length; tIdx++) {
    const tier = tiers[tIdx];
    const radialSegs = 9;
    const cone = new THREE.CylinderGeometry(tier.rTop, tier.rBot, tier.h, radialSegs, 2, false);
    cone.translate(0, tier.y + tier.h / 2, 0);

    const posAttr = cone.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const vz = posAttr.getZ(i);
      const angle = Math.atan2(vz, vx);
      // Natural branch droop & serrated bough tips
      const branchFlare = 1.0 + Math.sin(angle * 5 + tIdx * 1.4) * 0.16;
      const tipDroop = Math.hypot(vx, vz) > tier.rBot * 0.6 ? -0.22 * Math.cos(angle * 5) : 0;
      posAttr.setXYZ(i, vx * branchFlare, vy + tipDroop, vz * branchFlare);
    }
    cone.computeVertexNormals();

    const normAttr = cone.attributes.normal;
    const uvAttr = cone.attributes.uv;
    const idxAttr = cone.getIndex()!;

    for (let i = 0; i < posAttr.count; i++) {
      positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      normals.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
      uvs.push(uvAttr.getX(i), uvAttr.getY(i));
    }
    for (let i = 0; i < idxAttr.count; i++) {
      indices.push(idxAttr.getX(i) + vertexOffset);
    }
    vertexOffset += posAttr.count;
    cone.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  merged.setIndex(indices);
  return merged;
}

function createFoliageBushGeometry(): THREE.BufferGeometry {
  // Composite multi-lobe organic foliage bush (5 overlapping organic domes + crossed leaf cards)
  const lobes = [
    { x: 0.0, y: 0.65, z: 0.0, rx: 1.25, ry: 0.85, rz: 1.2 },
    { x: -0.75, y: 0.5, z: 0.35, rx: 0.95, ry: 0.68, rz: 0.9 },
    { x: 0.78, y: 0.52, z: -0.3, rx: 0.98, ry: 0.7, rz: 0.92 },
    { x: 0.25, y: 0.48, z: 0.75, rx: 0.88, ry: 0.62, rz: 0.85 },
    { x: -0.3, y: 0.46, z: -0.72, rx: 0.85, ry: 0.6, rz: 0.85 },
  ];

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  for (const l of lobes) {
    const ico = new THREE.IcosahedronGeometry(1.0, 1);
    const posAttr = ico.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i) * l.rx + l.x;
      const vy = Math.max(0.05, posAttr.getY(i) * l.ry + l.y);
      const vz = posAttr.getZ(i) * l.rz + l.z;
      posAttr.setXYZ(i, vx, vy, vz);
    }
    ico.computeVertexNormals();

    const normAttr = ico.attributes.normal;
    const uvAttr = ico.attributes.uv;
    const idxAttr = ico.getIndex();

    for (let i = 0; i < posAttr.count; i++) {
      positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      normals.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
      uvs.push(uvAttr.getX(i), uvAttr.getY(i));
    }
    if (idxAttr) {
      for (let i = 0; i < idxAttr.count; i++) {
        indices.push(idxAttr.getX(i) + vertexOffset);
      }
      vertexOffset += posAttr.count;
    }
    ico.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (indices.length > 0) merged.setIndex(indices);
  return merged;
}

export function createTrees(
  group: THREE.Group,
  samples: TrackSample[],
  getClosestSample: BuiltTrack['getClosestSample'],
  outerShoulderOffset: number,
  biome: TrackBiome,
  isNight: boolean,
  isSnowy: boolean,
  qualityTier: 'high' | 'medium' | 'low',
  textures: ProceduralTextureSet
): void {
  const dummy = new THREE.Object3D();
  const pineCountTarget = qualityTier === 'low' ? 95 : qualityTier === 'medium' ? 160 : 260;
  const bushCountTarget = qualityTier === 'low' ? 85 : qualityTier === 'medium' ? 140 : 240;

  const pineTransforms: Array<{ x: number; y: number; z: number; sx: number; sy: number; rot: number; tint: THREE.Color }> = [];
  const bushTransforms: Array<{ x: number; y: number; z: number; sx: number; sy: number; rot: number; tint: THREE.Color }> = [];

  const getPineTint = (seed: number) => {
    if (isSnowy) {
      return new THREE.Color(0x94a3b8).offsetHSL(0, 0, (seed % 3) * 0.04);
    }
    return new THREE.Color().setHSL(
      0.34 + (seed % 5) * 0.012,
      0.42,
      (isNight ? 0.36 : 0.48) + (seed % 4) * 0.05
    );
  };

  const getBushTint = (seed: number) => {
    return new THREE.Color().setHSL(
      0.29 + (seed % 6) * 0.015,
      0.46,
      (isNight ? 0.34 : 0.46) + (seed % 4) * 0.06
    );
  };

  // Place varied Pine Trees outside the track shoulders
  for (let attempt = 0; attempt < pineCountTarget * 4 && pineTransforms.length < pineCountTarget; attempt++) {
    const s = samples[(attempt * 7) % samples.length];
    const side = attempt % 2 === 0 ? 1 : -1;
    const distFromRoad = outerShoulderOffset + 4.5 + ((attempt * 13) % 115);
    const jitterX = (hash2D(attempt, 1) - 0.5) * 18;
    const jitterZ = (hash2D(attempt, 2) - 0.5) * 18;
    const tx = s.point.x + s.normal.x * side * distFromRoad + jitterX;
    const tz = s.point.z + s.normal.z * side * distFromRoad + jitterZ;

    const closest = getClosestSample(tx, tz);
    if (Math.abs(closest.signedLateralDist) < outerShoulderOffset + 3.5) continue;

    const ty = Math.abs(closest.signedLateralDist) < outerShoulderOffset + 12 ? closest.sample.point.y - 0.5 : -2.6;
    const sx = 0.8 + hash2D(attempt, 3) * 0.85;
    const sy = sx * (0.9 + hash2D(attempt, 4) * 0.45);
    const rot = hash2D(attempt, 5) * Math.PI * 2;
    pineTransforms.push({ x: tx, y: ty, z: tz, sx, sy, rot, tint: getPineTint(attempt) });
  }

  // Place varied Foliage Bushes along the grass verge & forest edge
  for (let attempt = 0; attempt < bushCountTarget * 4 && bushTransforms.length < bushCountTarget; attempt++) {
    const s = samples[(attempt * 5) % samples.length];
    const side = attempt % 2 === 0 ? -1 : 1;
    const distFromRoad = outerShoulderOffset - 2.5 + ((attempt * 11) % 68);
    const jitterX = (hash2D(attempt + 500, 1) - 0.5) * 12;
    const jitterZ = (hash2D(attempt + 500, 2) - 0.5) * 12;
    const bx = s.point.x + s.normal.x * side * distFromRoad + jitterX;
    const bz = s.point.z + s.normal.z * side * distFromRoad + jitterZ;

    const closest = getClosestSample(bx, bz);
    if (Math.abs(closest.signedLateralDist) < outerShoulderOffset - 3.2) continue;

    const by = Math.abs(closest.signedLateralDist) < outerShoulderOffset + 8 ? closest.sample.point.y - 0.45 : -2.5;
    const sx = 0.75 + hash2D(attempt + 500, 3) * 1.15;
    const sy = 0.65 + hash2D(attempt + 500, 4) * 0.85;
    const rot = hash2D(attempt + 500, 5) * Math.PI * 2;
    bushTransforms.push({ x: bx, y: by, z: bz, sx, sy, rot, tint: getBushTint(attempt) });
  }

  const trunkGeo = createTaperedBarkTrunkGeometry();
  const trunkMat = new THREE.MeshStandardMaterial({
    map: textures.barkTexture,
    roughness: 0.94,
    metalness: 0.02,
    envMapIntensity: 0.2,
  });

  if (pineTransforms.length > 0) {
    const pCount = pineTransforms.length;
    const pineFoliageGeo = createMultiTieredPineFoliageGeometry();
    const pineMat = new THREE.MeshStandardMaterial({
      map: textures.pineBoughTexture,
      roughness: 0.84,
      metalness: 0.02,
      envMapIntensity: 0.28,
    });

    const pineTrunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, pCount);
    const pineFoliageInst = new THREE.InstancedMesh(pineFoliageGeo, pineMat, pCount);

    pineTrunkInst.castShadow = qualityTier === 'high';
    pineFoliageInst.castShadow = qualityTier === 'high';
    pineFoliageInst.receiveShadow = true;

    for (let i = 0; i < pCount; i++) {
      const tr = pineTransforms[i];
      dummy.position.set(tr.x, tr.y, tr.z);
      dummy.rotation.set(0, tr.rot, 0);
      dummy.scale.set(tr.sx, tr.sy, tr.sx);
      dummy.updateMatrix();
      pineTrunkInst.setMatrixAt(i, dummy.matrix);
      pineFoliageInst.setMatrixAt(i, dummy.matrix);
      pineFoliageInst.setColorAt(i, tr.tint);
    }

    pineTrunkInst.instanceMatrix.needsUpdate = true;
    pineFoliageInst.instanceMatrix.needsUpdate = true;
    if (pineFoliageInst.instanceColor) pineFoliageInst.instanceColor.needsUpdate = true;
    pineTrunkInst.computeBoundingSphere();
    pineFoliageInst.computeBoundingSphere();
    group.add(pineTrunkInst, pineFoliageInst);
  }

  if (bushTransforms.length > 0) {
    const bCount = bushTransforms.length;
    const bushGeo = createFoliageBushGeometry();
    const bushMat = new THREE.MeshStandardMaterial({
      map: textures.leafCanopyTexture,
      roughness: 0.86,
      metalness: 0.02,
      envMapIntensity: 0.25,
    });

    const bushInst = new THREE.InstancedMesh(bushGeo, bushMat, bCount);
    bushInst.castShadow = false;
    bushInst.receiveShadow = true;

    for (let i = 0; i < bCount; i++) {
      const b = bushTransforms[i];
      dummy.position.set(b.x, b.y, b.z);
      dummy.rotation.set(0, b.rot, 0);
      dummy.scale.set(b.sx, b.sy, b.sx);
      dummy.updateMatrix();
      bushInst.setMatrixAt(i, dummy.matrix);
      bushInst.setColorAt(i, b.tint);
    }

    bushInst.instanceMatrix.needsUpdate = true;
    if (bushInst.instanceColor) bushInst.instanceColor.needsUpdate = true;
    bushInst.computeBoundingSphere();
    group.add(bushInst);
  }
}

// ============================================================================
// 7. MAIN ENTRY POINT: buildTrackEnvironment
// ============================================================================
export function buildTrackEnvironment(
  spec: TrackSpec,
  timeOfDay: TimeOfDay,
  textures: ProceduralTextureSet,
  qualityTier: 'high' | 'medium' | 'low',
  weather: WeatherType = 'clear'
): BuiltTrack {
  const group = new THREE.Group();
  const biome: TrackBiome = spec.biome || 'alpine';
  const isNight = timeOfDay === 'night';
  const isSnowy = biome === 'snow' || weather === 'snow';
  const isRainy = weather === 'rain';

  // Generate Level-Specific Road, Markings, Curbs & Gantry Textures with Max Anisotropy
  const levelTex = createLevelRoadTextures(spec, textures.roadTexture.anisotropy || 16);

  // 1. Sky Dome & Starfield (createSky) - follows camera in render loop
  const skyGroup = createSky(group, timeOfDay, biome, weather, textures);

  // 2. 3D CatmullRomCurve3 & Curvature Computation (Straight highway or loop)
  const isStraight = Boolean(spec.isStraight);
  const controlPoints = spec.waypoints.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(controlPoints, !isStraight, 'centripetal', 0.25);
  const totalLength = curve.getLength();

  // High-density sampling (640 samples) produces ultra-smooth ribbon geometry with zero angular faceting
  const sampleCount = 640;
  const samples: TrackSample[] = [];
  const minimapPoints: Array<{ x: number; z: number }> = [];

  for (let i = 0; i < sampleCount; i++) {
    const t = isStraight ? i / (sampleCount - 1) : i / sampleCount;
    const tPrev = ((i - 3 + sampleCount) % sampleCount) / sampleCount;
    const tNext = ((i + 3) % sampleCount) / sampleCount;
    const point = curve.getPointAt(t);
    const tangent = isStraight
      ? new THREE.Vector3(0, 0, -1)
      : curve.getTangentAt(t).normalize();
    const tangPrev = isStraight ? tangent : curve.getTangentAt(tPrev);
    const tangNext = isStraight ? tangent : curve.getTangentAt(tNext);
    const curvature = isStraight ? 0 : tangNext.x * tangPrev.z - tangNext.z * tangPrev.x;

    const normal = isStraight
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    samples.push({ point, tangent, normal, pitch: 0, curvature, t });
    if (i % 8 === 0) {
      minimapPoints.push({ x: point.x, z: point.z });
    }
  }

  // Multi-pass wide Gaussian elevation filter (16 passes, 9-point kernel) guarantees ultra-planar, ripple-free road surface
  const kernel9 = [0.02, 0.06, 0.12, 0.2, 0.2, 0.2, 0.12, 0.06, 0.02];
  for (let pass = 0; pass < 16; pass++) {
    const smoothedY = new Float32Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      let sum = 0;
      for (let k = -4; k <= 4; k++) {
        const idx = (i + k + sampleCount) % sampleCount;
        sum += samples[idx].point.y * kernel9[k + 4];
      }
      smoothedY[i] = sum;
    }
    for (let i = 0; i < sampleCount; i++) {
      samples[i].point.y = smoothedY[i];
    }
  }

  // Compute gentle, rock-steady longitudinal pitch from smoothed elevation (~14m baseline)
  for (let i = 0; i < sampleCount; i++) {
    const prevS = samples[(i - 6 + sampleCount) % sampleCount];
    const nextS = samples[(i + 6) % sampleCount];
    const dx = nextS.point.x - prevS.point.x;
    const dy = nextS.point.y - prevS.point.y;
    const dz = nextS.point.z - prevS.point.z;
    const horizDist = Math.max(0.001, Math.hypot(dx, dz));
    samples[i].pitch = THREE.MathUtils.clamp(Math.atan2(dy, horizDist), -0.045, 0.045);
  }

  // Smooth pitch across adjacent samples (8 passes) so cars never rock or pitch abruptly
  for (let pass = 0; pass < 8; pass++) {
    const smoothedPitch = new Float32Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      const pm2 = samples[(i - 2 + sampleCount) % sampleCount].pitch;
      const pm1 = samples[(i - 1 + sampleCount) % sampleCount].pitch;
      const p0 = samples[i].pitch;
      const pp1 = samples[(i + 1) % sampleCount].pitch;
      const pp2 = samples[(i + 2) % sampleCount].pitch;
      smoothedPitch[i] = pm2 * 0.1 + pm1 * 0.25 + p0 * 0.3 + pp1 * 0.25 + pp2 * 0.1;
    }
    for (let i = 0; i < sampleCount; i++) {
      samples[i].pitch = smoothedPitch[i];
    }
  }

  // Reusable interpolated sample for zero-GC continuous lookup
  const interpPoint = new THREE.Vector3();
  const interpTangent = new THREE.Vector3();
  const interpNormal = new THREE.Vector3();
  const interpSample: TrackSample = {
    point: interpPoint,
    tangent: interpTangent,
    normal: interpNormal,
    pitch: 0,
    curvature: 0,
    t: 0,
  };

  const tInterpPoint = new THREE.Vector3();
  const tInterpTangent = new THREE.Vector3();
  const tInterpNormal = new THREE.Vector3();
  const tInterpSample: TrackSample = {
    point: tInterpPoint,
    tangent: tInterpTangent,
    normal: tInterpNormal,
    pitch: 0,
    curvature: 0,
    t: 0,
  };

  const getSampleAtT = (rawT: number): TrackSample => {
    if (isStraight) {
      const normT = THREE.MathUtils.clamp(rawT, 0, 1);
      const exactIdx = normT * (sampleCount - 1);
      const idx0 = Math.min(sampleCount - 1, Math.floor(exactIdx));
      const idx1 = Math.min(sampleCount - 1, idx0 + 1);
      const alpha = exactIdx - Math.floor(exactIdx);
      const s0 = samples[idx0];
      const s1 = samples[idx1];

      tInterpPoint.lerpVectors(s0.point, s1.point, alpha);
      tInterpTangent.set(0, 0, -1);
      tInterpNormal.set(1, 0, 0);
      tInterpSample.pitch = 0;
      tInterpSample.curvature = 0;
      tInterpSample.t = normT;
      return tInterpSample;
    }

    const normT = ((rawT % 1) + 1) % 1;
    const exactIdx = normT * sampleCount;
    const idx0 = Math.floor(exactIdx) % sampleCount;
    const idx1 = (idx0 + 1) % sampleCount;
    const alpha = exactIdx - Math.floor(exactIdx);
    const s0 = samples[idx0];
    const s1 = samples[idx1];

    tInterpPoint.lerpVectors(s0.point, s1.point, alpha);
    tInterpTangent.lerpVectors(s0.tangent, s1.tangent, alpha).normalize();
    tInterpNormal.lerpVectors(s0.normal, s1.normal, alpha).normalize();
    tInterpSample.pitch = THREE.MathUtils.lerp(s0.pitch, s1.pitch, alpha);
    tInterpSample.curvature = THREE.MathUtils.lerp(s0.curvature, s1.curvature, alpha);
    tInterpSample.t = normT;
    return tInterpSample;
  };

  const getClosestSample = (x: number, z: number) => {
    if (isStraight) {
      const startZ = samples[0].point.z;
      const endZ = samples[sampleCount - 1].point.z;
      const lengthZ = startZ - endZ;
      const clampedZ = THREE.MathUtils.clamp(z, endZ, startZ);
      const t = lengthZ > 0.001 ? (startZ - clampedZ) / lengthZ : 0;
      const exactIdx = t * (sampleCount - 1);
      const idx0 = Math.min(sampleCount - 1, Math.floor(exactIdx));
      const idx1 = Math.min(sampleCount - 1, idx0 + 1);
      const alpha = exactIdx - Math.floor(exactIdx);

      const s0 = samples[idx0];
      const s1 = samples[idx1];
      interpPoint.lerpVectors(s0.point, s1.point, alpha);
      interpTangent.set(0, 0, -1);
      interpNormal.set(1, 0, 0);
      interpSample.pitch = 0;
      interpSample.curvature = 0;
      interpSample.t = t;

      const dx = x - interpPoint.x;
      const dz = z - interpPoint.z;
      const distSq = dx * dx + dz * dz;

      return {
        sample: interpSample,
        distSq,
        signedLateralDist: dx,
        index: idx0,
      };
    }

    let coarseIdx = 0;
    let bestDistSq = Infinity;
    const coarseStep = 16;
    for (let i = 0; i < sampleCount; i += coarseStep) {
      const dx = x - samples[i].point.x;
      const dz = z - samples[i].point.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        coarseIdx = i;
      }
    }
    let bestIdx = coarseIdx;
    for (let offset = -coarseStep; offset <= coarseStep; offset++) {
      const idx = (coarseIdx + offset + sampleCount) % sampleCount;
      const dx = x - samples[idx].point.x;
      const dz = z - samples[idx].point.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = idx;
      }
    }
    const s0 = samples[bestIdx];
    const dx0 = x - s0.point.x;
    const dz0 = z - s0.point.z;
    const projAlong = dx0 * s0.tangent.x + dz0 * s0.tangent.z;
    const neighborIdx =
      projAlong >= 0 ? (bestIdx + 1) % sampleCount : (bestIdx - 1 + sampleCount) % sampleCount;
    const s1 = samples[neighborIdx];
    const segDx = s1.point.x - s0.point.x;
    const segDz = s1.point.z - s0.point.z;
    const segLenSq = segDx * segDx + segDz * segDz;
    const alpha =
      segLenSq > 0.0001
        ? THREE.MathUtils.clamp((dx0 * segDx + dz0 * segDz) / segLenSq, 0, 1)
        : 0;

    interpPoint.lerpVectors(s0.point, s1.point, alpha);
    interpTangent.lerpVectors(s0.tangent, s1.tangent, alpha).normalize();
    interpNormal.lerpVectors(s0.normal, s1.normal, alpha).normalize();
    interpSample.pitch = THREE.MathUtils.lerp(s0.pitch, s1.pitch, alpha);
    interpSample.curvature = THREE.MathUtils.lerp(s0.curvature, s1.curvature, alpha);

    let tDiff = s1.t - s0.t;
    if (tDiff > 0.5) tDiff -= 1;
    if (tDiff < -0.5) tDiff += 1;
    interpSample.t = (s0.t + tDiff * alpha + 1) % 1;

    const dx = x - interpPoint.x;
    const dz = z - interpPoint.z;
    const signedLateralDist = dx * interpNormal.x + dz * interpNormal.z;
    return { sample: interpSample, distSq: bestDistSq, signedLateralDist, index: bestIdx };
  };

  // 3. Valley Floor Ground Plane
  const groundGeo = new THREE.PlaneGeometry(isStraight ? 3800 : 2800, isStraight ? 3800 : 2800);
  const groundMat = new THREE.MeshStandardMaterial({
    map: isSnowy ? textures.mountainRockTexture : textures.grassGroundTexture,
    color:
      spec.levelNumber === 3
        ? 0x3b1d0e
        : spec.levelNumber === 2
        ? 0x263e1d
        : spec.levelNumber === 4
        ? 0x081c24
        : isNight
        ? 0x0b1512
        : isSnowy
        ? 0x64748b
        : 0x263e1d,
    roughness: 0.95,
    metalness: 0.0,
    envMapIntensity: 0.05,
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.set(0, -2.6, isStraight ? -1250 : 0);
  groundMesh.receiveShadow = true;
  group.add(groundMesh);

  // 4. Level-Specific Asphalt Track, Markings, Curbs, Gravel & Grass (createTrack)
  const { halfW, kerbW, railOffset, outerShoulderOffset } = createTrack(
    group,
    spec,
    samples,
    totalLength,
    biome,
    isNight,
    isRainy,
    isSnowy,
    textures,
    levelTex
  );

  // 5. Multi-Octave Simplex/Perlin Mountains with Level Seed & Altitude Coloring (createMountains)
  createMountains(group, spec, getClosestSample, biome, isNight, isSnowy, textures);

  // 6. Guardrails, Curve Chevron Signs, Bollards, Streetlamps & Unique Landmarks (createRoadsideProps)
  const lampLightPositions = createRoadsideProps(
    group,
    spec,
    samples,
    totalLength,
    halfW,
    kerbW,
    railOffset,
    biome,
    timeOfDay,
    weather,
    qualityTier,
    textures,
    levelTex
  );

  // 7. Varied Pine Trees & Foliage Bushes via InstancedMesh (createTrees)
  createTrees(
    group,
    samples,
    getClosestSample,
    outerShoulderOffset,
    biome,
    isNight,
    isSnowy,
    qualityTier,
    textures
  );

  // 8. Interactive Exploration Beacons
  const beacons: DiscoveryBeacon[] = [];
  const beaconCount = 8;
  const ringGeo = new THREE.TorusGeometry(2.2, 0.18, 12, 28);
  const coreGeo = new THREE.OctahedronGeometry(0.95, 0);

  for (let b = 0; b < beaconCount; b++) {
    const sampleIdx = Math.floor(((b + 0.5) / beaconCount) * sampleCount) % sampleCount;
    const s = samples[sampleIdx];
    const sideOffset = (b % 2 === 0 ? 1 : -1) * (halfW * 0.45);
    const pos = new THREE.Vector3(
      s.point.x + s.normal.x * sideOffset,
      s.point.y,
      s.point.z + s.normal.z * sideOffset
    );

    const bGroup = new THREE.Group();
    bGroup.position.copy(pos);

    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 2.2,
      roughness: 0.2,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = 2.4;

    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.0,
      roughness: 0.15,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.y = 2.4;

    bGroup.add(ringMesh, coreMesh);
    group.add(bGroup);

    beacons.push({
      id: b,
      label: DISCOVERY_LABELS[b % DISCOVERY_LABELS.length],
      position: pos,
      mesh: bGroup,
      collected: false,
    });
  }

  const updateBeacons = (elapsedTime: number) => {
    for (const b of beacons) {
      if (b.collected) {
        b.mesh.visible = false;
      } else {
        b.mesh.visible = true;
        b.mesh.rotation.y = elapsedTime * 1.8 + b.id;
        b.mesh.position.y = b.position.y + Math.sin(elapsedTime * 3 + b.id) * 0.25;
      }
    }
  };

  const dispose = () => {
    levelTex.dispose();
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh || (obj as THREE.Points).isPoints) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else {
          m.material?.dispose();
        }
      }
    });
  };

  return {
    group,
    skyGroup,
    curve,
    samples,
    roadWidth: spec.roadWidth,
    totalLength,
    minimapPoints,
    beacons,
    lampLightPositions,
    getSampleAtT,
    getClosestSample,
    updateBeacons,
    dispose,
  };
}
