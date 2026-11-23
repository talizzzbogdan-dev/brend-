import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isNarrow = () => innerWidth < 760;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const PAL = {
  cobalt: 0x2b3bff, bone: 0xf0ece4, camel: 0xc19a6b, forest: 0x27483d, navy: 0x1f2a44,
  blush: 0xe0a699, slate: 0x7d8594, oak: 0xcfae85, leather: 0x4a3226, ink: 0x14171f,
};

async function init() {
  const canvas = document.getElementById('stage');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    document.documentElement.classList.add('no-webgl');
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isNarrow() ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);

  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(3.5, 6, 4.5);
  key.castShadow = true;
  const sm = isNarrow() ? 1024 : 2048;
  key.shadow.mapSize.set(sm, sm);
  Object.assign(key.shadow.camera, { left: -3.6, right: 3.6, top: 3.6, bottom: -3.6, near: 1, far: 16 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfe6ff, 0.55);
  fill.position.set(-4, 2.5, 3);
  scene.add(fill);

  // ---------- материалы и помощники ----------
  const steel = new THREE.MeshStandardMaterial({ color: 0x232730, roughness: 0.45, metalness: 0.85 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xc3c8d2, roughness: 0.22, metalness: 1 });
  const oakMat = new THREE.MeshStandardMaterial({ color: PAL.oak, roughness: 0.7 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.9 });
  const cobaltMat = new THREE.MeshPhysicalMaterial({ color: PAL.cobalt, roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.25 });
  const boneMat = new THREE.MeshStandardMaterial({ color: PAL.bone, roughness: 0.6 });

  const shadowy = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
    const m = shadowy(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));
    m.position.set(x, y, z);
    return m;
  };
  const rbox = (w, h, d, r, mat, x = 0, y = 0, z = 0) => {
    const m = shadowy(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat));
    m.position.set(x, y, z);
    return m;
  };
  const rod = (a, b, r, mat) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    m.castShadow = true;
    return m;
  };
  const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);

  const clothMat = (color, sheen = 0xffffff) =>
    new THREE.MeshPhysicalMaterial({
      color, roughness: 0.9, sheen: 1, sheenRoughness: 0.7, sheenColor: new THREE.Color(sheen), side: THREE.DoubleSide,
    });

  // Одежда как «подушка»: две сетки (лицо и спина) сходятся на краях
  function shellGeo({ h, hw, bulge = 0.04, fold = 0.012, freq = 5, phase = 0, du = 18, dv = 30 }) {
    const bf = typeof bulge === 'function' ? bulge : () => bulge;
    const cols = du + 1, rows = dv + 1;
    const pos = [];
    for (let side = 0; side < 2; side++) {
      for (let j = 0; j < rows; j++) {
        const v = j / dv;
        const y = -v * h;
        const half = Math.max(0.002, hw(v));
        for (let i = 0; i < cols; i++) {
          const u = (i / du) * 2 - 1;
          const edge = Math.sqrt(Math.max(0, 1 - u * u));
          const z = bf(v) * edge + fold * Math.sin(u * freq * 1.57 + phase + v * 2.2) * edge * (0.4 + v);
          pos.push(u * half, y, side ? -z : z);
        }
      }
    }
    const per = cols * rows, idx = [];
    for (let side = 0; side < 2; side++)
      for (let j = 0; j < dv; j++)
        for (let i = 0; i < du; i++) {
          const a = side * per + j * cols + i, b = a + 1, c = a + cols, d = c + 1;
          if (side === 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
        }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  const cloth = (geo, mat) => shadowy(new THREE.Mesh(geo, mat));

  function makeHanger(width = 0.44, mat = chrome, r = 0.0035) {
    const g = new THREE.Group();
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.03, r, 8, 28, Math.PI * 1.7), mat);
    hook.rotation.z = -Math.PI * 0.2;
    hook.castShadow = true;
    g.add(hook);
    g.add(rod(V(0, -0.03), V(0, -0.12), r, mat));
    g.add(rod(V(0, -0.12), V(-width / 2, -0.205), r * 1.4, mat));
    g.add(rod(V(0, -0.12), V(width / 2, -0.205), r * 1.4, mat));
    g.userData.attachY = -0.205;
    return g;
  }

  function sleeve(len, w0, w1, x, y, rotZ, mat, z = 0) {
    const m = cloth(shellGeo({ h: len, hw: (v) => w0 + (w1 - w0) * v, bulge: 0.034, fold: 0.008, freq: 3, du: 8, dv: 14 }), mat);
    m.position.set(x, y, z);
    m.rotation.z = rotZ;
    return m;
  }
  function buttons(g, n, x, y0, dy, z, r = 0.017) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), cobaltMat);
      s.position.set(x, y0 - i * dy, z);
      s.scale.z = 0.55;
      s.castShadow = true;
      g.add(s);
    }
  }

  // ---------- одежда ----------
  function coat() {
    const root = new THREE.Group();
    const hang = makeHanger(0.5, chrome);
    root.add(hang);
    const body = new THREE.Group();
    body.position.y = -0.2;
    root.add(body);
    const mat = clothMat(PAL.camel, 0xffe3bf);
    body.add(cloth(shellGeo({
      h: 1.1, hw: (v) => 0.17 + 0.13 * Math.pow(v, 1.3), bulge: (v) => 0.05 * (1 - 0.4 * v * v * v), fold: 0.016, freq: 5, phase: 0.3,
    }), mat));
    body.add(sleeve(0.8, 0.066, 0.052, -0.19, -0.025, -0.13, mat, -0.012));
    body.add(sleeve(0.8, 0.066, 0.052, 0.19, -0.025, 0.13, mat, -0.012));
    buttons(body, 3, 0.045, -0.42, 0.17, 0.068);
    root.userData.height = 1.3;
    return root;
  }
  function dress() {
    const root = new THREE.Group();
    root.add(makeHanger(0.36, chrome));
    const body = new THREE.Group();
    body.position.y = -0.2;
    root.add(body);
    const mat = clothMat(PAL.blush, 0xffffff);
    const hw = (v) => {
      if (v < 0.38) return 0.13 + (0.105 - 0.13) * smooth(0, 1, v / 0.38);
      return 0.105 + 0.27 * Math.pow((v - 0.38) / 0.62, 1.45);
    };
    body.add(cloth(shellGeo({ h: 1.0, hw, bulge: (v) => 0.032 + 0.02 * v, fold: 0.024, freq: 6, phase: 1.1, du: 22, dv: 36 }), mat));
    // бретели
    for (const s of [-1, 1]) body.add(rod(V(s * 0.085, 0.0, 0.0), V(s * 0.05, 0.16, 0.0), 0.006, mat));
    root.userData.height = 1.2;
    return root;
  }
  function hoodie() {
    const root = new THREE.Group();
    root.add(makeHanger(0.42, chrome));
    const body = new THREE.Group();
    body.position.y = -0.2;
    root.add(body);
    const mat = clothMat(PAL.forest, 0xa6d9c3);
    body.add(cloth(shellGeo({ h: 0.62, hw: (v) => 0.19 + 0.012 * v, bulge: 0.05, fold: 0.014, freq: 4, phase: 2 }), mat));
    body.add(sleeve(0.56, 0.07, 0.05, -0.188, -0.02, -0.2, mat, -0.01));
    body.add(sleeve(0.56, 0.07, 0.05, 0.188, -0.02, 0.2, mat, -0.01));
    const hood = cloth(new THREE.SphereGeometry(0.1, 20, 14), mat);
    hood.scale.set(1.25, 0.8, 0.85);
    hood.position.set(0, 0.0, -0.05);
    body.add(hood);
    const pocket = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.1, 0.02, 3, 0.012), mat));
    pocket.position.set(0, -0.4, 0.06);
    body.add(pocket);
    root.userData.height = 0.85;
    return root;
  }
  function tee(col = 0xe9e1d3, sh = 0xffffff) {
    const root = new THREE.Group();
    root.add(makeHanger(0.38, chrome));
    const body = new THREE.Group();
    body.position.y = -0.2;
    root.add(body);
    const mat = clothMat(col, sh);
    body.add(cloth(shellGeo({ h: 0.56, hw: (v) => 0.165 + 0.012 * v, bulge: 0.04, fold: 0.012, freq: 4, phase: 0.6 }), mat));
    body.add(sleeve(0.2, 0.075, 0.068, -0.165, -0.02, -0.7, mat, -0.01));
    body.add(sleeve(0.2, 0.075, 0.068, 0.165, -0.02, 0.7, mat, -0.01));
    root.userData.height = 0.75;
    return root;
  }
  function blazer() {
    const root = new THREE.Group();
    root.add(makeHanger(0.46, chrome));
    const body = new THREE.Group();
    body.position.y = -0.2;
    root.add(body);
    const mat = clothMat(PAL.navy, 0x8fa0d8);
    body.add(cloth(shellGeo({ h: 0.76, hw: (v) => 0.165 + 0.04 * v, bulge: 0.046, fold: 0.012, freq: 4, phase: 0.1 }), mat));
    body.add(sleeve(0.66, 0.064, 0.05, -0.165, -0.025, -0.09, mat, -0.01));
    body.add(sleeve(0.66, 0.064, 0.05, 0.165, -0.025, 0.09, mat, -0.01));
    buttons(body, 2, 0.035, -0.34, 0.14, 0.058, 0.015);
    root.userData.height = 1.0;
    return root;
  }
  function trousers() {
    const root = new THREE.Group();
    const hang = makeHanger(0.36, chrome);
    root.add(hang);
    root.add(rod(V(-0.17, -0.205), V(0.17, -0.205), 0.004, chrome));
    const body = new THREE.Group();
    body.position.y = -0.21;
    root.add(body);
    const mat = clothMat(0x3b4a6b, 0x9db0e0);
    for (const s of [-1, 1]) {
      const leg = cloth(shellGeo({ h: 0.8, hw: (v) => 0.086 - 0.022 * v, bulge: 0.05, fold: 0.01, freq: 3, phase: s, du: 10, dv: 22 }), mat);
      leg.position.set(s * 0.086, 0, 0);
      body.add(leg);
    }
    body.add(box(0.34, 0.05, 0.07, mat, 0, -0.01, 0).clone());
    root.userData.height = 1.0;
    return root;
  }
  function scarf() {
    const root = new THREE.Group();
    const mat = clothMat(PAL.cobalt, 0xaab4ff);
    const wrap = cloth(new THREE.CylinderGeometry(0.03, 0.03, 0.13, 16), mat);
    wrap.rotation.z = Math.PI / 2;
    root.add(wrap);
    const a = cloth(shellGeo({ h: 0.62, hw: () => 0.052, bulge: 0.02, fold: 0.012, freq: 2, du: 6, dv: 18 }), mat);
    a.position.set(-0.03, -0.015, 0.03);
    root.add(a);
    const b = cloth(shellGeo({ h: 0.45, hw: () => 0.052, bulge: 0.02, fold: 0.012, freq: 2, phase: 2, du: 6, dv: 18 }), mat);
    b.position.set(0.035, -0.015, -0.03);
    root.add(b);
    root.userData.height = 0.65;
    return root;
  }

  // ---------- бирки (навигация) ----------
  function tagTexture(text) {
    const W = 520, H = 300;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#F2EEE6';
    x.beginPath();
    x.roundRect(6, 6, W - 12, H - 12, 34);
    x.fill();
    x.strokeStyle = 'rgba(20,23,31,.18)';
    x.lineWidth = 4;
    x.stroke();
    x.fillStyle = '#DCE0E8';
    x.beginPath(); x.arc(W / 2, 46, 15, 0, 7); x.fill();
    x.strokeStyle = 'rgba(20,23,31,.35)'; x.lineWidth = 3; x.stroke();
    x.fillStyle = '#14171F';
    let size = 74;
    x.font = `700 ${size}px Unbounded, sans-serif`;
    while (x.measureText(text).width > W - 70 && size > 30) { size -= 4; x.font = `700 ${size}px Unbounded, sans-serif`; }
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(text, W / 2, 168);
    // пуговица-точка в углу
    x.fillStyle = '#2B3BFF';
    x.beginPath(); x.arc(W - 62, H - 56, 20, 0, 7); x.fill();
    x.fillStyle = '#F2EEE6';
    for (const [dx, dy] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) { x.beginPath(); x.arc(W - 62 + dx, H - 56 + dy, 3, 0, 7); x.fill(); }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }
  function addTag(root, text, x, y, z) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.116),
      new THREE.MeshStandardMaterial({ map: tagTexture(text), roughness: 0.7, side: THREE.DoubleSide, transparent: true })
    );
    m.position.set(x, y, z);
    m.rotation.z = 0.06;
    m.castShadow = true;
    root.add(m);
    root.add(rod(V(0.02, -0.205, 0.01), V(x - 0.005, y + 0.052, z), 0.0015, boneMat));
  }

  await (document.fonts ? document.fonts.load('700 48px Unbounded', 'Бренды') : Promise.resolve()).catch(() => {});

  // ---------- стойка ----------
  const rack = new THREE.Group();
  scene.add(rack);
  const XS = [-1.65, 0, 1.65], ZB = 0.42, TOP = 2.45, BASE = 0.14, RAIL = 2.15;

  for (const x of XS) for (const z of [-ZB, ZB]) rack.add(box(0.05, TOP - 0.1, 0.05, steel, x, (TOP + 0.1) / 2, z));
  for (const z of [-ZB, ZB]) {
    rack.add(box(3.35, 0.05, 0.05, steel, 0, TOP, z));
    rack.add(box(3.35, 0.05, 0.05, steel, 0, BASE, z));
  }
  for (const x of XS) {
    rack.add(box(0.05, 0.05, ZB * 2, steel, x, TOP, 0));
    rack.add(box(0.05, 0.05, ZB * 2, steel, x, BASE, 0));
    rack.add(box(0.04, 0.04, ZB * 2, steel, x, RAIL - 0.03, 0));
  }
  for (const x of [-1.65, 0]) rack.add(box(0.04, 0.04, ZB * 2, steel, x, 1.2 - 0.03, 0));
  const railMesh = (x0, x1, y) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, x1 - x0, 14), chrome);
    m.rotation.z = Math.PI / 2;
    m.position.set((x0 + x1) / 2, y, 0);
    m.castShadow = true;
    return m;
  };
  rack.add(railMesh(-1.65, 0, RAIL));
  rack.add(railMesh(0, 1.65, RAIL));
  rack.add(railMesh(-1.65, 0, 1.2));
  // колёса
  for (const x of XS) for (const z of [-ZB, ZB]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.045, 18), rubber);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.06, z);
    w.castShadow = true;
    rack.add(w);
    rack.add(box(0.012, 0.05, 0.05, steel, x + 0.0, 0.1, z));
  }
  // полка справа
  for (const x of [0, 1.65]) rack.add(box(0.04, 0.04, ZB * 2, steel, x, 0.37, 0));
  for (let k = 0; k < 5; k++) rack.add(box(1.62, 0.022, 0.15, oakMat, 0.825, 0.4, -0.34 + k * 0.17));

  // вещи на полке
  const sneaker = (x, z, rotY) => {
    const g = new THREE.Group();
    g.add(rbox(0.3, 0.04, 0.115, 0.016, boneMat, 0, 0, 0));
    g.add(box(0.29, 0.009, 0.119, cobaltMat, 0, 0.0, 0));
    g.add(rbox(0.19, 0.085, 0.1, 0.034, boneMat, -0.045, 0.06, 0));
    g.add(rbox(0.12, 0.06, 0.098, 0.028, boneMat, 0.085, 0.04, 0));
    g.add(rbox(0.04, 0.05, 0.1, 0.02, cobaltMat, -0.13, 0.065, 0));
    g.position.set(x, 0.435, z);
    g.rotation.y = rotY;
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  };
  rack.add(sneaker(0.35, 0.12, -Math.PI / 2 + 0.2));
  rack.add(sneaker(0.58, 0.14, -Math.PI / 2 - 0.12));
  const stack = [PAL.camel, PAL.forest, PAL.blush];
  stack.forEach((c, i) => rack.add(rbox(0.36, 0.07, 0.3, 0.03, new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 }), 1.38, 0.46 + i * 0.07, -0.05 + (i % 2) * 0.012)));
  const leather = new THREE.MeshStandardMaterial({ color: PAL.leather, roughness: 0.5 });
  const bag = new THREE.Group();
  bag.add(rbox(0.3, 0.22, 0.12, 0.045, leather, 0, 0.11, 0));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.008, 8, 24, Math.PI), leather);
  handle.position.y = 0.22;
  bag.add(handle);
  bag.position.set(0.95, 0.411, 0.0);
  bag.rotation.y = -0.3;
  bag.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  rack.add(bag);

  // пол
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.2 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const blobC = document.createElement('canvas');
  blobC.width = blobC.height = 128;
  const bx = blobC.getContext('2d');
  const gr = bx.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, 'rgba(20,23,31,.35)');
  gr.addColorStop(1, 'rgba(20,23,31,0)');
  bx.fillStyle = gr; bx.fillRect(0, 0, 128, 128);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blobC), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.005;
  scene.add(blob);

  // ---------- вешалки с одеждой ----------
  const swingers = [];
  const hit = []; // что можно кликать
  function hang(root, x, y, z, link, label, phase, tagPos) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    pivot.add(root);
    if (label) addTag(root, label, tagPos[0], tagPos[1], tagPos[2]);
    rack.add(pivot);
    const s = { pivot, link, phase, ax: 0, vx: 0, az: 0, vz: 0, scale: 1, w: 0.75 + Math.random() * 0.5 };
    swingers.push(s);
    if (link) pivot.traverse((o) => { if (o.isMesh) { o.userData.swinger = s; hit.push(o); } });
    return s;
  }
  // левая секция, верхняя штанга
  hang(hoodie(), -1.28, RAIL, 0.1, '#stylist', 'Стилист', 0.2, [0.07, -0.43, 0.075]);
  hang(tee(0x30343f, 0x8a93b0), -0.88, RAIL, 0.0, null, null, 1.7);
  hang(scarf(), -0.52, RAIL, -0.05, null, null, 2.8);
  hang(tee(), -0.3, RAIL, -0.12, null, null, 0.9);
  // левая секция, нижняя штанга
  hang(trousers(), -1.1, 1.2, 0.0, '#contact', 'Написать', 3.1, [0.07, -0.45, 0.07]);
  hang(trousers(), -0.55, 1.2, -0.05, null, null, 4.4);
  // правая секция
  hang(coat(), 0.42, RAIL, 0.08, '#brands', 'Бренды', 0.8, [0.11, -0.52, 0.085]);
  hang(dress(), 0.98, RAIL, 0.0, null, null, 2.2);
  hang(blazer(), 1.4, RAIL, -0.04, '#process', 'Как работаем', 5.0, [0.07, -0.4, 0.075]);

  // кобальтовая пуговица-подвеска
  const pendant = new THREE.Group();
  {
    const R = 0.23;
    const sh = new THREE.Shape();
    sh.absarc(0, 0, R, 0, Math.PI * 2, false);
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const h = new THREE.Path();
      h.absarc(dx * 0.05, dy * 0.05, 0.022, 0, Math.PI * 2, true);
      sh.holes.push(h);
    }
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.014, bevelSegments: 4, curveSegments: 40 });
    geo.translate(0, 0, -0.0175);
    const b = shadowy(new THREE.Mesh(geo, cobaltMat));
    pendant.add(b);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 0.72, 0.008, 10, 48), cobaltMat);
    ring.position.z = 0.032;
    ring.castShadow = true;
    pendant.add(ring);
    for (const rz of [Math.PI / 4, -Math.PI / 4]) {
      const th = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.0065, 0.006), boneMat);
      th.rotation.z = rz;
      th.position.z = 0.034;
      pendant.add(th);
    }
    pendant.position.set(0, 1.66, ZB + 0.06);
    pendant.add(rod(V(0, R, 0), V(0, 0.8, 0), 0.0025, boneMat));
    pendant.traverse((o) => { if (o.isMesh) { o.userData.pendant = true; hit.push(o); } });
    rack.add(pendant);
  }
  const pend = { ry: 0, vy: 0, rz: 0, vz: 0 };

  // ---------- камера по скроллу ----------
  const KEYS = [
    { p: [0.8, 1.6, 7.2], t: [-1.5, 1.2, 0] },   // hero
    { p: [0.75, 1.75, 4.9], t: [-0.25, 1.45, 0] }, // brands: правая секция
    { p: [-1.0, 1.9, 4.8], t: [-1.55, 1.68, 0] },   // stylist: левая секция
    { p: [2.4, 2.3, 5.8], t: [-1.5, 1.2, 0] },     // process: обзор сбоку
    { p: [0.3, 1.9, 3.4], t: [-0.7, 1.85, 0] },    // contact: пуговица
  ];
  const IDS = ['hero', 'brands', 'stylist', 'process', 'contact'];
  let anchors = [0, 1, 2, 3, 4];
  function measure() {
    anchors = IDS.map((id, i) => {
      const el = document.getElementById(id);
      if (!el) return i * 1000;
      if (i === 0) return 0;
      return el.offsetTop + el.offsetHeight / 2 - innerHeight / 2;
    });
    for (let i = 1; i < anchors.length; i++) anchors[i] = Math.max(anchors[i], anchors[i - 1] + 10);
  }
  const keyAt = (i) => {
    const k = KEYS[i];
    const p = V(...k.p), t = V(...k.t);
    if (isNarrow()) { p.z += i === 0 ? 4.8 : 1.9; p.x *= 0.7; t.x *= 0.15; t.y -= i === 0 ? 1.15 : 0.85; }
    return { p, t };
  };
  const camPos = V(...KEYS[0].p), camTar = V(...KEYS[0].t);
  const tmpP = V(0, 0), tmpT = V(0, 0);
  function targetPose(y) {
    let i = 0;
    while (i < anchors.length - 2 && y >= anchors[i + 1]) i++;
    const u = clamp((y - anchors[i]) / (anchors[i + 1] - anchors[i]), 0, 1);
    const e = smooth(0.12, 0.88, u);
    const a = keyAt(i), b = keyAt(i + 1);
    tmpP.lerpVectors(a.p, b.p, e);
    tmpT.lerpVectors(a.t, b.t, e);
  }

  // ---------- ввод ----------
  const ptr = { x: 0, y: 0, moved: false, touch: false };
  addEventListener('pointermove', (e) => {
    ptr.x = (e.clientX / innerWidth) * 2 - 1;
    ptr.y = -(e.clientY / innerHeight) * 2 + 1;
    ptr.moved = true;
    ptr.touch = e.pointerType === 'touch';
  }, { passive: true });
  const ray = new THREE.Raycaster();
  let hovered = null, hoverPend = false;
  const overUi = (e) => e && e.target && e.target.closest && e.target.closest('.copy, header, a, button, footer');
  function pick(cx, cy) {
    ray.setFromCamera(new THREE.Vector2(cx, cy), camera);
    const h = ray.intersectObjects(hit, false)[0];
    return h ? h.object : null;
  }
  addEventListener('click', (e) => {
    if (overUi(e)) return;
    const o = pick((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    if (!o) return;
    const link = o.userData.pendant ? '#contact' : o.userData.swinger && o.userData.swinger.link;
    const el = link && document.querySelector(link);
    if (el) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    if (o.userData.swinger) o.userData.swinger.vx += 0.5;
    if (o.userData.pendant) pend.vy += 3;
  });

  // ---------- размеры ----------
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = isNarrow() ? 42 : 32;
    camera.updateProjectionMatrix();
    measure();
  }
  addEventListener('resize', resize);
  resize();
  addEventListener('load', measure);
  if (document.fonts) document.fonts.ready.then(measure);

  // ---------- цикл ----------
  let lastY = scrollY, last = performance.now(), vel = 0;
  const t0 = last;
  if (!reduce) swingers.forEach((s) => { s.vx = (Math.random() - 0.3) * 1.1; });
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const time = (now - t0) / 1000;
    const y = scrollY;
    const raw = (y - lastY) / Math.max(dt, 0.001);
    lastY = y;
    vel += (raw - vel) * Math.min(1, dt * 8);
    const kick = clamp(vel / 2600, -1, 1);

    // камера
    targetPose(y);
    const intro = reduce ? 1 : 1 - Math.pow(1 - clamp(time / 2.6, 0, 1), 3);
    tmpP.z += (1 - intro) * 2.6;
    tmpP.y += (1 - intro) * 0.5;
    tmpP.x += ptr.x * 0.16;
    tmpP.y += ptr.y * 0.08;
    const k = reduce ? 1 : 1 - Math.exp(-dt * 4.2);
    camPos.lerp(tmpP, k);
    camTar.lerp(tmpT, k);
    camera.position.copy(camPos);
    camera.lookAt(camTar);

    // наведение
    if (ptr.moved && !ptr.touch) {
      ptr.moved = false;
      const o = pick(ptr.x, ptr.y);
      const s = o && o.userData.swinger || null;
      const p = !!(o && o.userData.pendant);
      if (s && s !== hovered) s.vx += 0.55;
      if (p && !hoverPend) pend.vy += 2.2;
      hovered = s; hoverPend = p;
      document.body.classList.toggle('pick', !!(s || p));
    }

    // качание
    if (!reduce) {
      for (const s of swingers) {
        const wind = Math.sin(time * 0.8 + s.phase) * 0.03 + Math.sin(time * 0.37 + s.phase * 2) * 0.018;
        s.vx += kick * 0.9 * s.w * dt * 12;
        s.vx += (-14 * (s.ax - wind) - 1.7 * s.vx) * dt;
        s.ax += s.vx * dt;
        s.pivot.rotation.x = s.ax;
        s.pivot.rotation.z = s.ax * 0.22;
        s.pivot.rotation.y = Math.sin(time * 0.6 + s.phase) * 0.05;
        const target = s === hovered ? 1.05 : 1;
        s.scale += (target - s.scale) * Math.min(1, dt * 10);
        s.pivot.scale.setScalar(s.scale);
      }
      pend.vy += (-9 * (pend.ry - Math.sin(time * 0.5) * 0.35) - 1.4 * pend.vy) * dt;
      pend.ry += pend.vy * dt;
      pendant.rotation.y = pend.ry;
      pendant.rotation.z = Math.sin(time * 0.9) * 0.04;
    }

    renderer.render(scene, camera);
    if (!window.__ready) { window.__ready = true; document.documentElement.classList.add('ready'); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

init();
