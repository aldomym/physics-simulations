// Double Pendulum Simulation with Velocity Verlet Integration
// Lagrangian equations of motion for chaotic double pendulum

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Parameter inputs
const m1Input = document.getElementById('m1Input');
const m2Input = document.getElementById('m2Input');
const L1Input = document.getElementById('L1Input');
const L2Input = document.getElementById('L2Input');
const gInput = document.getElementById('gInput');
const th1Input = document.getElementById('th1Input');
const th2Input = document.getElementById('th2Input');
const w1Input = document.getElementById('w1Input');
const w2Input = document.getElementById('w2Input');
const dtInput = document.getElementById('dtInput');
const trailInput = document.getElementById('trailInput');

// Value displays
const m1Val = document.getElementById('m1Val');
const m2Val = document.getElementById('m2Val');
const L1Val = document.getElementById('L1Val');
const L2Val = document.getElementById('L2Val');
const gVal = document.getElementById('gVal');
const th1Val = document.getElementById('th1Val');
const th2Val = document.getElementById('th2Val');
const w1Val = document.getElementById('w1Val');
const w2Val = document.getElementById('w2Val');
const dtVal = document.getElementById('dtVal');
const trailVal = document.getElementById('trailVal');

// View mode
const viewRadios = document.querySelectorAll('input[name="view"]');

// Controls
const playPauseBtn = document.getElementById('playPauseBtn');
const playIcon = document.getElementById('playIcon');
const playText = document.getElementById('playText');
const resetBtn = document.getElementById('resetBtn');
const clearBtn = document.getElementById('clearBtn');

// Readouts
const energyVal = document.getElementById('energyVal');
const kineticVal = document.getElementById('kineticVal');
const potentialVal = document.getElementById('potentialVal');
const driftVal = document.getElementById('driftVal');
const th1Readout = document.getElementById('th1Readout');
const th2Readout = document.getElementById('th2Readout');

// State
let m1 = 1, m2 = 1, L1 = 1, L2 = 1, g = 9.81;
let th1 = Math.PI/2, th2 = Math.PI/2, w1 = 0, w2 = 0;
let dt = 0.005;
let trailLength = 500;
let viewMode = 'pendulum';

let running = false, lastTime = 0, animationId = null;
let trail = [];
let phaseTrail = [];
let poincarePoints = [];
let energyHistory = [];
let initialEnergy = 0;

// Mass matrix and inverse
function computeMassMatrix(th1, th2) {
  const c = Math.cos(th1 - th2);
  const M11 = (m1 + m2) * L1 * L1;
  const M12 = m2 * L1 * L2 * c;
  const M22 = m2 * L2 * L2;
  const det = M11 * M22 - M12 * M12;
  return {
    M11, M12, M22,
    invM11: M22 / det,
    invM12: -M12 / det,
    invM22: M11 / det,
    det
  };
}

// Potential energy
function potentialEnergy(th1, th2) {
  const y1 = -L1 * Math.cos(th1);
  const y2 = y1 - L2 * Math.cos(th2);
  return m1 * g * y1 + m2 * g * y2;
}

// Kinetic energy
function kineticEnergy(th1, th2, w1, w2) {
  const M = computeMassMatrix(th1, th2);
  return 0.5 * (M.M11 * w1 * w1 + 2 * M.M12 * w1 * w2 + M.M22 * w2 * w2);
}

// Equations of motion: compute angular accelerations α₁, α₂
// Standard double pendulum equations from Euler-Lagrange
// M * [α₁] = [τ₁]
//     [α₂]   [τ₂]
// τ₁ = -(m1+m2)*g*L1*sin(th1) - m2*L1*L2*sin(th1-th2)*w2²
// τ₂ =  m2*L1*L2*sin(th1-th2)*w1² - m2*g*L2*sin(th2)
function computeAccelerations(th1, th2, w1, w2) {
  const M = computeMassMatrix(th1, th2);
  const s = Math.sin(th1 - th2);

  // Right-hand side forces (generalized forces)
  const tau1 = -(m1 + m2) * g * L1 * Math.sin(th1) - m2 * L1 * L2 * s * w2 * w2;
  const tau2 = m2 * L1 * L2 * s * w1 * w1 - m2 * g * L2 * Math.sin(th2);

  // Solve M * α = τ
  const alpha1 = M.invM11 * tau1 + M.invM12 * tau2;
  const alpha2 = M.invM12 * tau1 + M.invM22 * tau2;

  return { alpha1, alpha2 };
}

// Velocity Verlet integration (symplectic for Lagrangian systems)
function velocityVerletStep(th1, th2, w1, w2, dt) {
  // Half step for velocities
  const acc = computeAccelerations(th1, th2, w1, w2);
  const w1_half = w1 + 0.5 * dt * acc.alpha1;
  const w2_half = w2 + 0.5 * dt * acc.alpha2;

  // Full step for positions
  const th1_new = th1 + dt * w1_half;
  const th2_new = th2 + dt * w2_half;

  // Half step for velocities (at new positions)
  const acc_new = computeAccelerations(th1_new, th2_new, w1_half, w2_half);
  const w1_new = w1_half + 0.5 * dt * acc_new.alpha1;
  const w2_new = w2_half + 0.5 * dt * acc_new.alpha2;

  return { th1: th1_new, th2: th2_new, w1: w1_new, w2: w2_new };
}

// Poincaré section: record when θ₁ crosses zero with positive velocity
function checkPoincare(th1, th2, w1, w2, prevTh1) {
  if (prevTh1 <= 0 && th1 > 0 && w1 > 0) {
    poincarePoints.push({ th2, w2 });
    if (poincarePoints.length > 2000) poincarePoints.shift();
  }
}

// Canvas drawing
function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctx.scale(dpr, dpr);
}

function getColors() {
  const computed = getComputedStyle(document.documentElement);
  return {
    bg: computed.getPropertyValue('--canvas-bg').trim(),
    fg: computed.getPropertyValue('--fg').trim(),
    muted: computed.getPropertyValue('--fg-muted').trim(),
    accent: computed.getPropertyValue('--accent').trim(),
    border: computed.getPropertyValue('--card-border').trim(),
    elevated: computed.getPropertyValue('--bg-elevated').trim()
  };
}

function draw() {
  const colors = getColors();
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);
  ctx.clearRect(0, 0, w, h);

  if (viewMode === 'pendulum') {
    drawPendulum(w, h, colors);
  } else if (viewMode === 'phase') {
    drawPhaseSpace(w, h, colors);
  } else if (viewMode === 'poincare') {
    drawPoincare(w, h, colors);
  } else if (viewMode === 'energy') {
    drawEnergy(w, h, colors);
  }

  // Update readouts
  const E = kineticEnergy(th1, th2, w1, w2) + potentialEnergy(th1, th2);
  const K = kineticEnergy(th1, th2, w1, w2);
  const U = potentialEnergy(th1, th2);
  const drift = initialEnergy !== 0 ? (E - initialEnergy) / initialEnergy * 100 : 0;

  energyVal.textContent = E.toFixed(4) + ' J';
  kineticVal.textContent = K.toFixed(4) + ' J';
  potentialVal.textContent = U.toFixed(4) + ' J';
  driftVal.textContent = drift.toFixed(4) + '%';
  th1Readout.textContent = (th1 * 180 / Math.PI).toFixed(1) + '°';
  th2Readout.textContent = (th2 * 180 / Math.PI).toFixed(1) + '°';
}

function drawPendulum(w, h, colors) {
  const cx = w / 2;
  const cy = h * 0.2;
  const scale = Math.min(w, h) * 0.35 / (L1 + L2);

  // Pivot
  ctx.fillStyle = colors.fg;
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();

  // Positions
  const x1 = cx + L1 * scale * Math.sin(th1);
  const y1 = cy + L1 * scale * Math.cos(th1);
  const x2 = x1 + L2 * scale * Math.sin(th2);
  const y2 = y1 + L2 * scale * Math.cos(th2);

  // Trail
  if (trail.length > 1) {
    ctx.strokeStyle = colors.accent + '80';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < trail.length; i++) {
      const tx = cx + trail[i].x * scale;
      const ty = cy + trail[i].y * scale;
      if (i === 0) ctx.moveTo(tx, ty);
      else ctx.lineTo(tx, ty);
    }
    ctx.stroke();
  }

  // Rod 1
  ctx.strokeStyle = colors.fg;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(x1, y1);
  ctx.stroke();

  // Rod 2
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Mass 1
  const r1 = Math.max(8, Math.min(20, m1 * 8));
  const grad1 = ctx.createRadialGradient(x1 - r1*0.3, y1 - r1*0.3, 0, x1, y1, r1);
  grad1.addColorStop(0, '#fff');
  grad1.addColorStop(1, colors.accent);
  ctx.fillStyle = grad1;
  ctx.beginPath();
  ctx.arc(x1, y1, r1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Mass 2
  const r2 = Math.max(8, Math.min(20, m2 * 8));
  const grad2 = ctx.createRadialGradient(x2 - r2*0.3, y2 - r2*0.3, 0, x2, y2, r2);
  grad2.addColorStop(0, '#fff');
  grad2.addColorStop(1, '#e85d2a');
  ctx.fillStyle = grad2;
  ctx.beginPath();
  ctx.arc(x2, y2, r2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = colors.border;
  ctx.stroke();

  // Joint
  ctx.fillStyle = colors.muted;
  ctx.beginPath();
  ctx.arc(x1, y1, 4, 0, Math.PI * 2);
  ctx.fill();

  // Reference line
  ctx.strokeStyle = colors.muted + '30';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy + (L1 + L2) * scale);
  ctx.stroke();
  ctx.setLineDash([]);

  // Angle indicators
  ctx.fillStyle = colors.muted;
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`θ₁: ${(th1 * 180 / Math.PI).toFixed(1)}°`, 10, 20);
  ctx.fillText(`θ₂: ${(th2 * 180 / Math.PI).toFixed(1)}°`, 10, 40);
}

function drawPhaseSpace(w, h, colors) {
  const margin = 60;
  const graphW = w - 2 * margin;
  const graphH = h - 2 * margin;

  // Axes
  ctx.strokeStyle = colors.muted + '60';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin, margin);
  ctx.lineTo(margin, h - margin);
  ctx.lineTo(w - margin, h - margin);
  ctx.stroke();

  // Labels
  ctx.fillStyle = colors.muted;
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('θ₁ (rad)', margin + graphW / 2, h - margin + 25);
  ctx.save();
  ctx.translate(margin - 20, margin + graphH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('ω₁ (rad/s)', 0, 0);
  ctx.restore();

  // Phase trail
  if (phaseTrail.length > 1) {
    ctx.strokeStyle = colors.accent + '80';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < phaseTrail.length; i++) {
      const px = margin + (phaseTrail[i].th1 + Math.PI) / (2 * Math.PI) * graphW;
      const py = h - margin - (phaseTrail[i].w1 + 10) / 20 * graphH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Current point
  const cx = margin + (th1 + Math.PI) / (2 * Math.PI) * graphW;
  const cy = h - margin - (w1 + 10) / 20 * graphH;
  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();

  // Grid
  ctx.strokeStyle = colors.muted + '15';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const x = margin + i / 4 * graphW;
    ctx.beginPath();
    ctx.moveTo(x, margin);
    ctx.lineTo(x, h - margin);
    ctx.stroke();
  }
  for (let i = 1; i < 4; i++) {
    const y = margin + i / 4 * graphH;
    ctx.beginPath();
    ctx.moveTo(margin, y);
    ctx.lineTo(w - margin, y);
    ctx.stroke();
  }
}

function drawPoincare(w, h, colors) {
  const margin = 60;
  const graphW = w - 2 * margin;
  const graphH = h - 2 * margin;

  // Axes
  ctx.strokeStyle = colors.muted + '60';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin, margin);
  ctx.lineTo(margin, h - margin);
  ctx.lineTo(w - margin, h - margin);
  ctx.stroke();

  // Labels
  ctx.fillStyle = colors.muted;
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('θ₂ (rad)', margin + graphW / 2, h - margin + 25);
  ctx.save();
  ctx.translate(margin - 20, margin + graphH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('ω₂ (rad/s)', 0, 0);
  ctx.restore();

  // Poincaré points
  ctx.fillStyle = colors.accent + 'CC';
  for (const pt of poincarePoints) {
    const px = margin + (pt.th2 + Math.PI) / (2 * Math.PI) * graphW;
    const py = h - margin - (pt.w2 + 10) / 20 * graphH;
    if (px >= margin && px <= w - margin && py >= margin && py <= h - margin) {
      ctx.beginPath();
      ctx.arc(px, py, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = colors.muted;
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`Points: ${poincarePoints.length}`, 10, 20);
}

function drawEnergy(w, h, colors) {
  const margin = 60;
  const graphW = w - 2 * margin;
  const graphH = h - 2 * margin;

  // Axes
  ctx.strokeStyle = colors.muted + '60';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin, margin);
  ctx.lineTo(margin, h - margin);
  ctx.lineTo(w - margin, h - margin);
  ctx.stroke();

  // Labels
  ctx.fillStyle = colors.muted;
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Time (s)', margin + graphW / 2, h - margin + 25);
  ctx.save();
  ctx.translate(margin - 20, margin + graphH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Energy (J)', 0, 0);
  ctx.restore();

  if (energyHistory.length > 1) {
    const maxE = Math.max(...energyHistory.map(e => Math.abs(e.total)));
    const minE = Math.min(...energyHistory.map(e => e.total));

    // Total energy
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < energyHistory.length; i++) {
      const px = margin + (i / energyHistory.length) * graphW;
      const py = h - margin - (energyHistory[i].total - minE) / (maxE - minE + 1e-10) * graphH * 0.9;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Kinetic
    ctx.strokeStyle = '#e85d2a';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let i = 0; i < energyHistory.length; i++) {
      const px = margin + (i / energyHistory.length) * graphW;
      const py = h - margin - (energyHistory[i].kinetic - minE) / (maxE - minE + 1e-10) * graphH * 0.9;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Potential
    ctx.strokeStyle = '#4a90d9';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let i = 0; i < energyHistory.length; i++) {
      const px = margin + (i / energyHistory.length) * graphW;
      const py = h - margin - (energyHistory[i].potential - minE) / (maxE - minE + 1e-10) * graphH * 0.9;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Legend
  ctx.fillStyle = colors.accent;
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('Total', margin + 10, margin + 20);
  ctx.fillStyle = '#e85d2a';
  ctx.fillText('Kinetic', margin + 10, margin + 35);
  ctx.fillStyle = '#4a90d9';
  ctx.fillText('Potential', margin + 10, margin + 50);
}

function animate(time) {
  if (!running) return;
  if (!lastTime) lastTime = time;
  const dtFrame = (time - lastTime) / 1000;
  lastTime = time;

  const steps = Math.max(1, Math.ceil(dtFrame / dt));
  const subDt = dtFrame / steps;

  let prevTh1 = th1;
  for (let i = 0; i < steps; i++) {
    // Velocity Verlet integration (symplectic for Lagrangian systems)
    const state = velocityVerletStep(th1, th2, w1, w2, subDt);
    th1 = state.th1;
    th2 = state.th2;
    w1 = state.w1;
    w2 = state.w2;

    // Normalize angles to [-π, π] for phase space
    while (th1 > Math.PI) th1 -= 2 * Math.PI;
    while (th1 < -Math.PI) th1 += 2 * Math.PI;
    while (th2 > Math.PI) th2 -= 2 * Math.PI;
    while (th2 < -Math.PI) th2 += 2 * Math.PI;

    // Trail for pendulum view
    const x2 = L1 * Math.sin(th1) + L2 * Math.sin(th2);
    const y2 = L1 * Math.cos(th1) + L2 * Math.cos(th2);
    trail.push({ x: x2, y: y2 });
    if (trail.length > trailLength) trail.shift();

    // Phase space trail
    phaseTrail.push({ th1, w1 });
    if (phaseTrail.length > trailLength) phaseTrail.shift();

    // Poincaré section
    checkPoincare(th1, th2, w1, w2, prevTh1);
    prevTh1 = th1;

    // Energy history
    const E = kineticEnergy(th1, th2, w1, w2) + potentialEnergy(th1, th2);
    const K = kineticEnergy(th1, th2, w1, w2);
    const U = potentialEnergy(th1, th2);
    energyHistory.push({ total: E, kinetic: K, potential: U });
    if (energyHistory.length > 2000) energyHistory.shift();
  }

  draw();
  animationId = requestAnimationFrame(animate);
}

function startAnimation() {
  running = true;
  lastTime = 0;
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
  th1 = th1Input.value * Math.PI / 180;
  th2 = th2Input.value * Math.PI / 180;
  w1 = w1Input.value * Math.PI / 180;
  w2 = w2Input.value * Math.PI / 180;
  trail = [];
  phaseTrail = [];
  poincarePoints = [];
  energyHistory = [];
  initialEnergy = kineticEnergy(th1, th2, w1, w2) + potentialEnergy(th1, th2);
  draw();
}

function clearTrails() {
  trail = [];
  phaseTrail = [];
  poincarePoints = [];
  draw();
}

function updateParams() {
  m1 = parseFloat(m1Input.value);
  m2 = parseFloat(m2Input.value);
  L1 = parseFloat(L1Input.value);
  L2 = parseFloat(L2Input.value);
  g = parseFloat(gInput.value);
  dt = parseFloat(dtInput.value);
  trailLength = parseInt(trailInput.value);

  m1Val.textContent = m1.toFixed(1);
  m2Val.textContent = m2.toFixed(1);
  L1Val.textContent = L1.toFixed(1);
  L2Val.textContent = L2.toFixed(1);
  gVal.textContent = g.toFixed(2);
  dtVal.textContent = dt.toFixed(3);
  trailVal.textContent = trailLength;

  if (!running) reset();
}

function init() {
  resizeCanvas();
  updateParams();

  // Event listeners
  m1Input.addEventListener('input', updateParams);
  m2Input.addEventListener('input', updateParams);
  L1Input.addEventListener('input', updateParams);
  L2Input.addEventListener('input', updateParams);
  gInput.addEventListener('input', updateParams);
  dtInput.addEventListener('input', updateParams);
  trailInput.addEventListener('input', updateParams);

  th1Input.addEventListener('input', (e) => {
    th1Val.textContent = e.target.value;
    if (!running) reset();
  });
  th2Input.addEventListener('input', (e) => {
    th2Val.textContent = e.target.value;
    if (!running) reset();
  });
  w1Input.addEventListener('input', (e) => {
    w1Val.textContent = e.target.value;
    if (!running) reset();
  });
  w2Input.addEventListener('input', (e) => {
    w2Val.textContent = e.target.value;
    if (!running) reset();
  });

  viewRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      viewMode = e.target.value;
      draw();
    });
  });

  playPauseBtn.addEventListener('click', togglePlayPause);
  resetBtn.addEventListener('click', reset);
  clearBtn.addEventListener('click', clearTrails);

  window.addEventListener('resize', () => { resizeCanvas(); draw(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseAnimation(); });
}

init();