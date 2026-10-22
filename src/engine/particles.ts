import * as THREE from 'three';

interface ParticleItem {
  active: boolean;
  age: number;
  maxAge: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export class ParticlePool {
  public points: THREE.Points;
  private pool: ParticleItem[] = [];
  private positions: Float32Array;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private maxCount: number;
  private writeCursor = 0;

  constructor(particleTexture: THREE.Texture, maxCount = 140, color = 0xe2e8f0, size = 0.95) {
    this.maxCount = maxCount;
    this.positions = new Float32Array(maxCount * 3);

    for (let i = 0; i < maxCount; i++) {
      this.positions[i * 3] = 0;
      this.positions[i * 3 + 1] = -999;
      this.positions[i * 3 + 2] = 0;
      this.pool.push({
        active: false,
        age: 0,
        maxAge: 0.6,
        x: 0,
        y: -999,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
      });
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    this.material = new THREE.PointsMaterial({
      map: particleTexture,
      color,
      size,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }

  public spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, maxAge = 0.55) {
    const p = this.pool[this.writeCursor];
    this.writeCursor = (this.writeCursor + 1) % this.maxCount;
    p.active = true;
    p.age = 0;
    p.maxAge = maxAge;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
  }

  public update(dt: number) {
    let dirty = false;
    for (let i = 0; i < this.maxCount; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      dirty = true;
      p.age += dt;
      if (p.age >= p.maxAge) {
        p.active = false;
        this.positions[i * 3 + 1] = -999;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        this.positions[i * 3] = p.x;
        this.positions[i * 3 + 1] = p.y;
        this.positions[i * 3 + 2] = p.z;
      }
    }
    if (dirty) {
      this.geometry.attributes.position.needsUpdate = true;
    }
  }

  public dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
