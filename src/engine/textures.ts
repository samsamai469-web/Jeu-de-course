import * as THREE from 'three';

export interface ProceduralTextureSet {
  roadTexture: THREE.CanvasTexture;
  roadEmissiveMap: THREE.CanvasTexture;
  roadNormalMap: THREE.DataTexture;
  roadRoughnessMap: THREE.CanvasTexture;
  kerbTexture: THREE.CanvasTexture;
  gravelTexture: THREE.CanvasTexture;
  chevronSignTexture: THREE.CanvasTexture;
  lampHaloTexture: THREE.CanvasTexture;
  sidewalkTexture: THREE.CanvasTexture;
  guardrailTexture: THREE.CanvasTexture;
  concreteWallTexture: THREE.CanvasTexture;
  mountainRockTexture: THREE.CanvasTexture;
  rockNormalMap: THREE.DataTexture;
  fenceTexture: THREE.CanvasTexture;
  leafCanopyTexture: THREE.CanvasTexture;
  pineBoughTexture: THREE.CanvasTexture;
  barkTexture: THREE.CanvasTexture;
  grassGroundTexture: THREE.CanvasTexture;
  leatherTexture: THREE.CanvasTexture;
  buildingTextureDay: THREE.CanvasTexture;
  buildingTextureNight: THREE.CanvasTexture;
  buildingRoughnessMap: THREE.CanvasTexture;
  buildingNormalMap: THREE.CanvasTexture;
  billboardTexture: THREE.CanvasTexture;
  roadSignTexture: THREE.CanvasTexture;
  checkeredTexture: THREE.CanvasTexture;
  carFlakeNormalMap: THREE.DataTexture;
  tireTreadTexture: THREE.CanvasTexture;
  contactShadowTexture: THREE.CanvasTexture;
  headlightBeamTexture: THREE.CanvasTexture;
  brakeHaloTexture: THREE.CanvasTexture;
  wheelBlurTexture: THREE.CanvasTexture;
  particleTexture: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  // 1. Lighter Grey Asphalt Texture (#3a3d42) with High-Contrast White Markings
  const roadCanvas = document.createElement('canvas');
  roadCanvas.width = 1024;
  roadCanvas.height = 1024;
  const rCtx = roadCanvas.getContext('2d')!;

  const tarmacGrad = rCtx.createLinearGradient(0, 0, 1024, 0);
  tarmacGrad.addColorStop(0.0, '#32353a');
  tarmacGrad.addColorStop(0.08, '#3a3d42');
  tarmacGrad.addColorStop(0.22, '#35383d'); // Left wheel track
  tarmacGrad.addColorStop(0.32, '#3d4046');
  tarmacGrad.addColorStop(0.42, '#36393e'); // Inner left wheel track
  tarmacGrad.addColorStop(0.5, '#3f4248');  // Road crown (#3a3d42 family)
  tarmacGrad.addColorStop(0.58, '#36393e'); // Inner right wheel track
  tarmacGrad.addColorStop(0.68, '#3d4046');
  tarmacGrad.addColorStop(0.78, '#35383d'); // Right wheel track
  tarmacGrad.addColorStop(0.92, '#3a3d42');
  tarmacGrad.addColorStop(1.0, '#32353a');

  rCtx.fillStyle = tarmacGrad;
  rCtx.fillRect(0, 0, 1024, 1024);

  // Fine mineral aggregate micro-grain (70,000 grains around #3a3d42)
  for (let i = 0; i < 70000; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const base = 48 + Math.floor(Math.random() * 32);
    rCtx.fillStyle = `rgba(${base}, ${base + 2}, ${base + 5}, 0.45)`;
    const sz = Math.random() > 0.84 ? 2.2 : 1.4;
    rCtx.fillRect(x, y, sz, sz);
  }

  // Subtle dark tar joints & longitudinal paving seams
  rCtx.strokeStyle = 'rgba(28, 30, 35, 0.5)';
  rCtx.lineWidth = 2.0;
  for (const sx of [78, 512, 946]) {
    rCtx.beginPath();
    rCtx.moveTo(sx, 0);
    rCtx.lineTo(sx, 1024);
    rCtx.stroke();
  }

  // Crisp High-Visibility White Edge Lines on Both Sides of the Track
  rCtx.fillStyle = '#ffffff';
  rCtx.fillRect(58, 0, 18, 1024);
  rCtx.fillRect(948, 0, 18, 1024);

  // Dashed White Center Line (Ligne centrale pointillée bien visible)
  rCtx.fillStyle = '#ffffff';
  for (let y = 0; y < 1024; y += 128) {
    rCtx.fillRect(504, y + 16, 16, 76);
  }

  // Subtle grain over painted lines
  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    rCtx.fillStyle = 'rgba(58, 61, 66, 0.22)';
    rCtx.fillRect(x, y, 2, 2);
  }

  const roadTexture = new THREE.CanvasTexture(roadCanvas);
  roadTexture.colorSpace = THREE.SRGBColorSpace;
  roadTexture.wrapS = THREE.RepeatWrapping;
  roadTexture.wrapT = THREE.RepeatWrapping;
  roadTexture.anisotropy = maxAnisotropy;

  // 1b. Road Emissive Map so white edge & center lines glow softly at distance
  const roadEmissiveCanvas = document.createElement('canvas');
  roadEmissiveCanvas.width = 1024;
  roadEmissiveCanvas.height = 1024;
  const reCtx = roadEmissiveCanvas.getContext('2d')!;
  reCtx.fillStyle = '#14171d';
  reCtx.fillRect(0, 0, 1024, 1024);
  reCtx.fillStyle = '#ffffff';
  reCtx.fillRect(58, 0, 18, 1024);
  reCtx.fillRect(948, 0, 18, 1024);
  for (let y = 0; y < 1024; y += 128) {
    reCtx.fillRect(504, y + 16, 16, 76);
  }
  const roadEmissiveMap = new THREE.CanvasTexture(roadEmissiveCanvas);
  roadEmissiveMap.colorSpace = THREE.SRGBColorSpace;
  roadEmissiveMap.wrapS = THREE.RepeatWrapping;
  roadEmissiveMap.wrapT = THREE.RepeatWrapping;
  roadEmissiveMap.anisotropy = maxAnisotropy;

  // 2. Smoothly Filtered Isotropic Road Normal Map (No rainbow normal aliasing)
  const normSize = 256;
  const rawDx = new Float32Array(normSize * normSize);
  const rawDy = new Float32Array(normSize * normSize);
  for (let i = 0; i < normSize * normSize; i++) {
    rawDx[i] = (Math.random() - 0.5) * 26;
    rawDy[i] = (Math.random() - 0.5) * 26;
  }
  const normData = new Uint8Array(normSize * normSize * 4);
  for (let y = 0; y < normSize; y++) {
    for (let x = 0; x < normSize; x++) {
      const i00 = y * normSize + x;
      const i10 = y * normSize + ((x + 1) % normSize);
      const i01 = ((y + 1) % normSize) * normSize + x;
      const nx = 128 + Math.round((rawDx[i00] + rawDx[i10] + rawDx[i01]) / 3);
      const ny = 128 + Math.round((rawDy[i00] + rawDy[i10] + rawDy[i01]) / 3);
      normData[i00 * 4] = nx;
      normData[i00 * 4 + 1] = ny;
      normData[i00 * 4 + 2] = 255;
      normData[i00 * 4 + 3] = 255;
    }
  }
  const roadNormalMap = new THREE.DataTexture(normData, normSize, normSize, THREE.RGBAFormat);
  roadNormalMap.wrapS = THREE.RepeatWrapping;
  roadNormalMap.wrapT = THREE.RepeatWrapping;
  roadNormalMap.repeat.set(14, 14);
  roadNormalMap.needsUpdate = true;

  // 3. Calibrated Road Roughness Map (Micro-variations + polished wheel tracks)
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 512;
  roughCanvas.height = 512;
  const rgCtx = roughCanvas.getContext('2d')!;
  const rgGrad = rgCtx.createLinearGradient(0, 0, 512, 0);
  rgGrad.addColorStop(0.0, '#e5e5e5');
  rgGrad.addColorStop(0.24, '#a8a8a8');
  rgGrad.addColorStop(0.5, '#d4d4d4');
  rgGrad.addColorStop(0.76, '#a8a8a8');
  rgGrad.addColorStop(1.0, '#e5e5e5');
  rgCtx.fillStyle = rgGrad;
  rgCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 140 + Math.floor(Math.random() * 95);
    rgCtx.fillStyle = `rgb(${v},${v},${v})`;
    rgCtx.fillRect(x, y, 3, 3);
  }
  const roadRoughnessMap = new THREE.CanvasTexture(roughCanvas);
  roadRoughnessMap.wrapS = THREE.RepeatWrapping;
  roadRoughnessMap.wrapT = THREE.RepeatWrapping;
  roadRoughnessMap.anisotropy = maxAnisotropy;

  // 4. Red & White Racing Curbstones Texture (Vibreurs rouge/blanc dans les virages)
  const kerbCanvas = document.createElement('canvas');
  kerbCanvas.width = 256;
  kerbCanvas.height = 256;
  const kCtx = kerbCanvas.getContext('2d')!;
  // Top half: Crimson Red (#dc2626), Bottom half: Crisp White (#f1f5f9)
  kCtx.fillStyle = '#dc2626';
  kCtx.fillRect(0, 0, 256, 128);
  kCtx.fillStyle = '#f1f5f9';
  kCtx.fillRect(0, 128, 256, 128);
  // Dark concrete mortar joints between curb blocks
  kCtx.fillStyle = '#1e293b';
  kCtx.fillRect(0, 122, 256, 7);
  kCtx.fillRect(0, 249, 256, 7);
  // Subtle bevel & tire rubber scuffing along the inner edge
  kCtx.fillStyle = 'rgba(12, 15, 20, 0.42)';
  kCtx.fillRect(0, 0, 34, 256);
  for (let i = 0; i < 2400; i++) {
    const v = 40 + Math.floor(Math.random() * 60);
    kCtx.fillStyle = `rgba(${v}, ${v}, ${v}, 0.18)`;
    kCtx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
  }
  const kerbTexture = new THREE.CanvasTexture(kerbCanvas);
  kerbTexture.colorSpace = THREE.SRGBColorSpace;
  kerbTexture.wrapS = THREE.RepeatWrapping;
  kerbTexture.wrapT = THREE.RepeatWrapping;
  kerbTexture.anisotropy = maxAnisotropy;

  // 4b. Crushed Stone Gravel Verge Texture (Gravier de chaque côté)
  const gvCanvas = document.createElement('canvas');
  gvCanvas.width = 512;
  gvCanvas.height = 512;
  const gvCtx = gvCanvas.getContext('2d')!;
  gvCtx.fillStyle = '#3f3c38';
  gvCtx.fillRect(0, 0, 512, 512);
  const gravelShades = ['#57534e', '#44403c', '#78716c', '#292524', '#6b655e'];
  for (let i = 0; i < 26000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    gvCtx.fillStyle = gravelShades[i % gravelShades.length];
    const sz = 1.5 + Math.random() * 3.0;
    gvCtx.fillRect(x, y, sz, sz);
  }
  const gravelTexture = new THREE.CanvasTexture(gvCanvas);
  gravelTexture.colorSpace = THREE.SRGBColorSpace;
  gravelTexture.wrapS = THREE.RepeatWrapping;
  gravelTexture.wrapT = THREE.RepeatWrapping;
  gravelTexture.anisotropy = maxAnisotropy;

  // 4c. Reflective Red/White Chevron Curve Warning Sign Texture (Panneaux de virage)
  const chvCanvas = document.createElement('canvas');
  chvCanvas.width = 256;
  chvCanvas.height = 128;
  const chvCtx = chvCanvas.getContext('2d')!;
  chvCtx.fillStyle = '#f8fafc';
  chvCtx.fillRect(0, 0, 256, 128);
  chvCtx.fillStyle = '#dc2626';
  for (let cx = -20; cx < 260; cx += 80) {
    chvCtx.beginPath();
    chvCtx.moveTo(cx, 0);
    chvCtx.lineTo(cx + 42, 0);
    chvCtx.lineTo(cx + 76, 64);
    chvCtx.lineTo(cx + 42, 128);
    chvCtx.lineTo(cx, 128);
    chvCtx.lineTo(cx + 34, 64);
    chvCtx.closePath();
    chvCtx.fill();
  }
  chvCtx.strokeStyle = '#1e293b';
  chvCtx.lineWidth = 6;
  chvCtx.strokeRect(3, 3, 250, 122);
  const chevronSignTexture = new THREE.CanvasTexture(chvCanvas);
  chevronSignTexture.colorSpace = THREE.SRGBColorSpace;
  chevronSignTexture.anisotropy = maxAnisotropy;

  // 4d. Soft Radial Streetlamp Light Halo Texture (Pure circular radial gradient, zero square edges)
  const haloCanvas = document.createElement('canvas');
  haloCanvas.width = 128;
  haloCanvas.height = 128;
  const hCtx = haloCanvas.getContext('2d')!;
  hCtx.clearRect(0, 0, 128, 128);
  const hGrad = hCtx.createRadialGradient(64, 64, 1, 64, 64, 52);
  hGrad.addColorStop(0.0, 'rgba(255, 248, 225, 0.95)');
  hGrad.addColorStop(0.25, 'rgba(253, 224, 110, 0.45)');
  hGrad.addColorStop(0.65, 'rgba(253, 224, 110, 0.08)');
  hGrad.addColorStop(1.0, 'rgba(253, 224, 110, 0.0)');
  hCtx.fillStyle = hGrad;
  hCtx.beginPath();
  hCtx.arc(64, 64, 52, 0, Math.PI * 2);
  hCtx.fill();
  const lampHaloTexture = new THREE.CanvasTexture(haloCanvas);
  lampHaloTexture.colorSpace = THREE.SRGBColorSpace;

  // 5. Natural Dark Stone / Cobble Sidewalk & Shoulder Texture
  const swCanvas = document.createElement('canvas');
  swCanvas.width = 256;
  swCanvas.height = 256;
  const swCtx = swCanvas.getContext('2d')!;
  swCtx.fillStyle = '#4a3d36';
  swCtx.fillRect(0, 0, 256, 256);

  const brickRows = 8;
  const brickCols = 4;
  const bh = 256 / brickRows;
  const bw = 256 / brickCols;
  for (let r = 0; r < brickRows; r++) {
    const offset = (r % 2) * (bw / 2);
    for (let c = -1; c <= brickCols; c++) {
      const bx = c * bw + offset;
      const by = r * bh;
      const shade = (Math.random() - 0.5) * 18;
      swCtx.fillStyle = `rgb(${Math.round(118 + shade)}, ${Math.round(78 + shade * 0.7)}, ${Math.round(62 + shade * 0.5)})`;
      swCtx.fillRect(bx + 2, by + 2, bw - 4, bh - 4);
    }
  }
  for (let i = 0; i < 2200; i++) {
    swCtx.fillStyle = 'rgba(20, 20, 24, 0.16)';
    swCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const sidewalkTexture = new THREE.CanvasTexture(swCanvas);
  sidewalkTexture.colorSpace = THREE.SRGBColorSpace;
  sidewalkTexture.wrapS = THREE.RepeatWrapping;
  sidewalkTexture.wrapT = THREE.RepeatWrapping;
  sidewalkTexture.anisotropy = maxAnisotropy;

  // 6. Galvanized Steel W-Beam Guardrail Texture
  const grCanvas = document.createElement('canvas');
  grCanvas.width = 256;
  grCanvas.height = 64;
  const grCtx = grCanvas.getContext('2d')!;
  const grGrad = grCtx.createLinearGradient(0, 0, 0, 64);
  grGrad.addColorStop(0, '#475569');
  grGrad.addColorStop(0.3, '#94a3b8');
  grGrad.addColorStop(0.52, '#334155');
  grGrad.addColorStop(0.78, '#94a3b8');
  grGrad.addColorStop(1, '#334155');
  grCtx.fillStyle = grGrad;
  grCtx.fillRect(0, 0, 256, 64);
  grCtx.fillStyle = '#1e293b';
  grCtx.fillRect(126, 0, 5, 64);
  grCtx.fillStyle = '#dc2626';
  grCtx.fillRect(28, 22, 16, 20);
  const guardrailTexture = new THREE.CanvasTexture(grCanvas);
  guardrailTexture.colorSpace = THREE.SRGBColorSpace;
  guardrailTexture.wrapS = THREE.RepeatWrapping;
  guardrailTexture.wrapT = THREE.RepeatWrapping;
  guardrailTexture.anisotropy = maxAnisotropy;

  // 7. Weathered Poured Concrete Retaining Wall & Tunnel Liner Texture
  const cwCanvas = document.createElement('canvas');
  cwCanvas.width = 512;
  cwCanvas.height = 256;
  const cwCtx = cwCanvas.getContext('2d')!;
  const cwGrad = cwCtx.createLinearGradient(0, 0, 0, 256);
  cwGrad.addColorStop(0, '#6e7175');
  cwGrad.addColorStop(0.2, '#5c6066');
  cwGrad.addColorStop(0.24, '#3d4147');
  cwGrad.addColorStop(0.68, '#555960');
  cwGrad.addColorStop(1, '#373a40');
  cwCtx.fillStyle = cwGrad;
  cwCtx.fillRect(0, 0, 512, 256);

  for (let x = 0; x < 512; x += 64) {
    cwCtx.fillStyle = 'rgba(18, 20, 24, 0.55)';
    cwCtx.fillRect(x, 42, 8, 214);
    cwCtx.fillStyle = 'rgba(148, 163, 184, 0.18)';
    cwCtx.fillRect(x + 8, 42, 3, 214);
    // Concrete formwork tie holes
    cwCtx.fillStyle = 'rgba(15, 18, 22, 0.65)';
    cwCtx.beginPath();
    cwCtx.arc(x + 34, 95, 3, 0, Math.PI * 2);
    cwCtx.arc(x + 34, 185, 3, 0, Math.PI * 2);
    cwCtx.fill();
  }
  for (let i = 0; i < 6000; i++) {
    const v = 50 + Math.floor(Math.random() * 65);
    cwCtx.fillStyle = `rgba(${v},${v + 1},${v + 2},0.22)`;
    cwCtx.fillRect(Math.random() * 512, Math.random() * 256, 3, 3);
  }
  const concreteWallTexture = new THREE.CanvasTexture(cwCanvas);
  concreteWallTexture.colorSpace = THREE.SRGBColorSpace;
  concreteWallTexture.wrapS = THREE.RepeatWrapping;
  concreteWallTexture.wrapT = THREE.RepeatWrapping;
  concreteWallTexture.anisotropy = maxAnisotropy;

  // 8. Natural Alpine Granite & Slate Cliff Rock Texture (No white snow-cone glare!)
  const mrCanvas = document.createElement('canvas');
  mrCanvas.width = 512;
  mrCanvas.height = 512;
  const mrCtx = mrCanvas.getContext('2d')!;
  const mrGrad = mrCtx.createLinearGradient(0, 0, 0, 512);
  mrGrad.addColorStop(0, '#646b75');
  mrGrad.addColorStop(0.35, '#4e555f');
  mrGrad.addColorStop(0.7, '#3c434c');
  mrGrad.addColorStop(1, '#2b332b'); // Mossy base transition
  mrCtx.fillStyle = mrGrad;
  mrCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 360; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const w = 16 + Math.random() * 75;
    const h = 3 + Math.random() * 16;
    mrCtx.save();
    mrCtx.translate(x, y);
    mrCtx.rotate((Math.random() - 0.5) * 0.75);
    const pick = Math.random();
    if (pick < 0.45) {
      mrCtx.fillStyle = 'rgba(24, 28, 34, 0.48)';
    } else if (pick < 0.82) {
      mrCtx.fillStyle = 'rgba(115, 122, 132, 0.32)';
    } else {
      // Natural alpine lichen / moss patches
      mrCtx.fillStyle = 'rgba(54, 78, 52, 0.35)';
    }
    mrCtx.fillRect(-w / 2, -h / 2, w, h);
    mrCtx.restore();
  }
  const mountainRockTexture = new THREE.CanvasTexture(mrCanvas);
  mountainRockTexture.colorSpace = THREE.SRGBColorSpace;
  mountainRockTexture.wrapS = THREE.RepeatWrapping;
  mountainRockTexture.wrapT = THREE.RepeatWrapping;
  mountainRockTexture.anisotropy = maxAnisotropy;

  // Rock Normal Map
  const rNormSize = 128;
  const rNormData = new Uint8Array(rNormSize * rNormSize * 4);
  for (let i = 0; i < rNormSize * rNormSize; i++) {
    rNormData[i * 4] = 128 + Math.floor((Math.random() - 0.5) * 70);
    rNormData[i * 4 + 1] = 128 + Math.floor((Math.random() - 0.5) * 70);
    rNormData[i * 4 + 2] = 255;
    rNormData[i * 4 + 3] = 255;
  }
  const rockNormalMap = new THREE.DataTexture(rNormData, rNormSize, rNormSize, THREE.RGBAFormat);
  rockNormalMap.wrapS = THREE.RepeatWrapping;
  rockNormalMap.wrapT = THREE.RepeatWrapping;
  rockNormalMap.repeat.set(8, 8);
  rockNormalMap.needsUpdate = true;

  // 9. Botanical Broadleaf Canopy Alpha-Cutout Texture (Replaces green balls with real detailed leaf clusters & branches!)
  const lfCanvas = document.createElement('canvas');
  lfCanvas.width = 512;
  lfCanvas.height = 512;
  const lfCtx = lfCanvas.getContext('2d')!;
  lfCtx.clearRect(0, 0, 512, 512);

  // Wooden twigs radiating from bottom-center
  lfCtx.strokeStyle = '#3e2c1e';
  lfCtx.lineCap = 'round';
  const branchAngles = [-0.65, -0.32, 0, 0.32, 0.65];
  for (const ba of branchAngles) {
    lfCtx.save();
    lfCtx.translate(256, 460);
    lfCtx.rotate(ba);
    lfCtx.lineWidth = 7;
    lfCtx.beginPath();
    lfCtx.moveTo(0, 0);
    lfCtx.lineTo(0, -340);
    lfCtx.stroke();
    lfCtx.restore();
  }

  // Draw 420 individual botanical leaves with veins, shadows, and natural olive/emerald/forest hues
  const leafPalette = [
    '#1e3a1e',
    '#254723',
    '#2d5429',
    '#366330',
    '#3f7036',
    '#4d7c3f',
    '#193019',
  ];
  for (let i = 0; i < 420; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.pow(Math.random(), 0.62) * 215;
    const lx = 256 + Math.cos(angle) * radius;
    const ly = 248 + Math.sin(angle) * radius * 0.92;
    const leafW = 14 + Math.random() * 18;
    const leafH = 24 + Math.random() * 26;
    const rot = Math.random() * Math.PI * 2;

    lfCtx.save();
    lfCtx.translate(lx, ly);
    lfCtx.rotate(rot);

    // Leaf ambient occlusion drop shadow
    lfCtx.fillStyle = 'rgba(10, 20, 10, 0.45)';
    lfCtx.beginPath();
    lfCtx.ellipse(2, 3, leafW * 0.5, leafH * 0.5, 0, 0, Math.PI * 2);
    lfCtx.fill();

    // Pointed botanical leaf blade
    lfCtx.fillStyle = leafPalette[i % leafPalette.length];
    lfCtx.beginPath();
    lfCtx.moveTo(0, -leafH * 0.55);
    lfCtx.quadraticCurveTo(leafW * 0.65, 0, 0, leafH * 0.55);
    lfCtx.quadraticCurveTo(-leafW * 0.65, 0, 0, -leafH * 0.55);
    lfCtx.closePath();
    lfCtx.fill();

    // Central leaf vein highlight
    lfCtx.strokeStyle = 'rgba(134, 179, 105, 0.35)';
    lfCtx.lineWidth = 1.2;
    lfCtx.beginPath();
    lfCtx.moveTo(0, -leafH * 0.45);
    lfCtx.lineTo(0, leafH * 0.45);
    lfCtx.stroke();

    lfCtx.restore();
  }
  const leafCanopyTexture = new THREE.CanvasTexture(lfCanvas);
  leafCanopyTexture.colorSpace = THREE.SRGBColorSpace;
  leafCanopyTexture.anisotropy = maxAnisotropy;

  // 10. Alpine Pine / Conifer Needle Bough Alpha-Cutout Texture
  const pnCanvas = document.createElement('canvas');
  pnCanvas.width = 256;
  pnCanvas.height = 256;
  const pnCtx = pnCanvas.getContext('2d')!;
  pnCtx.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 280; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.pow(Math.random(), 0.65) * 112;
    const px = 128 + Math.cos(a) * r;
    const py = 128 + Math.sin(a) * r;
    pnCtx.save();
    pnCtx.translate(px, py);
    pnCtx.rotate(a + (Math.random() - 0.5) * 0.6);
    pnCtx.fillStyle = i % 3 === 0 ? '#163020' : i % 3 === 1 ? '#1f422b' : '#285236';
    pnCtx.fillRect(-3, -14, 6, 28);
    pnCtx.restore();
  }
  const pineBoughTexture = new THREE.CanvasTexture(pnCanvas);
  pineBoughTexture.colorSpace = THREE.SRGBColorSpace;
  pineBoughTexture.anisotropy = maxAnisotropy;

  // 11. Fissured Tree Bark Texture
  const bkCanvas = document.createElement('canvas');
  bkCanvas.width = 256;
  bkCanvas.height = 256;
  const bkCtx = bkCanvas.getContext('2d')!;
  bkCtx.fillStyle = '#3d2e22';
  bkCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    bkCtx.fillStyle = Math.random() > 0.5 ? 'rgba(24, 17, 12, 0.55)' : 'rgba(82, 63, 47, 0.4)';
    bkCtx.fillRect(x, y, 3, 18 + Math.random() * 24);
  }
  const barkTexture = new THREE.CanvasTexture(bkCanvas);
  barkTexture.colorSpace = THREE.SRGBColorSpace;
  barkTexture.wrapS = THREE.RepeatWrapping;
  barkTexture.wrapT = THREE.RepeatWrapping;

  // 12. Natural Valley Meadow & Soil Ground Texture
  const ggCanvas = document.createElement('canvas');
  ggCanvas.width = 512;
  ggCanvas.height = 512;
  const ggCtx = ggCanvas.getContext('2d')!;
  ggCtx.fillStyle = '#253322';
  ggCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 12000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const pick = Math.random();
    ggCtx.fillStyle =
      pick < 0.4 ? 'rgba(44, 62, 36, 0.5)' : pick < 0.75 ? 'rgba(30, 44, 26, 0.5)' : 'rgba(62, 54, 42, 0.35)';
    ggCtx.fillRect(x, y, 4, 4);
  }
  const grassGroundTexture = new THREE.CanvasTexture(ggCanvas);
  grassGroundTexture.colorSpace = THREE.SRGBColorSpace;
  grassGroundTexture.wrapS = THREE.RepeatWrapping;
  grassGroundTexture.wrapT = THREE.RepeatWrapping;
  grassGroundTexture.repeat.set(45, 45);
  grassGroundTexture.anisotropy = maxAnisotropy;

  // 13. Perforated Automotive Leather & Alcantara Interior Texture
  const ltCanvas = document.createElement('canvas');
  ltCanvas.width = 256;
  ltCanvas.height = 256;
  const ltCtx = ltCanvas.getContext('2d')!;
  ltCtx.fillStyle = '#181b22';
  ltCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 8) {
    for (let x = 0; x < 256; x += 8) {
      ltCtx.fillStyle = '#0d0f14';
      ltCtx.fillRect(x + 2, y + 2, 2.5, 2.5);
    }
  }
  // Red double-stitch seam lines
  ltCtx.strokeStyle = '#dc2626';
  ltCtx.lineWidth = 2;
  ltCtx.setLineDash([6, 4]);
  ltCtx.beginPath();
  ltCtx.moveTo(22, 0);
  ltCtx.lineTo(22, 256);
  ltCtx.moveTo(234, 0);
  ltCtx.lineTo(234, 256);
  ltCtx.stroke();
  const leatherTexture = new THREE.CanvasTexture(ltCanvas);
  leatherTexture.colorSpace = THREE.SRGBColorSpace;
  leatherTexture.wrapS = THREE.RepeatWrapping;
  leatherTexture.wrapT = THREE.RepeatWrapping;

  // 14. Roadside Chain-Link Security Fence Texture
  const fnCanvas = document.createElement('canvas');
  fnCanvas.width = 128;
  fnCanvas.height = 128;
  const fnCtx = fnCanvas.getContext('2d')!;
  fnCtx.clearRect(0, 0, 128, 128);
  fnCtx.fillStyle = '#24382e';
  fnCtx.fillRect(0, 0, 128, 7);
  fnCtx.fillRect(0, 62, 128, 4);
  fnCtx.fillRect(0, 121, 128, 7);
  fnCtx.fillRect(0, 0, 7, 128);
  fnCtx.strokeStyle = 'rgba(100, 116, 139, 0.48)';
  fnCtx.lineWidth = 1.4;
  for (let i = -128; i < 256; i += 16) {
    fnCtx.beginPath();
    fnCtx.moveTo(i, 0);
    fnCtx.lineTo(i + 128, 128);
    fnCtx.stroke();
    fnCtx.beginPath();
    fnCtx.moveTo(i + 128, 0);
    fnCtx.lineTo(i, 128);
    fnCtx.stroke();
  }
  const fenceTexture = new THREE.CanvasTexture(fnCanvas);
  fenceTexture.colorSpace = THREE.SRGBColorSpace;
  fenceTexture.wrapS = THREE.RepeatWrapping;
  fenceTexture.wrapT = THREE.RepeatWrapping;
  fenceTexture.anisotropy = maxAnisotropy;

  // 15. Photorealistic Architectural Facade Textures (Travertine/Concrete Cladding + Recessed Reflective Glass + Interior Depth)
  const bRoughCanvas = document.createElement('canvas');
  bRoughCanvas.width = 512;
  bRoughCanvas.height = 1024;
  const brCtx = bRoughCanvas.getContext('2d')!;
  // Stone cladding is matte (white = 0.9 roughness), window glass is glossy (dark = 0.12 roughness)
  brCtx.fillStyle = '#e2e8f0';
  brCtx.fillRect(0, 0, 512, 1024);

  const createBuildingTex = (isNight: boolean, recordRoughness: boolean) => {
    const bCanvas = document.createElement('canvas');
    bCanvas.width = 512;
    bCanvas.height = 1024;
    const bCtx = bCanvas.getContext('2d')!;

    // Natural architectural travertine / dark slate concrete cladding
    bCtx.fillStyle = isNight ? '#161b24' : '#4a525d';
    bCtx.fillRect(0, 0, 512, 1024);

    // Fine stone texture noise on facade walls
    for (let i = 0; i < 8000; i++) {
      const v = isNight ? 18 + Math.random() * 18 : 65 + Math.random() * 32;
      bCtx.fillStyle = `rgba(${v},${v + 2},${v + 5},0.28)`;
      bCtx.fillRect(Math.random() * 512, Math.random() * 1024, 3, 3);
    }

    const rows = 16;
    const cols = 6;
    const floorH = 1024 / rows;
    const colW = 512 / cols;

    for (let r = 0; r < rows; r++) {
      const y = r * floorH;
      // Projected stone cornice & shadow band under each floor slab
      bCtx.fillStyle = isNight ? '#242c3a' : '#646e7c';
      bCtx.fillRect(0, y, 512, 9);
      bCtx.fillStyle = 'rgba(10, 12, 16, 0.55)';
      bCtx.fillRect(0, y + 9, 512, 4);

      for (let c = 0; c < cols; c++) {
        const x = c * colW;
        // Vertical structural pilaster column
        bCtx.fillStyle = isNight ? '#1e2532' : '#57606d';
        bCtx.fillRect(x, y, 10, floorH);

        const wx = x + 13;
        const wy = y + 14;
        const ww = colW - 22;
        const wh = floorH - 20;

        if (recordRoughness) {
          brCtx.fillStyle = '#262626'; // Glossy window glass
          brCtx.fillRect(wx, wy, ww, wh);
        }

        // Interior room depth gradient behind the glass pane
        const winGrad = bCtx.createLinearGradient(wx, wy, wx, wy + wh);
        const isLit = ((r * 11 + c * 7) % 5) < (isNight ? 3 : 2);
        if (isNight && isLit) {
          winGrad.addColorStop(0, '#fde68a');
          winGrad.addColorStop(0.45, '#d97706');
          winGrad.addColorStop(1, '#451a03');
        } else {
          // Daytime sky reflection + dark interior room depth
          winGrad.addColorStop(0, '#1e3a5f');
          winGrad.addColorStop(0.4, '#0f1e33');
          winGrad.addColorStop(1, '#090d16');
        }
        bCtx.fillStyle = winGrad;
        bCtx.fillRect(wx, wy, ww, wh);

        // Interior venetian blinds / ceiling slab detail inside the window
        if ((r + c) % 2 === 0) {
          bCtx.fillStyle = isNight && isLit ? 'rgba(254, 243, 199, 0.35)' : 'rgba(148, 163, 184, 0.22)';
          const blindH = wh * (0.25 + ((r * 3 + c) % 4) * 0.12);
          bCtx.fillRect(wx + 2, wy + 2, ww - 4, blindH);
        }

        // Dark anodized aluminum window frame & mullions
        bCtx.strokeStyle = '#0f141c';
        bCtx.lineWidth = 2.5;
        bCtx.strokeRect(wx, wy, ww, wh);
        bCtx.fillStyle = '#18202c';
        bCtx.fillRect(wx + ww / 2 - 1, wy, 2, wh);
        bCtx.fillRect(wx, wy + wh * 0.68, ww, 2);

        // Architectural glass balcony rail at bottom of window
        bCtx.fillStyle = 'rgba(148, 163, 184, 0.28)';
        bCtx.fillRect(wx + 1, wy + wh - 10, ww - 2, 9);
      }
    }

    const tex = new THREE.CanvasTexture(bCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = maxAnisotropy;
    return tex;
  };

  const buildingTextureDay = createBuildingTex(false, true);
  const buildingTextureNight = createBuildingTex(true, false);

  const buildingRoughnessMap = new THREE.CanvasTexture(bRoughCanvas);
  buildingRoughnessMap.wrapS = THREE.RepeatWrapping;
  buildingRoughnessMap.wrapT = THREE.RepeatWrapping;
  buildingRoughnessMap.anisotropy = maxAnisotropy;

  const bnCanvas = document.createElement('canvas');
  bnCanvas.width = 256;
  bnCanvas.height = 512;
  const bnCtx = bnCanvas.getContext('2d')!;
  bnCtx.fillStyle = 'rgb(128,128,255)';
  bnCtx.fillRect(0, 0, 256, 512);
  for (let y = 0; y < 512; y += 32) {
    bnCtx.fillStyle = 'rgb(128,195,255)';
    bnCtx.fillRect(0, y, 256, 4);
    bnCtx.fillStyle = 'rgb(128,70,255)';
    bnCtx.fillRect(0, y + 4, 256, 3);
  }
  const buildingNormalMap = new THREE.CanvasTexture(bnCanvas);
  buildingNormalMap.wrapS = THREE.RepeatWrapping;
  buildingNormalMap.wrapT = THREE.RepeatWrapping;

  // 16. Highway Electronic Matrix Sign Texture
  const bbCanvas = document.createElement('canvas');
  bbCanvas.width = 512;
  bbCanvas.height = 256;
  const bbCtx = bbCanvas.getContext('2d')!;
  bbCtx.fillStyle = '#090d14';
  bbCtx.fillRect(0, 0, 512, 256);
  bbCtx.strokeStyle = '#334155';
  bbCtx.lineWidth = 10;
  bbCtx.strokeRect(8, 8, 496, 240);
  bbCtx.fillStyle = '#f59e0b';
  bbCtx.font = 'bold 42px monospace';
  bbCtx.fillText('TUNNEL ALPIN', 42, 105);
  bbCtx.fillStyle = '#fbbf24';
  bbCtx.font = 'bold 36px monospace';
  bbCtx.fillText('110 KM/H  ▼▼', 42, 182);
  const billboardTexture = new THREE.CanvasTexture(bbCanvas);
  billboardTexture.colorSpace = THREE.SRGBColorSpace;
  billboardTexture.anisotropy = maxAnisotropy;

  // 17. Yellow Diamond Clearance Warning Sign Texture ("3.8m")
  const rsCanvas = document.createElement('canvas');
  rsCanvas.width = 256;
  rsCanvas.height = 256;
  const rsCtx = rsCanvas.getContext('2d')!;
  rsCtx.fillStyle = '#d97706';
  rsCtx.fillRect(0, 0, 256, 256);
  rsCtx.strokeStyle = '#0f172a';
  rsCtx.lineWidth = 12;
  rsCtx.strokeRect(10, 10, 236, 236);
  rsCtx.fillStyle = '#0f172a';
  rsCtx.font = 'bold 64px sans-serif';
  rsCtx.textAlign = 'center';
  rsCtx.fillText('3.8m', 128, 148);
  rsCtx.font = 'bold 28px sans-serif';
  rsCtx.fillText('▲', 128, 62);
  rsCtx.fillText('▼', 128, 224);
  const roadSignTexture = new THREE.CanvasTexture(rsCanvas);
  roadSignTexture.colorSpace = THREE.SRGBColorSpace;
  roadSignTexture.anisotropy = maxAnisotropy;

  // 18. Checkered Start/Finish Texture
  const chkCanvas = document.createElement('canvas');
  chkCanvas.width = 256;
  chkCanvas.height = 64;
  const cCtx = chkCanvas.getContext('2d')!;
  const sq = 16;
  for (let y = 0; y < 64; y += sq) {
    for (let x = 0; x < 256; x += sq) {
      const even = (x / sq + y / sq) % 2 === 0;
      cCtx.fillStyle = even ? 'rgba(203, 213, 225, 0.78)' : 'rgba(15, 23, 42, 0.85)';
      cCtx.fillRect(x, y, sq, sq);
    }
  }
  const checkeredTexture = new THREE.CanvasTexture(chkCanvas);
  checkeredTexture.colorSpace = THREE.SRGBColorSpace;
  checkeredTexture.wrapS = THREE.RepeatWrapping;
  checkeredTexture.wrapT = THREE.RepeatWrapping;
  checkeredTexture.anisotropy = maxAnisotropy;

  // 19. Metallic Car Paint Micro-Flake Normal Map
  const flakeSize = 128;
  const flakeData = new Uint8Array(flakeSize * flakeSize * 4);
  for (let i = 0; i < flakeSize * flakeSize; i++) {
    flakeData[i * 4] = 128 + Math.floor((Math.random() - 0.5) * 10);
    flakeData[i * 4 + 1] = 128 + Math.floor((Math.random() - 0.5) * 10);
    flakeData[i * 4 + 2] = 255;
    flakeData[i * 4 + 3] = 255;
  }
  const carFlakeNormalMap = new THREE.DataTexture(flakeData, flakeSize, flakeSize, THREE.RGBAFormat);
  carFlakeNormalMap.wrapS = THREE.RepeatWrapping;
  carFlakeNormalMap.wrapT = THREE.RepeatWrapping;
  carFlakeNormalMap.repeat.set(22, 22);
  carFlakeNormalMap.needsUpdate = true;

  // 20. Tire Tread Pattern Texture
  const tireCanvas = document.createElement('canvas');
  tireCanvas.width = 128;
  tireCanvas.height = 256;
  const tCtx = tireCanvas.getContext('2d')!;
  tCtx.fillStyle = '#141518';
  tCtx.fillRect(0, 0, 128, 256);
  tCtx.fillStyle = '#09090b';
  tCtx.fillRect(28, 0, 8, 256);
  tCtx.fillRect(60, 0, 8, 256);
  tCtx.fillRect(92, 0, 8, 256);
  for (let y = 0; y < 256; y += 14) {
    tCtx.fillRect(6, y, 18, 5);
    tCtx.fillRect(104, y + 6, 18, 5);
  }
  const tireTreadTexture = new THREE.CanvasTexture(tireCanvas);
  tireTreadTexture.colorSpace = THREE.SRGBColorSpace;
  tireTreadTexture.wrapS = THREE.RepeatWrapping;
  tireTreadTexture.wrapT = THREE.RepeatWrapping;
  tireTreadTexture.anisotropy = maxAnisotropy;

  // 21. Soft Multi-Stop Elliptical Blob Shadow under Car (Ombre douce sous la voiture pour qu'elle colle à la route)
  const shCanvas = document.createElement('canvas');
  shCanvas.width = 256;
  shCanvas.height = 512;
  const sCtx = shCanvas.getContext('2d')!;
  sCtx.clearRect(0, 0, 256, 512);
  sCtx.save();
  sCtx.translate(128, 256);
  sCtx.scale(1.0, 1.95);
  const grad = sCtx.createRadialGradient(0, 0, 14, 0, 0, 118);
  grad.addColorStop(0.0, 'rgba(0, 0, 0, 0.96)');
  grad.addColorStop(0.45, 'rgba(0, 0, 0, 0.84)');
  grad.addColorStop(0.72, 'rgba(2, 4, 10, 0.45)');
  grad.addColorStop(0.9, 'rgba(2, 4, 10, 0.12)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  sCtx.fillStyle = grad;
  sCtx.beginPath();
  sCtx.arc(0, 0, 118, 0, Math.PI * 2);
  sCtx.fill();
  sCtx.restore();

  const contactShadowTexture = new THREE.CanvasTexture(shCanvas);
  contactShadowTexture.colorSpace = THREE.SRGBColorSpace;

  // 21b. Volumetric Headlight Cone Beam Texture (Faisceau lumineux additif progressif)
  const beamCanvas = document.createElement('canvas');
  beamCanvas.width = 128;
  beamCanvas.height = 256;
  const bmCtx = beamCanvas.getContext('2d')!;
  bmCtx.clearRect(0, 0, 128, 256);
  // In Three.js ConeGeometry, V=1 is at the tip (headlight source) and V=0 is at the wide base (far road)
  // In HTML Canvas, y=0 is V=1 (tip) and y=256 is V=0 (base)
  const bmGrad = bmCtx.createLinearGradient(0, 0, 0, 256);
  bmGrad.addColorStop(0.0, 'rgba(255, 246, 218, 0.55)');
  bmGrad.addColorStop(0.22, 'rgba(255, 244, 214, 0.28)');
  bmGrad.addColorStop(0.62, 'rgba(254, 240, 200, 0.08)');
  bmGrad.addColorStop(1.0, 'rgba(254, 240, 200, 0.0)');
  bmCtx.fillStyle = bmGrad;
  bmCtx.fillRect(0, 0, 128, 256);
  const headlightBeamTexture = new THREE.CanvasTexture(beamCanvas);
  headlightBeamTexture.colorSpace = THREE.SRGBColorSpace;

  // 21c. Additive Red Taillight / Brake Halo & Light Trail Texture
  const brkCanvas = document.createElement('canvas');
  brkCanvas.width = 128;
  brkCanvas.height = 128;
  const bkGlowCtx = brkCanvas.getContext('2d')!;
  bkGlowCtx.clearRect(0, 0, 128, 128);
  const bkGrad = bkGlowCtx.createRadialGradient(64, 64, 2, 64, 64, 58);
  bkGrad.addColorStop(0.0, 'rgba(255, 180, 180, 1.0)');
  bkGrad.addColorStop(0.22, 'rgba(239, 68, 68, 0.85)');
  bkGrad.addColorStop(0.55, 'rgba(220, 38, 38, 0.28)');
  bkGrad.addColorStop(1.0, 'rgba(185, 28, 28, 0.0)');
  bkGlowCtx.fillStyle = bkGrad;
  bkGlowCtx.beginPath();
  bkGlowCtx.arc(64, 64, 58, 0, Math.PI * 2);
  bkGlowCtx.fill();
  const brakeHaloTexture = new THREE.CanvasTexture(brkCanvas);
  brakeHaloTexture.colorSpace = THREE.SRGBColorSpace;

  // 21d. High-Speed Radial Wheel Motion Blur Texture (Léger flou à haute vitesse)
  const wbCanvas = document.createElement('canvas');
  wbCanvas.width = 128;
  wbCanvas.height = 128;
  const wbCtx = wbCanvas.getContext('2d')!;
  wbCtx.clearRect(0, 0, 128, 128);
  const wbGrad = wbCtx.createRadialGradient(64, 64, 10, 64, 64, 58);
  wbGrad.addColorStop(0.0, 'rgba(226, 232, 240, 0.65)');
  wbGrad.addColorStop(0.35, 'rgba(203, 213, 225, 0.42)');
  wbGrad.addColorStop(0.75, 'rgba(148, 163, 184, 0.55)');
  wbGrad.addColorStop(0.92, 'rgba(71, 85, 105, 0.2)');
  wbGrad.addColorStop(1.0, 'rgba(15, 23, 42, 0.0)');
  wbCtx.fillStyle = wbGrad;
  wbCtx.beginPath();
  wbCtx.arc(64, 64, 58, 0, Math.PI * 2);
  wbCtx.fill();
  // Subtle concentric motion streaks
  wbCtx.strokeStyle = 'rgba(248, 250, 252, 0.35)';
  wbCtx.lineWidth = 2;
  for (const r of [24, 36, 48]) {
    wbCtx.beginPath();
    wbCtx.arc(64, 64, r, 0.2, 2.4);
    wbCtx.stroke();
    wbCtx.beginPath();
    wbCtx.arc(64, 64, r, 3.3, 5.5);
    wbCtx.stroke();
  }
  const wheelBlurTexture = new THREE.CanvasTexture(wbCanvas);
  wheelBlurTexture.colorSpace = THREE.SRGBColorSpace;

  // 22. Soft Circular Particle / Star Point Texture (Pure radial circle, zero square edges)
  const pCanvas = document.createElement('canvas');
  pCanvas.width = 64;
  pCanvas.height = 64;
  const pCtx = pCanvas.getContext('2d')!;
  pCtx.clearRect(0, 0, 64, 64);
  const pGrad = pCtx.createRadialGradient(32, 32, 1, 32, 32, 26);
  pGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  pGrad.addColorStop(0.35, 'rgba(240, 245, 255, 0.55)');
  pGrad.addColorStop(0.75, 'rgba(240, 245, 255, 0.08)');
  pGrad.addColorStop(1, 'rgba(240, 245, 255, 0.0)');
  pCtx.fillStyle = pGrad;
  pCtx.beginPath();
  pCtx.arc(32, 32, 26, 0, Math.PI * 2);
  pCtx.fill();

  const particleTexture = new THREE.CanvasTexture(pCanvas);
  particleTexture.colorSpace = THREE.SRGBColorSpace;

  return {
    roadTexture,
    roadEmissiveMap,
    roadNormalMap,
    roadRoughnessMap,
    kerbTexture,
    gravelTexture,
    chevronSignTexture,
    lampHaloTexture,
    sidewalkTexture,
    guardrailTexture,
    concreteWallTexture,
    mountainRockTexture,
    rockNormalMap,
    fenceTexture,
    leafCanopyTexture,
    pineBoughTexture,
    barkTexture,
    grassGroundTexture,
    leatherTexture,
    buildingTextureDay,
    buildingTextureNight,
    buildingRoughnessMap,
    buildingNormalMap,
    billboardTexture,
    roadSignTexture,
    checkeredTexture,
    carFlakeNormalMap,
    tireTreadTexture,
    contactShadowTexture,
    headlightBeamTexture,
    brakeHaloTexture,
    wheelBlurTexture,
    particleTexture,
    dispose: () => {
      roadTexture.dispose();
      roadEmissiveMap.dispose();
      roadNormalMap.dispose();
      roadRoughnessMap.dispose();
      kerbTexture.dispose();
      gravelTexture.dispose();
      chevronSignTexture.dispose();
      lampHaloTexture.dispose();
      sidewalkTexture.dispose();
      guardrailTexture.dispose();
      concreteWallTexture.dispose();
      mountainRockTexture.dispose();
      rockNormalMap.dispose();
      fenceTexture.dispose();
      leafCanopyTexture.dispose();
      pineBoughTexture.dispose();
      barkTexture.dispose();
      grassGroundTexture.dispose();
      leatherTexture.dispose();
      buildingTextureDay.dispose();
      buildingTextureNight.dispose();
      buildingRoughnessMap.dispose();
      buildingNormalMap.dispose();
      billboardTexture.dispose();
      roadSignTexture.dispose();
      checkeredTexture.dispose();
      carFlakeNormalMap.dispose();
      tireTreadTexture.dispose();
      contactShadowTexture.dispose();
      headlightBeamTexture.dispose();
      brakeHaloTexture.dispose();
      wheelBlurTexture.dispose();
      particleTexture.dispose();
    },
  };
}
