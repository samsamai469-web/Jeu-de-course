import * as THREE from 'three';
import { CarCustomization, CarSpec } from '../types/game';

export interface CarRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  frontLeftPivot: THREE.Group;
  frontRightPivot: THREE.Group;
  wheelAssemblies: THREE.Group[]; // For vertical suspension travel
  wheels: THREE.Object3D[]; // For rotational spin
  steeringWheel: THREE.Group;
  bodyMaterial: THREE.MeshPhysicalMaterial;
  rimMaterial: THREE.MeshStandardMaterial;
  brakeLightMaterial: THREE.MeshPhysicalMaterial;
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

/**
 * Generates a high-polygon, CAD-sculpted 3D lower automobile body (nose, hood,
 * flared fenders, sculpted doors, beltline, rear quarter panels, and rear bumper)
 * with 35 longitudinal stations and 32 cross-section segments.
 */
function createLoftedLowerBodyGeometry(style: CarSpec['bodyStyle']): THREE.BufferGeometry {
  const widthFactor = style === 'muscle' ? 1.06 : style === 'hyper' ? 1.04 : 1.0;
  const heightFactor = style === 'hyper' ? 0.92 : style === 'muscle' ? 1.04 : 1.02;

  const zStations = [
    -2.36, -2.32, -2.24, -2.12, -1.96, -1.8, -1.64, -1.49, -1.35, -1.21,
    -1.06, -0.9, -0.72, -0.52, -0.3, -0.05, 0.2, 0.45, 0.7, 0.92,
    1.1, 1.24, 1.36, 1.48, 1.62, 1.76, 1.9, 2.02, 2.12, 2.2, 2.26, 2.29,
  ];

  const ringSegments = 30;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const getStationProfile = (z: number) => {
    const absFrontWheel = Math.exp(-Math.pow((z - -1.35) / 0.37, 2));
    const absRearWheel = Math.exp(-Math.pow((z - 1.35) / 0.39, 2));
    const wheelFlare = (absFrontWheel * 0.125 + absRearWheel * 0.155) * widthFactor;

    const midDoorPinch = z > -0.68 && z < 0.78 ? Math.sin(((z + 0.68) / 1.46) * Math.PI) * 0.055 : 0;

    let halfW = 0.96 * widthFactor;
    if (z < -1.88) {
      const t = (z - -2.36) / 0.48;
      halfW *= 0.64 + 0.36 * Math.pow(Math.max(0, t), 0.62);
    } else if (z > 1.9) {
      const t = (2.29 - z) / 0.39;
      halfW *= 0.82 + 0.18 * Math.pow(Math.max(0, t), 0.68);
    }
    halfW += wheelFlare;

    let centerTopY = 0.8;
    if (z < -0.68) {
      const t = Math.max(0, Math.min(1, (z - -2.36) / 1.68));
      centerTopY = 0.37 + Math.pow(t, 0.64) * 0.45;
    } else if (z <= 1.15) {
      centerTopY = 0.64; // Recessed cabin tub so sculpted interior sits naturally inside
    } else {
      const t = Math.max(0, Math.min(1, (z - 1.15) / 1.14));
      centerTopY = 0.84 - Math.pow(t, 1.35) * 0.09;
    }
    centerTopY *= heightFactor;

    const fenderCrestBoost = absFrontWheel * 0.06 + absRearWheel * 0.08;
    const shoulderY = (0.83 + fenderCrestBoost) * heightFactor;
    const archCutoutY = 0.21 + (absFrontWheel + absRearWheel) * 0.25;

    return { halfW, centerTopY, shoulderY, archCutoutY, midDoorPinch };
  };

  for (let i = 0; i < zStations.length; i++) {
    const z = zStations[i];
    const v = (z + 2.36) / 4.65;
    const { halfW, centerTopY, shoulderY, archCutoutY, midDoorPinch } = getStationProfile(z);

    const isCap = i === 0 || i === zStations.length - 1;
    const capScale = isCap ? 0.02 : 1.0;

    for (let j = 0; j <= ringSegments; j++) {
      const angle = (j / ringSegments) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      let x = sinA * halfW * capScale;
      let y = 0.45;

      if (cosA >= 0) {
        const lat = Math.abs(sinA);
        const hoodCrease = lat > 0.38 && lat < 0.52 && z < -0.7 ? 0.016 : 0;
        const archHump = lat > 0.68 ? Math.sin(((lat - 0.68) / 0.32) * Math.PI) * 0.042 : 0;
        y = THREE.MathUtils.lerp(shoulderY, centerTopY, Math.pow(Math.max(0, cosA), 0.75)) + archHump + hoodCrease;
      } else {
        const downT = Math.max(0, -cosA);
        const sidePinch = (1 - downT) * midDoorPinch;
        x = Math.sign(sinA) * Math.max(0, Math.abs(x) - sidePinch);
        const minBottomY = Math.abs(sinA) > 0.72 ? archCutoutY : 0.2;
        y = THREE.MathUtils.lerp(shoulderY * 0.76, minBottomY, Math.pow(downT, 0.52));
      }

      if (isCap) {
        y = i === 0 ? 0.36 : 0.56;
      }

      positions.push(x, y, z);
      uvs.push(j / ringSegments, v);
    }
  }

  const stride = ringSegments + 1;
  for (let i = 0; i < zStations.length - 1; i++) {
    for (let j = 0; j < ringSegments; j++) {
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
 * Generates a realistic smoked glass greenhouse (front windshield, side windows,
 * and angled rear hatch/fastback window) with smooth compound curvature.
 */
function createGlassGreenhouseGeometry(style: CarSpec['bodyStyle']): THREE.BufferGeometry {
  const widthFactor = style === 'muscle' ? 1.04 : style === 'hyper' ? 0.96 : 1.0;
  const heightFactor = style === 'hyper' ? 0.92 : style === 'muscle' ? 1.04 : 1.04;

  const rearZ = style === 'street' ? 1.82 : 1.56;
  const penultZ = style === 'street' ? 1.58 : 1.46;
  const zStations = [-0.86, -0.68, -0.45, -0.18, 0.12, 0.45, 0.78, 1.08, 1.32, penultZ, rearZ];
  const ringSegments = 24;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < zStations.length; i++) {
    const z = zStations[i];
    const t = THREE.MathUtils.clamp((z - -0.86) / (rearZ - -0.86), 0, 1);

    const roofCurve = Math.max(0, Math.sin(Math.pow(t, 0.72) * Math.PI));
    const topY = (0.82 + Math.pow(roofCurve, 0.58) * 0.48) * heightFactor;
    const baseY = 0.8 * heightFactor;

    const widthProfile = Math.max(0, Math.sin(Math.pow(t, 0.55) * Math.PI));
    const halfW = (0.52 + Math.pow(widthProfile, 0.45) * 0.26) * widthFactor;

    for (let j = 0; j <= ringSegments; j++) {
      const u = j / ringSegments;
      const angle = u * Math.PI;
      const cosA = -Math.cos(angle);
      const sinA = Math.max(0, Math.sin(angle));
      const x = Math.sign(cosA) * Math.pow(Math.abs(cosA), 0.72) * halfW;
      const y = baseY + Math.pow(sinA, 0.55) * (topY - baseY);

      positions.push(x, y, z);
      uvs.push(u, t);
    }
  }

  const stride = ringSegments + 1;
  for (let i = 0; i < zStations.length - 1; i++) {
    for (let j = 0; j < ringSegments; j++) {
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
 * Creates a contoured, ergonomic Recaro-style sport bucket seat with curved bolsters,
 * sculpted headrest, and harness slots (Zero simple BoxGeometry cubes!).
 */
function createContouredBucketSeat(
  leatherMat: THREE.Material,
  redAlcantaraMat: THREE.Material,
  trimMat: THREE.Material,
  heightScale: number
): THREE.Group {
  const seatGroup = new THREE.Group();

  // Contoured backrest profile with shoulder wings
  const backShape = new THREE.Shape();
  backShape.moveTo(-0.15, 0);
  backShape.quadraticCurveTo(-0.21, 0.14, -0.22, 0.32); // Left shoulder wing
  backShape.quadraticCurveTo(-0.18, 0.46, -0.1, 0.52);
  backShape.quadraticCurveTo(0, 0.64, 0.1, 0.52); // Integrated curved headrest top
  backShape.quadraticCurveTo(0.18, 0.46, 0.22, 0.32); // Right shoulder wing
  backShape.quadraticCurveTo(0.21, 0.14, 0.15, 0);
  backShape.closePath();

  const backGeo = new THREE.ExtrudeGeometry(backShape, {
    steps: 2,
    depth: 0.055,
    bevelEnabled: true,
    bevelThickness: 0.028,
    bevelSize: 0.025,
    bevelSegments: 4,
  });
  const backMesh = new THREE.Mesh(backGeo, leatherMat);
  backMesh.position.set(0, 0.62 * heightScale, 0.08);
  backMesh.rotation.x = 0.18;
  seatGroup.add(backMesh);

  // Sculpted Left & Right Curved Side Bolsters in Crimson Alcantara
  const bolsterGeo = new THREE.CapsuleGeometry(0.042, 0.34, 8, 12);
  const bolsterL = new THREE.Mesh(bolsterGeo, redAlcantaraMat);
  bolsterL.position.set(-0.175, 0.83 * heightScale, 0.085);
  bolsterL.rotation.x = 0.18;
  bolsterL.rotation.z = 0.08;

  const bolsterR = new THREE.Mesh(bolsterGeo, redAlcantaraMat);
  bolsterR.position.set(0.175, 0.83 * heightScale, 0.085);
  bolsterR.rotation.x = 0.18;
  bolsterR.rotation.z = -0.08;
  seatGroup.add(bolsterL, bolsterR);

  // Twin Racing Harness Pass-Through Bezels in Upper Backrest
  const slotGeo = new THREE.TorusGeometry(0.028, 0.008, 8, 14);
  slotGeo.scale(1.4, 0.75, 1);
  const slotL = new THREE.Mesh(slotGeo, trimMat);
  slotL.position.set(-0.055, 1.03 * heightScale, 0.12);
  slotL.rotation.x = 0.18;
  const slotR = new THREE.Mesh(slotGeo, trimMat);
  slotR.position.set(0.055, 1.03 * heightScale, 0.12);
  slotR.rotation.x = 0.18;
  seatGroup.add(slotL, slotR);

  // Contoured Thigh Cushion with Side Thigh Bolsters
  const cushionGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.38, 14);
  cushionGeo.rotateZ(Math.PI / 2);
  cushionGeo.scale(1, 0.35, 1.15);
  const cushionMesh = new THREE.Mesh(cushionGeo, leatherMat);
  cushionMesh.position.set(0, 0.61 * heightScale, -0.04);
  seatGroup.add(cushionMesh);

  return seatGroup;
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
      return { metalness: 0.88, roughness: 0.14, clearcoat: 1.0, clearcoatRoughness: 0.05 };
    }
    if (finish === 'matte') {
      return { metalness: 0.4, roughness: 0.48, clearcoat: 0.3, clearcoatRoughness: 0.32 };
    }
    // 1. CARROSSERIE : MeshPhysicalMaterial avec clearcoat 1, clearcoat roughness 0.1, metalness 0.7, roughness 0.3
    return { metalness: 0.7, roughness: 0.3, clearcoat: 1.0, clearcoatRoughness: 0.1 };
  };

  const finishProps = getFinishProps(customization.finish);

  // 1. Calibrated Automotive Clearcoat Paint Material (metalness 0.7, roughness 0.3, clearcoat 1.0, clearcoatRoughness 0.1 + PMREM envMap reflections)
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(customization.bodyColor || '#1d4ed8'),
    metalness: finishProps.metalness,
    roughness: finishProps.roughness,
    clearcoat: finishProps.clearcoat,
    clearcoatRoughness: finishProps.clearcoatRoughness,
    normalMap: carFlakeNormalMap || null,
    normalScale: new THREE.Vector2(0.05, 0.05),
    envMapIntensity: 1.6,
  });

  // 2. Satin Trim / Rubber Window Seals Material
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0x101319,
    metalness: 0.3,
    roughness: 0.52,
  });

  // Lower Rear Bumper Lip Accent
  const lowerLipMaterial = new THREE.MeshPhysicalMaterial({
    color: spec.bodyStyle === 'street' ? 0x161a24 : 0x141820,
    metalness: 0.55,
    roughness: 0.32,
    clearcoat: 0.85,
  });

  // 3. Realistic Dark Smoked Automotive Glass Canopy
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x090f18,
    metalness: 0.15,
    roughness: 0.04,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    envMapIntensity: 1.15,
  });

  // 4. Forged Metallic Alloy Rim Material (Jantes métalliques)
  const rimMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(customization.rimColor),
    metalness: 0.9,
    roughness: 0.16,
    envMapIntensity: 1.35,
  });

  // 5. Matte Black Rubber Tire Material (Pneus noirs mats)
  const tireMaterial = new THREE.MeshStandardMaterial({
    color: 0x101215,
    map: tireTreadTexture || null,
    metalness: 0.02,
    roughness: 0.9,
  });

  // High-speed wheel motion blur material (Léger flou à haute vitesse)
  const wheelBlurMaterial = new THREE.MeshBasicMaterial({
    map: wheelBlurTexture || null,
    color: new THREE.Color(customization.rimColor),
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // 6. Optical Headlight & Emissive Red LED Taillight Materials
  const headlightColor = new THREE.Color(customization.headlightColor);
  const headlightMaterial = new THREE.MeshStandardMaterial({
    color: headlightColor,
    emissive: headlightColor,
    emissiveIntensity: 2.5,
    roughness: 0.08,
  });

  const brakeLightMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xdc2626,
    emissive: 0xef4444,
    emissiveIntensity: 1.8,
    roughness: 0.1,
    clearcoat: 1.0,
  });

  // Additive Red Halo Sprite Material for Rear LED Bar & Brake Lights
  const brakeHaloMaterial = new THREE.SpriteMaterial({
    map: brakeHaloTexture || null,
    color: 0xff2a2a,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  // Subtle High-Speed Taillight Light-Trail Material (Traînée lumineuse subtile derrière les feux à haute vitesse)
  const tailTrailMaterial = new THREE.MeshBasicMaterial({
    map: brakeHaloTexture || null,
    color: 0xef4444,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const reverseLensMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xcbd5e1,
    emissive: 0x94a3b8,
    emissiveIntensity: 0.25,
    roughness: 0.15,
    clearcoat: 1.0,
  });

  // 6. OMBRE : Soft Elliptical Ground Blob Shadow under the Car (pour qu'elle colle à la route)
  const shadowGeo = new THREE.PlaneGeometry(3.15, 5.65);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTexture,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.025;
  root.add(shadowMesh);

  const widthScale = spec.bodyStyle === 'muscle' ? 1.06 : spec.bodyStyle === 'hyper' ? 1.04 : 1.0;
  const heightScale = spec.bodyStyle === 'hyper' ? 0.92 : spec.bodyStyle === 'muscle' ? 1.04 : 1.04;

  // PART 1: High-Resolution Lofted Lower Bodywork + Inner Wheel Arch Liners
  const bodyGeo = createLoftedLowerBodyGeometry(spec.bodyStyle);
  const mainBodyMesh = new THREE.Mesh(bodyGeo, bodyMaterial);
  mainBodyMesh.castShadow = true;
  mainBodyMesh.receiveShadow = true;
  bodyGroup.add(mainBodyMesh);

  // Dark Matte Inner Wheel Well Liners (prevents seeing empty space inside wheel arches)
  const archLinerMat = new THREE.MeshBasicMaterial({ color: 0x080a0e });
  const archLinerGeo = new THREE.CylinderGeometry(0.41, 0.41, 0.42, 18, 1, false, 0, Math.PI);
  archLinerGeo.rotateZ(Math.PI / 2);
  for (const [ax, az] of [
    [-0.82 * widthScale, -1.35],
    [0.82 * widthScale, -1.35],
    [-0.84 * widthScale, 1.35],
    [0.84 * widthScale, 1.35],
  ]) {
    const liner = new THREE.Mesh(archLinerGeo, archLinerMat);
    liner.position.set(ax, 0.39, az);
    bodyGroup.add(liner);
  }

  // PART 2: Sculpted Automotive Interior Cabin (Contoured Leather Seats, Curved Dashboard, Binnacle, Door Cards)
  const interiorGroup = new THREE.Group();
  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x1e232d,
    map: leatherTexture || null,
    roughness: 0.68,
    metalness: 0.08,
  });
  const redAlcantaraMat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    roughness: 0.74,
    metalness: 0.05,
  });

  // Sculpted Cabin Tub & Transmission Tunnel
  const tunnelGeo = new THREE.CylinderGeometry(0.13, 0.18, 1.45, 12);
  tunnelGeo.rotateX(Math.PI / 2);
  const tunnelMesh = new THREE.Mesh(tunnelGeo, leatherMat);
  tunnelMesh.position.set(0, 0.62 * heightScale, 0.05);
  interiorGroup.add(tunnelMesh);

  // Contoured Left & Right Door Interior Cards with Sculpted Armrests
  for (const side of [-1, 1]) {
    const doorCardGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.32, 10);
    doorCardGeo.rotateX(Math.PI / 2);
    doorCardGeo.scale(0.55, 2.2, 1);
    const doorCard = new THREE.Mesh(doorCardGeo, leatherMat);
    doorCard.position.set(side * 0.69 * widthScale, 0.72 * heightScale, 0.02);
    const armrest = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.55, 6, 10), redAlcantaraMat);
    armrest.rotation.x = Math.PI / 2;
    armrest.position.set(side * 0.64 * widthScale, 0.74 * heightScale, -0.02);
    interiorGroup.add(doorCard, armrest);
  }

  // Sculpted Curved Dashboard Wing & Driver Gauge Binnacle Hood
  const dashWingGeo = new THREE.CylinderGeometry(0.24, 0.28, 1.36 * widthScale, 16, 1, false, 0, Math.PI);
  dashWingGeo.rotateZ(Math.PI / 2);
  dashWingGeo.scale(1, 0.62, 1.25);
  const dashWing = new THREE.Mesh(dashWingGeo, leatherMat);
  dashWing.position.set(0, 0.78 * heightScale, -0.52);
  interiorGroup.add(dashWing);

  // Hooded Driver Instrument Binnacle Arch
  const binnacleGeo = new THREE.CylinderGeometry(0.18, 0.2, 0.34, 16, 1, false, -Math.PI * 0.5, Math.PI);
  binnacleGeo.rotateX(Math.PI / 2);
  binnacleGeo.scale(1.15, 0.68, 1);
  const binnacleHood = new THREE.Mesh(binnacleGeo, leatherMat);
  binnacleHood.position.set(-0.32, 0.89 * heightScale, -0.38);
  interiorGroup.add(binnacleHood);

  // Dual Circular Gauge Bezels inside Binnacle
  const gaugeRingGeo = new THREE.TorusGeometry(0.052, 0.008, 8, 18);
  const gaugeFaceMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    emissive: 0x0284c7,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  for (const gx of [-0.38, -0.26]) {
    const gRing = new THREE.Mesh(gaugeRingGeo, rimMaterial);
    gRing.position.set(gx, 0.9 * heightScale, -0.28);
    gRing.rotation.x = -0.22;
    const gFace = new THREE.Mesh(new THREE.CircleGeometry(0.048, 16), gaugeFaceMat);
    gFace.position.set(gx, 0.9 * heightScale, -0.282);
    gFace.rotation.x = -0.22;
    interiorGroup.add(gRing, gFace);
  }

  // Leather Shift Boot Cone & Polished Gear Shifter
  const shiftBoot = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.11, 12), leatherMat);
  shiftBoot.position.set(0, 0.74 * heightScale, -0.12);
  const shifterStick = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.14, 10), rimMaterial);
  shifterStick.position.set(0, 0.83 * heightScale, -0.12);
  shifterStick.rotation.x = -0.14;
  const shifterKnob = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 12), rimMaterial);
  shifterKnob.position.set(0, 0.9 * heightScale, -0.135);
  interiorGroup.add(shiftBoot, shifterStick, shifterKnob);

  // Sculpted Interior Central Rear-View Mirror with Oval Bezel
  const rvMirrorMount = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.09, 8), trimMaterial);
  rvMirrorMount.position.set(0, 1.22 * heightScale, -0.32);
  const rvMirrorGeo = new THREE.CapsuleGeometry(0.026, 0.16, 8, 12);
  rvMirrorGeo.rotateZ(Math.PI / 2);
  rvMirrorGeo.scale(1, 1, 0.45);
  const rvMirrorBody = new THREE.Mesh(rvMirrorGeo, trimMaterial);
  rvMirrorBody.position.set(0, 1.18 * heightScale, -0.32);
  interiorGroup.add(rvMirrorMount, rvMirrorBody);

  // Sculpted 3-Spoke Sport Steering Wheel
  const steeringWheel = new THREE.Group();
  steeringWheel.position.set(-0.32, 0.89 * heightScale, -0.16);
  steeringWheel.rotation.x = -0.28;
  const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.022, 12, 28), leatherMat);
  const wheelHub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 14), trimMaterial);
  wheelHub.rotation.x = Math.PI / 2;
  const wheelSpoke = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.026, 0.018), rimMaterial);
  const topMarker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.023, 0.023, 0.028, 10),
    new THREE.MeshBasicMaterial({ color: 0xef4444 })
  );
  topMarker.rotation.z = Math.PI / 2;
  topMarker.position.set(0, 0.145, 0);
  steeringWheel.add(wheelRing, wheelHub, wheelSpoke, topMarker);
  interiorGroup.add(steeringWheel);

  // Two Contoured Front Sport Bucket Seats (Left & Right)
  const seatL = createContouredBucketSeat(leatherMat, redAlcantaraMat, trimMaterial, heightScale);
  seatL.position.x = -0.32;
  const seatR = createContouredBucketSeat(leatherMat, redAlcantaraMat, trimMaterial, heightScale);
  seatR.position.x = 0.32;
  interiorGroup.add(seatL, seatR);

  // Contoured Rear Bench Seat with Curved Bolsters & Twin Sculpted Headrests
  const rearBenchGroup = new THREE.Group();
  const rearBackGeo = new THREE.CylinderGeometry(0.16, 0.16, 1.22, 14);
  rearBackGeo.rotateZ(Math.PI / 2);
  rearBackGeo.scale(1, 1.45, 0.45);
  const rearBackMesh = new THREE.Mesh(rearBackGeo, leatherMat);
  rearBackMesh.position.set(0, 0.84 * heightScale, 0.78);
  rearBackMesh.rotation.x = 0.18;
  rearBenchGroup.add(rearBackMesh);

  for (const rx of [-0.32, 0.32]) {
    const rBolster = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.24, 8, 12), redAlcantaraMat);
    rBolster.rotation.z = Math.PI / 2;
    rBolster.position.set(rx, 0.88 * heightScale, 0.75);
    const rHeadrest = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.11, 8, 12), leatherMat);
    rHeadrest.rotation.z = Math.PI / 2;
    rHeadrest.position.set(rx, 1.03 * heightScale, 0.81);
    rearBenchGroup.add(rBolster, rHeadrest);
  }
  interiorGroup.add(rearBenchGroup);
  bodyGroup.add(interiorGroup);

  // PART 3: Sculpted Curved Roof Panel, A/B/C Pillars & Rear Spoiler
  const roofLength = spec.bodyStyle === 'street' ? 1.38 : 1.15;
  const roofArchGeo = new THREE.CylinderGeometry(0.58 * widthScale, 0.62 * widthScale, roofLength, 18, 1, false, -0.95, 1.9);
  roofArchGeo.rotateZ(Math.PI / 2);
  roofArchGeo.rotateY(Math.PI / 2);
  roofArchGeo.scale(1, 0.16, 1);
  const roofMesh = new THREE.Mesh(roofArchGeo, bodyMaterial);
  roofMesh.position.set(0, 1.22 * heightScale, 0.22);
  roofMesh.castShadow = true;
  bodyGroup.add(roofMesh);

  // Sculpted Rear Roof Spoiler Wing
  const spoilerCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.58 * widthScale, 1.28 * heightScale, spec.bodyStyle === 'street' ? 0.94 : 0.84),
    new THREE.Vector3(0, 1.31 * heightScale, spec.bodyStyle === 'street' ? 0.91 : 0.81),
    new THREE.Vector3(0.58 * widthScale, 1.28 * heightScale, spec.bodyStyle === 'street' ? 0.94 : 0.84),
  ]);
  const roofSpoilerGeo = new THREE.TubeGeometry(spoilerCurve, 16, 0.055, 8, false);
  roofSpoilerGeo.scale(1, 0.35, 2.2);
  const roofSpoiler = new THREE.Mesh(roofSpoilerGeo, trimMaterial);
  bodyGroup.add(roofSpoiler);

  // Smooth Cylindrical A-Pillars, B-Pillars & C-Pillars framing the Greenhouse
  for (const side of [-1, 1]) {
    const aPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.58, 10), bodyMaterial);
    aPillar.position.set(side * 0.62 * widthScale, 1.05 * heightScale, -0.52);
    aPillar.rotation.x = -0.68;
    aPillar.rotation.z = -side * 0.22;
    bodyGroup.add(aPillar);

    const bPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.48, 8), trimMaterial);
    bPillar.position.set(side * 0.68 * widthScale, 1.05 * heightScale, 0.18);
    bPillar.rotation.z = -side * 0.2;
    bodyGroup.add(bPillar);

    const cPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.058, 0.58, 10), bodyMaterial);
    cPillar.position.set(side * 0.62 * widthScale, 1.04 * heightScale, spec.bodyStyle === 'street' ? 1.36 : 1.18);
    cPillar.rotation.x = 0.64;
    cPillar.rotation.z = -side * 0.22;
    bodyGroup.add(cPillar);
  }

  // Smoked Glass Greenhouse
  const canopyGeo = createGlassGreenhouseGeometry(spec.bodyStyle);
  const canopyMesh = new THREE.Mesh(canopyGeo, glassMaterial);
  canopyMesh.renderOrder = 2;
  bodyGroup.add(canopyMesh);

  // Rear Wiper Arm & Blade
  const wiperGeo = new THREE.CylinderGeometry(0.008, 0.01, 0.42, 6);
  wiperGeo.rotateZ(Math.PI / 2);
  const wiperMesh = new THREE.Mesh(wiperGeo, trimMaterial);
  wiperMesh.position.set(0.14, 0.86 * heightScale, spec.bodyStyle === 'street' ? 1.79 : 1.54);
  wiperMesh.rotation.z = -0.18;
  wiperMesh.rotation.x = 0.55;
  bodyGroup.add(wiperMesh);

  // PART 4: Rear Trunk / Tailgate Details — Beveled License Plate Recess & Sculpted Lower Lip
  const plateShape = new THREE.Shape();
  plateShape.moveTo(-0.36 * widthScale, -0.09);
  plateShape.lineTo(0.36 * widthScale, -0.09);
  plateShape.lineTo(0.32 * widthScale, 0.09);
  plateShape.lineTo(-0.32 * widthScale, 0.09);
  plateShape.closePath();

  const plateRecessGeo = new THREE.ExtrudeGeometry(plateShape, {
    steps: 1,
    depth: 0.04,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 3,
  });
  const plateRecessMesh = new THREE.Mesh(plateRecessGeo, trimMaterial);
  plateRecessMesh.position.set(0, 0.62 * heightScale, 2.24);
  bodyGroup.add(plateRecessMesh);

  // Sculpted Curved Lower Rear Bumper Valence / Diffuser
  const rearLipCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.92 * widthScale, 0.25, 2.02),
    new THREE.Vector3(-0.55 * widthScale, 0.24, 2.21),
    new THREE.Vector3(0, 0.24, 2.25),
    new THREE.Vector3(0.55 * widthScale, 0.24, 2.21),
    new THREE.Vector3(0.92 * widthScale, 0.25, 2.02),
  ]);
  const rearLipGeo = new THREE.TubeGeometry(rearLipCurve, 24, 0.075, 10, false);
  rearLipGeo.scale(1, 0.85, 1.35);
  const rearLowerLip = new THREE.Mesh(rearLipGeo, lowerLipMaterial);
  bodyGroup.add(rearLowerLip);

  // PART 5: Full-Width Emissive Red LED Light Bar + Wrap-Around Corner Taillight Clusters + Additive Halo Sprites + High-Speed Trails
  const buildCornerTaillight = (side: -1 | 1) => {
    const tGroup = new THREE.Group();

    const housingGeo = new THREE.SphereGeometry(0.22, 16, 12);
    housingGeo.scale(0.82, 0.68, 0.65);
    const housing = new THREE.Mesh(housingGeo, trimMaterial);
    tGroup.add(housing);

    // Upper Ruby-Red Brake & Tail Lens Dome
    const upperRedGeo = new THREE.SphereGeometry(0.215, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
    upperRedGeo.scale(0.84, 0.7, 0.68);
    const upperRed = new THREE.Mesh(upperRedGeo, brakeLightMaterial);
    upperRed.position.set(0, 0.01, 0.01);
    tGroup.add(upperRed);

    // Middle Crystal Clear Turn/Reverse Lens Band
    const midClearGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.055, 16);
    midClearGeo.scale(0.95, 1, 0.75);
    const midClear = new THREE.Mesh(midClearGeo, reverseLensMaterial);
    midClear.position.set(0, -0.02, 0.012);
    tGroup.add(midClear);

    // Lower Red Reflector Bowl
    const lowerRedGeo = new THREE.SphereGeometry(0.21, 16, 12, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45);
    lowerRedGeo.scale(0.84, 0.68, 0.68);
    const lowerRed = new THREE.Mesh(lowerRedGeo, brakeLightMaterial);
    lowerRed.position.set(0, -0.01, 0.01);
    tGroup.add(lowerRed);

    tGroup.position.set(side * 0.74 * widthScale, 0.67 * heightScale, 2.13);
    tGroup.rotation.y = side * 0.24;
    tGroup.rotation.z = -side * 0.06;
    return tGroup;
  };
  bodyGroup.add(buildCornerTaillight(-1), buildCornerTaillight(1));

  // Full-Width Emissive Red LED Light Bar (Barre LED rouge émissive sur toute la largeur arrière)
  const ledBarCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.74 * widthScale, 0.69 * heightScale, 2.15),
    new THREE.Vector3(-0.38 * widthScale, 0.71 * heightScale, 2.23),
    new THREE.Vector3(0, 0.715 * heightScale, 2.25),
    new THREE.Vector3(0.38 * widthScale, 0.71 * heightScale, 2.23),
    new THREE.Vector3(0.74 * widthScale, 0.69 * heightScale, 2.15),
  ]);
  const ledBarGeo = new THREE.TubeGeometry(ledBarCurve, 24, 0.026, 8, false);
  ledBarGeo.scale(1, 0.75, 1.15);
  const ledBarMesh = new THREE.Mesh(ledBarGeo, brakeLightMaterial);
  bodyGroup.add(ledBarMesh);

  // Additive Red Halo Sprites on the Rear Taillights & LED Bar
  const brakeHaloSprites: THREE.Sprite[] = [];
  for (const hx of [-0.72 * widthScale, 0, 0.72 * widthScale]) {
    const haloSprite = new THREE.Sprite(brakeHaloMaterial);
    const isCenter = hx === 0;
    haloSprite.position.set(hx, 0.69 * heightScale, isCenter ? 2.31 : 2.22);
    haloSprite.scale.set(isCenter ? 1.45 : 0.95, isCenter ? 0.52 : 0.68, 1);
    bodyGroup.add(haloSprite);
    brakeHaloSprites.push(haloSprite);
  }

  // Subtle High-Speed Taillight Light Trails (Traînée lumineuse subtile derrière les feux à haute vitesse)
  const tailTrailMeshes: THREE.Mesh[] = [];
  const trailGeo = new THREE.PlaneGeometry(0.28, 3.2);
  // Shift plane so local origin is at the rear taillight and extends toward +Z (behind the car)
  trailGeo.rotateX(-Math.PI / 2);
  trailGeo.translate(0, 0, 1.6);
  for (const side of [-1, 1]) {
    const trailGroup = new THREE.Mesh(trailGeo, tailTrailMaterial);
    trailGroup.position.set(side * 0.72 * widthScale, 0.68 * heightScale, 2.16);
    bodyGroup.add(trailGroup);
    tailTrailMeshes.push(trailGroup);
  }

  // High-Mount Wing for GT / Hyper / Muscle models
  if (spec.bodyStyle !== 'street') {
    const wingGroup = new THREE.Group();
    const wingHeight = spec.bodyStyle === 'hyper' ? 1.15 : 1.07;
    const wingSpan = 1.88 * widthScale;

    const wingCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-wingSpan / 2, (wingHeight - 0.03) * heightScale, 2.06),
      new THREE.Vector3(0, wingHeight * heightScale, 1.96),
      new THREE.Vector3(wingSpan / 2, (wingHeight - 0.03) * heightScale, 2.06),
    ]);
    const wingTubeGeo = new THREE.TubeGeometry(wingCurve, 20, 0.1, 8, false);
    wingTubeGeo.scale(1, 0.22, 1.35);
    const wingBlade = new THREE.Mesh(wingTubeGeo, trimMaterial);
    wingBlade.castShadow = true;
    wingGroup.add(wingBlade);

    const pylonGeo = new THREE.CylinderGeometry(0.022, 0.028, 0.26, 8);
    for (const px of [-0.38, 0.38]) {
      const pylon = new THREE.Mesh(pylonGeo, trimMaterial);
      pylon.position.set(px * widthScale, (wingHeight - 0.12) * heightScale, 1.96);
      pylon.rotation.x = -0.25;
      wingGroup.add(pylon);
    }
    bodyGroup.add(wingGroup);
  }

  // PART 6: Polished Stainless Exhaust Canister & Chrome Exhaust Tip(s)
  const exhaustOuterGeo = new THREE.CylinderGeometry(0.068, 0.072, 0.34, 18);
  exhaustOuterGeo.rotateX(Math.PI / 2);
  const exhaustInnerGeo = new THREE.CylinderGeometry(0.054, 0.054, 0.35, 14);
  exhaustInnerGeo.rotateX(Math.PI / 2);
  const boreMat = new THREE.MeshBasicMaterial({ color: 0x050505 });

  if (spec.bodyStyle === 'street') {
    const mufflerCanister = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.095, 0.42, 16),
      rimMaterial
    );
    mufflerCanister.rotation.x = Math.PI / 2;
    mufflerCanister.position.set(0.42 * widthScale, 0.22, 2.05);
    const tipOuter = new THREE.Mesh(exhaustOuterGeo, rimMaterial);
    tipOuter.position.set(0.42 * widthScale, 0.21, 2.24);
    const tipInner = new THREE.Mesh(exhaustInnerGeo, boreMat);
    tipInner.position.set(0.42 * widthScale, 0.21, 2.25);
    bodyGroup.add(mufflerCanister, tipOuter, tipInner);
  } else {
    for (const ex of [-0.46, 0.46]) {
      const outer = new THREE.Mesh(exhaustOuterGeo, rimMaterial);
      outer.position.set(ex * widthScale, 0.24, 2.25);
      const inner = new THREE.Mesh(exhaustInnerGeo, boreMat);
      inner.position.set(ex * widthScale, 0.24, 2.26);
      bodyGroup.add(outer, inner);
    }
  }

  // PART 7: Aerodynamic Side Mirrors with Rear-Facing Reflective Mirror Glass
  const mirrorGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x94a3b8,
    metalness: 0.96,
    roughness: 0.04,
    envMapIntensity: 1.2,
  });

  const buildMirror = (side: -1 | 1) => {
    const mGroup = new THREE.Group();
    const stalkGeo = new THREE.CylinderGeometry(0.02, 0.026, 0.15, 8);
    stalkGeo.rotateZ(side * 1.1);
    const stalk = new THREE.Mesh(stalkGeo, trimMaterial);
    mGroup.add(stalk);

    const housingGeo = new THREE.SphereGeometry(0.105, 14, 10);
    housingGeo.scale(1.25, 0.65, 0.8);
    const housing = new THREE.Mesh(housingGeo, bodyMaterial);
    housing.position.set(side * 0.09, 0.03, 0);
    mGroup.add(housing);

    const mirrorFace = new THREE.Mesh(new THREE.CircleGeometry(0.068, 14), mirrorGlassMat);
    mirrorFace.scale.set(1.2, 0.68, 1);
    mirrorFace.position.set(side * 0.09, 0.03, 0.068);
    mGroup.add(mirrorFace);

    mGroup.position.set(side * 0.78 * widthScale, 0.88 * heightScale, -0.45);
    return mGroup;
  };
  bodyGroup.add(buildMirror(-1), buildMirror(1));

  // PART 8: Front Grille & Multi-Optic LED Projector Headlights
  const grilleMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68 * widthScale, 0.68 * widthScale, 0.18, 16, 1, false, -0.7, 1.4),
    trimMaterial
  );
  grilleMesh.position.set(0, 0.36, -1.68);
  bodyGroup.add(grilleMesh);

  const buildHeadlightCluster = (side: -1 | 1) => {
    const hGroup = new THREE.Group();
    const bezelGeo = new THREE.SphereGeometry(0.18, 12, 10);
    bezelGeo.scale(1.2, 0.45, 0.9);
    const bezel = new THREE.Mesh(bezelGeo, trimMaterial);
    hGroup.add(bezel);

    const lensGeo = new THREE.SphereGeometry(0.055, 10, 10);
    const lens1 = new THREE.Mesh(lensGeo, headlightMaterial);
    lens1.position.set(-side * 0.05, 0.01, -0.08);
    const lens2 = new THREE.Mesh(lensGeo, headlightMaterial);
    lens2.position.set(side * 0.06, 0.02, -0.06);

    hGroup.add(lens1, lens2);
    hGroup.position.set(side * 0.68 * widthScale, 0.51 * heightScale, -2.14);
    return hGroup;
  };
  bodyGroup.add(buildHeadlightCluster(-1), buildHeadlightCluster(1));

  const headlightSpots: THREE.SpotLight[] = [];
  const headlightBeams: THREE.Mesh[] = [];
  if (enableSpotlights) {
    // 2. PHARES : 2 SpotLight vers l'avant (angle 0.45, penumbra 0.6, distance 90, blanc chaud) - Max 2 SpotLights for 60 FPS mobile
    const warmWhite = 0xfff3d6;
    const spotL = new THREE.SpotLight(warmWhite, 95, 90, 0.45, 0.6, 1.05);
    spotL.position.set(-0.68 * widthScale, 0.65 * heightScale, -2.16);
    spotL.target.position.set(-0.68 * widthScale, -0.12, -36);
    bodyGroup.add(spotL, spotL.target);

    const spotR = new THREE.SpotLight(warmWhite, 95, 90, 0.45, 0.6, 1.05);
    spotR.position.set(0.68 * widthScale, 0.65 * heightScale, -2.16);
    spotR.target.position.set(0.68 * widthScale, -0.12, -36);
    bodyGroup.add(spotR, spotR.target);
    headlightSpots.push(spotL, spotR);

    // Visible Volumetric Light Beams (Cône transparent additif)
    const beamConeGeo = new THREE.ConeGeometry(2.65, 22.0, 20, 1, true);
    // Shift cone so the apex is at (0,0,0) and the cone projects forward along -Z
    beamConeGeo.translate(0, -11.0, 0);
    beamConeGeo.rotateX(Math.PI / 2);
    const beamConeMat = new THREE.MeshBasicMaterial({
      map: headlightBeamTexture || null,
      color: warmWhite,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    for (const side of [-1, 1]) {
      const beamMesh = new THREE.Mesh(beamConeGeo, beamConeMat);
      beamMesh.position.set(side * 0.68 * widthScale, 0.51 * heightScale, -2.18);
      beamMesh.rotation.x = -0.045; // Aimed slightly down onto the road ahead
      beamMesh.rotation.y = -side * 0.03;
      beamMesh.renderOrder = 3;
      bodyGroup.add(beamMesh);
      headlightBeams.push(beamMesh);
    }
  }

  // PART 9: Optional Neon Underglow
  const underglowLight = new THREE.PointLight(
    new THREE.Color(customization.bodyColor),
    customization.neonUnderglow ? 3.8 : 0,
    5.8
  );
  underglowLight.position.set(0, 0.22, 0);
  bodyGroup.add(underglowLight);

  const underglowGeo = new THREE.PlaneGeometry(1.75, 3.7);
  const underglowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(customization.bodyColor),
    transparent: true,
    opacity: customization.neonUnderglow ? 0.42 : 0.0,
    depthWrite: false,
  });
  const underglowMesh = new THREE.Mesh(underglowGeo, underglowMat);
  underglowMesh.rotation.x = -Math.PI / 2;
  underglowMesh.position.y = 0.035;
  root.add(underglowMesh);

  // PART 10: 4 Wide Cambered Wheels, Deep-Dish Multi-Spoke Forged Rims & Brake Calipers
  const wheels: THREE.Object3D[] = [];
  const wheelAssemblies: THREE.Group[] = [];
  const frontLeftPivot = new THREE.Group();
  const frontRightPivot = new THREE.Group();

  const tirePoints = [
    new THREE.Vector2(0.24, -0.155),
    new THREE.Vector2(0.35, -0.17),
    new THREE.Vector2(0.388, -0.13),
    new THREE.Vector2(0.395, 0.0),
    new THREE.Vector2(0.388, 0.13),
    new THREE.Vector2(0.35, 0.17),
    new THREE.Vector2(0.24, 0.155),
  ];
  const sharedTireGeo = new THREE.LatheGeometry(tirePoints, 28);
  sharedTireGeo.rotateZ(Math.PI / 2);

  const rotorMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    metalness: 0.85,
    roughness: 0.32,
  });
  const caliperMat = new THREE.MeshPhysicalMaterial({
    color: 0xdc2626,
    metalness: 0.4,
    roughness: 0.22,
    clearcoat: 0.9,
  });

  const createWheelCorner = (isLeft: boolean, isRear: boolean) => {
    const suspensionGroup = new THREE.Group();
    const spinGroup = new THREE.Group();

    const tireScaleW = isRear ? 1.18 : 1.06;
    const tireMesh = new THREE.Mesh(sharedTireGeo, tireMaterial);
    tireMesh.scale.set(tireScaleW, 1, 1);
    tireMesh.castShadow = true;
    spinGroup.add(tireMesh);

    const barrelGeo = new THREE.CylinderGeometry(0.268, 0.268, 0.31 * tireScaleW, 24, 1, true);
    barrelGeo.rotateZ(Math.PI / 2);
    const barrelMesh = new THREE.Mesh(barrelGeo, rimMaterial);
    spinGroup.add(barrelMesh);

    const spokeGeo = new THREE.CylinderGeometry(0.015, 0.022, 0.248, 8);
    const offsetX = (isLeft ? -1 : 1) * 0.115 * tireScaleW;
    for (let s = 0; s < 6; s++) {
      const baseAngle = (s * Math.PI * 2) / 6;
      const spoke = new THREE.Mesh(spokeGeo, rimMaterial);
      spoke.position.set(offsetX, Math.cos(baseAngle) * 0.12, Math.sin(baseAngle) * 0.12);
      spoke.rotation.x = -baseAngle;
      spoke.rotation.z = (isLeft ? 1 : -1) * 0.1;
      spinGroup.add(spoke);
    }

    const hubGeo = new THREE.CylinderGeometry(0.055, 0.065, 0.32 * tireScaleW, 14);
    hubGeo.rotateZ(Math.PI / 2);
    const hubMesh = new THREE.Mesh(hubGeo, trimMaterial);
    spinGroup.add(hubMesh);

    // High-Speed Radial Wheel Motion Blur Disc on Outer Face of Rim
    const blurDiscGeo = new THREE.CircleGeometry(0.255, 20);
    blurDiscGeo.rotateY(isLeft ? -Math.PI / 2 : Math.PI / 2);
    const blurDiscMesh = new THREE.Mesh(blurDiscGeo, wheelBlurMaterial);
    blurDiscMesh.position.x = (isLeft ? -1 : 1) * 0.145 * tireScaleW;
    spinGroup.add(blurDiscMesh);

    const rotorGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.03, 20);
    rotorGeo.rotateZ(Math.PI / 2);
    const rotorMesh = new THREE.Mesh(rotorGeo, rotorMat);
    rotorMesh.position.x = (isLeft ? -1 : 1) * 0.04;
    spinGroup.add(rotorMesh);

    const caliperGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.09, 10);
    caliperGeo.rotateZ(Math.PI / 2);
    const caliperMesh = new THREE.Mesh(caliperGeo, caliperMat);
    caliperMesh.position.set((isLeft ? -1 : 1) * 0.05, 0.06, isRear ? -0.14 : 0.14);
    suspensionGroup.add(caliperMesh);

    suspensionGroup.add(spinGroup);
    suspensionGroup.rotation.z = (isLeft ? -1 : 1) * 0.055;
    return { suspensionGroup, spinGroup };
  };

  const fl = createWheelCorner(true, false);
  frontLeftPivot.position.set(-0.96 * widthScale, 0.39, -1.35);
  frontLeftPivot.add(fl.suspensionGroup);
  root.add(frontLeftPivot);
  wheels.push(fl.spinGroup);
  wheelAssemblies.push(fl.suspensionGroup);

  const fr = createWheelCorner(false, false);
  frontRightPivot.position.set(0.96 * widthScale, 0.39, -1.35);
  frontRightPivot.add(fr.suspensionGroup);
  root.add(frontRightPivot);
  wheels.push(fr.spinGroup);
  wheelAssemblies.push(fr.suspensionGroup);

  const rl = createWheelCorner(true, true);
  rl.suspensionGroup.position.set(-0.99 * widthScale, 0.39, 1.35);
  root.add(rl.suspensionGroup);
  wheels.push(rl.spinGroup);
  wheelAssemblies.push(rl.suspensionGroup);

  const rr = createWheelCorner(false, true);
  rr.suspensionGroup.position.set(0.99 * widthScale, 0.39, 1.35);
  root.add(rr.suspensionGroup);
  wheels.push(rr.spinGroup);
  wheelAssemblies.push(rr.suspensionGroup);

  return {
    root,
    bodyGroup,
    frontLeftPivot,
    frontRightPivot,
    wheelAssemblies,
    wheels,
    steeringWheel,
    bodyMaterial,
    rimMaterial,
    brakeLightMaterial,
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
