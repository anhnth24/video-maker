// Dùng chung cho các job render: vật liệu, texture vẽ bằng canvas, ánh sáng
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function makeRenderer(w, h, { alpha = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (alpha) renderer.setClearColor(0x000000, 0);
  document.body.appendChild(renderer.domElement);
  return renderer;
}

export function makeEnv(renderer, scene, intensity = 0.6) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = intensity;
  return env;
}

// ---------- Texture canvas ----------
export function canvasTex(w, h, draw, { repeat = null, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

let seed = 1234567;
export function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

export function marbleTex() {
  return canvasTex(1024, 1024, (g, w, h) => {
    const n = 4, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const light = (i + j) % 2 === 0;
      g.fillStyle = light ? '#c9b08a' : '#b39470';
      g.fillRect(i * s, j * s, s, s);
      // vân đá
      for (let k = 0; k < 7; k++) {
        g.strokeStyle = `rgba(${light ? '150,120,80' : '120,90,55'},${0.08 + rnd() * 0.12})`;
        g.lineWidth = 0.6 + rnd() * 1.8;
        g.beginPath();
        let x = i * s + rnd() * s, y = j * s;
        g.moveTo(x, y);
        for (let t = 0; t < 12; t++) { x += (rnd() - 0.5) * 40; y += s / 12; g.lineTo(x, y); }
        g.stroke();
      }
    }
    g.strokeStyle = 'rgba(120,80,40,0.55)'; g.lineWidth = 3;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
  }, { repeat: [6, 10] });
}

export function carpetTex() {
  return canvasTex(512, 2048, (g, w, h) => {
    g.fillStyle = '#9a0f12'; g.fillRect(0, 0, w, h);
    const grd = g.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0.25)'); grd.addColorStop(0.5, 'rgba(255,80,60,0.12)'); grd.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // viền vàng
    g.fillStyle = '#e2ad45'; g.fillRect(14, 0, 22, h); g.fillRect(w - 36, 0, 22, h);
    g.fillStyle = '#7a0a0c'; g.fillRect(40, 0, 8, h); g.fillRect(w - 48, 0, 8, h);
    g.fillStyle = '#e2ad45'; g.fillRect(52, 0, 5, h); g.fillRect(w - 57, 0, 5, h);
    // hoa văn giữa
    for (let y = 80; y < h; y += 220) {
      g.save(); g.translate(w / 2, y);
      g.strokeStyle = '#e2ad45'; g.lineWidth = 6;
      g.beginPath(); g.moveTo(0, -70); g.lineTo(70, 0); g.lineTo(0, 70); g.lineTo(-70, 0); g.closePath(); g.stroke();
      g.fillStyle = '#d9a13a';
      for (let a = 0; a < 8; a++) { g.rotate(Math.PI / 4); g.beginPath(); g.ellipse(0, -30, 9, 22, 0, 0, Math.PI * 2); g.fill(); }
      g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    // sợi thảm
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.08})`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
  });
}

export function wallTex() {
  return canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#6e0e0a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d8a447'; g.lineWidth = 6;
    const s = 256;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const x = i * s, y = j * s;
      g.strokeRect(x + 16, y + 16, s - 32, s - 32);
      g.lineWidth = 3;
      g.beginPath(); g.arc(x + s / 2, y + s / 2, 60, 0, Math.PI * 2); g.stroke();
      for (let a = 0; a < 8; a++) {
        const an = (a / 8) * Math.PI * 2;
        g.beginPath(); g.arc(x + s / 2 + Math.cos(an) * 60, y + s / 2 + Math.sin(an) * 60, 18, 0, Math.PI * 2); g.stroke();
      }
      g.lineWidth = 6;
    }
  }, { repeat: [4, 2] });
}

export function latticeTex() {
  return canvasTex(512, 512, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.7);
    grd.addColorStop(0, '#fff0c0'); grd.addColorStop(1, '#ff9a40');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#5a0a06'; g.lineWidth = 14;
    for (let i = -h; i < w + h; i += 48) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke();
      g.beginPath(); g.moveTo(i, h); g.lineTo(i + h, 0); g.stroke();
    }
    g.lineWidth = 24; g.strokeRect(0, 0, w, h);
  });
}

export function plaqueTex(text) {
  return canvasTex(1024, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#8e1a12'); grd.addColorStop(1, '#4a0806');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f0c060'; g.lineWidth = 16; g.strokeRect(10, 10, w - 20, h - 20);
    g.lineWidth = 4; g.strokeRect(34, 34, w - 68, h - 68);
    const tg = g.createLinearGradient(0, 60, 0, 190);
    tg.addColorStop(0, '#fff2b8'); tg.addColorStop(0.5, '#f2c050'); tg.addColorStop(1, '#b07818');
    g.fillStyle = tg;
    let fs = 104; do { g.font = `bold ${fs}px "DejaVu Serif", "Noto Serif", Georgia, serif`; fs -= 4; } while (g.measureText(text).width > w - 110);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 6);
  });
}

export function radialTex(stops, size = 512) {
  return canvasTex(size, size, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    stops.forEach(([o, c]) => grd.addColorStop(o, c));
    g.fillStyle = grd; g.fillRect(0, 0, w, w);
  });
}

// ---------- Vật liệu ----------
export const MAT = {
  gold: () => new THREE.MeshStandardMaterial({ color: 0xffc35a, metalness: 1, roughness: 0.28 }),
  goldStatue: () => new THREE.MeshStandardMaterial({ color: 0xf3b64a, metalness: 0.95, roughness: 0.32, emissive: 0x2a1600, emissiveIntensity: 0.15 }),
  goldDark: () => new THREE.MeshStandardMaterial({ color: 0xc8892a, metalness: 1, roughness: 0.4 }),
  bronze: () => new THREE.MeshStandardMaterial({ color: 0xc08a3e, metalness: 1, roughness: 0.35 }),
  redLacquer: () => new THREE.MeshPhysicalMaterial({ color: 0x8c120c, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
  darkWood: () => new THREE.MeshStandardMaterial({ color: 0x3a0a06, roughness: 0.6 }),
  pink: () => new THREE.MeshStandardMaterial({ color: 0xff9ab8, roughness: 0.45, emissive: 0x401020, emissiveIntensity: 0.3 }),
  leaf: () => new THREE.MeshStandardMaterial({ color: 0x2f7d45, roughness: 0.5 }),
  porcelain: () => new THREE.MeshPhysicalMaterial({ color: 0x2c6c96, roughness: 0.15, clearcoat: 1 }),
  wax: () => new THREE.MeshStandardMaterial({ color: 0xfff2dc, roughness: 0.6, emissive: 0x402a10, emissiveIntensity: 0.4 }),
  flame: () => new THREE.MeshBasicMaterial({ color: 0xffd27a }),
};

// Cánh sen: hình lá được uốn cong
export function petalGeometry(w = 0.25, h = 0.6, curve = 0.18, depth = 0.03) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(-w, h * 0.25, -w * 0.75, h * 0.8, 0, h);
  shape.bezierCurveTo(w * 0.75, h * 0.8, w, h * 0.25, 0, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: depth * 0.5, bevelSize: depth * 0.6, bevelSegments: 2, curveSegments: 16 });
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const u = y / h;
    // cong ra phía trước (z) theo chiều dọc, lõm theo chiều ngang
    pos.setZ(i, z + Math.sin(u * Math.PI * 0.9) * curve * h - (x * x) / (w * w) * curve * 0.35 * h * (1 - u * 0.5));
  }
  geo.computeVertexNormals();
  return geo;
}

export function lotusFlower(scale = 1, mat) {
  const g = new THREE.Group();
  const m = mat || MAT.pink();
  const tiers = [[8, 0.5, 0.95], [6, 0.35, 0.8], [5, 0.15, 0.6]];
  tiers.forEach(([n, tilt, s], ti) => {
    const geo = petalGeometry(0.12 * s, 0.32 * s, 0.25, 0.012);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ti * 0.4;
      // quay mặt cánh hướng ra ngoài
      const holder = new THREE.Group();
      holder.rotation.y = a;
      const inner = new THREE.Mesh(geo, m);
      inner.rotation.x = tilt * Math.PI * 0.6; // mở cánh ra ngoài
      inner.position.z = 0.02;
      holder.add(inner);
      g.add(holder);
    }
  });
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffd65a, emissive: 0x804000, emissiveIntensity: 0.4 }));
  center.position.y = 0.06;
  g.add(center);
  g.scale.setScalar(scale);
  return g;
}

export function lathe(points, segs = 48) {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segs);
}
