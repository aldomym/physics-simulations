// 2D Canvas simulation
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const canvas3d = document.getElementById('canvas3d');

// Inputs
const velocityInput = document.getElementById('velocity');
const angleInput = document.getElementById('angle');
const heightInput = document.getElementById('height');
const dragInput = document.getElementById('drag');
const gravitySelect = document.getElementById('gravity');
const playPauseBtn = document.getElementById('playPauseBtn');
const playIcon = document.getElementById('playIcon');
const playText = document.getElementById('playText');
const resetBtn = document.getElementById('resetBtn');
const run3dBtn = document.getElementById('run3dBtn');
const modeRadios = document.querySelectorAll('input[name="mode"]');

// 3D inputs
const massInput = document.getElementById('mass');
const volumeInput = document.getElementById('volume');
const rhoInput = document.getElementById('rho');
const cDInput = document.getElementById('cD');
const areaInput = document.getElementById('area');
const omegaXInput = document.getElementById('omegaX');
const omegaYInput = document.getElementById('omegaY');
const omegaZInput = document.getElementById('omegaZ');
const sParamInput = document.getElementById('sParam');
const dtInput = document.getElementById('dt');
const tmaxInput = document.getElementById('tmax');
const azimuthInput = document.getElementById('azimuth');

// Value displays
const velVal = document.getElementById('velVal');
const angleVal = document.getElementById('angleVal');
const heightVal = document.getElementById('heightVal');
const dragVal = document.getElementById('dragVal');
const massVal = document.getElementById('massVal');
const volumeVal = document.getElementById('volumeVal');
const rhoVal = document.getElementById('rhoVal');
const cDVal = document.getElementById('cDVal');
const areaVal = document.getElementById('areaVal');
const omegaXVal = document.getElementById('omegaXVal');
const omegaYVal = document.getElementById('omegaYVal');
const omegaZVal = document.getElementById('omegaZVal');
const omegaVal = document.getElementById('omegaVal');
const sVal = document.getElementById('sVal');
const dtVal = document.getElementById('dtVal');
const tmaxVal = document.getElementById('tmaxVal');
const azimuthVal = document.getElementById('azimuthVal');

// Readouts
const rangeVal = document.getElementById('rangeVal');
const maxHeightVal = document.getElementById('maxHeightVal');
const timeVal = document.getElementById('timeVal');
const impactVelVal = document.getElementById('impactVelVal');
const range3dVal = document.getElementById('range3dVal');
const drift3dVal = document.getElementById('drift3dVal');
const readout3d = document.getElementById('readout3d');
const readout3d2 = document.getElementById('readout3d2');
const params3d = document.getElementById('params3d');

// State
let v0 = 25, theta = 45 * Math.PI / 180, y0 = 0, drag = 0, g = 9.81;
let running = false, lastTime = 0, animationId = null;
let x = 0, y = 0, vx = 0, vy = 0, t = 0;
let trajectory = [], maxHeight = 0;
let mode = '2d';
let threeScene = null, threeRenderer = null, threeCamera = null, threeControls = null;
let trajectoryLine = null, projectileMesh = null;

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctx.scale(dpr, dpr);

  if (threeRenderer) {
    threeRenderer.setSize(rect.width, rect.height);
    threeCamera.aspect = rect.width / rect.height;
    threeCamera.updateProjectionMatrix();
  }
}

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

function calcAnalytics() {
  const th = theta;
  const v0x = v0 * Math.cos(th);
  const v0y = v0 * Math.sin(th);
  if (drag === 0 && g > 0) {
    const disc = v0y*v0y + 2*g*y0;
    if (disc < 0) { rangeVal.textContent = '—'; maxHeightVal.textContent = '—'; timeVal.textContent = '—'; impactVelVal.textContent = '—'; return; }
    const tf = (v0y + Math.sqrt(disc)) / g;
    const range = v0x * tf;
    const hmax = y0 + v0y*v0y / (2*g);
    const vimpact = Math.sqrt(v0x*v0x + (v0y - g*tf)*(v0y - g*tf));
    rangeVal.textContent = range.toFixed(2);
    maxHeightVal.textContent = hmax.toFixed(2);
    timeVal.textContent = tf.toFixed(2);
    impactVelVal.textContent = vimpact.toFixed(2);
  } else {
    rangeVal.textContent = '—'; maxHeightVal.textContent = '—'; timeVal.textContent = '—'; impactVelVal.textContent = '—';
  }
}

function draw2D() {
  const colors = getColors();
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);
  ctx.clearRect(0, 0, w, h);
  const margin = 40;
  const maxRange = v0 * v0 / g + y0 * v0 / g + 50;
  const maxH = y0 + v0*v0/(2*g) + 20;
  const scaleX = (w - 2*margin) / Math.max(maxRange, 10);
  const scaleY = (h - 2*margin) / Math.max(maxH, 10);
  const scale = Math.min(scaleX, scaleY);
  const originX = margin;
  const originY = h - margin - y0 * scale;

  // Ground line
  ctx.strokeStyle = colors.border; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(originX, originY); ctx.lineTo(w - margin, originY); ctx.stroke();
  // Y axis
  ctx.beginPath(); ctx.moveTo(originX, originY); ctx.lineTo(originX, margin); ctx.stroke();

  // Grid lines
  ctx.font = '10px "JetBrains Mono", monospace'; ctx.fillStyle = colors.muted; ctx.textAlign = 'center';
  for (let i = 0; i <= 10; i++) {
    const xx = originX + i * (w - 2*margin) / 10;
    ctx.beginPath(); ctx.moveTo(xx, originY); ctx.lineTo(xx, originY + 5); ctx.stroke();
    ctx.fillText((i * maxRange / 10).toFixed(0), xx, originY + 18);
  }
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let i = 0; i <= 10; i++) {
    const yy = originY - i * (h - 2*margin) / 10;
    ctx.beginPath(); ctx.moveTo(originX, yy); ctx.lineTo(originX - 5, yy); ctx.stroke();
    ctx.fillText((i * maxH / 10).toFixed(0), originX - 10, yy);
  }

  // Trajectory
  if (trajectory.length > 1) {
    ctx.strokeStyle = colors.accent; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(originX + trajectory[0].x * scale, originY - trajectory[0].y * scale);
    for (let i = 1; i < trajectory.length; i++) {
      ctx.lineTo(originX + trajectory[i].x * scale, originY - trajectory[i].y * scale);
    }
    ctx.stroke();
  }

  // Projectile
  const px = originX + x * scale; const py = originY - y * scale;
  const r = Math.max(6, Math.min(14, w * 0.02));
  const grad = ctx.createRadialGradient(px - r*0.3, py - r*0.3, r*0.1, px, py, r);
  grad.addColorStop(0, colors.accent); grad.addColorStop(1, colors.fg);
  ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = colors.border; ctx.lineWidth = 1.5; ctx.stroke();

  // Velocity & time
  const v = Math.sqrt(vx*vx + vy*vy);
  ctx.fillStyle = colors.muted; ctx.font = '11px "JetBrains Mono", monospace'; ctx.textAlign = 'left';
  ctx.fillText(`v = ${v.toFixed(1)} m/s`, px + r + 8, py);
  ctx.fillText(`t = ${t.toFixed(2)} s`, px + r + 8, py + 16);
}

// 3D Physics - Heun's method (same as projectilereal.py)
function run3DPhysics(params) {
  const m = params.mass;
  const V = params.volume;
  const rho = params.rho;
  const C = params.cD;
  const A = params.area;
  const omegaX = params.omegaX;
  const omegaY = params.omegaY;
  const omegaZ = params.omegaZ;
  const S = params.sParam;
  const g_0 = params.gravity;
  const dT = params.dt;
  const t_max = params.tmax;
  const azimuth = params.azimuth * Math.PI / 180;
  const theta_rad = params.angle * Math.PI / 180;
  const v0 = params.velocity;
  const y0 = params.height;

  // Initial velocity components
  let ux = v0 * Math.cos(theta_rad) * Math.cos(azimuth);
  let uy = v0 * Math.cos(theta_rad) * Math.sin(azimuth);
  let uz = v0 * Math.sin(theta_rad);
  let x = 0, y = 0, z = y0;

  const positions = [[x, y, z]];
  const velocities = [[ux, uy, uz]];
  let maxHeight = y0;
  let n = 0;
  const maxPoints = Math.floor(t_max / dT) + 1;

  function dragForce(vx, vy, vz) {
    const speed = Math.sqrt(vx*vx + vy*vy + vz*vz);
    if (speed === 0) return [0, 0, 0];
    const factor = -0.5 * C * A * rho * speed / m;
    return [factor * vx, factor * vy, factor * vz];
  }

  function magnusForce(vx, vy, vz) {
    // Proper Magnus force: F = 0.5 * rho * A * C_L * v^2 * (omega × v) / |omega × v|
    // where C_L ≈ S * (omega * r) / v (lift coefficient proportional to spin parameter)
    // Using S as a dimensionless coefficient combining C_L effects
    const speed = Math.sqrt(vx*vx + vy*vy + vz*vz);
    if (speed === 0) return [0, 0, 0];
    // omega × v = (omegaY*vz - omegaZ*vy, omegaZ*vx - omegaX*vz, omegaX*vy - omegaY*vx)
    const omegaCrossVx = omegaY * vz - omegaZ * vy;
    const omegaCrossVy = omegaZ * vx - omegaX * vz;
    const omegaCrossVz = omegaX * vy - omegaY * vx;
    const omegaCrossVmag = Math.sqrt(omegaCrossVx*omegaCrossVx + omegaCrossVy*omegaCrossVy + omegaCrossVz*omegaCrossVz);
    if (omegaCrossVmag === 0) return [0, 0, 0];
    // Force magnitude: 0.5 * rho * A * S * speed * omegaCrossVmag
    const factor = 0.5 * rho * A * S * speed / m;
    return [factor * omegaCrossVx / omegaCrossVmag, factor * omegaCrossVy / omegaCrossVmag, factor * omegaCrossVz / omegaCrossVmag];
  }

  function buoyancyGravity() {
    return g_0 * (rho * V / m - 1);
  }

  while (n < maxPoints - 1) {
    // Predictor
    const [dax, day, daz] = dragForce(ux, uy, uz);
    const [max_, may, maz] = magnusForce(ux, uy, uz);
    let ax = dax + max_;
    let ay = day + may;
    let az = daz + maz + buoyancyGravity();

    const ux_pred = ux + ax * dT;
    const uy_pred = uy + ay * dT;
    const uz_pred = uz + az * dT;
    const x_pred = x + ux * dT;
    const y_pred = y + uy * dT;
    const z_pred = z + uz * dT;

    // Corrector
    const [dax2, day2, daz2] = dragForce(ux_pred, uy_pred, uz_pred);
    const [max2_, may2, maz2] = magnusForce(ux_pred, uy_pred, uz_pred);
    const ax2 = dax2 + max2_;
    const ay2 = day2 + may2;
    const az2 = daz2 + maz2 + buoyancyGravity();

    // Save old velocities for position corrector (per Heun's method)
    const ux_old = ux, uy_old = uy, uz_old = uz;

    ux += 0.5 * dT * (ax + ax2);
    uy += 0.5 * dT * (ay + ay2);
    uz += 0.5 * dT * (az + az2);

    // Position corrector uses OLD velocity + PREDICTOR velocity (matching Python)
    x += 0.5 * dT * (ux_old + ux_pred);
    y += 0.5 * dT * (uy_old + uy_pred);
    z += 0.5 * dT * (uz_old + uz_pred);

    n++;
    positions.push([x, y, z]);
    velocities.push([ux, uy, uz]);
    maxHeight = Math.max(maxHeight, z);

    if (z <= 0) break;
  }

  const range3d = Math.sqrt(x*x + y*y);
  const lateralDrift = y;
  const flightTime = n * dT;
  const impactVel = Math.sqrt(ux*ux + uy*uy + uz*uz);

  return { positions, velocities, range: range3d, maxHeight, flightTime, impactVelocity: impactVel, lateralDrift, nPoints: n + 1 };
}

function initThree() {
  if (threeScene) return;
  const container = canvas3d;
  const rect = container.getBoundingClientRect();

  threeScene = new THREE.Scene();
  threeScene.background = new THREE.Color(getColors().bg);

  threeCamera = new THREE.PerspectiveCamera(50, rect.width / rect.height, 0.1, 10000);
  // Position camera to view the trajectory from a good angle:
  // trajectory is in x-y plane (physics.x=forward -> three.x, physics.z=vertical -> three.y)
  // Camera at (60, 40, 60) looks at origin diagonally to see both forward and vertical motion
  threeCamera.position.set(60, 40, 60);
  threeCamera.lookAt(0, 0, 0);

  threeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  threeRenderer.setSize(rect.width, rect.height);
  threeRenderer.setPixelRatio(window.devicePixelRatio || 1);
  container.appendChild(threeRenderer.domElement);

  threeControls = new OrbitControls(threeCamera, threeRenderer.domElement);
  threeControls.enableDamping = true;
  threeControls.dampingFactor = 0.05;

  // Ground plane
  const groundGeo = new THREE.PlaneGeometry(200, 200);
  const groundMat = new THREE.MeshBasicMaterial({ color: 0x1e2a3a, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  threeScene.add(ground);

  // Grid helper
  const grid = new THREE.GridHelper(200, 40, getColors().border, getColors().muted);
  threeScene.add(grid);

  // Axes
  const axes = new THREE.AxesHelper(50);
  threeScene.add(axes);

  // Trajectory line
  const lineGeo = new THREE.BufferGeometry();
  const lineMat = new THREE.LineBasicMaterial({ color: getColors().accent, linewidth: 3 });
  trajectoryLine = new THREE.Line(lineGeo, lineMat);
  threeScene.add(trajectoryLine);

  // Projectile sphere
  const sphereGeo = new THREE.SphereGeometry(0.5, 16, 16);
  const sphereMat = new THREE.MeshBasicMaterial({ color: getColors().accent });
  projectileMesh = new THREE.Mesh(sphereGeo, sphereMat);
  threeScene.add(projectileMesh);

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  threeScene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(50, 100, 50);
  threeScene.add(dirLight);

  animateThree();
}

function animateThree() {
  if (!threeRenderer) return;
  requestAnimationFrame(animateThree);
  threeControls.update();
  threeRenderer.render(threeScene, threeCamera);
}

function updateThreeTrajectory(positions) {
  if (!trajectoryLine) return;
  // Physics uses: x=forward, y=lateral, z=vertical
  // Three.js uses: x=right, y=up, z=forward
  // Map: physics.x -> three.x, physics.y -> three.z, physics.z -> three.y
  const points = positions.map(p => new THREE.Vector3(p[0], p[2], p[1]));
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  trajectoryLine.geometry.dispose();
  trajectoryLine.geometry = geo;
}

function animateThreeProjectile(positions, index) {
  if (!projectileMesh || index >= positions.length) return;
  const p = positions[index];
  // Map: physics.x -> three.x, physics.y -> three.z, physics.z -> three.y
  projectileMesh.position.set(p[0], p[2], p[1]);
}

function run3DSimulation() {
  const params = {
    mass: parseFloat(massInput.value),
    volume: parseFloat(volumeInput.value),
    rho: parseFloat(rhoInput.value),
    cD: parseFloat(cDInput.value),
    area: parseFloat(areaInput.value),
    omegaX: parseFloat(omegaXInput.value),
    omegaY: parseFloat(omegaYInput.value),
    omegaZ: parseFloat(omegaZInput.value),
    sParam: parseFloat(sParamInput.value),
    gravity: parseFloat(gravitySelect.value),
    dt: parseFloat(dtInput.value),
    tmax: parseFloat(tmaxInput.value),
    azimuth: parseFloat(azimuthInput.value),
    angle: parseFloat(angleInput.value),
    velocity: parseFloat(velocityInput.value),
    height: parseFloat(heightInput.value)
  };

  run3dBtn.disabled = true;
  run3dBtn.textContent = 'Running...';

  try {
    const result = run3DPhysics(params);

    // Update readouts
    range3dVal.textContent = result.range.toFixed(2);
    drift3dVal.textContent = result.lateralDrift.toFixed(2);
    maxHeightVal.textContent = result.maxHeight.toFixed(2);
    timeVal.textContent = result.flightTime.toFixed(2);
    impactVelVal.textContent = result.impactVelocity.toFixed(2);
    rangeVal.textContent = result.range.toFixed(2);

    readout3d.style.display = 'flex';
    readout3d2.style.display = 'flex';

    initThree();
    updateThreeTrajectory(result.positions);

    let frame = 0;
    const totalFrames = result.positions.length;
    const animateProjectile = () => {
      if (frame < totalFrames) {
        animateThreeProjectile(result.positions, frame);
        frame += Math.max(1, Math.floor(totalFrames / 120));
        requestAnimationFrame(animateProjectile);
      }
    };
    animateProjectile();

    // Fit camera (using Three.js coordinates: physics.x -> three.x, physics.y -> three.z, physics.z -> three.y)
    const positions = result.positions;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of positions) {
      const tx = p[0];
      const ty = p[2]; // physics.z -> three.y (vertical)
      const tz = p[1]; // physics.y -> three.z (forward/lateral)
      minX = Math.min(minX, tx); maxX = Math.max(maxX, tx);
      minY = Math.min(minY, ty); maxY = Math.max(maxY, ty);
      minZ = Math.min(minZ, tz); maxZ = Math.max(maxZ, tz);
    }
    const center = new THREE.Vector3((minX+maxX)/2, (minY+maxY)/2, (minZ+maxZ)/2);
    const size = Math.max(maxX-minX, maxY-minY, maxZ-minZ) || 10;
    threeCamera.position.set(center.x + size, center.y + size, center.z + size * 0.5);
    threeControls.target.copy(center);
    threeControls.update();

  } catch (e) {
    console.error('3D simulation error:', e);
    alert('Simulation error: ' + e.message);
  } finally {
    run3dBtn.disabled = false;
    run3dBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> Run 3D';
  }
}

function step(dt) {
  if (drag > 0) {
    const v = Math.sqrt(vx*vx + vy*vy);
    if (v > 0) {
      const ax = -drag * vx * v;
      const ay = -g - drag * vy * v;
      vx += ax * dt; vy += ay * dt;
    } else { vy -= g * dt; }
  } else { vy -= g * dt; }
  x += vx * dt; y += vy * dt; t += dt;
  trajectory.push({x, y}); maxHeight = Math.max(maxHeight, y);
}

function animate2D(time) {
  if (!running) return;
  if (!lastTime) lastTime = time;
  const dt = Math.min((time - lastTime) / 1000, 0.05); lastTime = time;
  const steps = Math.max(1, Math.ceil(dt / 0.005)); const subDt = dt / steps;
  for (let i = 0; i < steps; i++) {
    if (y <= 0 && vy < 0) { running = false; break; }
    step(subDt);
  }
  draw2D();
  if (running) animationId = requestAnimationFrame(animate2D);
  else { playIcon.innerHTML = '<path d="M5 4v16l14-8-14-8z"/>'; playText.textContent = 'Play'; }
}

function startAnimation() {
  if (mode === '3d') { run3DSimulation(); return; }
  running = true; lastTime = 0;
  playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'; playText.textContent = 'Pause';
  animationId = requestAnimationFrame(animate2D);
}

function pauseAnimation() {
  running = false;
  if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
  playIcon.innerHTML = '<path d="M5 4v16l14-8-14-8z"/>'; playText.textContent = 'Play';
}

function togglePlayPause() { if (running) pauseAnimation(); else startAnimation(); }

function reset() {
  pauseAnimation();
  theta = parseFloat(angleInput.value) * Math.PI / 180;
  v0 = parseFloat(velocityInput.value);
  y0 = parseFloat(heightInput.value);
  vx = v0 * Math.cos(theta); vy = v0 * Math.sin(theta);
  x = 0; y = y0; t = 0; trajectory = [{x: 0, y: y0}]; maxHeight = y0;
  if (mode === '2d') draw2D();
  calcAnalytics();
}

function updateParams() {
  v0 = parseFloat(velocityInput.value);
  theta = parseFloat(angleInput.value) * Math.PI / 180;
  y0 = parseFloat(heightInput.value);
  drag = parseFloat(dragInput.value);
  g = parseFloat(gravitySelect.value);

  velVal.textContent = v0.toFixed(1);
  angleVal.textContent = angleInput.value + '°';
  heightVal.textContent = y0.toFixed(1);
  dragVal.textContent = drag.toFixed(3);

  massVal.textContent = parseFloat(massInput.value).toFixed(2);
  volumeVal.textContent = parseFloat(volumeInput.value).toFixed(6);
  rhoVal.textContent = parseFloat(rhoInput.value).toFixed(2);
  cDVal.textContent = parseFloat(cDInput.value).toFixed(2);
  areaVal.textContent = parseFloat(areaInput.value).toFixed(3);
  const ox = parseFloat(omegaXInput.value);
  const oy = parseFloat(omegaYInput.value);
  const oz = parseFloat(omegaZInput.value);
  omegaXVal.textContent = ox.toFixed(0);
  omegaYVal.textContent = oy.toFixed(0);
  omegaZVal.textContent = oz.toFixed(0);
  omegaVal.textContent = `(${ox.toFixed(0)}, ${oy.toFixed(0)}, ${oz.toFixed(0)})`;
  sVal.textContent = parseFloat(sParamInput.value).toFixed(2);
  dtVal.textContent = parseFloat(dtInput.value).toFixed(3);
  tmaxVal.textContent = parseFloat(tmaxInput.value).toFixed(0);
  azimuthVal.textContent = parseFloat(azimuthInput.value).toFixed(0) + '°';

  calcAnalytics();
  if (!running && mode === '2d') reset();
}

function setMode(newMode) {
  mode = newMode;
  if (mode === '2d') {
    canvas.style.display = 'block';
    canvas3d.style.display = 'none';
    playPauseBtn.style.display = 'inline-flex';
    run3dBtn.style.display = 'none';
    document.querySelectorAll('.params-3d').forEach(el => el.classList.remove('visible'));
    readout3d.style.display = 'none';
    readout3d2.style.display = 'none';
    if (!running) reset();
  } else {
    canvas.style.display = 'none';
    canvas3d.style.display = 'block';
    playPauseBtn.style.display = 'none';
    run3dBtn.style.display = 'inline-flex';
    document.querySelectorAll('.params-3d').forEach(el => el.classList.add('visible'));
    if (!threeScene) initThree();
  }
}

// Event listeners
velocityInput.addEventListener('input', updateParams);
angleInput.addEventListener('input', updateParams);
heightInput.addEventListener('input', updateParams);
dragInput.addEventListener('input', updateParams);
gravitySelect.addEventListener('change', updateParams);

massInput.addEventListener('input', updateParams);
volumeInput.addEventListener('input', updateParams);
rhoInput.addEventListener('input', updateParams);
cDInput.addEventListener('input', updateParams);
areaInput.addEventListener('input', updateParams);
omegaXInput.addEventListener('input', updateParams);
omegaYInput.addEventListener('input', updateParams);
omegaZInput.addEventListener('input', updateParams);
sParamInput.addEventListener('input', updateParams);
dtInput.addEventListener('input', updateParams);
tmaxInput.addEventListener('input', updateParams);
azimuthInput.addEventListener('input', updateParams);

modeRadios.forEach(radio => radio.addEventListener('change', (e) => setMode(e.target.value)));

playPauseBtn.addEventListener('click', togglePlayPause);
resetBtn.addEventListener('click', reset);
run3dBtn.addEventListener('click', run3DSimulation);

window.addEventListener('resize', () => { resizeCanvas(); if (mode === '2d') draw2D(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseAnimation(); });

function init() { resizeCanvas(); updateParams(); if (mode === '2d') draw2D(); }
init();