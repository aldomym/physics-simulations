import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const canvas3d = document.getElementById('canvas3d');

// Inputs
const lengthInput = document.getElementById('length');
const thetaInput = document.getElementById('theta');
const phiInput = document.getElementById('phi');
const thetaDotInput = document.getElementById('thetaDot');
const phiDotInput = document.getElementById('phiDot');
const gravitySelect = document.getElementById('gravity');
const dtInput = document.getElementById('dt');
const traceLenInput = document.getElementById('traceLen');
const playPauseBtn = document.getElementById('playPauseBtn');
const playIcon = document.getElementById('playIcon');
const playText = document.getElementById('playText');
const resetBtn = document.getElementById('resetBtn');
const clearTraceBtn = document.getElementById('clearTraceBtn');
const modeRadios = document.querySelectorAll('input[name="mode"]');
const viewRadios = document.querySelectorAll('input[name="view"]');

// Value displays
const lengthVal = document.getElementById('lengthVal');
const thetaVal = document.getElementById('thetaVal');
const phiVal = document.getElementById('phiVal');
const thetaDotVal = document.getElementById('thetaDotVal');
const phiDotVal = document.getElementById('phiDotVal');
const dtVal = document.getElementById('dtVal');
const traceLenVal = document.getElementById('traceLenVal');

// Readouts
const energyVal = document.getElementById('energyVal');
const lzVal = document.getElementById('lzVal');
const thetaCurrVal = document.getElementById('thetaCurrVal');
const phiCurrVal = document.getElementById('phiCurrVal');

// State
let L = 1.0;
let theta = 30 * Math.PI / 180;
let phi = 0;
let thetaDot = 0;
let phiDot = 2.0;
let g = 9.81;
let dt = 0.01;
let traceLen = 5000;
let running = false;
let animationId = null;
let mode = 'sim';
let view = '3d';
let tracePoints = [];
let initialEnergy = 0;
let initialLz = 0;

// Three.js
let threeScene = null, threeRenderer = null, threeCamera = null, threeControls = null;
let pendulumBob = null, pendulumRod = null, pivot = null;
let traceLine = null, traceGeometry = null;

function getColors() {
  const cs = getComputedStyle(document.documentElement);
  return {
    bg: cs.getPropertyValue('--canvas-bg').trim(),
    fg: cs.getPropertyValue('--fg').trim(),
    muted: cs.getPropertyValue('--fg-muted').trim(),
    accent: cs.getPropertyValue('--accent').trim(),
    border: cs.getPropertyValue('--card-border').trim(),
    elevated: cs.getPropertyValue('--bg-elevated').trim()
  };
}

function sphericalToCartesian(th, ph) {
  // Physics: θ from +z axis (downward), φ in xy plane
  // Three.js: Y is up
  // x = L * sin(θ) * cos(φ)
  // y = -L * cos(θ)  (negative = below pivot)
  // z = L * sin(θ) * sin(φ)
  return [
    L * Math.sin(th) * Math.cos(ph),
    -L * Math.cos(th),
    L * Math.sin(th) * Math.sin(ph)
  ];
}

// Equations of motion from Lagrangian
// θ̈ = sinθ cosθ * φ̇² - (g/L) * sinθ
// φ̈ = -2 * cotθ * θ̇ * φ̇
function derivatives(state) {
  const [th, ph, thDot, phDot] = state;
  const sinTh = Math.sin(th);
  const cosTh = Math.cos(th);

  // Avoid singularity at poles
  const cotTh = (Math.abs(sinTh) < 1e-10) ? 0 : cosTh / sinTh;

  const thDDot = sinTh * cosTh * phDot * phDot - (g / L) * sinTh;
  const phDDot = -2 * cotTh * thDot * phDot;

  return [thDot, phDot, thDDot, phDDot];
}

function rk4Step(state, dt) {
  const k1 = derivatives(state);
  const k2 = derivatives(state.map((v, i) => v + 0.5 * dt * k1[i]));
  const k3 = derivatives(state.map((v, i) => v + 0.5 * dt * k2[i]));
  const k4 = derivatives(state.map((v, i) => v + dt * k3[i]));

  return state.map((v, i) => v + dt / 6 * (k1[i] + 2*k2[i] + 2*k3[i] + k4[i]));
}

function computeEnergy(state) {
  const [th, ph, thDot, phDot] = state;
  const sinTh = Math.sin(th);
  // T = 0.5 * m * L^2 * (thDot^2 + sin^2(th) * phDot^2), m=1
  // V = m * g * L * (1 - cos(th)), m=1
  const T = 0.5 * L * L * (thDot * thDot + sinTh * sinTh * phDot * phDot);
  const V = g * L * (1 - Math.cos(th));
  return T + V;
}

function computeLz(state) {
  const [th, ph, thDot, phDot] = state;
  // Lz = m * L^2 * sin^2(th) * phDot, m=1
  return L * L * Math.sin(th) * Math.sin(th) * phDot;
}

function initThree() {
  if (threeScene) return;
  const container = canvas3d;
  const rect = container.getBoundingClientRect();

  threeScene = new THREE.Scene();
  threeScene.background = new THREE.Color(getColors().bg);

  threeCamera = new THREE.PerspectiveCamera(50, rect.width / rect.height, 0.1, 1000);
  threeCamera.position.set(0, 5, 5);
  threeCamera.lookAt(0, 0, 0);

  threeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  threeRenderer.setSize(rect.width, rect.height);
  threeRenderer.setPixelRatio(window.devicePixelRatio || 1);
  container.appendChild(threeRenderer.domElement);

  threeControls = new OrbitControls(threeCamera, threeRenderer.domElement);
  threeControls.enableDamping = true;
  threeControls.dampingFactor = 0.05;

  // Pivot point
  const pivotGeo = new THREE.SphereGeometry(0.08, 16, 16);
  const pivotMat = new THREE.MeshBasicMaterial({ color: getColors().elevated });
  pivot = new THREE.Mesh(pivotGeo, pivotMat);
  threeScene.add(pivot);

  // Rod
  const rodGeo = new THREE.CylinderGeometry(0.02, 0.02, L, 8);
  const rodMat = new THREE.MeshBasicMaterial({ color: getColors().fg, transparent: true, opacity: 0.6 });
  pendulumRod = new THREE.Mesh(rodGeo, rodMat);
  threeScene.add(pendulumRod);

  // Bob
  const bobGeo = new THREE.SphereGeometry(0.15, 16, 16);
  const bobMat = new THREE.MeshStandardMaterial({
    color: getColors().accent,
    metalness: 0.3,
    roughness: 0.4
  });
  pendulumBob = new THREE.Mesh(bobGeo, bobMat);
  pendulumBob.castShadow = true;
  threeScene.add(pendulumBob);

  // Trace line
  traceGeometry = new THREE.BufferGeometry();
  const traceMat = new THREE.LineBasicMaterial({
    color: getColors().accent,
    transparent: true,
    opacity: 0.7
  });
  traceLine = new THREE.Line(traceGeometry, traceMat);
  threeScene.add(traceLine);

  // Reference sphere (wireframe showing pendulum length)
  const sphereGeo = new THREE.SphereGeometry(L, 32, 32);
  const sphereMat = new THREE.MeshBasicMaterial({
    color: getColors().border,
    wireframe: true,
    transparent: true,
    opacity: 0.15
  });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  threeScene.add(sphere);

  // Ground plane
  const groundGeo = new THREE.PlaneGeometry(10, 10);
  const groundMat = new THREE.MeshBasicMaterial({
    color: getColors().border,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.3
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -L - 0.1;
  threeScene.add(ground);

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  threeScene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(5, 10, 5);
  dirLight.castShadow = true;
  threeScene.add(dirLight);

  animateThree();
}

function animateThree() {
  if (!threeRenderer) return;
  requestAnimationFrame(animateThree);
  threeControls.update();
  threeRenderer.render(threeScene, threeCamera);
}

function updateThree() {
  if (!threeScene) return;

  const [x, y, z] = sphericalToCartesian(theta, phi);

  // Update bob position
  pendulumBob.position.set(x, y, z);

  // Update rod - point from pivot (0,0,0) to bob (x,y,z)
  // Rod geometry is along +Y axis (height), centered at origin
  // Scale Y to match length, position at midpoint, orient with lookAt
  const rodLength = Math.sqrt(x*x + y*y + z*z);
  pendulumRod.scale.set(1, rodLength / L, 1);
  pendulumRod.position.set(x/2, y/2, z/2);
  pendulumRod.lookAt(x, y, z);
  pendulumRod.rotateX(Math.PI / 2);

  // Add trace point (in both sim and trace modes)
  tracePoints.push([x, y, z]);
  if (tracePoints.length > traceLen) tracePoints.shift();
  updateTraceLine();
}

function updateTraceLine() {
  if (!traceLine || tracePoints.length < 2) return;
  const positions = new Float32Array(tracePoints.length * 3);
  tracePoints.forEach((p, i) => {
    positions[i*3] = p[0];
    positions[i*3+1] = p[1];
    positions[i*3+2] = p[2];
  });
  traceGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  traceGeometry.attributes.position.needsUpdate = true;
}

function clearTrace() {
  tracePoints = [];
  updateTraceLine();
}

function setView(newView) {
  view = newView;
  if (!threeCamera) return;

  const distance = L * 3;
  switch(view) {
    case 'top':
      threeCamera.position.set(0, distance, 0);
      threeCamera.lookAt(0, 0, 0);
      break;
    case 'side':
      threeCamera.position.set(distance, 0, 0);
      threeCamera.lookAt(0, 0, 0);
      break;
    case '3d':
    default:
      threeCamera.position.set(distance * 0.7, distance * 0.7, distance * 0.7);
      threeCamera.lookAt(0, 0, 0);
      break;
  }
  threeControls.update();
}

function step() {
  const state = [theta, phi, thetaDot, phiDot];
  const newState = rk4Step(state, dt);
  theta = newState[0];
  phi = newState[1];
  thetaDot = newState[2];
  phiDot = newState[3];

  // Normalize phi to [-π, π]
  phi = ((phi + Math.PI) % (2 * Math.PI)) - Math.PI;
}

function animate() {
  if (!running) return;

  const stepsPerFrame = Math.max(1, Math.floor(1/60 / dt));
  for (let i = 0; i < stepsPerFrame; i++) {
    step();
  }

  updateThree();
  updateReadouts();

  animationId = requestAnimationFrame(animate);
}

function updateReadouts() {
  const state = [theta, phi, thetaDot, phiDot];
  const E = computeEnergy(state);
  const Lz = computeLz(state);

  energyVal.textContent = E.toFixed(4);
  lzVal.textContent = Lz.toFixed(4);
  thetaCurrVal.textContent = (theta * 180 / Math.PI).toFixed(1);
  phiCurrVal.textContent = (phi * 180 / Math.PI).toFixed(1);

  // Energy conservation check
  const energyError = ((E - initialEnergy) / initialEnergy * 100);
  if (Math.abs(energyError) > 0.1) {
    energyVal.style.color = 'var(--danger)';
  } else {
    energyVal.style.color = 'var(--fg)';
  }
}

function startAnimation() {
  running = true;
  playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
  playText.textContent = 'Pause';
  animationId = requestAnimationFrame(animate);
}

function pauseAnimation() {
  running = false;
  if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
  playIcon.innerHTML = '<path d="M5 4v16l14-8-14-8z"/>';
  playText.textContent = 'Play';
}

function togglePlayPause() { if (running) pauseAnimation(); else startAnimation(); }

function reset() {
  pauseAnimation();
  theta = parseFloat(thetaInput.value) * Math.PI / 180;
  phi = parseFloat(phiInput.value) * Math.PI / 180;
  thetaDot = parseFloat(thetaDotInput.value);
  phiDot = parseFloat(phiDotInput.value);
  L = parseFloat(lengthInput.value);
  g = parseFloat(gravitySelect.value);
  dt = parseFloat(dtInput.value);
  traceLen = parseInt(traceLenInput.value);

  const state = [theta, phi, thetaDot, phiDot];
  initialEnergy = computeEnergy(state);
  initialLz = computeLz(state);

  clearTrace();
  updateThree();
  updateReadouts();
}

function updateParams() {
  L = parseFloat(lengthInput.value);
  g = parseFloat(gravitySelect.value);
  dt = parseFloat(dtInput.value);
  traceLen = parseInt(traceLenInput.value);

  lengthVal.textContent = L.toFixed(2);
  thetaVal.textContent = thetaInput.value + '°';
  phiVal.textContent = phiInput.value + '°';
  thetaDotVal.textContent = parseFloat(thetaDotInput.value).toFixed(1);
  phiDotVal.textContent = parseFloat(phiDotInput.value).toFixed(1);
  dtVal.textContent = dt.toFixed(3);
  traceLenVal.textContent = traceLen.toLocaleString();

  if (!running) reset();
}

function setMode(newMode) {
  mode = newMode;
  // In 'sim' mode we still record trace but only show it in 'trace' mode
  if (mode === 'sim') {
    // Optionally clear trace when switching to sim mode
    // clearTrace();
  }
  updateTraceVisibility();
}

function updateTraceVisibility() {
  if (traceLine) {
    traceLine.visible = (mode === 'trace');
  }
}

// Event listeners
lengthInput.addEventListener('input', updateParams);
thetaInput.addEventListener('input', () => { thetaVal.textContent = thetaInput.value + '°'; if (!running) reset(); });
phiInput.addEventListener('input', () => { phiVal.textContent = phiInput.value + '°'; if (!running) reset(); });
thetaDotInput.addEventListener('input', () => { thetaDotVal.textContent = parseFloat(thetaDotInput.value).toFixed(1); if (!running) reset(); });
phiDotInput.addEventListener('input', () => { phiDotVal.textContent = parseFloat(phiDotInput.value).toFixed(1); if (!running) reset(); });
gravitySelect.addEventListener('change', updateParams);
dtInput.addEventListener('input', updateParams);
traceLenInput.addEventListener('input', updateParams);

modeRadios.forEach(radio => radio.addEventListener('change', (e) => setMode(e.target.value)));
viewRadios.forEach(radio => radio.addEventListener('change', (e) => setView(e.target.value)));

playPauseBtn.addEventListener('click', togglePlayPause);
resetBtn.addEventListener('click', reset);
clearTraceBtn.addEventListener('click', clearTrace);

window.addEventListener('resize', () => {
  if (threeRenderer) {
    const rect = canvas3d.getBoundingClientRect();
    threeRenderer.setSize(rect.width, rect.height);
    threeCamera.aspect = rect.width / rect.height;
    threeCamera.updateProjectionMatrix();
  }
});

document.addEventListener('visibilitychange', () => { if (document.hidden) pauseAnimation(); });

function init() {
  updateParams();
  initThree();
  updateThree();
  updateReadouts();
  setView(view);
  updateTraceVisibility();
}
init();