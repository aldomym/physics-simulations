// Hydrogen Atom Orbital Visualization
// Spherical harmonic solution to Schrödinger equation with U = -k/r

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const nInput = document.getElementById('nInput');
const lInput = document.getElementById('lInput');
const mInput = document.getElementById('mInput');
const nVal = document.getElementById('nVal');
const lVal = document.getElementById('lVal');
const mVal = document.getElementById('mVal');
const viewRadios = document.querySelectorAll('input[name="view"]');
const sliceInput = document.getElementById('sliceInput');
const rMaxInput = document.getElementById('rMaxInput');
const logScaleInput = document.getElementById('logScale');
const presetBtns = document.querySelectorAll('.btn-secondary[id^="preset"]');

const orbitalName = document.getElementById('orbitalName');
const energyVal = document.getElementById('energyVal');
const degeneracyVal = document.getElementById('degeneracyVal');
const nodesVal = document.getElementById('nodesVal');
const avgRVal = document.getElementById('avgRVal');
const sliceVal = document.getElementById('sliceVal');
const rMaxVal = document.getElementById('rMaxVal');
const colorbarEl = document.getElementById('colorbar');

let n = 1, l = 0, m = 0;
let viewMode = 'density';
let slicePlane = 0; // 0=xy, 1=xz, 2=yz
let rMax = 30;
let logScale = true;

// Constants (atomic units: ℏ = mₑ = e = a₀ = 1)
const E_HARTREE = 27.2114; // eV
const E_GROUND = -13.5984; // eV

// Factorial with memoization
const factCache = [1];
function factorial(n) {
  if (n < 0) return 0;
  if (factCache[n] !== undefined) return factCache[n];
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  factCache[n] = result;
  return result;
}

// Double factorial
function doubleFactorial(n) {
  if (n <= 0) return 1;
  let result = 1;
  for (let i = n; i > 0; i -= 2) result *= i;
  return result;
}

// Associated Legendre polynomial P_l^m(x)
function assocLegendre(l, m, x) {
  if (m < 0) {
    const prefactor = Math.pow(-1, -m) * factorial(l + m) / factorial(l - m);
    return prefactor * assocLegendre(l, -m, x);
  }
  if (m > l) return 0;

  let pmm = 1.0;
  if (m > 0) {
    const somx2 = Math.sqrt((1 - x) * (1 + x));
    let fact = 1.0;
    for (let i = 1; i <= m; i++) {
      pmm = -pmm * fact * somx2;
      fact += 2.0;
    }
  }
  if (l === m) return pmm;

  let pmmp1 = x * (2 * m + 1) * pmm;
  if (l === m + 1) return pmmp1;

  for (let ll = m + 2; ll <= l; ll++) {
    const pll = (x * (2 * ll - 1) * pmmp1 - (ll + m - 1) * pmm) / (ll - m);
    pmm = pmmp1;
    pmmp1 = pll;
  }
  return pmmp1;
}

// Spherical harmonic Y_l^m(θ, φ)
// Returns complex value as {re, im}
function sphericalHarmonic(l, m, theta, phi) {
  // Normalization
  const norm = Math.sqrt((2 * l + 1) / (4 * Math.PI) * factorial(l - Math.abs(m)) / factorial(l + Math.abs(m)));
  const Plm = assocLegendre(l, Math.abs(m), Math.cos(theta));
  const Ylm = norm * Plm;

  // e^{imφ}
  const cos_mphi = Math.cos(m * phi);
  const sin_mphi = Math.sin(m * phi);

  // Condon-Shortley phase (-1)^m for m>0
  const phase = (m > 0 && m % 2 === 1) ? -1 : 1;

  return {
    re: phase * Ylm * cos_mphi,
    im: phase * Ylm * sin_mphi
  };
}

// Associated Laguerre polynomial L_n^k(x)
function assocLaguerre(n, k, x) {
  if (n === 0) return 1;
  if (n === 1) return 1 + k - x;

  let Lkm2 = 1;
  let Lkm1 = 1 + k - x;
  let Lk = 0;

  for (let i = 2; i <= n; i++) {
    Lk = ((2 * i - 1 + k - x) * Lkm1 - (i - 1 + k) * Lkm2) / i;
    Lkm2 = Lkm1;
    Lkm1 = Lk;
  }
  return Lk;
}

// Radial wavefunction R_{n,l}(r)
function radialWavefunction(n, l, r) {
  // Normalization constant
  const norm = Math.sqrt(Math.pow(2 / n, 3) * factorial(n - l - 1) / (2 * n * factorial(n + l)));
  const rho = 2 * r / n;
  const L = assocLaguerre(n - l - 1, 2 * l + 1, rho);
  return norm * Math.pow(rho, l) * L * Math.exp(-rho / 2);
}

// Full wavefunction ψ_{n,l,m}(r,θ,φ) - returns complex
function wavefunction(n, l, m, r, theta, phi) {
  const R = radialWavefunction(n, l, r);
  const Y = sphericalHarmonic(l, m, theta, phi);
  return {
    re: R * Y.re,
    im: R * Y.im
  };
}

// Probability density |ψ|²
function probabilityDensity(n, l, m, r, theta, phi) {
  const psi = wavefunction(n, l, m, r, theta, phi);
  return psi.re * psi.re + psi.im * psi.im;
}

// Radial probability density r²|R|²
function radialProbabilityDensity(n, l, r) {
  const R = radialWavefunction(n, l, r);
  return r * r * R * R;
}

// Orbital name from quantum numbers
function orbitalNameFromQL(n, l, m) {
  const letters = ['s', 'p', 'd', 'f', 'g', 'h', 'i'];
  const letter = letters[l] || String.fromCharCode(106 + l); // j, k, l...
  const mStr = m === 0 ? '' : (m > 0 ? '+' + m : m);
  return `${n}${letter}${mStr}`;
}

// Energy in eV
function energyFromN(n) {
  return E_GROUND / (n * n);
}

// Degeneracy (number of states with same n)
function degeneracyFromN(n) {
  return n * n;
}

// Number of nodes
function nodesFromNL(n, l) {
  return n - l - 1; // radial nodes
}

// Average radius ⟨r⟩ in a₀
function avgRadius(n, l) {
  // ⟨r⟩ = (a₀/2) [3n² - l(l+1)]
  return 0.5 * (3 * n * n - l * (l + 1));
}

// Convert spherical to Cartesian
function sphericalToCartesian(r, theta, phi) {
  const sinTheta = Math.sin(theta);
  return {
    x: r * sinTheta * Math.cos(phi),
    y: r * sinTheta * Math.sin(phi),
    z: r * Math.cos(theta)
  };
}

// Get coordinates for slice plane
function getSliceCoords(x, y, plane) {
  switch (plane) {
    case 0: // xy plane (z=0)
      return { r: Math.sqrt(x * x + y * y), theta: Math.PI / 2, phi: Math.atan2(y, x) };
    case 1: // xz plane (y=0)
      return { r: Math.sqrt(x * x + y * y), theta: Math.atan2(Math.abs(x), y), phi: x >= 0 ? 0 : Math.PI };
    case 2: // yz plane (x=0)
      return { r: Math.sqrt(x * x + y * y), theta: Math.atan2(Math.abs(y), x), phi: y >= 0 ? Math.PI / 2 : -Math.PI / 2 };
    default:
      return { r: Math.sqrt(x * x + y * y), theta: Math.PI / 2, phi: Math.atan2(y, x) };
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

// Viridis-like colormap
function viridis(t) {
  t = Math.max(0, Math.min(1, t));
  const r = 0.231 + 0.583 * t + 0.232 * t * t - 0.295 * t * t * t;
  const g = 0.088 + 0.543 * t + 0.599 * t * t - 0.241 * t * t * t;
  const b = 0.221 + 0.116 * t - 0.493 * t * t + 0.475 * t * t * t;
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

function draw() {
  const colors = getColors();
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);
  ctx.clearRect(0, 0, w, h);

  const centerX = w / 2;
  const centerY = h / 2;
  const scale = Math.min(w, h) * 0.4 / rMax; // pixels per a₀

  if (viewMode === 'density') {
    drawDensitySlice(centerX, centerY, scale, w, h, colors);
  } else if (viewMode === 'radial') {
    drawRadialDistribution(centerX, centerY, scale, w, h, colors);
  } else if (viewMode === 'angular') {
    drawAngularSlice(centerX, centerY, scale, w, h, colors);
  }

  // Draw colorbar
  drawColorbar(w, h, colors);

  // Update info panel
  updateInfoPanel();
}

function drawDensitySlice(cx, cy, scale, w, h, colors) {
  const imageData = ctx.createImageData(w, h);
  const data = imageData.data;

  let maxProb = 0;
  const probs = new Float32Array(w * h);

  // First pass: compute all probabilities and find max
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const x = (px - cx) / scale;
      const y = (py - cy) / scale;
      const coords = getSliceCoords(x, y, slicePlane);
      const prob = probabilityDensity(n, l, m, coords.r, coords.theta, coords.phi);
      probs[py * w + px] = prob;
      if (prob > maxProb) maxProb = prob;
    }
  }

  // Second pass: render with colormap
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const prob = probs[py * w + px];
      const idx = (py * w + px) * 4;

      if (prob > 1e-10) {
        const t = logScale ? Math.log10(prob / maxProb + 1e-10) / Math.log10(1e-4) : prob / maxProb;
        const clampedT = Math.max(0, Math.min(1, t));
        const color = viridis(clampedT);
        const rgb = color.match(/\d+/g).map(Number);
        data[idx] = rgb[0];
        data[idx + 1] = rgb[1];
        data[idx + 2] = rgb[2];
        data[idx + 3] = Math.round(255 * Math.max(0.1, clampedT));
      } else {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Draw nucleus
  ctx.fillStyle = '#ffcc00';
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();

  // Draw slice plane label
  const planeNames = ['z=0 (xy)', 'y=0 (xz)', 'x=0 (yz)'];
  ctx.fillStyle = colors.muted;
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`Slice: ${planeNames[slicePlane]}`, 10, h - 10);
  ctx.textAlign = 'right';
  ctx.fillText(`${rMax} a₀`, w - 10, h - 10);
}

function drawRadialDistribution(cx, cy, scale, w, h, colors) {
  const graphW = w - 80;
  const graphH = h - 80;
  const graphX = 40;
  const graphY = 40;

  // Find max
  let maxProb = 0;
  const steps = 500;
  for (let i = 0; i <= steps; i++) {
    const r = (i / steps) * rMax;
    const prob = radialProbabilityDensity(n, l, r);
    if (prob > maxProb) maxProb = prob;
  }

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
  ctx.fillText('r (a₀)', graphX + graphW / 2, graphY + graphH + 25);
  ctx.save();
  ctx.translate(graphX - 20, graphY + graphH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('r²|R|²', 0, 0);
  ctx.restore();

  // Curve
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const r = (i / steps) * rMax;
    const prob = radialProbabilityDensity(n, l, r);
    const px = graphX + (r / rMax) * graphW;
    const py = graphY + graphH - (prob / maxProb) * graphH * 0.9;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Nucleus marker
  ctx.fillStyle = '#ffcc00';
  ctx.beginPath();
  ctx.arc(graphX, graphY + graphH, 4, 0, Math.PI * 2);
  ctx.fill();

  // Grid lines
  ctx.strokeStyle = colors.muted + '20';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    const r = (i / 4) * rMax;
    const px = graphX + (i / 4) * graphW;
    ctx.beginPath();
    ctx.moveTo(px, graphY);
    ctx.lineTo(px, graphY + graphH);
    ctx.stroke();
    ctx.fillStyle = colors.muted;
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(r.toFixed(0), px, graphY + graphH + 12);
  }
}

function drawAngularSlice(cx, cy, scale, w, h, colors) {
  // 3D-like visualization: show angular dependence on a sphere
  const radius = Math.min(w, h) * 0.35;

  // Draw angular probability on sphere surface
  const imageData = ctx.createImageData(w, h);
  const data = imageData.data;

  let maxProb = 0;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        // Project onto sphere
        const theta = Math.acos(Math.max(-1, Math.min(1, dy / radius)));
        const phi = Math.atan2(dx, Math.sqrt(radius * radius - dx * dx - dy * dy));
        // Fix phi for back side
        const phiCorrected = dx >= 0 ? phi : 2 * Math.PI - phi;

        // Use a fixed radius (e.g., ⟨r⟩)
        const r = avgRadius(n, l);
        const prob = probabilityDensity(n, l, m, r, theta, phiCorrected);

        const idx = (py * w + px) * 4;
        if (prob > maxProb) maxProb = prob;
        data[idx + 3] = 255; // mark as valid
        data[idx] = prob; // store prob temporarily in red channel
      } else {
        data[idx + 3] = 0;
      }
    }
  }

  // Render with colormap
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const idx = (py * w + px) * 4;
      if (data[idx + 3] === 255) {
        const prob = data[idx];
        const t = logScale ? Math.log10(prob / maxProb + 1e-10) / Math.log10(1e-4) : prob / maxProb;
        const clampedT = Math.max(0, Math.min(1, t));
        const color = viridis(clampedT);
        const rgb = color.match(/\d+/g).map(Number);
        data[idx] = rgb[0];
        data[idx + 1] = rgb[1];
        data[idx + 2] = rgb[2];
        data[idx + 3] = Math.round(255 * Math.max(0.1, clampedT));
      } else {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Draw sphere wireframe
  ctx.strokeStyle = colors.muted + '60';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Equator and meridian
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(cx - radius, cy);
  ctx.lineTo(cx + radius, cy);
  ctx.moveTo(cx, cy - radius);
  ctx.lineTo(cx, cy + radius);
  ctx.stroke();
  ctx.setLineDash([]);

  // Nucleus
  ctx.fillStyle = '#ffcc00';
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colors.muted;
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('Angular distribution at ⟨r⟩', 10, h - 10);
}

function drawColorbar(w, h, colors) {
  const barW = 200;
  const barH = 16;
  const barX = (w - barW) / 2;
  const barY = h - 35;

  const grad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
  for (let i = 0; i <= 10; i++) {
    grad.addColorStop(i / 10, viridis(i / 10));
  }
  ctx.fillStyle = grad;
  ctx.fillRect(barX, barY, barW, barH);

  ctx.strokeStyle = colors.muted + '60';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);

  ctx.fillStyle = colors.muted;
  ctx.font = '9px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(logScale ? 'Log scale' : 'Linear', barX, barY - 4);
  ctx.textAlign = 'right';
  ctx.fillText('|ψ|²', barX + barW, barY - 4);
}

function updateInfoPanel() {
  orbitalName.textContent = orbitalNameFromQL(n, l, m);
  energyVal.textContent = energyFromN(n).toFixed(2);
  degeneracyVal.textContent = degeneracyFromN(n);
  nodesVal.textContent = nodesFromNL(n, l);
  avgRVal.textContent = avgRadius(n, l).toFixed(1);
}

function updateInputs() {
  nVal.textContent = n;
  lVal.textContent = l;
  mVal.textContent = m;
  sliceVal.textContent = ['z=0 (xy-plane)', 'y=0 (xz-plane)', 'x=0 (yz-plane)'][slicePlane];
  rMaxVal.textContent = rMax + ' a₀';

  // Constrain l to [0, n-1]
  if (l >= n) {
    l = n - 1;
    lInput.value = l;
    lVal.textContent = l;
  }
  // Constrain m to [-l, l]
  if (Math.abs(m) > l) {
    m = Math.max(-l, Math.min(l, m));
    mInput.value = m;
    mVal.textContent = m;
  }

  lInput.max = Math.max(0, n - 1);
  mInput.min = -lInput.max;
  mInput.max = lInput.max;

  draw();
}

function init() {
  resizeCanvas();
  updateInputs();

  // Event listeners
  nInput.addEventListener('input', (e) => {
    n = parseInt(e.target.value);
    updateInputs();
  });

  lInput.addEventListener('input', (e) => {
    l = parseInt(e.target.value);
    updateInputs();
  });

  mInput.addEventListener('input', (e) => {
    m = parseInt(e.target.value);
    updateInputs();
  });

  const sliceRow = document.getElementById('sliceRow');
  const rMaxRow = rMaxInput.closest('.control-row');

  viewRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      viewMode = e.target.value;
      sliceRow.style.display = viewMode === 'density' ? 'flex' : 'none';
      rMaxRow.style.display = viewMode !== 'angular' ? 'flex' : 'none';
      draw();
    });
  });

  sliceInput.addEventListener('input', (e) => {
    slicePlane = parseInt(e.target.value);
    updateInputs();
  });

  rMaxInput.addEventListener('input', (e) => {
    rMax = parseInt(e.target.value);
    updateInputs();
  });

  logScaleInput.addEventListener('change', (e) => {
    logScale = e.target.checked;
    draw();
  });

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.id.replace('preset', '');
      if (preset === '1s') { n = 1; l = 0; m = 0; }
      else if (preset === '2s') { n = 2; l = 0; m = 0; }
      else if (preset === '2p') { n = 2; l = 1; m = 0; }
      else if (preset === '3d') { n = 3; l = 2; m = 0; }
      else if (preset === '4f') { n = 4; l = 3; m = 0; }
      nInput.value = n;
      lInput.value = l;
      mInput.value = m;
      updateInputs();
    });
  });

  window.addEventListener('resize', () => { resizeCanvas(); draw(); });
}

init();