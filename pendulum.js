const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const lengthInput = document.getElementById('length');
const angleInput = document.getElementById('angle');
const dampingInput = document.getElementById('damping');
const gravitySelect = document.getElementById('gravity');
const playPauseBtn = document.getElementById('playPauseBtn');
const playIcon = document.getElementById('playIcon');
const playText = document.getElementById('playText');
const resetBtn = document.getElementById('resetBtn');

const lengthVal = document.getElementById('lengthVal');
const angleVal = document.getElementById('angleVal');
const dampingVal = document.getElementById('dampingVal');

const periodVal = document.getElementById('periodVal');
const freqVal = document.getElementById('freqVal');
const velVal = document.getElementById('velVal');
const energyVal = document.getElementById('energyVal');

let L = 1.0;
let theta = 30 * Math.PI / 180;
let omega = 0;
let damping = 0;
let g = 9.81;
let running = false;
let lastTime = 0;
let frameCount = 0;
let zeroCrossings = [];
let maxOmega = 0;
let animationId = null;

const PIVOT_X = 0.5;
const PIVOT_Y = 0.15;
const SCALE = 1;

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

function drawPendulum() {
  const colors = getColors();
  const width = canvas.width / (window.devicePixelRatio || 1);
  const height = canvas.height / (window.devicePixelRatio || 1);

  ctx.clearRect(0, 0, width, height);

  const pivotX = width * PIVOT_X;
  const pivotY = height * PIVOT_Y;
  const maxLength = Math.min(width, height) * 0.7;
  const pendulumLength = Math.min(L * maxLength / 3, maxLength);

  const bobX = pivotX + pendulumLength * Math.sin(theta);
  const bobY = pivotY + pendulumLength * Math.cos(theta);

  ctx.strokeStyle = colors.muted;
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(pivotX, pivotY + maxLength);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = colors.fg;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(bobX, bobY);
  ctx.stroke();

  const bobRadius = Math.max(12, Math.min(28, pendulumLength * 0.08));
  const gradient = ctx.createRadialGradient(
    bobX - bobRadius * 0.3, bobY - bobRadius * 0.3, bobRadius * 0.1,
    bobX, bobY, bobRadius
  );
  gradient.addColorStop(0, colors.accent);
  gradient.addColorStop(1, colors.fg);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(bobX, bobY, bobRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(bobX, bobY, bobRadius, 0, Math.PI * 2);
  ctx.stroke();

  const pivotRadius = 6;
  ctx.fillStyle = colors.elevated;
  ctx.beginPath();
  ctx.arc(pivotX, pivotY, pivotRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = colors.muted;
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`L = ${L.toFixed(2)} m`, pivotX, pivotY - 20);

  const angleDeg = Math.abs(theta * 180 / Math.PI);
  ctx.fillText(`θ = ${angleDeg.toFixed(1)}°`, pivotX, height - 20);
}

function updateReadouts() {
  const period = 2 * Math.PI * Math.sqrt(L / g);
  const frequency = 1 / period;
  const vMax = Math.sqrt(2 * g * L * (1 - Math.cos(theta)));
  const energy = 0.5 * vMax * vMax;

  periodVal.textContent = period.toFixed(3);
  freqVal.textContent = frequency.toFixed(3);
  velVal.textContent = vMax.toFixed(3);
  energyVal.textContent = energy.toFixed(3);
}

function step(dt) {
  const alpha = -(g / L) * Math.sin(theta) - damping * omega;
  omega += alpha * dt;
  theta += omega * dt;

  if (theta * (theta - omega * dt) < 0 && omega < 0) {
    zeroCrossings.push(performance.now());
    if (zeroCrossings.length > 10) zeroCrossings.shift();
  }

  maxOmega = Math.max(maxOmega, Math.abs(omega));
}

function animate(time) {
  if (!running) return;

  if (!lastTime) lastTime = time;
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;

  const steps = Math.max(1, Math.ceil(dt / 0.01));
  const subDt = dt / steps;

  for (let i = 0; i < steps; i++) {
    step(subDt);
  }

  drawPendulum();
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
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  playIcon.innerHTML = '<path d="M5 4v16l14-8-14-8z"/>';
  playText.textContent = 'Play';
}

function togglePlayPause() {
  if (running) pauseAnimation();
  else startAnimation();
}

function reset() {
  pauseAnimation();
  theta = parseFloat(angleInput.value) * Math.PI / 180;
  omega = 0;
  zeroCrossings = [];
  maxOmega = 0;
  lastTime = 0;
  drawPendulum();
}

function updateParams() {
  L = parseFloat(lengthInput.value);
  damping = parseFloat(dampingInput.value);
  g = parseFloat(gravitySelect.value);

  lengthVal.textContent = L.toFixed(2);
  angleVal.textContent = angleInput.value + '°';
  dampingVal.textContent = damping.toFixed(2);

  updateReadouts();

  if (!running) drawPendulum();
}

lengthInput.addEventListener('input', updateParams);
angleInput.addEventListener('input', () => {
  angleVal.textContent = angleInput.value + '°';
  if (!running) {
    theta = parseFloat(angleInput.value) * Math.PI / 180;
    drawPendulum();
  }
});
dampingInput.addEventListener('input', updateParams);
gravitySelect.addEventListener('change', updateParams);

playPauseBtn.addEventListener('click', togglePlayPause);
resetBtn.addEventListener('click', reset);

window.addEventListener('resize', () => {
  resizeCanvas();
  drawPendulum();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseAnimation();
});

function init() {
  resizeCanvas();
  updateParams();
  drawPendulum();
}

init();