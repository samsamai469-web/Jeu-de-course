import * as THREE from 'three';
import { CarCustomization, CarSpec } from '../types/game';

export interface CarRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  mainBodyMesh: THREE.Mesh;
  frontBumper: THREE.Group;
  rearBumper: THREE.Group;
  leftMirror: THREE.Group;
  rightMirror: THREE.Group;
  frontLeftPivot: THREE.Group;
  frontRightPivot: THREE.Group;
  wheelAssemblies: THREE.Group[]; // For vertical suspension travel
  wheels: THREE.Object3D[]; // For rotational spin
  steeringWheel: THREE.Group;
  bodyMaterial: THREE.MeshPhysicalMaterial;
  rimMaterial: THREE.MeshStandardMaterial;
  brakeLightMaterial: THREE.MeshStandardMaterial;
  reverseLightMaterial: THREE.MeshStandardMaterial;
  turnSignalMaterial: THREE.MeshStandardMaterial;
  brakeHaloMaterial: THREE.SpriteMaterial;
  brakeHaloSprites: THREE.Sprite[];
  tailTrailMaterial: THREE.MeshBasicMaterial;
  tailTrailMeshes: THREE.Mesh[];
  wheelBlurMaterial: THREE.MeshBasicMaterial;
  headlightMaterial: THREE.MeshStandardMaterial;
  headlightSpots: THREE.SpotLight[];
  headlightBeams: THREE.Mesh[];
  underglowLight: THREE.PointLight;
  underglowMesh: THREE.Mesh;
}

interface StationDims {
  z: number;
  halfW: number;
  rockerW: number;
  shoulderY: number;
  hoodCenterY: number;
  archCutY: number;
  beltCrease: number;
}

/**
 * Generates an authentic, CAD-sculpted automotive body shell with:
 * - Wide sculpted front bumper & hood (never pinches to a torpedo point)
 * - Sharp fender creases, coke-bottle door sculpting, and flared wheel arches
 * - Recessed wheel well arches that wrap tightly around the front & rear tires
 * - Flat aerodynamic underbody floor
 */
function createSculptedCarBodyGeometry(style: CarSpec['bodyStyle']): THREE.BufferGeometry {
  const isHyper = style === 'hyper';
  const isMuscle = style === 'muscle';
  const isStreet = style === 'street';

  const wScale = isMuscle ? 1.07 : isHyper ? 1.05 : isStreet ? 0.98 : 1.02;
  const hScale = isHyper ? 0.91 : isMuscle ? 1.04 : isStreet ? 1.05 : 0.98;

  const zStations = [
    -2.34, -2.30, -2.20, -2.04, -1.84, -1.66, -1.50, -1.35, -1.20, -1.04,
    -0.86, -0.66, -0.40, -0.10, 0.20, 0.50, 0.78, 1.02, 1.18, 1.35,
    1.52, 1.68, 1.86, 2.02, 2.14, 2.22, 2.25,
  ];

  // Cross-section perimeter points around each Z station (from top-center -> right side -> bottom-center -> left side -> top-center)
  // Using 28 profile nodes per station for crisp automotive creases
  const profileNodes = 28;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const getStationDims = (z: number): StationDims => {
    const frontWheelDist = (z - -1.35) / 0.42;
    const rearWheelDist = (z - 1.35) / 0.44;
    const frontArch = Math.max(0, 1 - frontWheelDist * frontWheelDist);
    const rearArch = Math.max(0, 1 - rearWheelDist * rearWheelDist);

    const frontFlare = Math.exp(-Math.pow((z - -1.35) / 0.42, 2)) * (isMuscle ? 0.13 : 0.105);
    const rearFlare = Math.exp(-Math.pow((z - 1.35) / 0.46, 2)) * (isMuscle ? 0.16 : isHyper ? 0.15 : 0.13);

    const doorCokePinch =
      z > -0.78 && z < 0.82
        ? Math.sin(((z + 0.78) / 1.6) * Math.PI) * (isHyper ? 0.075 : 0.045)
        : 0;

    let baseHalfW = 0.93 * wScale;
    // Nose planform curve (wide automotive front bumper, flat across the front)
    if (z < -1.85) {
      const t = THREE.MathUtils.clamp((z - -2.34) / 0.49, 0, 1);
      baseHalfW *= 0.76 + 0.24 * Math.pow(t, 0.45);
    } else if (z > 1.88) {
      const t = THREE.MathUtils.clamp((2.25 - z) / 0.37, 0, 1);
      baseHalfW *= 0.84 + 0.16 * Math.pow(t, 0.5);
    }

    const halfW = baseHalfW + (frontFlare + rearFlare) * wScale - doorCokePinch * 0.4;
    const rockerW = baseHalfW + (frontFlare * 0.5 + rearFlare * 0.55) * wScale;

    // Hood, cabin tub & rear decklid vertical profile
    let hoodCenterY = 0.76;
    if (z < -0.75) {
      const t = THREE.MathUtils.clamp((z - -2.34) / 1.59, 0, 1);
      const noseLow = isHyper ? 0.36 : isMuscle ? 0.46 : 0.40;
      const cowlHigh = isHyper ? 0.73 : isMuscle ? 0.83 : 0.78;
      hoodCenterY = noseLow + Math.pow(t, 0.58) * (cowlHigh - noseLow);
    } else if (z <= 1.05) {
      // Recessed cockpit tub so the 3D interior & seats sit cleanly inside
      hoodCenterY = 0.60;
    } else {
      const t = THREE.MathUtils.clamp((z - 1.05) / 1.2, 0, 1);
      const deckStart = isStreet ? 0.84 : isMuscle ? 0.86 : 0.82;
      const deckEnd = isStreet ? 0.74 : isMuscle ? 0.78 : 0.72;
      hoodCenterY = THREE.MathUtils.lerp(deckStart, deckEnd, Math.pow(t, 0.85));
    }
    hoodCenterY *= hScale;

    let shoulderY = 0.79;
    if (z < -1.55) {
      const t = THREE.MathUtils.clamp((z - -2.34) / 0.79, 0, 1);
      shoulderY = (isHyper ? 0.40 : 0.45) + Math.pow(t, 0.56) * 0.33;
    } else if (z > 1.65) {
      const t = THREE.MathUtils.clamp((z - 1.65) / 0.6, 0, 1);
      shoulderY = 0.82 - t * 0.08;
    } else {
      shoulderY = 0.79 + (z + 1.55) * 0.012;
    }
    shoulderY = (shoulderY + frontArch * 0.055 + rearArch * 0.07) * hScale;

    // Wheel arch cutout height so tires sit cleanly inside circular wheel wells
    const archCutY = 0.17 + Math.max(frontArch, rearArch) * 0.51;
    const beltCrease = (frontArch + rearArch) * 0.025 + 0.02;

    return { z, halfW, rockerW, shoulderY, hoodCenterY, archCutY, beltCrease };
  };

  // Sample cross-section point for a given normalized parameter u in [0..1]
  const evalProfilePoint = (d: StationDims, u: number, isFrontFace: boolean, isRearFace: boolean) => {
    // Map u around full loop:
    // u = 0.0 -> Top center (x = 0)
    // u = 0..0.5 -> Right side (top -> fender crest -> upper door -> lower door -> rocker -> undertray -> bottom center)
    // u = 0.5..1.0 -> Left side (mirror of right side)
    const isLeft = u > 0.5;
    const sideSign = isLeft ? -1 : 1;
    const s = isLeft ? (1 - u) * 2 : u * 2; // 0 (top center) to 1 (bottom center)

    let x = 0;
    let y = 0.45;

    if (s <= 0.32) {
      // Hood / Decklid surface from center (0) to outer fender crease (0.32)
      const t = s / 0.32;
      x = sideSign * t * (d.halfW * 0.90);
      // Power-dome / hood character crease at t ~ 0.45 and raised fender crest at t ~ 0.92
      const powerDome = d.z < -0.82 && t < 0.55 ? Math.sin((t / 0.55) * Math.PI) * 0.024 : 0;
      const fenderPeak = Math.sin(Math.pow(t, 1.4) * Math.PI * 0.85) * 0.036;
      y = THREE.MathUtils.lerp(d.hoodCenterY, d.shoulderY, Math.pow(t, 0.75)) + powerDome + fenderPeak;
    } else if (s <= 0.52) {
      // Upper Fender Shoulder & Beltline Crease
      const t = (s - 0.32) / 0.20;
      x = sideSign * THREE.MathUtils.lerp(d.halfW * 0.90, d.halfW + d.beltCrease, Math.sin(t * Math.PI * 0.5));
      y = THREE.MathUtils.lerp(d.shoulderY + 0.02, d.shoulderY - 0.14, t);
    } else if (s <= 0.76) {
      // Sculpted Door Flank down to Lower Side Skirt / Wheel Arch Cutout
      const t = (s - 0.52) / 0.24;
      const inwardTuck = Math.sin(t * Math.PI) * 0.035;
      x = sideSign * (THREE.MathUtils.lerp(d.halfW + d.beltCrease, d.rockerW, t) - inwardTuck);
      const bottomEdgeY = Math.max(0.18, d.archCutY);
      y = THREE.MathUtils.lerp(d.shoulderY - 0.14, bottomEdgeY, t);
    } else {
      // Underbody Return into Flat Aerodynamic Floor
      const t = (s - 0.76) / 0.24;
      const bottomEdgeY = Math.max(0.18, d.archCutY);
      x = sideSign * THREE.MathUtils.lerp(d.rockerW, 0, Math.pow(t, 0.85));
      y = THREE.MathUtils.lerp(bottomEdgeY, 0.17, Math.min(1, t * 2.2));
    }

    // Close front bumper fascia & rear bumper valence cleanly into a flat vertical bulkhead
    if (isFrontFace) {
      x *= 0.02;
      y = THREE.MathUtils.lerp(0.34, 0.24, s);
    } else if (isRearFace) {
      x *= 0.02;
      y = THREE.MathUtils.lerp(0.62, 0.28, s);
    }

    return { x, y };
  };

  for (let i = 0; i < zStations.length; i++) {
    const z = zStations[i];
    const v = (z - zStations[0]) / (zStations[zStations.length - 1] - zStations[0]);
    const dims = getStationDims(z);
    const isFrontFace = i === 0;
    const isRearFace = i === zStations.length - 1;

    for (let j = 0; j <= profileNodes; j++) {
      const u = j / profileNodes;
      const pt = evalProfilePoint(dims, u, isFrontFace, isRearFace);
      positions.push(pt.x, pt.y, z);
      uvs.push(u, v);
    }
  }

  const stride = profileNodes + 1;
  for (let i = 0; i < zStations.length - 1; i++) {
    for (let j = 0; j < profileNodes; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates an aerodynamic cabin greenhouse (windshield, side windows, rear fastback glass)
 * with realistic tumblehome (inward side window angle) and wrap-around windshield curvature.
 */
function createAerodynamicCabinGeometry(
  style: CarSpec['bodyStyle'],
  scaleInset = 1.0
): THREE.BufferGeometry {
  const isHyper = style === 'hyper';
  const isMuscle = style === 'muscle';
  const isStreet = style === 'street';

  const wScale = (isMuscle ? 1.05 : isHyper ? 0.94 : 1.0) * scaleInset;
  const hScale = isHyper ? 0.90 : isMuscle ? 1.03 : isStreet ? 1.05 : 0.98;

  const frontZ = isHyper ? -0.98 : -0.88;
  const rearZ = isStreet ? 1.78 : isMuscle ? 1.52 : 1.64;
  const steps = 14;
  const zStations: number[] = [];
  for (let i = 0; i <= steps; i++) {
    zStations.push(THREE.MathUtils.lerp(frontZ, rearZ, i / steps));
  }

  const archNodes = 24;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < zStations.length; i++) {
    const z = zStations[i];
    const t = i / (zStations.length - 1);

    // Smooth fastback roofline curve: steeply raked windshield -> sleek roof peak -> fastback rear window
    let roofHeightOffset = 0;
    if (t < 0.34) {
      const wt = t / 0.34;
      roofHeightOffset = Math.pow(Math.sin(wt * Math.PI * 0.5), 0.78) * 0.46;
    } else if (t < 0.64) {
      const rt = (t - 0.34) / 0.30;
      roofHeightOffset = 0.46 - rt * (isStreet ? 0.02 : 0.05);
    } else {
      const bt = (t - 0.64) / 0.36;
      const endDrop = isStreet ? 0.41 : 0.41;
      roofHeightOffset = (isStreet ? 0.44 : 0.41) * (1 - Math.pow(bt, isStreet ? 1.55 : 1.25)) * (0.41 / endDrop);
    }

    const baseY = 0.77 * hScale;
    const topY = baseY + roofHeightOffset * hScale;

    // Planform cabin width: tapers at nose of windshield and rear decklid
    const planCurve = Math.sin(Math.pow(t, 0.62) * Math.PI);
    const bottomHalfW = (0.42 + Math.pow(Math.max(0, planCurve), 0.38) * 0.35) * wScale;
    // Tumblehome: roof is narrower than the beltline, just like a real sports car
    const roofHalfW = bottomHalfW * (isHyper ? 0.72 : 0.78);

    for (let j = 0; j <= archNodes; j++) {
      const u = j / archNodes; // 0 = left beltline, 0.5 = roof center, 1 = right beltline
      const side = (u - 0.5) * 2; // -1 to +1
      const absSide = Math.abs(side);

      let x = 0;
      let y = baseY;

      if (absSide > 0.58) {
        // Side window plane (tumblehome slope from beltline up to roof rail)
        const st = (1 - absSide) / 0.42; // 0 at beltline, 1 at roof rail
        x = Math.sign(side) * THREE.MathUtils.lerp(bottomHalfW, roofHalfW, Math.pow(st, 0.85));
        y = THREE.MathUtils.lerp(baseY, topY - 0.035, Math.pow(st, 0.78));
      } else {
        // Crowned roof & windshield center arch
        const rt = absSide / 0.58; // 0 at roof center, 1 at roof rail
        x = Math.sign(side) * rt * roofHalfW;
        const crown = (1 - rt * rt) * 0.035;
        y = topY - 0.035 + crown;
      }

      positions.push(x, y, z);
      uvs.push(u, t);
    }
  }

  const stride = archNodes + 1;
  for (let i = 0; i < zStations.length - 1; i++) {
    for (let j = 0; j < archNodes; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, d, b, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a contoured Recaro-style sport bucket seat with bolsters and harness pass-throughs.
 */
function createContouredBucketSeat(
  leatherMat: THREE.Material,
  redAlcantaraMat: THREE.Material,
  trimMat: THREE.Material,
  heightScale: number
): THREE.Group {
  const seatGroup = new THREE.Group();

  const backShape = new THREE.Shape();
  backShape.moveTo(-0.15, 0);
  backShape.quadraticCurveTo(-0.21, 0.14, -0.22, 0.32);
  backShape.quadraticCurveTo(-0.18, 0.46, -0.1, 0.52);
  backShape.quadraticCurveTo(0, 0.64, 0.1, 0.52);
  backShape.quadraticCurveTo(0.18, 0.46, 0.22, 0.32);
  backShape.quadraticCurveTo(0.21, 0.14, 0.15, 0);
  backShape.closePath();

  const backGeo = new THREE.ExtrudeGeometry(backShape, {
    steps: 2,
    depth: 0.055,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.022,
    bevelSegments: 3,
  });
  const backMesh = new THREE.Mesh(backGeo, leatherMat);
  backMesh.position.set(0, 0.58 * heightScale, 0.08);
  backMesh.rotation.x = 0.18;
  seatGroup.add(backMesh);

  const bolsterGeo = new THREE.CapsuleGeometry(0.04, 0.32, 6, 10);
  const bolsterL = new THREE.Mesh(bolsterGeo, redAlcantaraMat);
  bolsterL.position.set(-0.17, 0.79 * heightScale, 0.085);
  bolsterL.rotation.x = 0.18;
  bolsterL.rotation.z = 0.08;

  const bolsterR = new THREE.Mesh(bolsterGeo, redAlcantaraMat);
  bolsterR.position.set(0.17, 0.79 * heightScale, 0.085);
  bolsterR.rotation.x = 0.18;
  bolsterR.rotation.z = -0.08;
  seatGroup.add(bolsterL, bolsterR);

  const slotGeo = new THREE.TorusGeometry(0.026, 0.007, 6, 12);
  slotGeo.scale(1.4, 0.75, 1);
  const slotL = new THREE.Mesh(slotGeo, trimMat);
  slotL.position.set(-0.055, 0.99 * heightScale, 0.12);
  slotL.rotation.x = 0.18;
  const slotR = new THREE.Mesh(slotGeo, trimMat);
  slotR.position.set(0.055, 0.99 * heightScale, 0.12);
  slotR.rotation.x = 0.18;
  seatGroup.add(slotL, slotR);

  const cushionGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.36, 12);
  cushionGeo.rotateZ(Math.PI / 2);
  cushionGeo.scale(1, 0.32, 1.15);
  const cushionMesh = new THREE.Mesh(cushionGeo, leatherMat);
  cushionMesh.position.set(0, 0.57 * heightScale, -0.04);
  seatGroup.add(cushionMesh);

  return seatGroup;
}

/**
 * Creates an authentic 3D Mercedes-Benz Three-Pointed Star emblem:
 * Circular chrome ring + central chrome hub + 3 tapered star points (at 90°, 210°, 330°).
 */
function createMercedesStar(radius = 0.08, chromeMat: THREE.Material): THREE.Group {
  const group = new THREE.Group();

  // Outer circular chrome bezel ring
  const ringGeo = new THREE.TorusGeometry(radius, radius * 0.10, 10, 32);
  const ring = new THREE.Mesh(ringGeo, chromeMat);
  group.add(ring);

  // Central hub
  const hubGeo = new THREE.CylinderGeometry(radius * 0.22, radius * 0.22, radius * 0.14, 16);
  hubGeo.rotateX(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, chromeMat);
  group.add(hub);

  // 3 Star points (top 90°, bottom-left 210°, bottom-right 330°)
  const angles = [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 + (4 * Math.PI) / 3];
  for (const angle of angles) {
    const rayShape = new THREE.Shape();
    const baseW = radius * 0.16;
    rayShape.moveTo(-baseW, 0);
    rayShape.lineTo(0, radius * 0.94);
    rayShape.lineTo(baseW, 0);
    rayShape.closePath();

    const rayGeo = new THREE.ExtrudeGeometry(rayShape, {
      depth: radius * 0.08,
      bevelEnabled: true,
      bevelThickness: radius * 0.03,
      bevelSize: radius * 0.02,
      bevelSegments: 2,
    });
    rayGeo.translate(0, 0, -radius * 0.04);

    const rayMesh = new THREE.Mesh(rayGeo, chromeMat);
    rayMesh.rotation.z = angle - Math.PI / 2;
    group.add(rayMesh);
  }

  return group;
}

export function buildSportsCarModel(
  spec: CarSpec,
  customization: CarCustomization,
  contactShadowTexture: THREE.Texture,
  enableSpotlights: boolean,
  carFlakeNormalMap?: THREE.Texture,
  tireTreadTexture?: THREE.Texture,
  leatherTexture?: THREE.Texture,
  headlightBeamTexture?: THREE.Texture,
  brakeHaloTexture?: THREE.Texture,
  wheelBlurTexture?: THREE.Texture
): CarRig {
  const root = new THREE.Group();
  root.scale.setScalar(1.36);

  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const getFinishProps = (finish: CarCustomization['finish']) => {
    if (finish === 'chrome') {
      return {
        metalness: 0.96,
        roughness: 0.07,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
        flakeScale: 0.02,
      };
    }
    if (finish === 'matte') {
      return {
        metalness: 0.42,
        roughness: 0.46,
        clearcoat: 0.18,
        clearcoatRoughness: 0.36,
        flakeScale: 0.04,
      };
    }
    // Authentic Luxury Showroom Metallic Clearcoat Paint (Hotel Lobby Gloss)
    return {
      metalness: 0.84,
      roughness: 0.10,
      clearcoat: 1.0,
      clearcoatRoughness: 0.025,
      flakeScale: 0.05,
    };
  };

  const finishProps = getFinishProps(customization.finish);

  // 1. Showroom Dual-Layer Clearcoat Automotive Paint (MeshPhysicalMaterial)
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(customization.bodyColor || '#1d4ed8'),
    metalness: finishProps.metalness,
    roughness: finishProps.roughness,
    clearcoat: finishProps.clearcoat,
    clearcoatRoughness: finishProps.clearcoatRoughness,
    reflectivity: 1.0,
    ior: 1.54,
    envMapIntensity: 2.8,
    normalMap: carFlakeNormalMap || null,
    normalScale: new THREE.Vector2(finishProps.flakeScale, finishProps.flakeScale),
  });

  // 1B. Polished High-Gloss Chrome Luxury Trim (Window Moldings, Emblems & Exhausts)
  const chromeLuxuryMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    metalness: 0.98,
    roughness: 0.04,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    reflectivity: 1.0,
    envMapIntensity: 2.8,
  });

  // 1C. Crystal Polycarbonate Outer Headlight Lens with Refraction
  const headlightLensMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.05,
    roughness: 0.02,
    transmission: 0.88,
    thickness: 0.22,
    ior: 1.52,
    transparent: true,
    opacity: 0.72,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    depthWrite: false,
    envMapIntensity: 2.5,
  });

  // 2. Carbon Fiber / Satin Aero Trim Material (Splitters, Diffusers, Side Skirts, Pillars)
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0x11151c,
    metalness: 0.45,
    roughness: 0.36,
    envMapIntensity: 1.2,
  });

  // Deep Matte Black Grille & Intake Mesh Material
  const grilleDarkMaterial = new THREE.MeshStandardMaterial({
    color: 0x07090d,
    metalness: 0.25,
    roughness: 0.72,
  });

  // 3. Automotive Tinted Laminated Glass Canopy with High Specular Clearcoat
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x070d17,
    metalness: 0.18,
    roughness: 0.04,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    reflectivity: 1.0,
    transparent: true,
    opacity: enableSpotlights ? 0.56 : 0.84,
    depthWrite: false,
    envMapIntensity: 2.5,
  });

  // 4. Forged Machined Diamond-Cut Alloy Rim Material
  const rimMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(customization.rimColor),
    metalness: 0.96,
    roughness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 2.6,
  });

  // Brushed Steel Ventilated Brake Rotor Material
  const brakeRotorMaterial = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.88,
    roughness: 0.28,
    envMapIntensity: 1.3,
  });

  // Brembo-Style Painted Brake Caliper Material
  const caliperMaterial = new THREE.MeshStandardMaterial({
    color: spec.bodyStyle === 'hyper' ? 0xf59e0b : 0xdc2626,
    metalness: 0.55,
    roughness: 0.24,
  });

  // 5. Vulcanized Rubber Tire Material with Tread Pattern
  const tireMaterial = new THREE.MeshStandardMaterial({
    color: 0x101318,
    map: tireTreadTexture || null,
    metalness: 0.04,
    roughness: 0.84,
  });

  const wheelBlurMaterial = new THREE.MeshBasicMaterial({
    map: wheelBlurTexture || null,
    color: new THREE.Color(customization.rimColor),
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // 6. Optical Projector Headlights & Signature Ruby LED Taillights
  const headlightColor = new THREE.Color(customization.headlightColor);
  const headlightMaterial = new THREE.MeshStandardMaterial({
    color: headlightColor,
    emissive: headlightColor,
    emissiveIntensity: 3.2,
    roughness: 0.05,
  });

  const brakeLightMaterial = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0xff1e1e,
    emissiveIntensity: 2.2,
    roughness: 0.08,
  });

  const brakeHaloMaterial = new THREE.SpriteMaterial({
    map: brakeHaloTexture || null,
    color: 0xff2a2a,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const tailTrailMaterial = new THREE.MeshBasicMaterial({
    map: brakeHaloTexture || null,
    color: 0xef4444,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const reverseLightMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.15,
    roughness: 0.08,
  });

  const turnSignalMaterial = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.0,
    roughness: 0.15,
  });

  // Ground Ambient Occlusion Contact Shadow
  const shadowGeo = new THREE.PlaneGeometry(3.15, 5.65);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTexture,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.025;
  root.add(shadowMesh);

  const widthScale =
    spec.bodyStyle === 'muscle' ? 1.07 : spec.bodyStyle === 'hyper' ? 1.05 : spec.bodyStyle === 'street' ? 0.98 : 1.02;
  const heightScale =
    spec.bodyStyle === 'hyper' ? 0.91 : spec.bodyStyle === 'muscle' ? 1.04 : spec.bodyStyle === 'street' ? 1.05 : 0.98;

  // ============================================================================
  // PART 1: CAD-SCULPTED MAIN AUTOMOTIVE BODYWORK + WHEEL ARCH LINERS
  // ============================================================================
  const bodyGeo = createSculptedCarBodyGeometry(spec.bodyStyle);
  const mainBodyMesh = new THREE.Mesh(bodyGeo, bodyMaterial);
  mainBodyMesh.castShadow = true;
  mainBodyMesh.receiveShadow = true;
  bodyGroup.add(mainBodyMesh);

  // Recessed Matte Black Hood Aero Vents / Muscle Supercharger Cowl
  if (spec.bodyStyle === 'muscle') {
    const scoopShape = new THREE.Shape();
    scoopShape.moveTo(-0.26, 0);
    scoopShape.lineTo(0.26, 0);
    scoopShape.lineTo(0.21, 0.72);
    scoopShape.lineTo(-0.21, 0.72);
    scoopShape.closePath();
    const scoopGeo = new THREE.ExtrudeGeometry(scoopShape, {
      steps: 1,
      depth: 0.065,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
    });
    scoopGeo.rotateX(Math.PI / 2 - 0.14);
    const scoopMesh = new THREE.Mesh(scoopGeo, bodyMaterial);
    scoopMesh.position.set(0, 0.78 * heightScale, -1.72);
    bodyGroup.add(scoopMesh);

    const intakeSlot = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.055, 0.08), grilleDarkMaterial);
    intakeSlot.position.set(0, 0.75 * heightScale, -1.73);
    bodyGroup.add(intakeSlot);
  } else {
    // Twin GT / Hyper / Street Hood Aero Extractor Louvers
    const louverGeo = new THREE.BoxGeometry(0.22 * widthScale, 0.02, 0.42);
    for (const side of [-1, 1]) {
      const louver = new THREE.Mesh(louverGeo, trimMaterial);
      louver.position.set(side * 0.34 * widthScale, 0.65 * heightScale, -1.48);
      louver.rotation.x = 0.17;
      louver.rotation.z = -side * 0.08;
      bodyGroup.add(louver);
    }
  }

  // Deep Wheel Well Liners + Molded Fender Arch Trim Lips
  const archLinerMat = new THREE.MeshBasicMaterial({ color: 0x06080c, side: THREE.DoubleSide });
  const archLinerGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.44, 20, 1, false, 0, Math.PI);
  archLinerGeo.rotateZ(Math.PI / 2);
  const archLipGeo = new THREE.TorusGeometry(0.425, 0.024, 8, 22, Math.PI);

  for (const [ax, az, isRear] of [
    [-0.86 * widthScale, -1.35, 0],
    [0.86 * widthScale, -1.35, 0],
    [-0.89 * widthScale, 1.35, 1],
    [0.89 * widthScale, 1.35, 1],
  ] as const) {
    const liner = new THREE.Mesh(archLinerGeo, archLinerMat);
    liner.position.set(ax, 0.38, az);
    bodyGroup.add(liner);

    const archLip = new THREE.Mesh(archLipGeo, isRear && spec.bodyStyle === 'muscle' ? bodyMaterial : trimMaterial);
    archLip.rotation.y = Math.PI / 2;
    archLip.position.set(ax + Math.sign(ax) * 0.14, 0.38, az);
    bodyGroup.add(archLip);
  }

  // Carbon-Fiber Side Skirts + Rear Aero Winglets along the Lower Rocker Panels
  const skirtGeo = new THREE.BoxGeometry(0.09, 0.045, 1.88);
  const wingletGeo = new THREE.BoxGeometry(0.03, 0.18, 0.24);
  const doorHandleGeo = new THREE.BoxGeometry(0.028, 0.026, 0.16);
  const sideIntakeGeo = new THREE.BoxGeometry(0.08, 0.26, 0.42);

  for (const side of [-1, 1]) {
    const skirt = new THREE.Mesh(skirtGeo, trimMaterial);
    skirt.position.set(side * 0.94 * widthScale, 0.18, 0.0);
    bodyGroup.add(skirt);

    const winglet = new THREE.Mesh(wingletGeo, trimMaterial);
    winglet.position.set(side * 0.98 * widthScale, 0.25, 0.82);
    winglet.rotation.x = -0.22;
    bodyGroup.add(winglet);

    // Flush Aerodynamic Door Handle
    const handle = new THREE.Mesh(doorHandleGeo, trimMaterial);
    handle.position.set(side * 0.93 * widthScale, 0.72 * heightScale, 0.18);
    bodyGroup.add(handle);

    // Side Quarter-Panel Air Intake Scoop on GT / Hyper / Muscle models
    if (spec.bodyStyle !== 'street') {
      const intake = new THREE.Mesh(sideIntakeGeo, grilleDarkMaterial);
      intake.position.set(side * 0.92 * widthScale, 0.54 * heightScale, 0.68);
      intake.rotation.y = side * 0.12;
      bodyGroup.add(intake);
    }
  }

  // ============================================================================
  // PART 2: SCULPTED INTERIOR COCKPIT, DASHBOARD, BUCKET SEATS & STEERING WHEEL
  // ============================================================================
  const steeringWheel = new THREE.Group();
  steeringWheel.position.set(-0.32, 0.85 * heightScale, -0.20);
  steeringWheel.rotation.x = -0.26;

  if (enableSpotlights) {
    const interiorGroup = new THREE.Group();
    const leatherMat = new THREE.MeshStandardMaterial({
      color: 0x1a1f29,
      map: leatherTexture || null,
      roughness: 0.62,
      metalness: 0.1,
    });
    const redAlcantaraMat = new THREE.MeshStandardMaterial({
      color: 0xb91c1c,
      roughness: 0.72,
      metalness: 0.05,
    });

    const dashWingGeo = new THREE.CylinderGeometry(0.22, 0.26, 1.32 * widthScale, 12, 1, false, 0, Math.PI);
    dashWingGeo.rotateZ(Math.PI / 2);
    dashWingGeo.scale(1, 0.58, 1.2);
    const dashWing = new THREE.Mesh(dashWingGeo, leatherMat);
    dashWing.position.set(0, 0.74 * heightScale, -0.54);
    interiorGroup.add(dashWing);

    // Illuminated Digital Instrument Binnacle behind Steering Wheel
    const binnacleScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.09),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    binnacleScreen.position.set(-0.32, 0.88 * heightScale, -0.44);
    binnacleScreen.rotation.x = -0.18;
    interiorGroup.add(binnacleScreen);

    // 3D Sport Steering Wheel with Red 12-o'clock Marker & Aluminum Spokes
    const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.022, 10, 24), leatherMat);
    const topMarker = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.024, 8, 8, 0.35),
      caliperMaterial
    );
    topMarker.rotation.z = Math.PI / 2 - 0.175;
    const wheelHub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 12), trimMaterial);
    wheelHub.rotation.x = Math.PI / 2;
    const spokeH = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.024, 0.016), rimMaterial);
    const spokeV = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.12, 0.016), rimMaterial);
    spokeV.position.y = -0.06;
    steeringWheel.add(wheelRing, topMarker, wheelHub, spokeH, spokeV);
    interiorGroup.add(steeringWheel);

    const seatL = createContouredBucketSeat(leatherMat, redAlcantaraMat, trimMaterial, heightScale);
    seatL.position.x = -0.31;
    const seatR = createContouredBucketSeat(leatherMat, redAlcantaraMat, trimMaterial, heightScale);
    seatR.position.x = 0.31;
    interiorGroup.add(seatL, seatR);
    bodyGroup.add(interiorGroup);
  }

  // ============================================================================
  // PART 3: AERODYNAMIC CABIN GREENHOUSE, BODY-COLOR ROOF, PILLARS & WIPERS
  // ============================================================================
  const canopyGeo = createAerodynamicCabinGeometry(spec.bodyStyle, 1.0);
  const canopyMesh = new THREE.Mesh(canopyGeo, glassMaterial);
  canopyMesh.renderOrder = 2;
  bodyGroup.add(canopyMesh);

  // Flush Body-Colored Roof Panel & A/C-Pillar Rails
  const roofCapGeo = new THREE.BoxGeometry(0.86 * widthScale, 0.038, spec.bodyStyle === 'street' ? 1.18 : 0.96);
  const roofCapMesh = new THREE.Mesh(roofCapGeo, spec.bodyStyle === 'hyper' ? trimMaterial : bodyMaterial);
  roofCapMesh.position.set(0, 1.215 * heightScale, 0.18);
  roofCapMesh.castShadow = true;
  bodyGroup.add(roofCapMesh);

  // Le Mans Aero Dorsal Fin for Hypercar
  if (spec.bodyStyle === 'hyper') {
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(1.05, -0.08);
    finShape.lineTo(1.05, 0.12);
    finShape.lineTo(0, 0.18);
    finShape.closePath();
    const finGeo = new THREE.ExtrudeGeometry(finShape, { steps: 1, depth: 0.024, bevelEnabled: false });
    finGeo.rotateY(Math.PI / 2);
    const dorsalFin = new THREE.Mesh(finGeo, trimMaterial);
    dorsalFin.position.set(-0.012, 1.04 * heightScale, 0.62);
    bodyGroup.add(dorsalFin);
  }

  // Contoured A-Pillars, B-Pillars & C-Pillars Integrated Flush with Cabin Edges
  for (const side of [-1, 1]) {
    const aPillar = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.045, 0.68), bodyMaterial);
    aPillar.position.set(side * 0.56 * widthScale, 1.01 * heightScale, -0.50);
    aPillar.rotation.x = 0.62;
    aPillar.rotation.z = -side * 0.24;
    aPillar.rotation.y = side * 0.14;
    bodyGroup.add(aPillar);

    const bPillar = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.42, 0.075), trimMaterial);
    bPillar.position.set(side * 0.66 * widthScale, 1.01 * heightScale, 0.18);
    bPillar.rotation.z = -side * 0.26;
    bodyGroup.add(bPillar);

    const cPillar = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.052, 0.72), bodyMaterial);
    cPillar.position.set(
      side * 0.55 * widthScale,
      1.01 * heightScale,
      spec.bodyStyle === 'street' ? 1.32 : 1.16
    );
    cPillar.rotation.x = -0.58;
    cPillar.rotation.z = -side * 0.24;
    cPillar.rotation.y = -side * 0.14;
    bodyGroup.add(cPillar);

    // Luxury Chrome Window Surround Trim Moldings (Hotel / Showroom GT Styling)
    const chromeWindowArch = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.024, 0.72), chromeLuxuryMaterial);
    chromeWindowArch.position.set(side * 0.58 * widthScale, 1.03 * heightScale, -0.48);
    chromeWindowArch.rotation.x = 0.62;
    chromeWindowArch.rotation.z = -side * 0.24;
    chromeWindowArch.rotation.y = side * 0.14;
    bodyGroup.add(chromeWindowArch);

    const chromeRoofLine = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.024, 0.96), chromeLuxuryMaterial);
    chromeRoofLine.position.set(side * 0.44 * widthScale, 1.23 * heightScale, 0.18);
    bodyGroup.add(chromeRoofLine);
  }

  // Dual Front Windshield Aero Wipers at Base of Cowl
  const wiperBladeGeo = new THREE.BoxGeometry(0.42, 0.014, 0.022);
  for (const wx of [-0.22, 0.18]) {
    const wiper = new THREE.Mesh(wiperBladeGeo, trimMaterial);
    wiper.position.set(wx * widthScale, 0.79 * heightScale, -0.84);
    wiper.rotation.y = -0.14;
    wiper.rotation.x = 0.35;
    bodyGroup.add(wiper);
  }

  // ============================================================================
  // PART 4: FRONT BUMPER ASSEMBLY (DETACHABLE), SIDE MIRRORS & HEADLIGHTS
  // ============================================================================
  const frontBumper = new THREE.Group();
  bodyGroup.add(frontBumper);

  // Front Carbon Aero Splitter Lip + Side Canards
  const frontSplitterGeo = new THREE.BoxGeometry(1.86 * widthScale, 0.036, 0.36);
  const frontSplitter = new THREE.Mesh(frontSplitterGeo, trimMaterial);
  frontSplitter.position.set(0, 0.175, -2.23);
  frontBumper.add(frontSplitter);

  // Center Deep Front Radiator Grille + Polished Chrome Panamericana Structure
  const centerGrilleMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.02 * widthScale, 0.24, 0.10),
    grilleDarkMaterial
  );
  centerGrilleMesh.position.set(0, 0.32, -2.28);
  frontBumper.add(centerGrilleMesh);

  // Outer Polished Chrome Frame around the Mercedes Grille
  const grilleFrame = new THREE.Mesh(
    new THREE.BoxGeometry(1.06 * widthScale, 0.26, 0.024),
    chromeLuxuryMaterial
  );
  grilleFrame.position.set(0, 0.32, -2.29);
  frontBumper.add(grilleFrame);

  // Panamericana Vertical Chrome Waterfall Slats (14 vertical louvers across the mouth)
  const slatGeo = new THREE.BoxGeometry(0.012, 0.22, 0.025);
  const slatCount = 14;
  for (let s = 0; s < slatCount; s++) {
    const sx = THREE.MathUtils.lerp(-0.46 * widthScale, 0.46 * widthScale, s / (slatCount - 1));
    if (Math.abs(sx) < 0.10) continue; // Leave center space for the prominent Mercedes Star
    const slat = new THREE.Mesh(slatGeo, chromeLuxuryMaterial);
    const noseCurvature = Math.cos((sx / (0.46 * widthScale)) * Math.PI * 0.5) * 0.035;
    slat.position.set(sx, 0.32, -2.30 - noseCurvature);
    frontBumper.add(slat);
  }

  // Central Dual Chrome Wings Flanking the Star
  const wingLeft = new THREE.Mesh(new THREE.BoxGeometry(0.36 * widthScale, 0.024, 0.02), chromeLuxuryMaterial);
  wingLeft.position.set(-0.24 * widthScale, 0.32, -2.33);
  const wingRight = new THREE.Mesh(new THREE.BoxGeometry(0.36 * widthScale, 0.024, 0.02), chromeLuxuryMaterial);
  wingRight.position.set(0.24 * widthScale, 0.32, -2.33);
  frontBumper.add(wingLeft, wingRight);

  // Large Central Front Mercedes-Benz Three-Pointed Star Emblem
  const frontMercedesStar = createMercedesStar(0.088, chromeLuxuryMaterial);
  frontMercedesStar.position.set(0, 0.32, -2.34);
  frontBumper.add(frontMercedesStar);

  // Chrome "AMG" Badge on Front Grille
  const amgFrontPlate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.022, 0.015), chromeLuxuryMaterial);
  amgFrontPlate.position.set(0.24 * widthScale, 0.35, -2.33);
  frontBumper.add(amgFrontPlate);

  const intercoolerMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.82 * widthScale, 0.16, 0.06),
    brakeRotorMaterial
  );
  intercoolerMesh.position.set(0, 0.28, -2.36);
  frontBumper.add(intercoolerMesh);

  // Left & Right Side Brake Cooling Duct Intakes in Front Bumper
  const sideDuctGeo = new THREE.BoxGeometry(0.34 * widthScale, 0.18, 0.12);
  for (const side of [-1, 1]) {
    const duct = new THREE.Mesh(sideDuctGeo, grilleDarkMaterial);
    duct.position.set(side * 0.68 * widthScale, 0.31, -2.22);
    duct.rotation.y = side * 0.22;
    frontBumper.add(duct);

    // Front Bumper Dive-Plane Aero Canards
    const canard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.22), trimMaterial);
    canard.position.set(side * 0.91 * widthScale, 0.28, -2.12);
    canard.rotation.z = side * 0.18;
    canard.rotation.x = 0.24;
    frontBumper.add(canard);

    // Front Amber Turn Signal Indicator Strip
    const frontIndicator = new THREE.Mesh(new THREE.BoxGeometry(0.22 * widthScale, 0.018, 0.04), turnSignalMaterial);
    frontIndicator.position.set(side * 0.74 * widthScale, 0.44 * heightScale, -2.24);
    frontIndicator.rotation.y = side * 0.26;
    frontBumper.add(frontIndicator);
  }

  // Aerodynamic Side Mirrors (Detachable on Impact)
  const buildSideMirror = (side: -1 | 1) => {
    const mGroup = new THREE.Group();
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.14), bodyMaterial);
    housing.position.set(side * 0.96 * widthScale, 0.88 * heightScale, -0.28);
    housing.rotation.y = side * 0.15;
    housing.rotation.z = -side * 0.10;

    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.14, 8), trimMaterial);
    stalk.position.set(side * 0.88 * widthScale, 0.82 * heightScale, -0.28);
    stalk.rotation.z = -side * 0.55;

    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.14, 0.07),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.02, metalness: 0.95 })
    );
    glass.position.set(side * 0.96 * widthScale, 0.88 * heightScale, -0.21);
    glass.rotation.y = side > 0 ? -Math.PI / 2 + 0.25 : Math.PI / 2 - 0.25;

    const indicator = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.022, 0.12), turnSignalMaterial);
    indicator.position.set(side * 1.05 * widthScale, 0.88 * heightScale, -0.28);
    indicator.rotation.y = side * 0.15;

    mGroup.add(housing, stalk, glass, indicator);
    return mGroup;
  };

  const leftMirror = buildSideMirror(-1);
  const rightMirror = buildSideMirror(1);
  bodyGroup.add(leftMirror, rightMirror);

  // Angular Multi-Projector LED Matrix Headlight Clusters with DRL Light Blades
  const buildHeadlightCluster = (side: -1 | 1) => {
    const hGroup = new THREE.Group();

    // Contoured Polycarbonate Dark Housing
    const housingGeo = new THREE.BoxGeometry(0.38 * widthScale, 0.11, 0.28);
    const housing = new THREE.Mesh(housingGeo, trimMaterial);
    housing.rotation.y = side * 0.28;
    housing.rotation.z = -side * 0.12;
    hGroup.add(housing);

    // Dual Bi-LED Projector Lenses inside Housing
    const projectorGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.06, 12);
    projectorGeo.rotateX(Math.PI / 2);
    const lensOuter = new THREE.Mesh(projectorGeo, headlightMaterial);
    lensOuter.position.set(side * 0.08, 0.005, -0.11);
    const lensInner = new THREE.Mesh(projectorGeo, headlightMaterial);
    lensInner.position.set(-side * 0.05, -0.005, -0.12);
    hGroup.add(lensOuter, lensInner);

    // Signature Angular LED Daytime Running Light (DRL) Strip
    const drlBar = new THREE.Mesh(new THREE.BoxGeometry(0.34 * widthScale, 0.018, 0.04), headlightMaterial);
    drlBar.position.set(0, -0.038, -0.12);
    drlBar.rotation.y = side * 0.28;
    drlBar.rotation.z = -side * 0.14;
    hGroup.add(drlBar);

    // Crystal Outer Jewel Polycarbonate Headlight Lens with Refraction
    const lensCover = new THREE.Mesh(
      new THREE.BoxGeometry(0.39 * widthScale, 0.118, 0.024),
      headlightLensMaterial
    );
    lensCover.position.set(0, 0, -0.142);
    lensCover.rotation.y = side * 0.28;
    lensCover.rotation.z = -side * 0.12;
    hGroup.add(lensCover);

    hGroup.position.set(side * 0.64 * widthScale, 0.53 * heightScale, -2.14);
    return hGroup;
  };
  bodyGroup.add(buildHeadlightCluster(-1), buildHeadlightCluster(1));

  // 3D Mercedes Hood Nose Crest (Laurel Wreath + Three-Pointed Star Medallion)
  const hoodStarGroup = new THREE.Group();
  const hoodBadgeBase = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.044, 0.012, 24), chromeLuxuryMaterial);
  hoodBadgeBase.rotation.x = Math.PI / 2;
  const hoodBadgeCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.034, 0.034, 0.015, 24),
    new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.15, metalness: 0.85 })
  );
  hoodBadgeCore.rotation.x = Math.PI / 2;
  const hoodMiniStar = createMercedesStar(0.026, chromeLuxuryMaterial);
  hoodMiniStar.position.z = -0.01;
  hoodStarGroup.add(hoodBadgeBase, hoodBadgeCore, hoodMiniStar);
  hoodStarGroup.position.set(0, 0.505 * heightScale, -2.26);
  hoodStarGroup.rotation.x = 0.48;
  bodyGroup.add(hoodStarGroup);

  // Mercedes-AMG Front Fender Side Gills with "V8 BITURBO" Chrome Strakes
  const fenderGillGeo = new THREE.BoxGeometry(0.025, 0.07, 0.38);
  const fenderChromeFinGeo = new THREE.BoxGeometry(0.03, 0.014, 0.34);
  for (const side of [-1, 1]) {
    const gillMesh = new THREE.Mesh(fenderGillGeo, grilleDarkMaterial);
    gillMesh.position.set(side * 0.93 * widthScale, 0.62 * heightScale, -1.05);
    gillMesh.rotation.y = side * 0.04;
    bodyGroup.add(gillMesh);

    const fin1 = new THREE.Mesh(fenderChromeFinGeo, chromeLuxuryMaterial);
    fin1.position.set(side * 0.94 * widthScale, 0.635 * heightScale, -1.05);
    fin1.rotation.y = side * 0.04;

    const fin2 = new THREE.Mesh(fenderChromeFinGeo, chromeLuxuryMaterial);
    fin2.position.set(side * 0.94 * widthScale, 0.605 * heightScale, -1.05);
    fin2.rotation.y = side * 0.04;
    bodyGroup.add(fin1, fin2);
  }

  // Volumetric Headlight Beams
  const headlightSpots: THREE.SpotLight[] = [];
  const headlightBeams: THREE.Mesh[] = [];
  if (enableSpotlights) {
    const warmWhite = 0xfff3d6;
    const beamConeGeo = new THREE.ConeGeometry(2.65, 22.0, 14, 1, true);
    beamConeGeo.translate(0, -11.0, 0);
    beamConeGeo.rotateX(Math.PI / 2);
    const beamConeMat = new THREE.MeshBasicMaterial({
      map: headlightBeamTexture || null,
      color: warmWhite,
      transparent: true,
      opacity: 0.26,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    for (const side of [-1, 1]) {
      const beamMesh = new THREE.Mesh(beamConeGeo, beamConeMat);
      beamMesh.position.set(side * 0.64 * widthScale, 0.52 * heightScale, -2.22);
      beamMesh.rotation.x = -0.045;
      beamMesh.rotation.y = -side * 0.03;
      beamMesh.renderOrder = 3;
      bodyGroup.add(beamMesh);
      headlightBeams.push(beamMesh);
    }
  }

  // ============================================================================
  // PART 5: REAR FASCIA, DETACHABLE DIFFUSER BUMPER, SIGNATURE LED TAILLIGHTS
  // ============================================================================
  const rearBumper = new THREE.Group();
  bodyGroup.add(rearBumper);

  // Rear Multi-Strake Carbon Venturi Diffuser
  const diffuserBase = new THREE.Mesh(
    new THREE.BoxGeometry(1.78 * widthScale, 0.16, 0.22),
    trimMaterial
  );
  diffuserBase.position.set(0, 0.24, 2.18);
  rearBumper.add(diffuserBase);

  // 5 Vertical Aerodynamic Diffuser Strakes / Fins
  const finGeo = new THREE.BoxGeometry(0.022, 0.16, 0.28);
  for (const fx of [-0.52, -0.26, 0, 0.26, 0.52]) {
    const fin = new THREE.Mesh(finGeo, trimMaterial);
    fin.position.set(fx * widthScale, 0.22, 2.21);
    rearBumper.add(fin);
  }

  // Rear Recessed License Plate & Crisp White Plate Graphic
  const plateBacking = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.13, 0.03), trimMaterial);
  plateBacking.position.set(0, 0.52 * heightScale, 2.25);
  const plateFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.44, 0.10),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4, metalness: 0.1 })
  );
  plateFace.position.set(0, 0.52 * heightScale, 2.268);
  const plateBlueStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(0.05, 0.10),
    new THREE.MeshBasicMaterial({ color: 0x1d4ed8 })
  );
  plateBlueStrip.position.set(-0.195, 0.52 * heightScale, 2.27);
  rearBumper.add(plateBacking, plateFace, plateBlueStrip);

  // Flush Smoked-Lens LED Taillight Clusters (Twin Afterburner Rings / Sculpted LED Blades)
  const buildRearTaillightCluster = (side: -1 | 1) => {
    const tGroup = new THREE.Group();

    // Flush Smoked Dark Bezel
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.42 * widthScale, 0.13, 0.12), trimMaterial);
    tGroup.add(bezel);

    // Outer & Inner Glowing Ruby LED Signature Rings / Blades
    const ringGeo = new THREE.TorusGeometry(0.048, 0.015, 8, 18);
    const outerRing = new THREE.Mesh(ringGeo, brakeLightMaterial);
    outerRing.position.set(side * 0.085, 0.005, 0.058);
    const innerRing = new THREE.Mesh(ringGeo, brakeLightMaterial);
    innerRing.position.set(-side * 0.055, 0.005, 0.06);
    tGroup.add(outerRing, innerRing);

    // Horizontal Ruby LED Blade + White Reverse Strip + Amber Turn Indicator
    const ledBlade = new THREE.Mesh(new THREE.BoxGeometry(0.36 * widthScale, 0.024, 0.03), brakeLightMaterial);
    ledBlade.position.set(0, 0.038, 0.058);

    const reverseStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.18 * widthScale, 0.018, 0.025),
      reverseLightMaterial
    );
    reverseStrip.position.set(side * 0.08, -0.036, 0.058);

    const turnStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.18 * widthScale, 0.018, 0.025),
      turnSignalMaterial
    );
    turnStrip.position.set(-side * 0.08, -0.036, 0.058);

    tGroup.add(ledBlade, reverseStrip, turnStrip);

    tGroup.position.set(side * 0.64 * widthScale, 0.68 * heightScale, 2.19);
    tGroup.rotation.y = side * 0.16;
    return tGroup;
  };
  bodyGroup.add(buildRearTaillightCluster(-1), buildRearTaillightCluster(1));

  // Full-Width Emissive Red LED Light Bar Across the Rear Deck
  const ledBarMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.36 * widthScale, 0.028, 0.06),
    brakeLightMaterial
  );
  ledBarMesh.position.set(0, 0.70 * heightScale, 2.23);
  bodyGroup.add(ledBarMesh);

  // Rear Central Mercedes Three-Pointed Star Emblem on Trunk Decklid
  const rearMercedesStar = createMercedesStar(0.054, chromeLuxuryMaterial);
  rearMercedesStar.position.set(0, 0.76 * heightScale, 2.22);
  rearMercedesStar.rotation.x = -0.15;
  bodyGroup.add(rearMercedesStar);

  // Polished Chrome "AMG" 3D Badge on Left Rear Decklid
  const amgRearBadge = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.028, 0.018), chromeLuxuryMaterial);
  amgRearBadge.position.set(-0.48 * widthScale, 0.75 * heightScale, 2.21);
  amgRearBadge.rotation.x = -0.15;
  bodyGroup.add(amgRearBadge);

  // Polished Chrome "V8 BITURBO" 3D Badge on Right Rear Decklid
  const gtRearBadge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.024, 0.018), chromeLuxuryMaterial);
  gtRearBadge.position.set(0.48 * widthScale, 0.75 * heightScale, 2.21);
  gtRearBadge.rotation.x = -0.15;
  bodyGroup.add(gtRearBadge);

  // Additive Red Halo Sprites for Brake Lights
  const brakeHaloSprites: THREE.Sprite[] = [];
  for (const hx of [-0.66 * widthScale, 0, 0.66 * widthScale]) {
    const haloSprite = new THREE.Sprite(brakeHaloMaterial);
    const isCenter = hx === 0;
    haloSprite.position.set(hx, 0.69 * heightScale, isCenter ? 2.30 : 2.25);
    haloSprite.scale.set(isCenter ? 1.45 : 0.95, isCenter ? 0.48 : 0.62, 1);
    bodyGroup.add(haloSprite);
    brakeHaloSprites.push(haloSprite);
  }

  // High-Speed Taillight Light Trails
  const tailTrailMeshes: THREE.Mesh[] = [];
  const trailGeo = new THREE.PlaneGeometry(0.28, 3.2);
  trailGeo.rotateX(-Math.PI / 2);
  trailGeo.translate(0, 0, 1.6);
  for (const side of [-1, 1]) {
    const trailGroup = new THREE.Mesh(trailGeo, tailTrailMaterial);
    trailGroup.position.set(side * 0.66 * widthScale, 0.68 * heightScale, 2.22);
    bodyGroup.add(trailGroup);
    tailTrailMeshes.push(trailGroup);
  }

  // Model-Specific Rear Wing / Spoiler Architecture
  const wingGroup = new THREE.Group();
  const wingHeight = spec.bodyStyle === 'street' ? 1.18 : spec.bodyStyle === 'hyper' ? 1.14 : 1.08;
  const wingSpan = (spec.bodyStyle === 'street' ? 1.42 : 1.88) * widthScale;

  // Main Carbon Airfoil Wing Blade
  const wingCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-wingSpan / 2, (wingHeight - 0.02) * heightScale, 2.08),
    new THREE.Vector3(0, wingHeight * heightScale, 1.98),
    new THREE.Vector3(wingSpan / 2, (wingHeight - 0.02) * heightScale, 2.08),
  ]);
  const wingTubeGeo = new THREE.TubeGeometry(wingCurve, 20, 0.085, 8, false);
  wingTubeGeo.scale(1, 0.20, 1.45);
  const wingBlade = new THREE.Mesh(
    wingTubeGeo,
    spec.bodyStyle === 'street' ? bodyMaterial : trimMaterial
  );
  wingBlade.castShadow = true;
  wingGroup.add(wingBlade);

  // Vertical Wing Endplates & Swan-Neck Pylons
  const endplateGeo = new THREE.BoxGeometry(0.024, 0.18, 0.34);
  for (const side of [-1, 1]) {
    const endplate = new THREE.Mesh(endplateGeo, spec.bodyStyle === 'street' ? bodyMaterial : trimMaterial);
    endplate.position.set(side * (wingSpan / 2), (wingHeight - 0.02) * heightScale, 2.06);
    wingGroup.add(endplate);

    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.28, 0.14), trimMaterial);
    pylon.position.set(side * (spec.bodyStyle === 'street' ? 0.48 : 0.34) * widthScale, (wingHeight - 0.13) * heightScale, 1.98);
    pylon.rotation.x = -0.24;
    wingGroup.add(pylon);
  }
  bodyGroup.add(wingGroup);

  // ============================================================================
  // PART 6: AMG-STYLE QUAD TRAPEZOIDAL CHROME EXHAUST TIPS
  // ============================================================================
  const amgOuterTipGeo = new THREE.BoxGeometry(0.125, 0.075, 0.28);
  const amgInnerBoreGeo = new THREE.BoxGeometry(0.105, 0.055, 0.29);
  const boreMat = new THREE.MeshBasicMaterial({ color: 0x050505 });

  const exhaustXOffsets =
    spec.bodyStyle === 'hyper'
      ? [-0.18, 0.18]
      : spec.bodyStyle === 'street'
      ? [-0.54, 0.54]
      : [-0.60, -0.45, 0.45, 0.60];
  const exhaustY = spec.bodyStyle === 'hyper' ? 0.38 : 0.23;

  for (const ex of exhaustXOffsets) {
    const outer = new THREE.Mesh(amgOuterTipGeo, chromeLuxuryMaterial);
    outer.position.set(ex * widthScale, exhaustY, 2.26);
    const inner = new THREE.Mesh(amgInnerBoreGeo, boreMat);
    inner.position.set(ex * widthScale, exhaustY, 2.27);
    bodyGroup.add(outer, inner);
  }

  // ============================================================================
  // PART 7: AERODYNAMIC WING MIRRORS WITH REFLECTIVE GLASS
  // ============================================================================
  const mirrorGlassMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.98,
    roughness: 0.02,
    envMapIntensity: 1.8,
  });

  const buildMirror = (side: -1 | 1) => {
    const mGroup = new THREE.Group();
    const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.024, 0.05), trimMaterial);
    stalk.position.set(side * 0.04, 0, 0);
    stalk.rotation.z = side * 0.25;
    mGroup.add(stalk);

    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.085, 0.11), bodyMaterial);
    housing.position.set(side * 0.12, 0.025, 0);
    housing.rotation.y = -side * 0.18;
    mGroup.add(housing);

    const mirrorFace = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.068), mirrorGlassMat);
    mirrorFace.position.set(side * 0.12, 0.025, 0.057);
    mirrorFace.rotation.y = -side * 0.18;
    mGroup.add(mirrorFace);

    mGroup.position.set(side * 0.78 * widthScale, 0.86 * heightScale, -0.46);
    return mGroup;
  };
  bodyGroup.add(buildMirror(-1), buildMirror(1));

  // ============================================================================
  // PART 8: OPTIONAL NEON UNDERGLOW
  // ============================================================================
  const underglowLight = new THREE.PointLight(
    new THREE.Color(customization.bodyColor),
    0,
    5.8
  );

  const underglowGeo = new THREE.PlaneGeometry(1.82, 3.85);
  const underglowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(customization.bodyColor),
    transparent: true,
    opacity: customization.neonUnderglow ? 0.48 : 0.0,
    depthWrite: false,
  });
  const underglowMesh = new THREE.Mesh(underglowGeo, underglowMat);
  underglowMesh.rotation.x = -Math.PI / 2;
  underglowMesh.position.y = 0.035;
  root.add(underglowMesh);

  // ============================================================================
  // PART 9: 4 FORGED MULTI-SPOKE WHEELS, VENTILATED BRAKE DISCS & BREMBO CALIPERS
  // ============================================================================
  const wheels: THREE.Object3D[] = [];
  const wheelAssemblies: THREE.Group[] = [];
  const frontLeftPivot = new THREE.Group();
  const frontRightPivot = new THREE.Group();

  const tirePoints = [
    new THREE.Vector2(0.245, -0.155),
    new THREE.Vector2(0.355, -0.172),
    new THREE.Vector2(0.382, -0.135),
    new THREE.Vector2(0.388, 0.0),
    new THREE.Vector2(0.382, 0.135),
    new THREE.Vector2(0.355, 0.172),
    new THREE.Vector2(0.245, 0.155),
  ];
  const sharedTireGeo = new THREE.LatheGeometry(tirePoints, 24);
  sharedTireGeo.rotateZ(Math.PI / 2);

  // 5 Twin-Spoke (10-spoke) Forged Rim Geometry
  const spokeGeo = new THREE.BoxGeometry(0.022, 0.50, 0.022);
  const rotorGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.026, 20);
  rotorGeo.rotateZ(Math.PI / 2);
  const caliperGeo = new THREE.BoxGeometry(0.065, 0.15, 0.095);

  const createWheelCorner = (isLeft: boolean, isRear: boolean) => {
    const suspensionGroup = new THREE.Group();
    const spinGroup = new THREE.Group();

    const sideSign = isLeft ? -1 : 1;
    const tireScaleW = isRear ? 1.22 : 1.08;

    // 1. Vulcanized Low-Profile Tire
    const tireMesh = new THREE.Mesh(sharedTireGeo, tireMaterial);
    tireMesh.scale.set(tireScaleW, 1, 1);
    spinGroup.add(tireMesh);

    // 2. Deep-Dish Alloy Rim Barrel + Outer Stepped Lip Ring
    const barrelGeo = new THREE.CylinderGeometry(0.265, 0.265, 0.31 * tireScaleW, 24, 1, true);
    barrelGeo.rotateZ(Math.PI / 2);
    const barrelMesh = new THREE.Mesh(barrelGeo, rimMaterial);
    spinGroup.add(barrelMesh);

    const outerLipGeo = new THREE.TorusGeometry(0.258, 0.018, 8, 24);
    outerLipGeo.rotateY(Math.PI / 2);
    const outerLipMesh = new THREE.Mesh(outerLipGeo, rimMaterial);
    outerLipMesh.position.x = sideSign * 0.142 * tireScaleW;
    spinGroup.add(outerLipMesh);

    // 3. 5 Twin-Spokes (10-Spoke Forged Motorsport Design)
    const offsetX = sideSign * 0.122 * tireScaleW;
    for (let s = 0; s < 5; s++) {
      const baseAngle = (s * Math.PI) / 5;
      const spokeA = new THREE.Mesh(spokeGeo, rimMaterial);
      spokeA.position.set(offsetX, 0, 0);
      spokeA.rotation.x = baseAngle - 0.09;

      const spokeB = new THREE.Mesh(spokeGeo, rimMaterial);
      spokeB.position.set(offsetX, 0, 0);
      spokeB.rotation.x = baseAngle + 0.09;
      spinGroup.add(spokeA, spokeB);
    }

    // 4. Center Hub & Anodized Racing Center-Lock Nut
    const hubGeo = new THREE.CylinderGeometry(0.068, 0.072, 0.32 * tireScaleW, 14);
    hubGeo.rotateZ(Math.PI / 2);
    const hubMesh = new THREE.Mesh(hubGeo, trimMaterial);
    spinGroup.add(hubMesh);

    const centerLockGeo = new THREE.CylinderGeometry(0.036, 0.042, 0.035, 12);
    centerLockGeo.rotateZ(Math.PI / 2);
    const centerLockMesh = new THREE.Mesh(centerLockGeo, caliperMaterial);
    centerLockMesh.position.x = sideSign * 0.155 * tireScaleW;
    spinGroup.add(centerLockMesh);

    // 5. Ventilated Brushed-Steel Brake Rotor Disc
    const rotorMesh = new THREE.Mesh(rotorGeo, brakeRotorMaterial);
    rotorMesh.position.x = sideSign * 0.055 * tireScaleW;
    spinGroup.add(rotorMesh);

    // 6. Stationary Brembo-Style Painted Brake Caliper (mounted to suspensionGroup, does NOT spin with wheel!)
    const caliperMesh = new THREE.Mesh(caliperGeo, caliperMaterial);
    caliperMesh.position.set(
      sideSign * 0.068 * tireScaleW,
      0.08,
      isRear ? -0.155 : 0.155
    );
    caliperMesh.rotation.x = isRear ? 0.45 : -0.45;
    suspensionGroup.add(caliperMesh);

    if (enableSpotlights) {
      const blurDiscGeo = new THREE.CircleGeometry(0.255, 18);
      blurDiscGeo.rotateY(isLeft ? -Math.PI / 2 : Math.PI / 2);
      const blurDiscMesh = new THREE.Mesh(blurDiscGeo, wheelBlurMaterial);
      blurDiscMesh.position.x = sideSign * 0.148 * tireScaleW;
      spinGroup.add(blurDiscMesh);
    }

    suspensionGroup.add(spinGroup);
    // Subtle negative racing camber (-2.2 degrees)
    suspensionGroup.rotation.z = sideSign * 0.038;
    return { suspensionGroup, spinGroup };
  };

  const fl = createWheelCorner(true, false);
  frontLeftPivot.position.set(-0.95 * widthScale, 0.38, -1.35);
  frontLeftPivot.add(fl.suspensionGroup);
  root.add(frontLeftPivot);
  wheels.push(fl.spinGroup);
  wheelAssemblies.push(fl.suspensionGroup);

  const fr = createWheelCorner(false, false);
  frontRightPivot.position.set(0.95 * widthScale, 0.38, -1.35);
  frontRightPivot.add(fr.suspensionGroup);
  root.add(frontRightPivot);
  wheels.push(fr.spinGroup);
  wheelAssemblies.push(fr.suspensionGroup);

  const rl = createWheelCorner(true, true);
  rl.suspensionGroup.position.set(-0.98 * widthScale, 0.38, 1.35);
  root.add(rl.suspensionGroup);
  wheels.push(rl.spinGroup);
  wheelAssemblies.push(rl.suspensionGroup);

  const rr = createWheelCorner(false, true);
  rr.suspensionGroup.position.set(0.98 * widthScale, 0.38, 1.35);
  root.add(rr.suspensionGroup);
  wheels.push(rr.spinGroup);
  wheelAssemblies.push(rr.suspensionGroup);

  return {
    root,
    bodyGroup,
    mainBodyMesh,
    frontBumper,
    rearBumper,
    leftMirror,
    rightMirror,
    frontLeftPivot,
    frontRightPivot,
    wheelAssemblies,
    wheels,
    steeringWheel,
    bodyMaterial,
    rimMaterial,
    brakeLightMaterial,
    reverseLightMaterial,
    turnSignalMaterial,
    brakeHaloMaterial,
    brakeHaloSprites,
    tailTrailMaterial,
    tailTrailMeshes,
    wheelBlurMaterial,
    headlightMaterial,
    headlightSpots,
    headlightBeams,
    underglowLight,
    underglowMesh,
  };
}

/**
 * Displaces car body mesh vertices near the local impact point to create realistic
 * permanent sheet-metal crumple and accident deformation.
 */
export function deformCarBodyMesh(
  mesh: THREE.Mesh,
  localImpactPoint: THREE.Vector3,
  impulseNs: number
): void {
  if (!mesh || !mesh.geometry) return;
  const posAttr = mesh.geometry.attributes.position as THREE.BufferAttribute;
  if (!posAttr) return;

  const radius = 0.72;
  const deformStrength = THREE.MathUtils.clamp(impulseNs / 32000, 0.03, 0.16);
  const v = new THREE.Vector3();
  const centerOfCar = new THREE.Vector3(0, 0.5, 0);

  for (let i = 0; i < posAttr.count; i++) {
    v.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
    const dist = v.distanceTo(localImpactPoint);
    if (dist < radius) {
      const factor = (1 - dist / radius) * deformStrength;
      const crumpleDir = centerOfCar.clone().sub(v).normalize();
      // Add subtle irregularity to mimic crumpled aluminum/carbon
      crumpleDir.x += (Math.random() - 0.5) * 0.4;
      crumpleDir.y += (Math.random() - 0.5) * 0.4;
      crumpleDir.normalize();

      v.addScaledVector(crumpleDir, factor);
      posAttr.setXYZ(i, v.x, v.y, v.z);
    }
  }

  posAttr.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}

