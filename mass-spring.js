(() => {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  const massInput = document.getElementById('mass');
  const kInput = document.getElementById('k');
  const x0Input = document.getElementById('x0');
  const v0Input = document.getElementById('v0');
  const bInput = document.getElementById('b');
  const f0Input = document.getElementById('f0');
  const wDriveInput = document.getElementById('wDrive');
  const phaseInput = document.getElementById('phase');
  const dtInput = document.getElementById('dt');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const playIcon = document.getElementById('playIcon');
  const playText = document.getElementById('playText');
  const resetBtn = document.getElementById('resetBtn');
  const clearGraphBtn = document.getElementById('clearGraphBtn');
  const modeRadios = document.querySelectorAll('input[name="mode"]');

  const massVal = document.getElementById('massVal');
  const kVal = document.getElementById('kVal');
  const x0Val = document.getElementById('x0Val');
  const v0Val = document.getElementById('v0Val');
  const bVal = document.getElementById('bVal');
  const f0Val = document.getElementById('f0Val');
  const wDriveVal = document.getElementById('wDriveVal');
  const phaseVal = document.getElementById('phaseVal');
  const dtVal = document.getElementById('dtVal');

  const w0Val = document.getElementById('w0Val');
  const periodVal = document.getElementById('periodVal');
  const energyVal = document.getElementById('energyVal');
  const zetaVal = document.getElementById('zetaVal');
  const freqRatioVal = document.getElementById('freqRatioVal');
  const ampVal = document.getElementById('ampVal');
  const readoutDriven = document.getElementById('readoutDriven');
  const readoutDriven2 = document.getElementById('readoutDriven2');
  const paramsDriven = document.getElementById('paramsDriven');

  let m = 1.0, k = 10.0, x0 = 1.0, v0 = 0.0, b = 0.0, f0 = 1.0, wDrive = 3.16, phase = 0.0, dt = 0.01;
  let running = false, lastTime = 0, animationId = null;
  let x = 0, v = 0, simTime = 0;
  let mode = 'shm';
  let energyHistory = [], timeHistory = [], xHistory = [];
  let maxHistoryPoints = 500;

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

function computeParams() {
  const w0 = Math.sqrt(k / m);
  const zeta = b / (2 * Math.sqrt(k * m));
  const wd = w0 * Math.sqrt(Math.max(0, 1 - zeta * zeta));
  const period = (wd > 0) ? 2 * Math.PI / wd : 2 * Math.PI / w0;
  return { w0, zeta, wd, period };
}

function getAcceleration(x, v, simTime) {
  const { w0, zeta } = computeParams();
  let a = -w0 * w0 * x;
  if (mode === 'damped' || mode === 'driven') {
    a -= 2 * zeta * w0 * v;
  }
  if (mode === 'driven') {
    a += (f0 / m) * Math.cos(wDrive * simTime + phase);
  }
  return a;
}

function step(dt) {
  // Velocity Verlet for better energy conservation
  const a = getAcceleration(x, v, simTime);
  x += v * dt + 0.5 * a * dt * dt;
  const aNew = getAcceleration(x, v + a * dt, simTime + dt);
  v += 0.5 * (a + aNew) * dt;
  simTime += dt;
}

function draw() {
  const colors = getColors();
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);
  ctx.clearRect(0, 0, w, h);

  const { w0, zeta, wd, period } = computeParams();
  const maxDisp = Math.max(1.5, Math.abs(x0) * 1.5, Math.abs(x) * 1.5 + 0.5);
  const springLeft = 60;
  const springRight = w - 60;
  const springRest = springLeft + (springRight - springLeft) / 2;
  const scaleX = (springRight - springLeft) / 2 / maxDisp;

  const massX = springRest + x * scaleX;
  const massY = h / 2;
  const massSize = Math.min(50, Math.max(30, w * 0.08));
  const springCoils = 12;
  const springWidth = 30;

  // Wall
  ctx.fillStyle = colors.elevated;
  ctx.fillRect(0, 0, springLeft, h);

  // Spring
  ctx.strokeStyle = colors.fg;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(springLeft, massY);
  for (let i = 0; i <= springCoils; i++) {
    const px = springLeft + (massX - springLeft) * i / springCoils;
    const py = massY + (i % 2 === 0 ? springWidth / 2 : -springWidth / 2);
    ctx.lineTo(px, py);
  }
  ctx.lineTo(massX, massY);
  ctx.stroke();

  // Mass block
  ctx.fillStyle = colors.accent;
  ctx.fillRect(massX - massSize / 2, massY - massSize / 2, massSize, massSize);
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(massX - massSize / 2, massY - massSize / 2, massSize, massSize);

  // Center line
  ctx.strokeStyle = colors.muted;
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(springRest, massY - massSize);
  ctx.lineTo(springRest, massY + massSize);
  ctx.stroke();
  ctx.setLineDash([]);

  // Labels
  ctx.fillStyle = colors.muted;
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`x = ${x.toFixed(3)} m`, massX, massY - massSize / 2 - 10);
  ctx.fillText(`v = ${v.toFixed(3)} m/s`, massX, massY + massSize / 2 + 20);

  // Energy graph (bottom)
  const graphH = 80;
  const graphY = h - graphH - 10;
  const graphW = w - 20;
  const graphX = 10;

  if (energyHistory.length > 1) {
    const maxE = Math.max(...energyHistory, 0.001);
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(graphX, graphY, graphW, graphH);

    // Total energy
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < energyHistory.length; i++) {
      const px = graphX + (i / (energyHistory.length - 1)) * graphW;
      const py = graphY + graphH - (energyHistory[i] / maxE) * (graphH - 10) - 5;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Potential energy
    ctx.strokeStyle = colors.fg;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let i = 0; i < energyHistory.length; i++) {
      const pe = 0.5 * k * Math.pow(xHistory[i] || 0, 2);
      const px = graphX + (i / (energyHistory.length - 1)) * graphW;
      const py = graphY + graphH - (pe / maxE) * (graphH - 10) - 5;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Legend
    ctx.fillStyle = colors.accent;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Total E', graphX + 8, graphY + 14);
    ctx.fillStyle = colors.fg;
    ctx.fillText('Potential', graphX + 8, graphY + 28);
  }

  // Time
  ctx.fillStyle = colors.muted;
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`t = ${simTime.toFixed(2)} s`, w - 10, h - 10);
}

function animate(time) {
  if (!running) return;
  if (!lastTime) lastTime = time;
  const dtFrame = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;

  const steps = Math.max(1, Math.ceil(dtFrame / dt));
  const subDt = dtFrame / steps;
  for (let i = 0; i < steps; i++) {
    step(subDt);
  }

  // Record energy and position for graph
  const E = 0.5 * m * v * v + 0.5 * k * x * x;
  energyHistory.push(E);
  xHistory.push(x);
  if (energyHistory.length > maxHistoryPoints) energyHistory.shift();
  if (xHistory.length > maxHistoryPoints) xHistory.shift();

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
  x = parseFloat(x0Input.value);
  v = parseFloat(v0Input.value);
  simTime = 0;
  energyHistory = [];
  xHistory = [];
  draw();
}

function updateParams() {
  m = parseFloat(massInput.value);
  k = parseFloat(kInput.value);
  x0 = parseFloat(x0Input.value);
  v0 = parseFloat(v0Input.value);
  b = parseFloat(bInput.value);
  f0 = parseFloat(f0Input.value);
  wDrive = parseFloat(wDriveInput.value);
  phase = parseFloat(phaseInput.value);
  dt = parseFloat(dtInput.value);

  massVal.textContent = m.toFixed(2);
  kVal.textContent = k.toFixed(1);
  x0Val.textContent = x0.toFixed(1);
  v0Val.textContent = v0.toFixed(1);
  bVal.textContent = b.toFixed(1);
  f0Val.textContent = f0.toFixed(1);
  wDriveVal.textContent = wDrive.toFixed(2);
  phaseVal.textContent = phase.toFixed(2);
  dtVal.textContent = dt.toFixed(3);

  const { w0, zeta, wd, period } = computeParams();
  w0Val.textContent = w0.toFixed(3);
  periodVal.textContent = period.toFixed(3);
  zetaVal.textContent = zeta.toFixed(3);

  if (mode === 'driven') {
    freqRatioVal.textContent = (wDrive / w0).toFixed(3);
    // Steady-state amplitude for driven damped oscillator
    const denom = Math.sqrt(Math.pow(w0*w0 - wDrive*wDrive, 2) + Math.pow(2*zeta*w0*wDrive, 2));
    const amp = (f0 / m) / (denom || 1);
    ampVal.textContent = amp.toFixed(3);
  }

  if (!running) reset();
}

function setMode(newMode) {
  mode = newMode;
  if (mode === 'driven') {
    paramsDriven.classList.add('visible');
    readoutDriven.style.display = 'flex';
    readoutDriven2.style.display = 'flex';
  } else {
    paramsDriven.classList.remove('visible');
    readoutDriven.style.display = 'none';
    readoutDriven2.style.display = 'none';
  }
  if (!running) reset();
}

function clearGraph() {
  energyHistory = [];
  xHistory = [];
  draw();
}

// Event listeners
massInput.addEventListener('input', updateParams);
kInput.addEventListener('input', updateParams);
x0Input.addEventListener('input', updateParams);
v0Input.addEventListener('input', updateParams);
bInput.addEventListener('input', updateParams);
f0Input.addEventListener('input', updateParams);
wDriveInput.addEventListener('input', updateParams);
phaseInput.addEventListener('input', updateParams);
dtInput.addEventListener('input', updateParams);

modeRadios.forEach(radio => radio.addEventListener('change', (e) => setMode(e.target.value)));

playPauseBtn.addEventListener('click', togglePlayPause);
resetBtn.addEventListener('click', reset);
clearGraphBtn.addEventListener('click', clearGraph);

window.addEventListener('resize', () => { resizeCanvas(); draw(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseAnimation(); });

function init() { resizeCanvas(); updateParams(); draw(); }
init();
})();
