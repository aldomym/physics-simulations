// Coupled Oscillators Simulation
// Multiple masses connected by springs - normal modes, wave propagation

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Parameter inputs
const nInput = document.getElementById('nInput');
const massInput = document.getElementById('massInput');
const kInput = document.getElementById('kInput');
const dampingInput = document.getElementById('dampingInput');
const boundarySelect = document.getElementById('boundarySelect');
const presetSelect = document.getElementById('presetSelect');
const dtInput = document.getElementById('dtInput');
const trailInput = document.getElementById('trailInput');

// Value displays
const nVal = document.getElementById('nVal');
const massVal = document.getElementById('massVal');
const kVal = document.getElementById('kVal');
const dampingVal = document.getElementById('dampingVal');
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
const timeVal = document.getElementById('timeVal');

// Initial controls container
const initialControls = document.getElementById('initialControls');

// State
let n = 5;
let mass = 1.0;
let k = 10.0;
let damping = 0.0;
let boundary = 'fixed';
let dt = 0.02;
let trailLength = 200;
let viewMode = 'space';

let running = false, lastTime = 0, animationId = null;
let time = 0;

// Positions and velocities
let x = []; // displacements from equilibrium
let v = []; // velocities

// Trails for space-time view
let spaceTimeTrail = []; // array of {x: [], y: []} per mass

// Phase space trails
let phaseTrails = [];

// Energy history
let energyHistory = [];
let initialEnergy = 0;

// Normal mode data
let normalModes = { frequencies: [], eigenvectors: [] };
let modeAmplitudes = [];

function createInitialControls() {
  initialControls.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const label = document.createElement('label');
    label.innerHTML = `
      <span>Mass ${i + 1}</span>
      <input type="range" min="-2" max="2" step="0.1" value="0" data-index="${i}">
    `;
    initialControls.appendChild(label);
  }

  // Add event listeners
  initialControls.querySelectorAll('input[type="range"]').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.index);
      x[idx] = parseFloat(e.target.value);
      if (!running) draw();
    });
  });
}

function applyPreset(preset) {
  // Reset all to zero
  x.fill(0);
  v.fill(0);

  switch (preset) {
    case 'single':
      x[Math.floor(n / 2)] = 1.5;
      break;
    case 'first-mode':
      // 1st normal mode: all in phase, sin(π*i/(n+1))
      for (let i = 0; i < n; i++) {
        x[i] = Math.sin(Math.PI * (i + 1) / (n + 1));
      }
      break;
    case 'second-mode':
      // 2nd normal mode: one node
      for (let i = 0; i < n; i++) {
        x[i] = Math.sin(2 * Math.PI * (i + 1) / (n + 1));
      }
      break;
    case 'third-mode':
      // 3rd normal mode: two nodes
      for (let i = 0; i < n; i++) {
        x[i] = Math.sin(3 * Math.PI * (i + 1) / (n + 1));
      }
      break;
    case 'gaussian':
      // Gaussian pulse in center
      const center = (n - 1) / 2;
      const sigma = n / 6;
      for (let i = 0; i < n; i++) {
        x[i] = 1.5 * Math.exp(-0.5 * Math.pow((i - center) / sigma, 2));
      }
      break;
    case 'alternating':
      // Alternating displacements
      for (let i = 0; i < n; i++) {
        x[i] = (i % 2 === 0) ? 1 : -1;
      }
      break;
  }

  // Update UI controls
  initialControls.querySelectorAll('input[type="range"]').forEach((input, i) => {
    input.value = x[i].toFixed(1);
  });

  // Update initial controls display
  initialControls.querySelectorAll('input[type="range"]').forEach(input => {
    input.dispatchEvent(new Event('input'));
  });

  if (!running) draw();
}

function computeAccelerations(x, v) {
  const a = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    let force = 0;

    // Left spring
    if (i > 0) {
      force += k * (x[i - 1] - x[i]);
    } else if (boundary === 'periodic') {
      force += k * (x[n - 1] - x[i]);
    } else if (boundary === 'fixed') {
      force += k * (0 - x[i]); // fixed wall at 0
    }
    // else free: no left spring

    // Right spring
    if (i < n - 1) {
      force += k * (x[i + 1] - x[i]);
    } else if (boundary === 'periodic') {
      force += k * (x[0] - x[i]);
    } else if (boundary === 'fixed') {
      force += k * (0 - x[i]); // fixed wall at 0
    }
    // else free: no right spring

    // Damping force
    force -= damping * v[i];

    a[i] = force / mass;
  }

  return a;
}

// Velocity Verlet integration
function velocityVerletStep(dt) {
  // Half step for velocities
  const a = computeAccelerations(x, v);
  for (let i = 0; i < n; i++) {
    v[i] += 0.5 * dt * a[i];
  }

  // Full step for positions
  for (let i = 0; i < n; i++) {
    x[i] += dt * v[i];
  }

  // Half step for velocities (at new positions)
  const aNew = computeAccelerations(x, v);
  for (let i = 0; i < n; i++) {
    v[i] += 0.5 * dt * aNew[i];
  }
}

function computeNormalModes() {
  // Analytical normal modes for fixed-fixed boundary
  // ω_m = 2*sqrt(k/m)*sin(m*π/(2*(n+1)))
  // Eigenvectors: v_m[i] = sin(m*π*(i+1)/(n+1))

  const modes = [];
  const freq = [];

  for (let m = 1; m <= n; m++) {
    const omega = 2 * Math.sqrt(k / mass) * Math.sin(m * Math.PI / (2 * (n + 1)));
    const vec = [];
    for (let i = 0; i < n; i++) {
      vec.push(Math.sin(m * Math.PI * (i + 1) / (n + 1)));
    }
    // Normalize
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    for (let i = 0; i < n; i++) vec[i] /= norm;

    freq.push(omega);
    modes.push(vec);
  }

  normalModes = { frequencies: freq, eigenvectors: modes };

  // Project current state onto normal modes
  modeAmplitudes = [];
  for (let m = 0; m < n; m++) {
    let amp = 0;
    for (let i = 0; i < n; i++) {
      amp += x[i] * normalModes.eigenvectors[m][i];
    }
    modeAmplitudes.push(amp);
  }
}

function computeEnergy() {
  let kinetic = 0;
  let potential = 0;

  // Kinetic energy
  for (let i = 0; i < n; i++) {
    kinetic += 0.5 * mass * v[i] * v[i];
  }

  // Potential energy from springs
  if (boundary === 'fixed' || boundary === 'periodic') {
    for (let i = 0; i < n; i++) {
      let xLeft = (i > 0) ? x[i - 1] : (boundary === 'periodic' ? x[n - 1] : 0);
      let xRight = (i < n - 1) ? x[i + 1] : (boundary === 'periodic' ? x[0] : 0);

      if (i === 0 && boundary === 'fixed') {
        potential += 0.5 * k * x[i] * x[i]; // left wall
      }
      if (i === n - 1 && boundary === 'fixed') {
        potential += 0.5 * k * x[i] * x[i]; // right wall
      }

      if (i < n - 1) {
        potential += 0.5 * k * (x[i + 1] - x[i]) * (x[i + 1] - x[i]);
      } else if (boundary === 'periodic') {
        potential += 0.5 * k * (x[0] - x[i]) * (x[0] - x[i]);
      }
    }
  } else { // free
    for (let i = 0; i < n - 1; i++) {
      potential += 0.5 * k * (x[i + 1] - x[i]) * (x[i + 1] - x[i]);
    }
  }

  return { kinetic, potential, total: kinetic + potential };
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

  if (viewMode === 'space') {
    drawSpaceTime(w, h, colors);
  } else if (viewMode === 'phase') {
    drawPhaseSpace(w, h, colors);
  } else if (viewMode === 'modes') {
    drawNormalModes(w, h, colors);
  } else if (viewMode === 'energy') {
    drawEnergy(w, h, colors);
  } else if (viewMode === 'fourier') {
    drawFourier(w, h, colors);
  }

  // Update readouts
  const energy = computeEnergy();
  energyVal.textContent = energy.total.toFixed(4) + ' J';
  kineticVal.textContent = energy.kinetic.toFixed(4) + ' J';
  potentialVal.textContent = energy.potential.toFixed(4) + ' J';
  timeVal.textContent = time.toFixed(2) + ' s';
}

function drawSpaceTime(w, h, colors) {
  const margin = 60;
  const graphW = w - 2 * margin;
  const graphH = h - 2 * margin;
  const graphX = margin;
  const graphY = margin;

  // Time axis horizontal, space vertical
  const maxDisp = Math.max(2, ...x.map(Math.abs)) * 1.2;

  // Axes
  ctx.strokeStyle = colors.muted + '60';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(graphX, graphY);
  ctx.lineTo(graphX, graphY + graphH);
  ctx.lineTo(graphX + graphW, graphY + graphH);
  ctx.stroke();

  // Labels
  ctx.fillStyle = colors.muted;
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Time (s)', graphX + graphW / 2, graphY + graphH + 25);
  ctx.save();
  ctx.translate(graphX - 20, graphY + graphH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Mass Index', 0, 0);
  ctx.restore();

  // Equilibrium positions
  ctx.strokeStyle = colors.muted + '20';
  ctx.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    const py = graphY + graphH - (i + 0.5) / n * graphH;
    ctx.beginPath();
    ctx.moveTo(graphX, py);
    ctx.lineTo(graphX + graphW, py);
    ctx.stroke();
    ctx.fillStyle = colors.muted + '60';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${i + 1}`, graphX - 8, py + 4);
  }

  // Space-time trails
  for (let i = 0; i < n; i++) {
    if (spaceTimeTrail[i].length < 2) continue;

    const hue = (i / n) * 360;
    ctx.strokeStyle = `hsl(${hue}, 70%, 55%)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let j = 0; j < spaceTimeTrail[i].length; j++) {
      const px = graphX + (j / spaceTimeTrail[i].length) * graphW;
      const py = graphY + graphH - (i + 0.5 + spaceTimeTrail[i][j] / maxDisp * 0.4) / n * graphH;
      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Current positions as dots
  for (let i = 0; i < n; i++) {
    const px = graphX + graphW * 0.95;
    const py = graphY + graphH - (i + 0.5 + x[i] / maxDisp * 0.4) / n * graphH;
    const hue = (i / n) * 360;
    ctx.fillStyle = `hsl(${hue}, 70%, 55%)`;
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPhaseSpace(w, h, colors) {
  const margin = 60;
  const graphW = w - 2 * margin;
  const graphH = h - 2 * margin;
  const graphX = margin;
  const graphY = margin;

  // Find max velocity
  const maxV = Math.max(2, ...v.map(Math.abs)) * 1.2;
  const maxDisp = Math.max(2, ...x.map(Math.abs)) * 1.2;

  // Axes
  ctx.strokeStyle = colors.muted + '60';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(graphX, graphY);
  ctx.lineTo(graphX, graphY + graphH);
  ctx.lineTo(graphX + graphW, graphY + graphH);
  ctx.stroke();

  // Labels
  ctx.fillStyle = colors.muted;
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Displacement', graphX + graphW / 2, graphY + graphH + 25);
  ctx.save();
  ctx.translate(graphX - 20, graphY + graphH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Velocity', 0, 0);
  ctx.restore();

  // Draw phase space for each mass
  for (let i = 0; i < n; i++) {
    const hue = (i / n) * 360;

    // Trail
    if (phaseTrails[i].length > 1) {
      ctx.strokeStyle = `hsl(${hue}, 70%, 55%)80`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let j = 0; j < phaseTrails[i].length; j++) {
        const px = graphX + (phaseTrails[i][j].x + maxDisp) / (2 * maxDisp) * graphW;
        const py = graphY + graphH - (phaseTrails[i][j].v + maxV) / (2 * maxV) * graphH;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Current point
    const px = graphX + (x[i] + maxDisp) / (2 * maxDisp) * graphW;
    const py = graphY + graphH - (v[i] + maxV) / (2 * maxV) * graphH;
    ctx.fillStyle = `hsl(${hue}, 70%, 55%)`;
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawNormalModes(w, h, colors) {
  const margin = 60;
  const graphW = w - 2 * margin;
  const graphH = h - 2 * margin;
  const graphX = margin;
  const graphY = margin;

  // Axes
  ctx.strokeStyle = colors.muted + '60';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(graphX, graphY);
  ctx.lineTo(graphX, graphY + graphH);
  ctx.lineTo(graphX + graphW, graphY + graphH);
  ctx.stroke();

  // Labels
  ctx.fillStyle = colors.muted;
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Mode Number', graphX + graphW / 2, graphY + graphH + 25);
  ctx.save();
  ctx.translate(graphX - 20, graphY + graphH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Frequency (rad/s)', 0, 0);
  ctx.restore();

  // Frequencies
  const maxFreq = Math.max(...normalModes.frequencies, 1);

  // Theoretical frequencies
  ctx.fillStyle = colors.muted + '60';
  for (let m = 0; m < n; m++) {
    const px = graphX + (m + 0.5) / n * graphW;
    const py = graphY + graphH - normalModes.frequencies[m] / maxFreq * graphH * 0.9;
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Current mode amplitudes (energy in each mode)
  if (modeAmplitudes.length > 0) {
    const maxAmp = Math.max(...modeAmplitudes.map(Math.abs), 0.01);
    ctx.fillStyle = colors.accent + 'CC';
    for (let m = 0; m < n; m++) {
      const px = graphX + (m + 0.5) / n * graphW;
      const amp = Math.abs(modeAmplitudes[m]);
      const py = graphY + graphH - amp / maxAmp * graphH * 0.9;
      const barH = graphY + graphH - py;
      ctx.fillRect(px - 8, py, 16, barH);
    }
  }

  // Mode shapes below
  const shapeY = graphY + graphH + 40;
  const shapeH = 120;
  ctx.fillStyle = colors.muted;
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Mode Shapes (first 3)', graphX + graphW / 2, shapeY - 10);

  for (let m = 0; m < Math.min(3, n); m++) {
    const shapeX = graphX + m / 3 * graphW;
    const centerY = shapeY + shapeH / 2;

    ctx.strokeStyle = colors.muted + '40';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(shapeX, centerY);
    ctx.lineTo(shapeX + graphW / 3, centerY);
    ctx.stroke();

    ctx.strokeStyle = `hsl(${(m / 3) * 360}, 70%, 55%)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const px = shapeX + (i + 0.5) / n * (graphW / 3);
      const py = centerY - normalModes.eigenvectors[m][i] * shapeH * 0.4;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.fillStyle = colors.muted;
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`ω${m+1}=${normalModes.frequencies[m].toFixed(1)}`, shapeX + graphW / 6, centerY + shapeH / 2 + 15);
  }
}

function drawEnergy(w, h, colors) {
  const margin = 60;
  const graphW = w - 2 * margin;
  const graphH = h - 2 * margin;
  const graphX = margin;
  const graphY = margin;

  // Axes
  ctx.strokeStyle = colors.muted + '60';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(graphX, graphY);
  ctx.lineTo(graphX, graphY + graphH);
  ctx.lineTo(graphX + graphW, graphY + graphH);
  ctx.stroke();

  // Labels
  ctx.fillStyle = colors.muted;
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Time (s)', graphX + graphW / 2, graphY + graphH + 25);
  ctx.save();
  ctx.translate(graphX - 20, graphY + graphH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Energy (J)', 0, 0);
  ctx.restore();

  if (energyHistory.length > 1) {
    const maxE = Math.max(...energyHistory.map(e => Math.abs(e.total)), 1);
    const minE = Math.min(...energyHistory.map(e => e.total), 0);

    // Total energy
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < energyHistory.length; i++) {
      const px = graphX + (i / energyHistory.length) * graphW;
      const py = graphY + graphH - (energyHistory[i].total - minE) / (maxE - minE + 1e-10) * graphH * 0.9;
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
      const px = graphX + (i / energyHistory.length) * graphW;
      const py = graphY + graphH - (energyHistory[i].kinetic - minE) / (maxE - minE + 1e-10) * graphH * 0.9;
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
      const px = graphX + (i / energyHistory.length) * graphW;
      const py = graphY + graphH - (energyHistory[i].potential - minE) / (maxE - minE + 1e-10) * graphH * 0.9;
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

function drawFourier(w, h, colors) {
  const margin = 60;
  const graphW = w - 2 * margin;
  const graphH = h - 2 * margin;
  const graphX = margin;
  const graphY = margin;

  // Compute FFT of center mass (or first mass)
  const signal = spaceTimeTrail[Math.floor(n/2)] || [];
  if (signal.length < 4) {
    ctx.fillStyle = colors.muted;
    ctx.font = '14px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Run simulation to see spectrum', w/2, h/2);
    return;
  }

  const N = signal.length;
  const fft = computeFFT(signal.map(s => s));
  const freqs = fft.slice(0, N/2).map((c, i) => ({ freq: i / (N * dt), mag: Math.sqrt(c.re*c.re + c.im*c.im) }));
  const maxMag = Math.max(...freqs.map(f => f.mag), 1);

  // Axes
  ctx.strokeStyle = colors.muted + '60';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(graphX, graphY);
  ctx.lineTo(graphX, graphY + graphH);
  ctx.lineTo(graphX + graphW, graphY + graphH);
  ctx.stroke();

  // Labels
  ctx.fillStyle = colors.muted;
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Frequency (Hz)', graphX + graphW / 2, graphY + graphH + 25);
  ctx.save();
  ctx.translate(graphX - 20, graphY + graphH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Magnitude', 0, 0);
  ctx.restore();

  // Spectrum
  ctx.fillStyle = colors.accent + 'CC';
  const barW = graphW / (N/2);
  for (let i = 0; i < freqs.length; i++) {
    const px = graphX + i * barW;
    const barH = freqs[i].mag / maxMag * graphH * 0.9;
    ctx.fillRect(px, graphY + graphH - barH, Math.max(1, barW - 1), barH);
  }

  // Mark normal mode frequencies
  ctx.fillStyle = '#e85d2a';
  for (let m = 0; m < n; m++) {
    const f = normalModes.frequencies[m] / (2 * Math.PI);
    const px = graphX + f / (1/(2*dt)) * graphW;
    if (px >= graphX && px <= graphX + graphW) {
      ctx.beginPath();
      ctx.moveTo(px, graphY);
      ctx.lineTo(px, graphY + graphH);
      ctx.stroke();
      ctx.fillText(`ω${m+1}`, px, graphY - 5);
    }
  }
}

// Simple FFT (Cooley-Tukey, power of 2 only - pad if needed)
function computeFFT(signal) {
  let N = signal.length;
  // Pad to power of 2
  let pow2 = 1;
  while (pow2 < N) pow2 *= 2;
  const padded = new Array(pow2).fill({re: 0, im: 0});
  for (let i = 0; i < N; i++) {
    padded[i] = { re: signal[i], im: 0 };
  }
  N = pow2;

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [padded[i], padded[j]] = [padded[j], padded[i]];
  }

  // Cooley-Tukey
  for (let len = 2; len <= N; len <<= 1) {
    const angle = -2 * Math.PI / len;
    const wlen = { re: Math.cos(angle), im: Math.sin(angle) };
    for (let i = 0; i < N; i += len) {
      let w = { re: 1, im: 0 };
      for (let j = 0; j < len/2; j++) {
        const u = padded[i + j];
        const v = {
          re: padded[i + j + len/2].re * w.re - padded[i + j + len/2].im * w.im,
          im: padded[i + j + len/2].re * w.im + padded[i + j + len/2].im * w.re
        };
        padded[i + j] = { re: u.re + v.re, im: u.im + v.im };
        padded[i + j + len/2] = { re: u.re - v.re, im: u.im - v.im };
        // Multiply w by wlen
        const wnew = {
          re: w.re * wlen.re - w.im * wlen.im,
          im: w.re * wlen.im + w.im * wlen.re
        };
        w = wnew;
      }
    }
  }

  return padded;
}

function animate(timeMs) {
  if (!running) return;
  if (!lastTime) lastTime = timeMs;
  const dtFrame = (timeMs - lastTime) / 1000;
  lastTime = timeMs;

  const steps = Math.max(1, Math.ceil(dtFrame / dt));
  const subDt = dtFrame / steps;

  for (let step = 0; step < steps; step++) {
    velocityVerletStep(subDt);
    time += subDt;

    // Record trails
    for (let i = 0; i < n; i++) {
      spaceTimeTrail[i].push(x[i]);
      if (spaceTimeTrail[i].length > trailLength) spaceTimeTrail[i].shift();

      phaseTrails[i].push({ x: x[i], v: v[i] });
      if (phaseTrails[i].length > trailLength) phaseTrails[i].shift();
    }
  }

  // Update normal modes periodically
  if (Math.floor(time / 0.5) !== Math.floor((time - dtFrame) / 0.5)) {
    computeNormalModes();
  }

  // Energy history
  const energy = computeEnergy();
  energyHistory.push({ total: energy.total, kinetic: energy.kinetic, potential: energy.potential });
  if (energyHistory.length > 2000) energyHistory.shift();

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
  time = 0;
  x = new Array(n).fill(0);
  v = new Array(n).fill(0);
  spaceTimeTrail = Array.from({ length: n }, () => []);
  phaseTrails = Array.from({ length: n }, () => []);
  energyHistory = [];

  // Apply current preset
  applyPreset(presetSelect.value);

  // Recompute initial energy
  const energy = computeEnergy();
  initialEnergy = energy.total;
  computeNormalModes();
  draw();
}

function clearTrails() {
  spaceTimeTrail = Array.from({ length: n }, () => []);
  phaseTrails = Array.from({ length: n }, () => []);
  energyHistory = [];
  draw();
}

function updateParams() {
  const newN = parseInt(nInput.value);
  const oldN = n;

  n = newN;
  mass = parseFloat(massInput.value);
  k = parseFloat(kInput.value);
  damping = parseFloat(dampingInput.value);
  boundary = boundarySelect.value;
  dt = parseFloat(dtInput.value);
  trailLength = parseInt(trailInput.value);

  nVal.textContent = n;
  massVal.textContent = mass.toFixed(1);
  kVal.textContent = k.toFixed(1);
  dampingVal.textContent = damping.toFixed(2);
  dtVal.textContent = dt.toFixed(3);
  trailVal.textContent = trailLength;

  // Resize arrays if n changed
  if (n !== oldN) {
    if (n > oldN) {
      const diff = n - oldN;
      for (let i = 0; i < diff; i++) {
        x.push(0);
        v.push(0);
        spaceTimeTrail.push([]);
        phaseTrails.push([]);
      }
    } else {
      x = x.slice(0, n);
      v = v.slice(0, n);
      spaceTimeTrail = spaceTimeTrail.slice(0, n);
      phaseTrails = phaseTrails.slice(0, n);
    }
    createInitialControls();
  }

  if (!running) reset();
}

function init() {
  resizeCanvas();
  createInitialControls();
  updateParams();

  // Event listeners
  nInput.addEventListener('input', updateParams);
  massInput.addEventListener('input', updateParams);
  kInput.addEventListener('input', updateParams);
  dampingInput.addEventListener('input', updateParams);
  boundarySelect.addEventListener('change', updateParams);
  dtInput.addEventListener('input', updateParams);
  trailInput.addEventListener('input', updateParams);

  presetSelect.addEventListener('change', (e) => {
    if (e.target.value !== 'custom') {
      applyPreset(e.target.value);
    }
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