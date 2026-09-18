import * as THREE from 'three';
import { NAMES, LETTERS, FINAL_MSG, LEVELS } from './levels.js';

const $ = id => document.getElementById(id);
const DEBUG = new URLSearchParams(location.search).has('debug');

/* ---------- Sabitler ---------- */
const STEP = 1 / 120;
const PW = 0.7, PH = 1.3;
const GRAV = 34, JUMP = 13.2, RUN = 6.5, SPRING = 21.5, MAXFALL = 24, STOMP_BOUNCE = 11;
const ENEMY_SPEED = 1.6;
const GROUPS = ['A', 'B', 'C', 'D'];
const GROUP_COLORS = { A: 0xff5d73, B: 0xffc93c, C: 0x4fd08a, D: 0xa78bfa };
const DEPTH = 2.2;
const PEER_PREFIX = 'mete-bahar-askmacerasi-v1-';
const SAVE_KEY = 'askMacerasi.progress';

const THEMES = {
  garden: { sky: 0xcdeeff, fog: 0xcdeeff, dirt: 0xc98f6b, top: 0x8fdc7a, plank: 0xc98f6b, mover: 0xffb3cf, hemi: [0xffffff, 0x9fcf8f, 1.25], sun: 1.6 },
  pastel: { sky: 0xffe3f1, fog: 0xffe3f1, dirt: 0xb99ae0, top: 0xffffff, plank: 0xf7c6e0, mover: 0xa6e3ff, hemi: [0xffffff, 0xffc2e0, 1.3], sun: 1.5 },
  forest: { sky: 0xbfe8c8, fog: 0xa9d9b4, dirt: 0x7a5a45, top: 0x4caf50, plank: 0x8a6448, mover: 0xd9a066, hemi: [0xeaffea, 0x5a7d4a, 1.15], sun: 1.4 },
  ice: { sky: 0xe3f4ff, fog: 0xe3f4ff, dirt: 0x9fb8d0, top: 0xffffff, ice: 0xaee4ff, plank: 0xcfe8ff, mover: 0x9ad0ff, hemi: [0xffffff, 0xa9c8e8, 1.3], sun: 1.5 },
  night: { sky: 0x1d1640, fog: 0x1d1640, dirt: 0x3a3355, top: 0x7b6fc0, plank: 0x6a6494, mover: 0xff7eb0, hemi: [0xa99ee8, 0x2a2244, 1.0], sun: 0.7 },
  candy: { sky: 0xffd6ec, fog: 0xffd6ec, dirt: 0xff9ec7, top: 0xfff5fa, plank: 0xffc93c, mover: 0x7ad8c7, hemi: [0xffffff, 0xffb6d5, 1.3], sun: 1.5 },
  clouds: { sky: 0x9fd4ff, fog: 0xb8e0ff, dirt: 0xf4f8ff, top: 0xffffff, plank: 0xffffff, mover: 0xffd1e6, hemi: [0xffffff, 0xbfdcff, 1.4], sun: 1.4 },
  stars: { sky: 0x0e0b2a, fog: 0x0e0b2a, dirt: 0x4b3478, top: 0xffc93c, plank: 0x8f6fd1, mover: 0xff7eb0, hemi: [0xb3a8ff, 0x2b1f55, 1.05], sun: 0.8 },
};

const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const r2 = v => Math.round(v * 100) / 100;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const approach = (v, t, d) => v < t ? Math.min(v + d, t) : Math.max(v - d, t);
function lerpAngle(a, b, t) {
  const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * t;
}
function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------- Oyun durumu ---------- */
let mode = 'local';          // local | host | guest
let myChar = 0;
let state = 'menu';          // menu | lobby | play | pause | done | final | lost
let L = null;                // bölümün sabit verisi
let votes = [null, null];
let currentCard = null;
let runStats = {};
let acc = 0;
const W = { lv: 0, gt: 0, time: 0, open: {}, act: {}, latched: {}, lev: [], got: new Set(), enemies: [], cp: [-1, -1], hearts: 0, letter: false, deaths: 0, exitN: 0 };
const authority = () => mode !== 'guest';
const online = () => mode !== 'local';
const PHYS_STATES = ['lobby', 'play', 'done', 'final'];

/* ---------- Renderer / sahne ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
addEventListener('resize', () => renderer.setSize(innerWidth, innerHeight));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcdeeff);
scene.fog = new THREE.Fog(0xcdeeff, 26, 80);
const cams = [0, 1].map(() => {
  const c = new THREE.PerspectiveCamera(48, 1, 0.1, 300);
  c.userData = { tx: 0, ty: 4 };
  return c;
});
const views = [[0, 0, innerWidth, innerHeight], [0, 0, innerWidth, innerHeight]];
const hemi = new THREE.HemisphereLight(0xffffff, 0xcccccc, 1.2);
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 18, bottom: -18, near: 1, far: 90 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(hemi, sun, sun.target);

const levelGroup = new THREE.Group();
scene.add(levelGroup);

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const keepMat = m => { m.userData.keep = true; return m; };
const keepGeo = g => { g.userData.keep = true; return g; };
function mesh(geo, mat, parent, x = 0, y = 0, z = 0, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  if (parent) parent.add(m);
  return m;
}
function disposeTree(obj) {
  obj.traverse(o => {
    if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose();
    if (o.material) [].concat(o.material).forEach(m => { if (!m.userData.keep) { if (m.map) m.map.dispose(); m.dispose(); } });
  });
}
function clearLevelGroup() {
  levelGroup.children.slice().forEach(c => { disposeTree(c); levelGroup.remove(c); });
}

/* ---------- Kalp ve ortak şekiller ---------- */
function heartGeo(size) {
  const s = new THREE.Shape();
  s.moveTo(5, 5);
  s.bezierCurveTo(5, 5, 4, 0, 0, 0);
  s.bezierCurveTo(-6, 0, -6, 7, -6, 7);
  s.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
  s.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
  s.bezierCurveTo(16, 7, 16, 0, 10, 0);
  s.bezierCurveTo(7, 0, 5, 5, 5, 5);
  const g = new THREE.ExtrudeGeometry(s, { depth: 4, bevelEnabled: true, bevelSegments: 3, bevelSize: 1.5, bevelThickness: 1.5, curveSegments: 14 });
  g.center();
  g.rotateZ(Math.PI);
  const k = size / 21;
  g.scale(k, k, k);
  return keepGeo(g);
}
const HEART = heartGeo(0.62);
const HEART_BIG = heartGeo(1.6);
const HEART_TINY = heartGeo(0.3);
const HEART_BADGE = heartGeo(0.22);
const heartMat = keepMat(M(0xff3d7f, { roughness: 0.35, emissive: 0x661030, emissiveIntensity: 0.4 }));
const envGeo = keepGeo(new THREE.BoxGeometry(0.8, 0.54, 0.1));
const envMat = keepMat(M(0xffffff, { emissive: 0xffd6e8, emissiveIntensity: 0.6 }));
const sealMat = keepMat(M(0xff3d7f, { emissive: 0xff3d7f, emissiveIntensity: 0.4 }));
const ENEMY_GEO = keepGeo(new THREE.SphereGeometry(0.42, 18, 14));
const EYE_GEO = keepGeo(new THREE.SphereGeometry(0.11, 10, 8));
const PUPIL_GEO = keepGeo(new THREE.SphereGeometry(0.05, 8, 6));
const BROW_GEO = keepGeo(new THREE.BoxGeometry(0.2, 0.05, 0.05));
const enemyMat = keepMat(M(0x7b5cd6, { roughness: 0.5, emissive: 0x2a1560, emissiveIntensity: 0.3 }));
const whiteMat = keepMat(M(0xffffff));
const darkMat = keepMat(M(0x1d1026, { roughness: 0.4 }));

/* ---------- Karakterler ---------- */
function label(text, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 80;
  const x = c.getContext('2d');
  x.font = '800 44px "Baloo 2", system-ui, sans-serif';
  const w = Math.min(248, x.measureText(text).width + 44);
  x.fillStyle = 'rgba(255,255,255,0.95)';
  x.beginPath();
  if (x.roundRect) x.roundRect((256 - w) / 2, 8, w, 62, 31); else x.rect((256 - w) / 2, 8, w, 62);
  x.fill();
  x.fillStyle = color;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, 128, 42);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(1.3, 0.41, 1);
  s.renderOrder = 10;
  return s;
}

function makeChar(name, bodyColor, textColor, hairColor, girl) {
  const root = new THREE.Group();
  const model = new THREE.Group();
  model.scale.setScalar(0.7);
  root.add(model);
  const bodyM = M(bodyColor), skin = M(0xffdcc5), hairM = M(hairColor, { side: THREE.DoubleSide }), dark = M(0x2b1b24, { roughness: 0.4 });
  if (girl) {
    mesh(new THREE.ConeGeometry(0.5, 0.62, 20), bodyM, model, 0, 0.36, 0);
    mesh(new THREE.CapsuleGeometry(0.27, 0.35, 6, 14), bodyM, model, 0, 0.8, 0);
  } else {
    mesh(new THREE.CapsuleGeometry(0.34, 0.42, 6, 14), bodyM, model, 0, 0.6, 0);
  }
  mesh(HEART_BADGE, M(0xffffff), model, 0, 0.85, girl ? 0.27 : 0.33);
  const arms = [-1, 1].map(side => {
    const pivot = new THREE.Group();
    pivot.position.set(side * (girl ? 0.32 : 0.38), 1.0, 0);
    mesh(new THREE.CapsuleGeometry(0.09, 0.3, 4, 8), bodyM, pivot, 0, -0.22, 0);
    model.add(pivot);
    return pivot;
  });
  mesh(new THREE.SphereGeometry(0.36, 24, 18), skin, model, 0, 1.38, 0);
  const eyeG = new THREE.SphereGeometry(0.05, 10, 8);
  mesh(eyeG, dark, model, -0.12, 1.41, 0.32);
  mesh(eyeG, dark, model, 0.12, 1.41, 0.32);
  const blushG = new THREE.SphereGeometry(0.06, 10, 8), blushM = M(0xff8fae);
  mesh(blushG, blushM, model, -0.21, 1.31, 0.28).scale.set(1, 0.6, 0.5);
  mesh(blushG, blushM, model, 0.21, 1.31, 0.28).scale.set(1, 0.6, 0.5);
  mesh(new THREE.TorusGeometry(0.06, 0.015, 6, 12, Math.PI), dark, model, 0, 1.3, 0.345).rotation.z = Math.PI;
  const cap = mesh(new THREE.SphereGeometry(0.39, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM, model, 0, 1.4, -0.02);
  cap.rotation.x = -0.45;
  if (girl) {
    mesh(new THREE.SphereGeometry(0.17, 14, 10), hairM, model, 0, 1.8, -0.2);
    mesh(new THREE.SphereGeometry(0.37, 16, 12), hairM, model, 0, 1.15, -0.2).scale.set(1.05, 1.25, 0.6);
    mesh(heartGeo(0.3), M(0xff3d7f), model, 0.27, 1.7, 0.05).rotation.z = -0.4;
  } else {
    mesh(new THREE.ConeGeometry(0.1, 0.25, 6), hairM, model, 0.05, 1.8, 0.1).rotation.z = -0.5;
  }
  const lab = label(name, textColor);
  lab.position.y = 1.85;
  root.add(lab);
  scene.add(root);
  return { root, model, arms };
}

const players = [0, 1].map(id => ({
  id,
  ch: id === 0 ? makeChar(NAMES[0], 0x5b9bf0, '#3b7dd8', 0x4a2e22, false) : makeChar(NAMES[1], 0xff7eb0, '#e8457f', 0x7a3b1f, true),
  css: id === 0 ? '#3b7dd8' : '#e8457f',
  x: 0, y: 0, vx: 0, vy: 0, face: 1, onGround: false, groundTile: '#', coyote: 0, jumpBuf: 0, ride: null,
  dead: 0, inv: 0, sdx: 0, sdy: 0, walk: 0, local: true,
  tx: 0, ty: 0, netGround: true, netDead: false, hasNet: false, wasDead: false,
}));
const setupLocals = () => players.forEach(p => { p.local = mode === 'local' || p.id === myChar; });
const isDead = p => p.local ? p.dead > 0 : p.netDead;

/* ---------- Bölüm yükleme ---------- */
function parseLevel(i) {
  const def = LEVELS[i];
  const b = def.build();
  const m = b.m;
  const lv = {
    i, name: def.name, hint: def.hint, themeKey: def.theme, theme: THEMES[def.theme], w: m.w, h: m.h,
    grid: m.g.map(r => r.slice()), items: [], plates: [], levers: [], enemies: [], cps: [], springs: [],
    doors: { A: [], B: [], C: [], D: [] }, exit: null, spawns: [null, null], totalHearts: 0,
    movers: (b.movers || []).map((mv, id) => ({ id, ...mv, p: 0, px: mv.x, py: mv.y, sdx: 0, sdy: 0 })),
    groups: b.groups || {},
  };
  for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) {
    const c = lv.grid[y][x];
    const cx = x + 0.5;
    let clear = true;
    if (c === '1' || c === '2') lv.spawns[+c - 1] = { x: cx, y };
    else if (c === '*') { lv.items.push({ id: lv.items.length, kind: 'heart', x: cx, y: y + 0.5 }); lv.totalHearts++; }
    else if (c === '@') lv.items.push({ id: lv.items.length, kind: 'letter', x: cx, y: y + 0.5 });
    else if (c === '>') lv.exit = { x: cx, y };
    else if (c === '|') lv.cps.push({ x: cx, y });
    else if (c === 'e') lv.enemies.push({ x: cx, y });
    else if (c === 'o') lv.springs.push({ x: cx, y, anim: 0 });
    else if (c >= 'a' && c <= 'd') lv.plates.push({ id: lv.plates.length, g: c.toUpperCase(), x: cx, y, on: false });
    else if (c >= 'q' && c <= 't') lv.levers.push({ id: lv.levers.length, g: GROUPS[c.charCodeAt(0) - 113], x: cx, y });
    else {
      clear = false;
      if (c >= 'A' && c <= 'D') lv.doors[c].push({ x, y });
    }
    if (clear) lv.grid[y][x] = ' ';
  }
  lv.cps.sort((a, b) => a.x - b.x);
  lv.cps.forEach((c, id) => { c.id = id; });
  return lv;
}

function resetWorld() {
  Object.assign(W, { gt: 0, time: 0, cp: [-1, -1], hearts: 0, letter: false, deaths: 0, exitN: 0 });
  GROUPS.forEach(g => { W.act[g] = false; W.latched[g] = false; W.open[g] = !!(L.groups[g] && L.groups[g].invert); });
  W.lev = L.levers.map(() => false);
  W.got = new Set();
  W.enemies = L.enemies.map((e, id) => ({ id, x: e.x, y: e.y, rx: e.x, dir: -1, face: -1, alive: true, hold: 0 }));
  L.movers.forEach(mv => { mv.p = 0; mv.px = mv.x; mv.py = mv.y; mv.sdx = 0; mv.sdy = 0; });
}

function loadLevel(i) {
  W.lv = i;
  L = parseLevel(i);
  resetWorld();
  buildLevel();
  players.forEach(p => { placePlayer(p); p.hasNet = false; p.netDead = false; p.wasDead = false; });
  cams.forEach((c, k) => {
    const p = players[mode === 'local' ? k : myChar];
    c.userData.tx = p.x; c.userData.ty = p.y + 1.2;
  });
  acc = 0;
}

function tileAt(x, y) {
  if (x < 0 || x >= L.w) return '#';
  if (y < 0 || y >= L.h) return ' ';
  return L.grid[y][x];
}
function solidFor(c, pid) {
  switch (c) {
    case '#': case 'I': return true;
    case '[': return pid === 0;
    case ']': return pid === 1;
    case 'A': case 'B': case 'C': case 'D': return !W.open[c];
  }
  return false;
}
const enemySolid = c => c === '#' || c === 'I' || c === '[' || c === ']' || (c >= 'A' && c <= 'D' && !W.open[c]);

/* ---------- Bölüm görselleri ---------- */
function buildLevel() {
  clearLevelGroup();
  const T = L.theme;
  scene.background.set(T.sky);
  scene.fog.color.set(T.fog);
  hemi.color.set(T.hemi[0]);
  hemi.groundColor.set(T.hemi[1]);
  hemi.intensity = T.hemi[2];
  sun.intensity = T.sun;

  const cells = { '#': [], I: [], '-': [], '[': [], ']': [], '^': [], '~': [] };
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
    const c = L.grid[y][x];
    if (cells[c]) cells[c].push([x, y]);
  }
  const dummy = new THREE.Object3D();
  function inst(geo, mat, list, place, cast = false) {
    if (!list.length) { geo.dispose(); mat.dispose(); return null; }
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((c, i) => {
      dummy.position.set(0, 0, 0); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
      place(dummy, c);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    });
    im.receiveShadow = true;
    im.castShadow = cast;
    levelGroup.add(im);
    return im;
  }
  const solidAbove = (x, y) => { const a = tileAt(x, y + 1); return a === '#' || a === 'I'; };
  const at = (o, [x, y]) => o.position.set(x + 0.5, y + 0.5, 0);
  inst(new THREE.BoxGeometry(1, 1, DEPTH), M(T.dirt, { flatShading: true }), cells['#'], at);
  inst(new THREE.BoxGeometry(1.04, 0.26, DEPTH + 0.12), M(T.top), cells['#'].filter(([x, y]) => !solidAbove(x, y)), (o, [x, y]) => o.position.set(x + 0.5, y + 0.88, 0));
  inst(new THREE.BoxGeometry(1, 1, DEPTH), M(T.ice || 0xaee4ff, { roughness: 0.08, metalness: 0.2, emissive: 0x4a8ab8, emissiveIntensity: 0.15 }), cells.I, at);
  inst(new THREE.BoxGeometry(1.02, 0.22, DEPTH - 0.5), M(T.plank), cells['-'], (o, [x, y]) => o.position.set(x + 0.5, y + 0.89, 0), true);
  inst(new THREE.BoxGeometry(0.94, 0.94, DEPTH - 0.4), M(0x5b9bf0, { transparent: true, opacity: 0.75, emissive: 0x2a5ec8, emissiveIntensity: 0.35 }), cells['['], at);
  inst(new THREE.BoxGeometry(0.94, 0.94, DEPTH - 0.4), M(0xff7eb0, { transparent: true, opacity: 0.75, emissive: 0xc8307a, emissiveIntensity: 0.35 }), cells[']'], at);
  const spikes = [];
  cells['^'].forEach(([x, y]) => { for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) spikes.push([x + 0.2 + i * 0.3, y, (j - 0.5) * 0.9]); });
  inst(new THREE.ConeGeometry(0.14, 0.55, 6), M(0xdde3ea, { metalness: 0.6, roughness: 0.3 }), spikes, (o, [x, y, z]) => o.position.set(x, y + 0.27, z), true);
  inst(new THREE.BoxGeometry(1, 0.75, DEPTH + 0.4), new THREE.MeshStandardMaterial({ color: 0x55b4ff, transparent: true, opacity: 0.75, roughness: 0.1 }), cells['~'], (o, [x, y]) => o.position.set(x + 0.5, y + 0.37, 0));

  // kapılar
  L.doorMeshes = {};
  GROUPS.forEach(g => {
    if (!L.doors[g].length) return;
    const geo = new THREE.BoxGeometry(0.92, 1, DEPTH - 0.6);
    const mat = M(GROUP_COLORS[g], { transparent: true, opacity: 0.9, emissive: GROUP_COLORS[g], emissiveIntensity: 0.3 });
    const grp = new THREE.Group();
    L.doors[g].forEach(({ x, y }) => { const b = mesh(geo, mat, grp, x + 0.5, y + 0.5, 0); b.userData.y0 = y + 0.5; b.receiveShadow = true; });
    levelGroup.add(grp);
    L.doorMeshes[g] = { grp, mat, k: W.open[g] ? 0 : 1 };
  });

  // basınç düğmeleri ve kollar
  L.plates.forEach(pl => {
    pl.mesh = mesh(new THREE.BoxGeometry(0.9, 0.14, 1.3), M(GROUP_COLORS[pl.g], { emissive: GROUP_COLORS[pl.g], emissiveIntensity: 0.15 }), levelGroup, pl.x, pl.y + 0.08, 0);
    pl.mesh.receiveShadow = true;
  });
  L.levers.forEach(l => {
    const g = new THREE.Group();
    g.position.set(l.x, l.y, 0);
    levelGroup.add(g);
    mesh(new THREE.BoxGeometry(0.6, 0.2, 0.5), M(0x8a8a9a), g, 0, 0.1, 0);
    const pivot = new THREE.Group();
    pivot.position.y = 0.2;
    g.add(pivot);
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8), M(0x6b4a3a), pivot, 0, 0.35, 0);
    mesh(new THREE.SphereGeometry(0.14, 12, 10), M(GROUP_COLORS[l.g], { emissive: GROUP_COLORS[l.g], emissiveIntensity: 0.5 }), pivot, 0, 0.72, 0);
    pivot.rotation.z = 0.6;
    l.pivot = pivot;
  });

  // kalpler ve mektup
  L.items.forEach(it => {
    if (it.kind === 'heart') it.mesh = mesh(HEART, heartMat, levelGroup, it.x, it.y, 0);
    else {
      it.mesh = new THREE.Group();
      mesh(envGeo, envMat, it.mesh);
      mesh(HEART_BADGE, sealMat, it.mesh, 0, 0, 0.07);
      it.mesh.position.set(it.x, it.y, 0);
      levelGroup.add(it.mesh);
    }
  });

  // kayıt noktaları
  L.cps.forEach(c => {
    const g = new THREE.Group();
    g.position.set(c.x, c.y, -0.5);
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 8), M(0xeeeeee), g, 0, 0.9, 0);
    c.flag = mesh(new THREE.BoxGeometry(0.7, 0.45, 0.04), M(0xbbbbbb, { emissive: 0xff3d7f, emissiveIntensity: 0 }), g, 0.36, 1.55, 0);
    levelGroup.add(g);
  });

  // yaylar
  L.springs.forEach(s => {
    const g = new THREE.Group();
    g.position.set(s.x, s.y, 0);
    mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.18, 16), M(0x666677), g, 0, 0.09, 0);
    mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 8), M(0xaaaaaa), g, 0, 0.3, 0);
    s.pad = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 16), M(0xff3d7f, { emissive: 0xff3d7f, emissiveIntensity: 0.3 }), g, 0, 0.4, 0);
    levelGroup.add(g);
  });

  // hareketli platformlar
  L.movers.forEach(mv => {
    mv.mesh = mesh(new THREE.BoxGeometry(mv.w, 0.6, DEPTH - 0.4), M(mv.g ? GROUP_COLORS[mv.g] : T.mover, { flatShading: true }), levelGroup);
    mv.mesh.receiveShadow = true;
  });

  // canavarlar
  L.enemyMeshes = L.enemies.map(() => {
    const g = new THREE.Group();
    mesh(ENEMY_GEO, enemyMat, g).scale.set(1.1, 0.85, 1);
    [-1, 1].forEach(s => {
      mesh(EYE_GEO, whiteMat, g, s * 0.15, 0.1, 0.33);
      mesh(PUPIL_GEO, darkMat, g, s * 0.15, 0.1, 0.43);
      mesh(BROW_GEO, darkMat, g, s * 0.15, 0.26, 0.37).rotation.z = s * -0.5;
    });
    levelGroup.add(g);
    return g;
  });

  // çıkış kapısı
  const ex = new THREE.Group();
  ex.position.set(L.exit.x, L.exit.y, 0);
  const pillar = new THREE.BoxGeometry(0.35, 2.8, 0.6);
  mesh(pillar, M(0xffffff), ex, -1.3, 1.4, 0);
  mesh(pillar, M(0xffffff), ex, 1.3, 1.4, 0);
  L.exitHeart = mesh(HEART_BIG, M(0xff3d7f, { emissive: 0xff3d7f, emissiveIntensity: 0.5, roughness: 0.3 }), ex, 0, 3.3, 0);
  L.exitRing = mesh(new THREE.TorusGeometry(1.05, 0.07, 8, 40), M(0xffffff, { emissive: 0xff8fb8, emissiveIntensity: 0.9 }), ex, 0, 1.4, 0, false);
  levelGroup.add(ex);

  buildDecor();
}

/* ---------- Arka plan süsleri (temaya göre) ---------- */
function buildDecor() {
  const g = new THREE.Group();
  levelGroup.add(g);
  const rnd = mulberry32(L.i * 7919 + 13);
  const R = (a, b) => a + rnd() * (b - a);
  const Wd = L.w, Hd = L.h;
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const stars = n => {
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = R(-40, Wd + 40); pos[i * 3 + 1] = R(-10, Hd + 35); pos[i * 3 + 2] = R(-70, -35); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, fog: false })));
  };
  const cloud = (x, y, z, s, color = 0xffffff) => {
    const c = new THREE.Group();
    const mat = M(color, { roughness: 1 });
    for (let i = 0; i < 4; i++) mesh(new THREE.SphereGeometry(R(0.8, 1.4), 10, 8), mat, c, (i - 1.5) * 1.1, R(0, 0.5), R(-0.4, 0.4), false);
    c.position.set(x, y, z);
    c.scale.setScalar(s);
    g.add(c);
  };
  const tree = (x, z, color, s) => {
    const t = new THREE.Group();
    mesh(new THREE.CylinderGeometry(0.2, 0.3, 2, 8), M(0x8a5a44), t, 0, 1, 0, false);
    mesh(new THREE.IcosahedronGeometry(1.3, 0), M(color, { flatShading: true }), t, 0, 2.8, 0, false);
    t.position.set(x, 0, z);
    t.scale.setScalar(s);
    g.add(t);
  };
  switch (L.themeKey) {
    case 'garden':
      for (let x = -12; x < Wd + 12; x += R(7, 11)) mesh(new THREE.SphereGeometry(R(6, 10), 16, 10), M(pick([0xa6e39a, 0x8fd98a, 0xb8eba8]), { flatShading: true }), g, x, -4, R(-26, -16), false).scale.y = 0.6;
      for (let x = -4; x < Wd + 4; x += R(5, 9)) tree(x, R(-9, -5), pick([0xffa3c7, 0x7fcf74, 0xffc2d8]), R(0.8, 1.3));
      for (let x = 0; x < Wd; x += R(10, 16)) cloud(x, Hd + R(0, 5), R(-32, -22), R(1.2, 2.2));
      break;
    case 'pastel': {
      const rainbow = [0xff9aa2, 0xffb7b2, 0xffdac1, 0xe2f0cb, 0xb5ead7, 0xc7ceea];
      for (let x = 10; x < Wd; x += R(24, 34)) rainbow.forEach((c, i) => mesh(new THREE.TorusGeometry(9 - i * 0.55, 0.28, 8, 40, Math.PI), M(c, { emissive: c, emissiveIntensity: 0.3 }), g, x, -1, -28, false));
      for (let i = 0; i < Wd / 3; i++) mesh(new THREE.SphereGeometry(R(0.3, 1), 12, 10), new THREE.MeshStandardMaterial({ color: pick([0xffc2e0, 0xc2e5ff, 0xfff0a8]), transparent: true, opacity: 0.5 }), g, R(0, Wd), R(0, Hd + 4), R(-14, -5), false);
      for (let x = 0; x < Wd; x += R(12, 18)) cloud(x, Hd + R(-2, 3), R(-30, -20), R(1, 2), 0xfff5fb);
      break;
    }
    case 'forest':
      for (let x = -6; x < Wd + 6; x += R(2, 3.5)) {
        const z = R(-26, -9), h = R(5, 10);
        mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.2, 6), M(0x5b3a2a), g, x, 0.6, z, false);
        mesh(new THREE.ConeGeometry(R(1, 1.8), h, 7), M(pick([0x2e7d32, 0x388e3c, 0x1b5e20, 0x43a047]), { flatShading: true }), g, x, 1 + h / 2, z, false);
      }
      for (let i = 0; i < Wd / 2; i++) mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: 0xfff59d }), g, R(0, Wd), R(1, Hd), R(-6, -2), false);
      break;
    case 'ice':
      for (let x = -15; x < Wd + 15; x += R(9, 15)) {
        const h = R(12, 22);
        mesh(new THREE.ConeGeometry(R(7, 12), h, 6), M(pick([0xe8f4ff, 0xd4e8fb, 0xffffff]), { flatShading: true }), g, x, h / 2 - 4, R(-48, -32), false);
      }
      for (let i = 0; i < Wd / 4; i++) mesh(new THREE.OctahedronGeometry(R(0.4, 1.1), 0), M(0xbfe8ff, { transparent: true, opacity: 0.8, emissive: 0x6ab8e8, emissiveIntensity: 0.3 }), g, R(0, Wd), R(0, 4), R(-10, -4), false);
      for (let i = 0; i < 120; i++) mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), g, R(0, Wd), R(0, Hd + 6), R(-8, 2), false).userData.snow = R(0.3, 0.8);
      break;
    case 'night': {
      stars(500);
      mesh(new THREE.SphereGeometry(4, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff6d5, fog: false }), g, Wd * 0.6, Hd + 12, -60, false);
      const win = [];
      for (let x = -10; x < Wd + 10; x += R(3.5, 6)) {
        const w = R(3, 5.5), h = R(10, 26), z = R(-44, -26);
        mesh(new THREE.BoxGeometry(w, h, 3), M(pick([0x1f1a3d, 0x251f48, 0x1a1535])), g, x, h / 2 - 4, z, false);
        for (let wy = 1; wy < h - 3; wy += 1.4) for (let wx = -w / 2 + 0.7; wx < w / 2 - 0.4; wx += 1) if (rnd() < 0.4) win.push([x + wx, wy - 4 + 0.5, z + 1.52]);
      }
      if (win.length) {
        const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.45, 0.6), new THREE.MeshBasicMaterial({ color: 0xc9a85a }), win.length);
        const d = new THREE.Object3D();
        win.forEach(([x, y, z], i) => { d.position.set(x, y, z); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
        g.add(im);
      }
      break;
    }
    case 'candy':
      for (let x = -4; x < Wd + 4; x += R(3, 6)) {
        const z = R(-16, -6), h = R(3, 7), c = pick([0xff6fa3, 0x7ad8c7, 0xffc93c, 0xb18cff, 0x6fc3ff]);
        mesh(new THREE.CylinderGeometry(0.1, 0.1, h, 6), M(0xffffff), g, x, h / 2, z, false);
        const head = mesh(new THREE.CylinderGeometry(R(0.9, 1.5), R(0.9, 1.5), 0.3, 24), M(c, { emissive: c, emissiveIntensity: 0.15 }), g, x, h, z, false);
        head.rotation.x = Math.PI / 2;
      }
      for (let i = 0; i < Wd / 3; i++) mesh(new THREE.SphereGeometry(R(0.6, 1.4), 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(pick([0xff9ec7, 0x9be8d8, 0xfff08a, 0xd0b3ff])), g, R(0, Wd), 0, R(-5, -3), false);
      for (let x = 0; x < Wd; x += R(12, 18)) cloud(x, Hd + R(-1, 4), R(-30, -20), R(1, 2), 0xffe6f2);
      break;
    case 'clouds':
      for (let i = 0; i < Wd / 2; i++) cloud(R(-10, Wd + 10), R(-6, Hd + 2), R(-36, -10), R(1, 3));
      for (let x = -10; x < Wd + 10; x += 4) cloud(x, R(-9, -7), R(-8, 0), R(2, 3));
      break;
    case 'stars':
      stars(900);
      for (let i = 0; i < 5; i++) {
        const c = pick([0xffb3cf, 0x9fd4ff, 0xffc93c, 0xb18cff]);
        const pl = mesh(new THREE.SphereGeometry(R(2, 5), 24, 16), M(c, { emissive: c, emissiveIntensity: 0.35 }), g, R(0, Wd), R(4, Hd + 10), R(-55, -35), false);
        if (rnd() < 0.6) mesh(new THREE.TorusGeometry(pl.geometry.parameters.radius * 1.6, 0.15, 6, 40), M(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.4 }), pl, 0, 0, 0, false).rotation.x = 1.2;
      }
      for (let i = 0; i < Wd / 3; i++) mesh(HEART_TINY, new THREE.MeshBasicMaterial({ color: pick([0xff8fb8, 0xffc93c, 0xffffff]) }), g, R(0, Wd), R(0, Hd + 5), R(-12, -4), false).userData.float = R(0.5, 1.5);
      break;
  }
  L.decor = g;
}

/* ---------- Oyuncu fiziği ---------- */
function respawnPos(p) {
  const cp = W.cp[p.id] >= 0 ? L.cps[W.cp[p.id]] : null;
  if (!cp) return { x: L.spawns[p.id].x, y: L.spawns[p.id].y };
  return { x: cp.x + (p.id ? 0.4 : -0.4), y: cp.y };
}
function placePlayer(p) {
  const r = respawnPos(p);
  Object.assign(p, { x: r.x, y: r.y, vx: 0, vy: 0, ride: null, dead: 0, inv: 0, onGround: false, tx: r.x, ty: r.y, sdx: 0, sdy: 0, face: 1 });
}

function moveX(p, dx) {
  if (!dx) return;
  let nx = p.x + dx;
  const y0 = Math.floor(p.y + 0.02), y1 = Math.floor(p.y + PH - 0.02);
  const edge = dx > 0 ? Math.floor(nx + PW / 2) : Math.floor(nx - PW / 2);
  for (let y = y0; y <= y1; y++) {
    if (solidFor(tileAt(edge, y), p.id)) {
      nx = dx > 0 ? edge - PW / 2 - 0.001 : edge + 1 + PW / 2 + 0.001;
      p.vx = 0;
      break;
    }
  }
  p.x = nx;
}

function surfacesFor(p) {
  const s = L.movers.map(mv => ({ x0: mv.px, x1: mv.px + mv.w, top: mv.py + 1, ref: mv }));
  const o = players[1 - p.id];
  if (!isDead(o)) s.push({ x0: o.x - PW / 2, x1: o.x + PW / 2, top: o.y + PH, ref: o });
  return s;
}

function moveY(p, dy) {
  const prevY = p.y;
  let ny = p.y + dy;
  const x0 = Math.floor(p.x - PW / 2 + 0.02), x1 = Math.floor(p.x + PW / 2 - 0.02);
  p.onGround = false;
  p.ride = null;
  if (dy <= 0) {
    const cy = Math.floor(ny);
    for (let x = x0; x <= x1; x++) {
      const c = tileAt(x, cy);
      if (solidFor(c, p.id) || (c === '-' && prevY >= cy + 1 - 0.01)) {
        ny = cy + 1; p.vy = 0; p.onGround = true; p.groundTile = c;
        break;
      }
    }
    if (!p.onGround) {
      for (const s of surfacesFor(p)) {
        if (p.x + PW / 2 > s.x0 + 0.05 && p.x - PW / 2 < s.x1 - 0.05 && prevY >= s.top - 0.06 && ny <= s.top) {
          ny = s.top; p.vy = 0; p.onGround = true; p.groundTile = '#'; p.ride = s.ref;
          break;
        }
      }
    }
  } else {
    const cy = Math.floor(ny + PH);
    for (let x = x0; x <= x1; x++) {
      if (solidFor(tileAt(x, cy), p.id)) { ny = cy - PH - 0.001; p.vy = 0; break; }
    }
  }
  p.y = ny;
}

function stepPlayer(p, inp, dt) {
  if (p.dead > 0) {
    p.dead -= dt;
    if (p.dead <= 0) { placePlayer(p); p.inv = 1.2; }
    return;
  }
  if (p.inv > 0) p.inv -= dt;
  const ox = p.x, oy = p.y;
  if (p.ride) { moveX(p, p.ride.sdx || 0); p.y += p.ride.sdy || 0; }
  const ice = p.onGround && p.groundTile === 'I';
  p.vx = approach(p.vx, inp.x * RUN, (p.onGround ? (ice ? 7 : 70) : 32) * dt);
  if (Math.abs(inp.x) > 0.1) p.face = Math.sign(inp.x);
  if (inp.jq) { p.jumpBuf = 0.13; inp.jq = false; } else p.jumpBuf -= dt;
  p.coyote = p.onGround ? 0.1 : p.coyote - dt;
  if (p.jumpBuf > 0 && p.coyote > 0) { p.vy = JUMP; p.jumpBuf = 0; p.coyote = 0; p.launched = false; sfx.jump(); }
  // tuş erken bırakılırsa kısa zıplama; yay ve canavar sekmesi bundan etkilenmez
  if (p.vy <= 0) p.launched = false;
  const g = p.vy > 0 && !inp.jump && !p.launched ? GRAV * 2.4 : GRAV;
  p.vy = Math.max(p.vy - g * dt, -MAXFALL);
  p.fallV = p.vy;
  moveX(p, p.vx * dt);
  moveY(p, p.vy * dt);
  p.sdx = p.x - ox;
  p.sdy = p.y - oy;
  interact(p, inp);
}

function interact(p, inp) {
  const x0 = Math.floor(p.x - PW / 2 + 0.08), x1 = Math.floor(p.x + PW / 2 - 0.08);
  const y0 = Math.floor(p.y), y1 = Math.floor(p.y + PH - 0.1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const c = tileAt(x, y);
    if ((c === '^' && p.y < y + 0.45) || (c === '~' && p.y < y + 0.6)) return killPlayer(p);
  }
  if (p.y < -4) return killPlayer(p);

  for (const s of L.springs) {
    if (p.vy <= 0 && Math.abs(p.x - s.x) < 0.6 && p.y >= s.y - 0.1 && p.y <= s.y + 0.5) {
      p.vy = SPRING; p.launched = true; p.onGround = false; p.ride = null; s.anim = 1;
      sfx.spring();
    }
  }
  if (p.inv <= 0) {
    for (const e of W.enemies) {
      if (!e.alive || Math.abs(p.x - e.rx) > PW / 2 + 0.38 || p.y > e.y + 0.72 || p.y + PH < e.y + 0.05) continue;
      // üstüne düşerken değdiyse (yere inerken hız sıfırlansa bile) canavar ezilir
      if (p.fallV < 0 && p.y > e.y + 0.25) { p.vy = STOMP_BOUNCE; p.launched = true; request('stomp', e.id); }
      else return killPlayer(p);
    }
  }
  for (const it of L.items) {
    if (W.got.has(it.id) || it.pending) continue;
    if (Math.abs(p.x - it.x) < 0.62 && it.y > p.y - 0.3 && it.y < p.y + PH + 0.3) request('grab', it.id);
  }
  for (const c of L.cps) {
    if (c.id > W.cp[p.id] && Math.abs(p.x - c.x) < 0.8 && Math.abs(p.y - c.y) < 1.6) request('cp', c.id, p.id);
  }
  if (inp.aq) {
    inp.aq = false;
    const l = L.levers.find(l => Math.abs(p.x - l.x) < 1.1 && Math.abs(p.y - l.y) < 1.3);
    if (l) request('lever', l.id);
  }
}

function killPlayer(p) {
  if (p.dead > 0) return;
  p.dead = 0.9;
  p.vx = p.vy = 0;
  p.ride = null;
  sfx.die();
  burst([p.x, p.y + 0.7, 0], 16, 4, 2);
  request('die', 0);
}

function updateMovers(dt) {
  for (const mv of L.movers) {
    const ox = mv.px, oy = mv.py;
    if (mv.g) {
      const tgt = W.act[mv.g] ? 1 : 0;
      const d = (mv.speed || 2.5) / (Math.hypot(mv.dx, mv.dy) || 1) * dt;
      mv.p = tgt > mv.p ? Math.min(tgt, mv.p + d) : Math.max(tgt, mv.p - d);
    } else {
      mv.p = 0.5 - 0.5 * Math.cos(2 * Math.PI * (W.gt / mv.period + (mv.phase || 0)));
    }
    mv.px = mv.x + mv.dx * mv.p;
    mv.py = mv.y + mv.dy * mv.p;
    mv.sdx = mv.px - ox;
    mv.sdy = mv.py - oy;
  }
}

/* ---------- Otorite (oda kuran / aynı cihaz) ---------- */
const reqT = {};
function request(k, id, w = 0) {
  if (authority()) return handleRequest(k, id, W.lv, w);
  const key = k + id + '.' + w, now = performance.now();
  if (reqT[key] && now - reqT[key] < 400) return;
  reqT[key] = now;
  if (k === 'grab') { const it = L.items[id]; it.pending = true; setTimeout(() => { it.pending = false; }, 1500); }
  if (k === 'stomp') { const e = W.enemies[id]; if (e) { e.alive = false; e.hold = 1; } }
  send({ t: 'r', k, id, lv: W.lv, w });
}
function handleRequest(k, id, lv, w) {
  if (lv !== W.lv || state !== 'play' || typeof id !== 'number') return;
  if (k === 'grab') grab(id);
  else if (k === 'lever') toggleLever(id);
  else if (k === 'stomp') stomp(id);
  else if (k === 'cp') setCp(id, w === 1 ? 1 : 0);
  else if (k === 'die') W.deaths++;
}
function grab(id) {
  const it = L.items[id];
  if (!it || W.got.has(id)) return;
  W.got.add(id);
  const p = [it.x, it.y, 0];
  if (it.kind === 'heart') { W.hearts++; emit({ e: 'fx', k: 'heart', p }); }
  else {
    W.letter = true;
    emit({ e: 'fx', k: 'letter', p });
    emit({ e: 'toast', s: '💌 Anı mektubu bulundu! Bölüm sonunda okuyacaksınız.', d: 3.5 });
  }
}
const leverT = {};
function toggleLever(id) {
  const l = L.levers[id];
  const now = performance.now();
  if (!l || (leverT[id] && now - leverT[id] < 350)) return;
  leverT[id] = now;
  W.lev[id] = !W.lev[id];
  emit({ e: 'fx', k: 'lever', p: [l.x, l.y + 1, 0] });
}
function stomp(id) {
  const e = W.enemies[id];
  if (!e || !e.alive) return;
  e.alive = false;
  emit({ e: 'fx', k: 'stomp', p: [r2(e.x), e.y + 0.5, 0] });
}
// Kayıt noktaları kişiye özel: herkes kendi dokunduğu son noktada doğar (bulmacalar atlanamasın)
function setCp(id, w) {
  if (id <= W.cp[w] || !L.cps[id]) return;
  W.cp[w] = id;
  const c = L.cps[id];
  emit({ e: 'fx', k: 'cp', p: [c.x, c.y + 1.6, 0] });
}
const overlaps = (p, x, y) => p.x + PW / 2 > x && p.x - PW / 2 < x + 1 && p.y + PH > y && p.y < y + 1;
const doorBlocked = g => L.doors[g].some(({ x, y }) => players.some(p => !isDead(p) && overlaps(p, x, y)));

function authorityStep(dt) {
  W.time += dt;
  for (const pl of L.plates) {
    pl.on = players.some(p => !isDead(p) && Math.abs(p.x - pl.x) < 0.75 && p.y >= pl.y - 0.05 && p.y < pl.y + 0.4);
  }
  for (const g of GROUPS) {
    const cfg = L.groups[g] || {};
    const pls = L.plates.filter(pl => pl.g === g);
    const n = pls.filter(pl => pl.on).length;
    let act = cfg.need === 'all' ? pls.length > 0 && n === pls.length : n > 0;
    if (L.levers.some(l => l.g === g && W.lev[l.id])) act = true;
    if (cfg.latch && act && !W.latched[g]) { W.latched[g] = true; emit({ e: 'fx', k: 'latch' }); }
    if (W.latched[g]) act = true;
    W.act[g] = act;
    let open = cfg.invert ? !act : act;
    if (!open && W.open[g] && doorBlocked(g)) open = true;
    if (open !== W.open[g]) {
      W.open[g] = open;
      if (L.doors[g].length) emit({ e: 'fx', k: open ? 'open' : 'close' });
    }
  }
  for (const e of W.enemies) {
    if (!e.alive) continue;
    e.x += e.dir * ENEMY_SPEED * dt;
    const cx = Math.floor(e.x + e.dir * 0.45);
    const wall = enemySolid(tileAt(cx, Math.floor(e.y + 0.3)));
    const fl = tileAt(cx, Math.floor(e.y - 0.1));
    if (wall || !(enemySolid(fl) || fl === '-')) e.dir *= -1;
    e.rx = e.x;
    e.face = e.dir;
  }
  const ex = L.exit;
  W.exitN = players.filter(p => !isDead(p) && Math.abs(p.x - ex.x) < 1.4 && p.y >= ex.y - 0.5 && p.y < ex.y + 2.5).length;
  if (W.exitN === 2) levelComplete();
}

/* ---------- Ses ---------- */
let actx = null, muted = false;
function audio() {
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch {}
  keepAwake();
}
function tone(f, t0, dur, type = 'sine', vol = 0.12, fEnd) {
  if (!actx || muted) return;
  const a = actx, now = a.currentTime + t0;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, now);
  if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, now + dur);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(vol, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.connect(g).connect(a.destination);
  o.start(now);
  o.stop(now + dur + 0.05);
}
const sfx = {
  jump: () => tone(520, 0, 0.12, 'triangle', 0.06, 820),
  pick: () => { tone(880, 0, 0.1, 'triangle'); tone(1320, 0.05, 0.14, 'triangle'); },
  letter: () => [660, 880, 1100, 1320, 1760].forEach((f, i) => tone(f, i * 0.08, 0.3, 'triangle', 0.1)),
  spring: () => tone(260, 0, 0.35, 'sine', 0.14, 900),
  stomp: () => { tone(300, 0, 0.12, 'square', 0.07, 120); tone(700, 0.08, 0.1, 'triangle', 0.08); },
  die: () => tone(500, 0, 0.45, 'sawtooth', 0.07, 90),
  lever: () => { tone(420, 0, 0.06, 'square', 0.06); tone(620, 0.07, 0.06, 'square', 0.06); },
  open: () => tone(220, 0, 0.3, 'triangle', 0.07, 440),
  close: () => tone(200, 0, 0.25, 'triangle', 0.06, 100),
  cp: () => [784, 988, 1175].forEach((f, i) => tone(f, i * 0.09, 0.2, 'triangle', 0.09)),
  latch: () => [660, 880, 1100, 1320].forEach((f, i) => tone(f, i * 0.07, 0.25, 'triangle', 0.1)),
  win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.3, 'triangle', 0.12)),
  click: () => tone(700, 0, 0.06, 'triangle', 0.08),
};
$('btnSound').onclick = () => { audio(); muted = !muted; $('btnSound').textContent = muted ? '🔇' : '🔊'; };

let wakeLock = null;
async function keepAwake() {
  try {
    if (!wakeLock && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (state !== 'menu') keepAwake();
  try { if (peer && !peer.destroyed && peer.disconnected) peer.reconnect(); } catch {}
});

/* ---------- Efektler ---------- */
const parts = [];
const PALETTES = [
  [0xff3d7f, 0xff8fb8, 0xffffff, 0xffc93c],
  [0xffc93c, 0xffffff, 0xff3d7f],
  [0xb18cff, 0xffffff, 0xff8fb8],
  [0xff6fa3, 0x7ad8c7, 0xffc93c, 0x6fc3ff, 0xb18cff],
];
function burst(pos, n = 10, speed = 4, pal = 0) {
  const colors = PALETTES[pal];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(HEART_TINY, new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true }));
    m.position.set(pos[0], pos[1], pos[2] || 0);
    const a = Math.random() * Math.PI * 2, up = Math.random();
    const v = new THREE.Vector3(Math.cos(a) * (1 - up * 0.5), 0.6 + up, Math.sin(a) * (1 - up * 0.5) * 0.5).multiplyScalar(speed * (0.5 + Math.random() * 0.7));
    scene.add(m);
    parts.push({ m, v, life: 0.8 + Math.random() * 0.6, spin: (Math.random() - 0.5) * 10, g: 7 });
  }
}
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.v.y -= p.g * dt;
    p.m.position.addScaledVector(p.v, dt);
    p.m.rotation.y += p.spin * dt;
    p.life -= dt;
    p.m.material.opacity = Math.min(1, p.life * 2);
    if (p.life <= 0) {
      scene.remove(p.m);
      p.m.material.dispose();
      parts.splice(i, 1);
    }
  }
}

const tmpV = new THREE.Vector3();
function popup(text, p, color = '#ff3d7f', size = 22) {
  let vi = 0;
  if (mode === 'local' && state !== 'menu') {
    const d0 = Math.abs(players[0].x - p[0]) + Math.abs(players[0].y - p[1]);
    const d1 = Math.abs(players[1].x - p[0]) + Math.abs(players[1].y - p[1]);
    vi = d0 <= d1 ? 0 : 1;
  }
  const vp = views[vi];
  tmpV.set(p[0], p[1], p[2] || 0).project(cams[vi]);
  if (tmpV.z > 1 || Math.abs(tmpV.x) > 1.1 || Math.abs(tmpV.y) > 1.1) return;
  const d = document.createElement('div');
  d.className = 'pop';
  d.textContent = text;
  d.style.left = vp[0] + (tmpV.x * 0.5 + 0.5) * vp[2] + 'px';
  d.style.top = innerHeight - (vp[1] + (tmpV.y * 0.5 + 0.5) * vp[3]) + 'px';
  d.style.color = color;
  d.style.fontSize = size + 'px';
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 950);
}
function banner(html) {
  const b = $('banner');
  b.innerHTML = html;
  b.classList.remove('show');
  void b.offsetWidth;
  b.classList.add('show');
}
let toastTimer = 0;
function toast(text, dur = 3) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, dur * 1000);
}
function fx(k, p) {
  switch (k) {
    case 'heart': sfx.pick(); burst(p, 8, 3.5); popup('+1 💗', p); break;
    case 'letter': sfx.letter(); burst(p, 30, 5, 1); popup('💌', p, '#ff3d7f', 34); break;
    case 'lever': sfx.lever(); break;
    case 'stomp': sfx.stomp(); burst(p, 14, 4, 2); popup('💥', p, '#7b5cd6', 30); break;
    case 'cp': sfx.cp(); burst(p, 14, 4); popup('🚩 Kayıt', p, '#ff3d7f', 20); break;
    case 'open': sfx.open(); break;
    case 'close': sfx.close(); break;
    case 'latch': sfx.latch(); toast('🔓 Kapı artık açık kalacak!', 2.5); break;
    case 'win': sfx.win(); burst(p, 50, 7, 3); break;
  }
}

// Her iki cihazda görünmesi gereken olaylar: otorite üretir, misafire gönderir
function emit(ev) {
  applyEvent(ev);
  if (mode === 'host') send({ t: 'ev', ev });
}
function applyEvent(ev) {
  switch (ev.e) {
    case 'load': loadLevel(ev.i); break;
    case 'fx': fx(ev.k, ev.p); break;
    case 'sfx': sfx[ev.n]?.(); break;
    case 'banner': banner(ev.h); break;
    case 'toast': toast(ev.s, ev.d); break;
    case 'card': renderCard(ev.k, ev.d); break;
    case 'close': overlay.hidden = true; overlay.innerHTML = ''; break;
  }
}

/* ---------- Oyun akışı ---------- */
function loadProgress() {
  try { return clamp(parseInt(localStorage.getItem(SAVE_KEY), 10) || 0, 0, LEVELS.length - 1); } catch { return 0; }
}
function saveProgress(n) {
  try { if (n > loadProgress()) localStorage.setItem(SAVE_KEY, String(Math.min(n, LEVELS.length - 1))); } catch {}
}

function startLevel(i) {
  votes = [null, null];
  currentCard = null;
  emit({ e: 'load', i });
  state = 'play';
  emit({ e: 'close' });
  emit({ e: 'banner', h: `${i + 1}. Bölüm<br><span style="font-size:.6em">${LEVELS[i].name}</span>` });
  if (LEVELS[i].hint) emit({ e: 'toast', s: LEVELS[i].hint, d: 7 });
  sendWorld();
}

function levelComplete() {
  state = 'done';
  const d = { lv: W.lv, h: W.hearts, th: L.totalHearts, l: W.letter, t: Math.round(W.time), d: W.deaths };
  runStats[W.lv] = d;
  saveProgress(W.lv + 1);
  emit({ e: 'fx', k: 'win', p: [L.exit.x, L.exit.y + 2.5, 0] });
  sendWorld();
  setTimeout(() => { if (state === 'done' && W.lv === d.lv) showGameCard('done', d); }, 1400);
}

function showEnding() {
  state = 'final';
  votes = [null, null];
  currentCard = null;
  emit({ e: 'close' });
  emit({ e: 'banner', h: `${NAMES[0]} ❤ ${NAMES[1]}` });
  const stats = Object.values(runStats);
  const d = {
    found: stats.filter(s => s.l).map(s => s.lv).sort((a, b) => a - b),
    hearts: stats.reduce((a, s) => a + s.h, 0),
    th: stats.reduce((a, s) => a + s.th, 0),
  };
  sendWorld();
  setTimeout(() => { if (state === 'final') showGameCard('final', d); }, 3500);
}

function pauseGame() {
  if (state !== 'play') return;
  state = 'pause';
  showGameCard('pause');
}
function pressPause() {
  audio();
  if (state !== 'play') return;
  if (mode === 'guest') send({ t: 'pause' });
  else pauseGame();
}
$('btnPause').onclick = pressPause;

function showGameCard(k, d = {}) {
  currentCard = { k, d };
  emit({ e: 'card', k, d });
  sendWorld();
}

const IMMEDIATE = ['resume'];
function doAction(a) {
  if (!currentCard || !cardDef(currentCard.k, currentCard.d).btns.some(b => b[0] === a)) return;
  const d = currentCard.d;
  votes = [null, null];
  emit({ e: 'sfx', n: 'click' });
  switch (a) {
    case 'new': runStats = {}; startLevel(0); break;
    case 'cont': startLevel(d.saved); break;
    case 'next': startLevel(W.lv + 1); break;
    case 'retry': startLevel(W.lv); break;
    case 'skip': if (W.lv + 1 < LEVELS.length) startLevel(W.lv + 1); else showEnding(); break;
    case 'final': showEnding(); break;
    case 'resume': state = 'play'; currentCard = null; emit({ e: 'close' }); sendWorld(); break;
  }
}
function vote(a, who) {
  if (IMMEDIATE.includes(a)) return doAction(a);
  votes[who] = votes[who] === a ? null : a;
  if (votes[0] && votes[0] === votes[1]) doAction(a);
  else { updateVoteUI(); sendWorld(); }
}
function requestAction(a) {
  audio();
  if (mode === 'local') return doAction(a);
  if (mode === 'host') return vote(a, myChar);
  send({ t: 'vote', a });
  if (!IMMEDIATE.includes(a)) { votes[myChar] = votes[myChar] === a ? null : a; updateVoteUI(); }
}

/* ---------- Kartlar ---------- */
const overlay = $('overlay');
function showCard(html) {
  overlay.innerHTML = `<div class="card">${html}</div>`;
  overlay.hidden = false;
}
const who = i => `<b class="${i ? 'cb' : 'cm'}">${NAMES[i]}</b>`;
const touch = matchMedia('(pointer: coarse)').matches;
function controlsHtml() {
  if (online()) {
    return `<p class="small">${touch ? 'Ekrandaki ◀ ▶ ile yürü, ⬆ ile zıpla, ✋ ile kol çek.' : 'A/D veya ←/→ yürü · W/↑/Boşluk zıpla · E/S/↓ kol çek · Esc durdur'}</p>`;
  }
  return `<div class="controls">
    <div class="ctrl">${who(0)}<kbd>A</kbd> <kbd>D</kbd> yürü<br><kbd>W</kbd> zıpla · <kbd>S</kbd> kol</div>
    <div class="ctrl pink">${who(1)}<kbd>←</kbd> <kbd>→</kbd> yürü<br><kbd>↑</kbd> zıpla · <kbd>↓</kbd> kol</div>
  </div>`;
}
const fmtTime = t => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;

function cardDef(k, d = {}) {
  switch (k) {
    case 'ready': return {
      html: `<div class="big">💞</div><h2>${online() ? 'Bağlandınız!' : 'Hazır mısınız?'}</h2>
        ${online() ? `<p>Sen: ${who(myChar)} · Sevgilin: ${who(1 - myChar)}</p>` : ''}
        <p class="small">${LEVELS.length} dünya sizi bekliyor. Her bölümde bir anı mektubu saklı!</p>${controlsHtml()}`,
      btns: d.saved > 0 ? [['cont', `▶ Devam: ${d.saved + 1}. Bölüm`], ['new', 'Baştan Başla', 'sec']] : [['new', 'Başlayalım 💕']],
    };
    case 'done': {
      const last = d.lv === LEVELS.length - 1;
      return {
        html: `<div class="big">${d.l ? '💌' : '🎉'}</div><h2>${d.lv + 1}. Bölüm tamam!</h2>
          ${d.l ? `<p class="small">Bulduğunuz anı mektubu:</p><p class="msg">${LETTERS[d.lv]}</p>`
                : '<p class="small">Bu bölümün mektubunu bulamadınız 🙈 Tekrar oynayıp arayabilirsiniz.</p>'}
          <p class="stats">💗 ${d.h}/${d.th} · ⏱ ${fmtTime(d.t)} · 💫 ${d.d} düşüş</p>`,
        btns: last ? [['final', 'Final 💞'], ['retry', 'Bölümü Tekrarla', 'sec']]
                   : [['next', 'Sonraki Bölüm →'], ['retry', 'Bölümü Tekrarla', 'sec']],
      };
    }
    case 'pause': return {
      html: '<div class="big">⏸️</div><h2>Oyun durdu</h2>',
      btns: [['resume', '▶ Devam Et'], ['retry', '🔄 Bölümü Baştan Başlat', 'sec'],
        ['skip', W.lv < LEVELS.length - 1 ? '⏭ Bölümü Atla' : '⏭ Finale Geç', 'sec']],
    };
    case 'final': return {
      html: `<div class="big">💞</div><h1>${who(0)} & ${who(1)}</h1><p class="msg">${FINAL_MSG}</p>
        <p class="stats">💗 ${d.hearts}/${d.th} kalp · 💌 ${d.found.length}/${LETTERS.length} mektup</p>
        ${d.found.length ? `<details><summary>Bulduğunuz mektupları okuyun</summary>${d.found.map(i => `<p class="letter">${LETTERS[i]}</p>`).join('')}</details>` : ''}`,
      btns: [['new', 'Baştan Oyna']],
    };
  }
  return { html: '', btns: [] };
}
function renderCard(k, d) {
  const def = cardDef(k, d);
  const hint = online() && def.btns.some(b => !IMMEDIATE.includes(b[0]))
    ? '<p class="small">İkiniz de aynı butona basınca devam eder.</p><p id="voteStatus"></p>' : '';
  showCard(`${def.html}<div class="btns">${def.btns.map(([a, lab, cls]) =>
    `<button data-a="${a}" data-label="${lab}" class="${cls || ''}">${lab}<span class="cnt"></span></button>`).join('')}</div>${hint}`);
  overlay.querySelectorAll('button[data-a]').forEach(b => { b.onclick = () => requestAction(b.dataset.a); });
  updateVoteUI();
}
function updateVoteUI() {
  if (!online() || overlay.hidden) return;
  overlay.querySelectorAll('button[data-a]').forEach(b => {
    const a = b.dataset.a;
    if (IMMEDIATE.includes(a)) return;
    const n = votes.filter(v => v === a).length;
    b.querySelector('.cnt').textContent = n ? `${n}/2` : '';
    const mine = votes[myChar] === a;
    b.classList.toggle('voted', mine);
    b.firstChild.textContent = mine ? '✓ ' + b.dataset.label : b.dataset.label;
  });
  const st = $('voteStatus');
  if (st) st.innerHTML = [0, 1].map(i => `${who(i)} ${votes[i] ? '✅ hazır' : '⏳ bekleniyor'}`).join(' · ');
}

/* ---------- Ağ (PeerJS / WebRTC) ---------- */
// STUN: cihazların birbirini bulması. TURN: ağ doğrudan bağlantıya izin vermezse trafiği aktaran
// yedek sunucu. Bağlantı "Cihazlar bağlanıyor…" adımında takılıyorsa buraya TURN bilgisi ekleyin:
//   TURN.push({ urls: 'turn:....metered.ca:80', username: '...', credential: '...' });
const TURN = [];
const PEER_OPTS = {
  debug: 1,
  config: { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, ...TURN] },
};
const HELP = `<br><span class="small">• İkinizin de interneti açık olmalı.<br>
  • Oda kuranın sayfası açık kalmalı (başka uygulamaya geçmeyin).<br>
  • Olmazsa biriniz Wi‑Fi yerine mobil veriye geçip yeni bir oda kurun.</span>`;
let peer = null, conn = null, lastRecv = 0, gotHello = false, attempt = 0, pT = 0, wT = 0;
const MAX_TRY = 4;
const send = m => { if (conn && conn.open) { try { conn.send(m); } catch {} } };
const goHome = () => { try { if (peer) peer.destroy(); } catch {} location.href = location.pathname; };
function setStatus(html) { const el = $('wStatus'); if (el) el.innerHTML = html; }
function makeCode() {
  const A = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
  return Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join('');
}
function peerMissing() {
  if (typeof Peer !== 'undefined') return false;
  errorCard('Online bağlantı kütüphanesi yüklenemedi. İnternet bağlantını kontrol et.');
  return true;
}
function errorCard(text) {
  if (state === 'lost') return;
  showCard(`<div class="big">😿</div><h2>Olmadı…</h2><p>${text}</p><div class="btns"><button id="bHome">Ana Menü</button></div>`);
  $('bHome').onclick = goHome;
}
function lost() {
  if (state === 'lost') return;
  if (mode === 'guest' && !gotHello) { errorCard('Bağlantı kurulamadı.' + HELP); return; }
  state = 'lost';
  showCard(`<div class="big">💔</div><h2>Bağlantı koptu</h2><p>Sevgilin oyundan çıktı ya da internet gitti.<br>Ana menüden yeni bir oda kurabilirsiniz; ilerlemeniz oda kuranın cihazında kayıtlı.</p>
    <div class="btns"><button id="bHome">Ana Menü</button></div>`);
  $('bHome').onclick = goHome;
}

function createRoom(char) {
  if (peerMissing()) return;
  audio();
  mode = 'host';
  myChar = char;
  setupLocals();
  const code = makeCode();
  const link = location.origin + location.pathname + '?oda=' + code;
  showCard(`<div class="big">💌</div><h2>Oda hazırlanıyor</h2>
    <p>Sevgiline bu kodu ya da linki gönder:</p>
    <div class="code">${code}</div>
    <p class="small link">${link}</p>
    <div class="btns"><button id="bShare" disabled>Linki Paylaş 🔗</button><button id="bCancel" class="sec">Vazgeç</button></div>
    <p class="small" id="wStatus">Oda kuruluyor… ⏳</p>
    <p class="small">⚠️ Sevgilin katılana kadar bu sayfayı <b>açık ve önde</b> tut.</p>`);
  $('bCancel').onclick = goHome;
  $('bShare').onclick = async () => {
    const text = `${NAMES[myChar]} seni Aşk Macerası'na çağırıyor 💘 Oda kodu: ${code}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Aşk Macerası', text, url: link });
      else { await navigator.clipboard.writeText(link); $('bShare').textContent = 'Kopyalandı ✓'; }
    } catch {}
  };
  peer = new Peer(PEER_PREFIX + code, PEER_OPTS);
  peer.on('open', () => {
    setStatus(`Oda açık, sevgilin bekleniyor… ⏳ (Sen: ${NAMES[myChar]})`);
    if ($('bShare')) $('bShare').disabled = false;
  });
  peer.on('error', err => {
    if (err.type === 'unavailable-id') { peer.destroy(); createRoom(char); return; }
    if (conn && conn.open) return;
    if (err.type === 'network' || err.type === 'socket-error' || err.type === 'server-error') {
      setStatus('Sunucuya ulaşılamıyor, tekrar deneniyor… ⏳');
      try { peer.reconnect(); } catch {}
      return;
    }
    errorCard('Oda kurulamadı (' + err.type + ').' + HELP);
  });
  peer.on('connection', c => {
    if (conn) { c.on('open', () => c.close()); return; }
    conn = c;
    c.on('open', () => {
      lastRecv = performance.now();
      c.send({ t: 'hello', you: 1 - myChar });
      emit({ e: 'load', i: 0 });
      state = 'lobby';
      showGameCard('ready', { saved: loadProgress() });
    });
    c.on('data', onHostData);
    c.on('close', lost);
    c.on('error', lost);
  });
  peer.on('disconnected', () => { if (!(conn && conn.open)) try { peer.reconnect(); } catch {} });
}

function joinRoom(code) {
  code = (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 4) { if ($('codeIn')) $('codeIn').focus(); return; }
  if (peerMissing()) return;
  audio();
  mode = 'guest';
  gotHello = false;
  attempt = 0;
  try { if (peer) peer.destroy(); } catch {}
  peer = null; conn = null;
  showCard(`<div class="big">💗</div><h2>Bağlanıyor…</h2><p>Oda: <b>${code}</b></p>
    <p class="small" id="wStatus">Sunucuya bağlanılıyor… ⏳</p>
    <p class="small">Oda kuranın sayfası açık olmalı. Bağlantı 10–15 saniye sürebilir.</p>
    <div class="btns"><button id="bRetry" class="sec">↻ Tekrar Dene</button><button id="bCancel" class="sec">Vazgeç</button></div>`);
  $('bCancel').onclick = goHome;
  $('bRetry').onclick = () => joinRoom(code);
  peer = new Peer(PEER_OPTS);
  peer.on('open', () => { setStatus('Oda aranıyor… 🔍'); tryConnect(code); });
  peer.on('error', err => {
    if (gotHello) return;
    if (err.type === 'peer-unavailable') {
      if (attempt < MAX_TRY) { setStatus(`Oda henüz açılmamış, tekrar deneniyor… (${attempt}/${MAX_TRY})`); setTimeout(() => tryConnect(code), 2500); }
      else errorCard(`<b>${code}</b> odası bulunamadı 🥺<br>Kodu kontrol et; oda kuranın sayfası açık olmalı.` + HELP);
    } else if (err.type === 'network' || err.type === 'socket-error' || err.type === 'server-error') {
      setStatus('Sunucuya ulaşılamıyor, tekrar deneniyor… ⏳');
    } else errorCard('Bağlanılamadı (' + err.type + ').' + HELP);
  });
}
function tryConnect(code) {
  if (!peer || peer.destroyed || gotHello) return;
  const n = ++attempt;
  setStatus(`Cihazlar bağlanıyor… (${n}. deneme) 📡`);
  const c = peer.connect(PEER_PREFIX + code, { reliable: true, serialization: 'json' });
  conn = c;
  c.on('open', () => { if (conn === c) { lastRecv = performance.now(); setStatus('Bağlandı, oyun yükleniyor… 💞'); } });
  c.on('data', m => { if (conn === c) onGuestData(m); });
  c.on('close', () => { if (conn === c && gotHello) lost(); });
  c.on('error', () => {});
  setTimeout(() => {
    if (gotHello || conn !== c) return;
    try { c.close(); } catch {}
    if (attempt < MAX_TRY) tryConnect(code);
    else errorCard('Bağlantı kurulamadı 😿' + HELP);
  }, 10000);
}

function setRemote(p, s) {
  if (!Array.isArray(s) || s[6] !== W.lv) return;
  p.tx = s[0]; p.ty = s[1]; p.vx = s[2]; p.vy = s[3]; p.face = s[4] || 1;
  p.netGround = !!(s[5] & 1);
  p.netDead = !!(s[5] & 2);
  if (!p.hasNet) { p.x = p.tx; p.y = p.ty; }
  p.hasNet = true;
}
function onHostData(m) {
  lastRecv = performance.now();
  switch (m.t) {
    case 'p': setRemote(players[1 - myChar], m.s); break;
    case 'r': handleRequest(m.k, m.id, m.lv, 1 - myChar); break;
    case 'vote': vote(m.a, 1 - myChar); break;
    case 'pause': pauseGame(); break;
  }
}
function onGuestData(m) {
  lastRecv = performance.now();
  switch (m.t) {
    case 'hello': gotHello = true; myChar = m.you; setupLocals(); break;
    case 'p': setRemote(players[1 - myChar], m.s); break;
    case 'w': applyWorld(m); break;
    case 'ev': applyEvent(m.ev); break;
  }
}

function worldSnap() {
  return {
    t: 'w', lv: W.lv, st: state, gt: +W.gt.toFixed(3), tm: +W.time.toFixed(1),
    o: GROUPS.map(g => W.open[g] ? 1 : 0).join(''), a: GROUPS.map(g => W.act[g] ? 1 : 0).join(''),
    lev: W.lev.map(v => v ? 1 : 0), got: [...W.got], en: W.enemies.map(e => [r2(e.x), e.alive ? 1 : 0, e.dir]),
    cp: W.cp, h: W.hearts, l: W.letter ? 1 : 0, d: W.deaths, x: W.exitN, v: votes,
  };
}
function sendWorld() { if (mode === 'host') send(worldSnap()); }
function applyWorld(s) {
  if (state === 'lost') return;
  state = s.st;
  votes = s.v;
  updateVoteUI();
  if (!L || s.lv !== W.lv) return;
  if (Math.abs(s.gt - W.gt) > 1) W.gt = s.gt; else W.gt += (s.gt - W.gt) * 0.2;
  W.time = s.tm;
  GROUPS.forEach((g, i) => { W.open[g] = s.o[i] === '1'; W.act[g] = s.a[i] === '1'; });
  W.lev = s.lev.map(Boolean);
  W.got = new Set(s.got);
  s.en.forEach((e, i) => {
    const E = W.enemies[i];
    if (!E) return;
    E.x = e[0]; E.face = e[2] || E.face;
    if (!(E.hold > 0)) E.alive = !!e[1];
  });
  W.cp = Array.isArray(s.cp) ? s.cp : [-1, -1]; W.hearts = s.h; W.letter = !!s.l; W.deaths = s.d; W.exitN = s.x;
}

function netTick(dt) {
  if (!online() || !conn || !conn.open) return;
  pT -= dt;
  if (pT <= 0) {
    pT = 0.05;
    const p = players[myChar];
    send({ t: 'p', s: [r2(p.x), r2(p.y), r2(p.vx), r2(p.vy), p.face, (p.onGround ? 1 : 0) | (p.dead > 0 ? 2 : 0), W.lv] });
  }
  if (mode === 'host') {
    wT -= dt;
    if (wT <= 0) { wT = 1 / 12; sendWorld(); }
  }
  $('net').hidden = performance.now() - lastRecv < 2500 || state === 'lost';
}

function updateRemote(dt) {
  const k = 1 - Math.exp(-18 * dt);
  for (const p of players) {
    if (p.local) continue;
    const ox = p.x, oy = p.y;
    if (Math.hypot(p.tx - p.x, p.ty - p.y) > 4) { p.x = p.tx; p.y = p.ty; }
    else { p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; }
    p.sdx = p.x - ox;
    p.sdy = p.y - oy;
    p.dead = p.netDead ? 1 : 0;
  }
}
function interpEnemies(dt) {
  for (const e of W.enemies) {
    if (e.hold > 0) e.hold -= dt;
    e.rx = Math.abs(e.x - e.rx) > 3 ? e.x : damp(e.rx, e.x, 12, dt);
  }
}

/* ---------- Kontroller ---------- */
const kb = {};
const inputs = [0, 1].map(() => ({ x: 0, jump: false, jq: false, aq: false }));
const touchState = { l: false, r: false, j: false };
function keyRole(code) {
  if (mode === 'local') {
    if (code === 'KeyW') return [0, 'jq'];
    if (code === 'KeyS' || code === 'KeyE') return [0, 'aq'];
    if (code === 'ArrowUp') return [1, 'jq'];
    if (code === 'ArrowDown') return [1, 'aq'];
    return null;
  }
  if (code === 'KeyW' || code === 'ArrowUp' || code === 'Space') return [myChar, 'jq'];
  if (code === 'KeyS' || code === 'KeyE' || code === 'ArrowDown') return [myChar, 'aq'];
  return null;
}
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.code === 'Escape' || e.code === 'KeyP') { if (!e.repeat) pressPause(); return; }
  const first = !kb[e.code];
  kb[e.code] = true;
  if (!first) return;
  const r = keyRole(e.code);
  if (r) inputs[r[0]][r[1]] = true;
});
addEventListener('keyup', e => { kb[e.code] = false; });
addEventListener('blur', () => { for (const k in kb) kb[k] = false; });
function readInputs() {
  const k = c => kb[c] ? 1 : 0;
  if (mode === 'local') {
    inputs[0].x = k('KeyD') - k('KeyA');
    inputs[0].jump = !!kb.KeyW;
    inputs[1].x = k('ArrowRight') - k('ArrowLeft');
    inputs[1].jump = !!kb.ArrowUp;
  } else {
    const i = inputs[myChar];
    i.x = Math.max(k('KeyD'), k('ArrowRight'), touchState.r ? 1 : 0) - Math.max(k('KeyA'), k('ArrowLeft'), touchState.l ? 1 : 0);
    i.jump = !!(kb.KeyW || kb.ArrowUp || kb.Space || touchState.j);
  }
}
function bindTouch(id, key, onDown) {
  const el = $(id);
  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    audio();
    if (key) touchState[key] = true;
    el.classList.add('on');
    if (onDown) onDown();
    try { el.setPointerCapture(e.pointerId); } catch {}
  });
  const up = () => { if (key) touchState[key] = false; el.classList.remove('on'); };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => el.addEventListener(ev, up));
  el.addEventListener('contextmenu', e => e.preventDefault());
}
bindTouch('tL', 'l');
bindTouch('tR', 'r');
bindTouch('tJ', 'j', () => { inputs[myChar].jq = true; });
bindTouch('tA', null, () => { inputs[myChar].aq = true; });

/* ---------- Görsel güncelleme ---------- */
function visualPlayers(dt, t) {
  for (const p of players) {
    const { root, model, arms } = p.ch;
    const dead = isDead(p);
    if (dead && !p.wasDead && !p.local) { burst([p.x, p.y + 0.7, 0], 16, 4, 2); sfx.die(); }
    p.wasDead = dead;
    root.visible = !dead && !(p.local && p.inv > 0 && Math.floor(t * 15) % 2 === 0);
    root.position.set(p.x, p.y, 0);
    root.rotation.y = lerpAngle(root.rotation.y, p.face > 0 ? 1.15 : -1.15, 1 - Math.exp(-14 * dt));
    const grounded = p.local ? p.onGround : p.netGround;
    const speed = Math.abs(p.vx);
    if (grounded && speed > 0.5) p.walk += dt * speed * 2.2;
    else p.walk = damp(p.walk, Math.round(p.walk / Math.PI) * Math.PI, 10, dt);
    if (state === 'final') {
      model.position.y = Math.abs(Math.sin(t * 5 + p.id)) * 0.3;
      arms[0].rotation.set(0, 0, -2.6);
      arms[1].rotation.set(0, 0, 2.6);
    } else if (!grounded) {
      model.position.y = 0;
      arms[0].rotation.set(0, 0, p.vy > 0 ? -2.4 : -1.4);
      arms[1].rotation.set(0, 0, p.vy > 0 ? 2.4 : 1.4);
    } else {
      model.position.y = Math.abs(Math.sin(p.walk)) * 0.08;
      arms[0].rotation.set(Math.sin(p.walk) * 0.7, 0, -0.25);
      arms[1].rotation.set(-Math.sin(p.walk) * 0.7, 0, 0.25);
    }
    model.scale.y = 0.7 * (1 + Math.sin(t * 3 + p.id * 2) * 0.02);
  }
}

function visualLevel(dt, t) {
  for (const it of L.items) {
    it.mesh.visible = !W.got.has(it.id) && !it.pending;
    it.mesh.rotation.y += dt * (it.kind === 'heart' ? 2 : 1.2);
    it.mesh.position.y = it.y + Math.sin(t * 3 + it.id) * 0.1;
    if (it.kind === 'letter') it.mesh.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
  }
  for (const g of GROUPS) {
    const d = L.doorMeshes[g];
    if (!d) continue;
    d.k = damp(d.k, W.open[g] ? 0 : 1, 8, dt);
    d.grp.children.forEach(c => { c.scale.y = Math.max(0.04, d.k); c.position.y = c.userData.y0 - (1 - d.k) * 0.48; });
    d.mat.opacity = 0.15 + 0.75 * d.k;
  }
  for (const pl of L.plates) {
    const on = players.some(p => !isDead(p) && Math.abs(p.x - pl.x) < 0.75 && p.y >= pl.y - 0.05 && p.y < pl.y + 0.4);
    pl.mesh.position.y = pl.y + (on ? 0.03 : 0.08);
    pl.mesh.material.emissiveIntensity = on ? 0.9 : 0.15;
  }
  for (const l of L.levers) l.pivot.rotation.z = damp(l.pivot.rotation.z, W.lev[l.id] ? -0.6 : 0.6, 12, dt);
  for (const c of L.cps) {
    const a = c.id <= W.cp[0], b = c.id <= W.cp[1], on = a || b;
    c.flag.material.color.set(a && b ? 0xff3d7f : a ? 0x5b9bf0 : b ? 0xff7eb0 : 0xbbbbbb);
    c.flag.material.emissiveIntensity = on ? 0.4 : 0;
    c.flag.rotation.y = Math.sin(t * 3 + c.id) * 0.25;
  }
  for (const mv of L.movers) mv.mesh.position.set(mv.px + mv.w / 2, mv.py + 0.7, 0);
  W.enemies.forEach((e, i) => {
    const m = L.enemyMeshes[i];
    m.visible = e.alive;
    m.position.set(e.rx, e.y + 0.36 + Math.abs(Math.sin(t * 6 + i)) * 0.08, 0);
    m.rotation.y = damp(m.rotation.y, e.face > 0 ? 0.6 : -0.6, 8, dt);
  });
  for (const s of L.springs) {
    s.anim = Math.max(0, s.anim - dt * 4);
    s.pad.position.y = 0.4 + s.anim * 0.3;
  }
  L.exitRing.rotation.y += dt * 2;
  L.exitRing.scale.setScalar(1 + W.exitN * 0.12 + Math.sin(t * 4) * 0.04);
  L.exitHeart.rotation.y = Math.sin(t) * 0.4;
  L.exitHeart.scale.setScalar(1 + Math.sin(t * 5) * 0.05 + W.exitN * 0.1);
  L.decor.children.forEach(o => {
    if (o.userData.snow) { o.position.y -= o.userData.snow * dt; if (o.position.y < -2) o.position.y = L.h + 6; }
    if (o.userData.float) o.position.y += Math.sin(t * o.userData.float) * 0.005;
  });
}

let fireT = 0;
function followCam(cam, p, dt) {
  const u = cam.userData;
  u.tx = damp(u.tx, clamp(p.x + p.face * 1.2, 5, L.w - 5), 3.5, dt);
  u.ty = damp(u.ty, p.y + 1.2, 3, dt);
  const a = cam.aspect || 1;
  const dist = a < 0.8 ? 18 : a < 1.3 ? 14.5 : 12.5;
  cam.position.set(u.tx, u.ty + 2.4, dist);
  cam.lookAt(u.tx, u.ty + 0.4, 0);
}

const arrowEl = $('arrow');
function uiFrame() {
  const inGame = ['play', 'pause', 'done'].includes(state);
  $('hud').hidden = !inGame;
  $('btnPause').hidden = state !== 'play';
  if (inGame && L) {
    setText('lvl', `${W.lv + 1}. ${L.name}`);
    setText('hearts', `💗 ${W.hearts}/${L.totalHearts}`);
    setText('letter', W.letter ? '💌 ✓' : '💌 ?');
    $('exitN').hidden = !W.exitN;
    setText('exitN', `💞 ${W.exitN}/2 kapıda`);
  }
  const moving = PHYS_STATES.includes(state) && overlay.hidden;
  $('touch').hidden = !(online() && touch && moving);
  const split = mode === 'local' && state !== 'menu';
  const div = $('divider');
  div.hidden = !split;
  div.className = innerHeight > innerWidth * 1.1 ? 'h' : 'v';

  if (online() && L && moving) {
    const o = players[1 - myChar];
    tmpV.set(o.x, o.y + 0.7, 0).project(cams[0]);
    const off = Math.abs(tmpV.x) > 1 || Math.abs(tmpV.y) > 1;
    arrowEl.hidden = !off || isDead(o);
    if (off) {
      const m = Math.max(Math.abs(tmpV.x), Math.abs(tmpV.y));
      arrowEl.style.left = (tmpV.x / m * 0.86 * 0.5 + 0.5) * innerWidth + 'px';
      arrowEl.style.top = (-tmpV.y / m * 0.8 * 0.5 + 0.5) * innerHeight + 'px';
      arrowEl.querySelector('.ar').style.transform = `rotate(${-Math.atan2(tmpV.y, tmpV.x)}rad)`;
      arrowEl.querySelector('.nm').textContent = NAMES[o.id];
    }
  } else arrowEl.hidden = true;
}
const textCache = {};
function setText(id, s) { if (textCache[id] !== s) { textCache[id] = s; $(id).textContent = s; } }

function render(dt, t) {
  const w = innerWidth, h = innerHeight;
  const split = mode === 'local' && state !== 'menu';
  if (state === 'menu') {
    const u = cams[0].userData;
    u.tx = 9 + Math.sin(t * 0.15) * 5;
    u.ty = 4;
    cams[0].position.set(u.tx, u.ty + 2.4, 14);
    cams[0].lookAt(u.tx, u.ty, 0);
  } else if (split) {
    followCam(cams[0], players[0], dt);
    followCam(cams[1], players[1], dt);
  } else followCam(cams[0], players[myChar], dt);

  const cx = split ? (cams[0].userData.tx + cams[1].userData.tx) / 2 : cams[0].userData.tx;
  const cy = cams[0].userData.ty;
  sun.target.position.set(cx, cy, 0);
  sun.position.set(cx + 8, cy + 18, 14);

  if (split) {
    const portrait = h > w * 1.1;
    renderer.setScissorTest(true);
    for (let i = 0; i < 2; i++) {
      const vp = portrait ? [0, i === 0 ? h / 2 : 0, w, h / 2] : [i * w / 2, 0, w / 2, h];
      views[i] = vp;
      renderer.setViewport(vp[0], vp[1], vp[2], vp[3]);
      renderer.setScissor(vp[0], vp[1], vp[2], vp[3]);
      cams[i].aspect = vp[2] / vp[3];
      cams[i].updateProjectionMatrix();
      renderer.render(scene, cams[i]);
    }
    renderer.setScissorTest(false);
  } else {
    views[0] = [0, 0, w, h];
    renderer.setViewport(0, 0, w, h);
    cams[0].aspect = w / h;
    cams[0].updateProjectionMatrix();
    renderer.render(scene, cams[0]);
  }
}

/* ---------- Ana döngü ---------- */
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  frame(Math.min(clock.getDelta(), 0.1), clock.elapsedTime);
}
function frame(dt, t) {
  readInputs();
  const phys = L && PHYS_STATES.includes(state);
  if (!phys) inputs.forEach(i => { i.jq = false; i.aq = false; });
  if (L) updateRemote(dt);
  if (phys) {
    acc += dt;
    let first = true;
    while (acc >= STEP) {
      W.gt += STEP;
      updateMovers(STEP);
      for (const p of players) if (p.local) stepPlayer(p, inputs[p.id], STEP);
      if (authority() && state === 'play') authorityStep(STEP);
      if (first) { players.forEach(p => { if (!p.local) { p.sdx = 0; p.sdy = 0; } }); first = false; }
      acc -= STEP;
    }
  } else acc = 0;
  if (L && !authority()) interpEnemies(dt);
  netTick(dt);
  if (L) {
    visualPlayers(dt, t);
    visualLevel(dt, t);
    if (state === 'final') {
      fireT -= dt;
      if (fireT <= 0) {
        fireT = 0.4;
        const p = players[mode === 'local' ? 0 : myChar];
        burst([p.x + (Math.random() - 0.5) * 12, p.y + 3 + Math.random() * 4, -1], 26, 6, 3);
        tone(700 + Math.random() * 600, 0, 0.2, 'triangle', 0.04);
      }
    }
  }
  updateParts(dt);
  uiFrame();
  render(dt, t);
}

/* ---------- Menüler ---------- */
function menuCard() {
  showCard(`<div class="big">💞</div><h1>Aşk Macerası</h1>
    <div class="names">${who(0)} & ${who(1)}</div>
    <p>${LEVELS.length} dünya, ikinizi de gerektiren bulmacalar ve her bölümde saklı bir anı mektubu.</p>
    <div class="btns">
      <button id="hA" class="blue">${NAMES[0]} olarak oda kur</button>
      <button id="hB">${NAMES[1]} olarak oda kur</button>
    </div>
    <p class="or">— ya da sevgilinin odasına katıl —</p>
    <div class="join"><input id="codeIn" maxlength="4" placeholder="KOD" autocomplete="off" autocapitalize="characters"><button id="bJoin">Katıl</button></div>
    <div class="btns"><button id="bLocal" class="sec">🖥️ Aynı bilgisayarda oyna (bölünmüş ekran)</button></div>`);
  $('hA').onclick = () => createRoom(0);
  $('hB').onclick = () => createRoom(1);
  $('bJoin').onclick = () => joinRoom($('codeIn').value);
  $('codeIn').onkeydown = e => { if (e.key === 'Enter') joinRoom($('codeIn').value); };
  $('bLocal').onclick = () => {
    audio();
    mode = 'local';
    setupLocals();
    loadLevel(0);
    state = 'lobby';
    showGameCard('ready', { saved: loadProgress() });
  };
}
function inviteCard(code) {
  showCard(`<div class="big">💌</div><h2>Bir davetin var!</h2>
    <p>Sevgilin seni Aşk Macerası'na çağırıyor.</p>
    <div class="code">${code}</div>
    <p class="small">${LEVELS.length} dünya, ortak bulmacalar ve saklı anı mektupları seni bekliyor.</p>
    <div class="btns"><button id="bJoin">Katıl 💕</button><button id="bOther" class="sec">Ana Menü</button></div>`);
  $('bJoin').onclick = () => joinRoom(code);
  $('bOther').onclick = goHome;
}

loadLevel(0);
const urlCode = (new URLSearchParams(location.search).get('oda') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
if (urlCode.length === 4) inviteCard(urlCode); else menuCard();
loop();

if (DEBUG) {
  let fakeT = 0;
  window.__am = {
    players, W, inputs, kb, startLevel, levelComplete, showEnding, tileAt, solidFor,
    // test için oyunu elle ilerlet (arka plandaki sekmede requestAnimationFrame durur)
    advance(sec) { for (let i = 0; i < sec * 60; i++) frame(1 / 60, fakeT += 1 / 60); },
    get L() { return L; }, get state() { return state; }, get mode() { return mode; },
  };
}
