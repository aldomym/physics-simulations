// Virtual Orrery - Planetary positions using two-body problem with J2000 orbital elements

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const dateInput = document.getElementById('dateInput');
const jdInput = document.getElementById('jdInput');
const timeScaleInput = document.getElementById('timeScale');
const viewScaleInput = document.getElementById('viewScale');
const showOrbitsInput = document.getElementById('showOrbits');
const showTrailsInput = document.getElementById('showTrails');
const showLabelsInput = document.getElementById('showLabels');
const playPauseBtn = document.getElementById('playPauseBtn');
const playIcon = document.getElementById('playIcon');
const playText = document.getElementById('playText');
const resetBtn = document.getElementById('resetBtn');
const nowBtn = document.getElementById('nowBtn');
const presetBtns = document.querySelectorAll('.preset-btn');
const planetInfoEl = document.getElementById('planetInfo');
const legendEl = document.getElementById('legend');
const timeScaleVal = document.getElementById('timeScaleVal');
const viewScaleVal = document.getElementById('viewScaleVal');

let running = false, lastTime = 0, animationId = null;
let currentJD = 0;
let timeScale = 100;
let viewScale = 1;
let trails = {};

// Planetary orbital elements at J2000.0 epoch (from JPL DE430 / standard astronomical references)
// a: semi-major axis (AU), e: eccentricity, i: inclination (deg),
// Omega: longitude of ascending node (deg), omega: argument of periapsis (deg)
// M0: mean anomaly at J2000 (deg), period: orbital period (days)
const PLANETS = [
  {
    name: 'Mercury',
    color: '#b5b5b5',
    radius: 0.38, // Earth radii
    a: 0.387098,  // AU
    e: 0.205630,
    i: 7.00487,
    Omega: 48.33167,
    omega: 29.124,
    M0: 174.796,
    period: 87.969,
    mass: 0.0553
  },
  {
    name: 'Venus',
    color: '#e6c87a',
    radius: 0.95,
    a: 0.723332,
    e: 0.006772,
    i: 3.39471,
    Omega: 76.68069,
    omega: 54.884,
    M0: 50.416,
    period: 224.701,
    mass: 0.815
  },
  {
    name: 'Earth',
    color: '#4a90d9',
    radius: 1.0,
    a: 1.000001,
    e: 0.016709,
    i: 0.00005,
    Omega: -11.26064,
    omega: 114.207,
    M0: 357.529,
    period: 365.256,
    mass: 1.0
  },
  {
    name: 'Mars',
    color: '#e85d2a',
    radius: 0.53,
    a: 1.523662,
    e: 0.093412,
    i: 1.85061,
    Omega: 49.57854,
    omega: 286.502,
    M0: 19.373,
    period: 686.980,
    mass: 0.107
  },
  {
    name: 'Jupiter',
    color: '#d4a574',
    radius: 11.2,
    a: 5.203363,
    e: 0.048392,
    i: 1.30530,
    Omega: 100.55615,
    omega: 273.867,
    M0: 20.020,
    period: 4332.59,
    mass: 317.8
  },
  {
    name: 'Saturn',
    color: '#f4e4a1',
    radius: 9.45,
    a: 9.537070,
    e: 0.054150,
    i: 2.48446,
    Omega: 113.71504,
    omega: 339.392,
    M0: 317.020,
    period: 10759.22,
    mass: 95.2
  },
  {
    name: 'Uranus',
    color: '#7de3f4',
    radius: 4.0,
    a: 19.19126,
    e: 0.047167,
    i: 0.76986,
    Omega: 74.22988,
    omega: 97.862,
    M0: 142.238,
    period: 30688.5,
    mass: 14.5
  },
  {
    name: 'Neptune',
    color: '#4b70dd',
    radius: 3.9,
    a: 30.06896,
    e: 0.008585,
    i: 1.76917,
    Omega: 131.72169,
    omega: 276.336,
    M0: 256.225,
    period: 60182,
    mass: 17.1
  }
];

// Constants
const AU_KM = 149597870.7;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const J2000 = 2451545.0;
const DAYS_PER_CENTURY = 36525;
const GM_SUN = 1.32712440018e11; // km^3/s^2

// Solve Kepler's equation: M = E - e*sin(E) for E
function solveKepler(M, e) {
  let E = M;
  for (let i = 0; i < 10; i++) {
    const f = E - e * Math.sin(E) - M;
    const fprime = 1 - e * Math.cos(E);
    const dE = f / fprime;
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

// Compute planetary position in heliocentric ecliptic coordinates
function computePlanetPosition(planet, jd) {
  // Time in centuries from J2000
  const T = (jd - J2000) / DAYS_PER_CENTURY;

  // Mean motion (deg/day)
  const n = 360 / planet.period;

  // Mean anomaly at time T
  const M = (planet.M0 + n * (jd - J2000)) % 360;
  const M_rad = M * DEG_TO_RAD;

  // Solve Kepler's equation for eccentric anomaly
  const E = solveKepler(M_rad, planet.e);

  // True anomaly
  const nu = 2 * Math.atan2(Math.sqrt(1 + planet.e) * Math.sin(E / 2), Math.sqrt(1 - planet.e) * Math.cos(E / 2));

  // Distance from Sun
  const r = planet.a * (1 - planet.e * Math.cos(E));

  // Orbital plane coordinates
  const x_orb = r * Math.cos(nu);
  const y_orb = r * Math.sin(nu);
  const z_orb = 0;

  // Convert to ecliptic coordinates
  const omega = planet.omega * DEG_TO_RAD;
  const Omega = planet.Omega * DEG_TO_RAD;
  const i = planet.i * DEG_TO_RAD;

  // Rotation matrices: Rz(-Omega) * Rx(-i) * Rz(-omega)
  const cosO = Math.cos(Omega), sinO = Math.sin(Omega);
  const cosi = Math.cos(i), sini = Math.sin(i);
  const cosw = Math.cos(omega), sinw = Math.sin(omega);

  // Position in ecliptic frame
  const x = (cosO * cosw - sinO * sinw * cosi) * x_orb + (-cosO * sinw - sinO * cosw * cosi) * y_orb;
  const y = (sinO * cosw + cosO * sinw * cosi) * x_orb + (-sinO * sinw + cosO * cosw * cosi) * y_orb;
  const z = (sinw * sini) * x_orb + (cosw * sini) * y_orb;

  // Velocity in orbital plane
  const h = Math.sqrt(GM_SUN * planet.a * AU_KM * (1 - planet.e * planet.e));
  const v_r = GM_SUN / h * planet.e * Math.sin(nu);
  const v_t = h / (r * AU_KM);

  const vx_orb = -v_t * Math.sin(nu) + v_r * Math.cos(nu);
  const vy_orb = v_t * Math.cos(nu) + v_r * Math.sin(nu);

  const vx = (cosO * cosw - sinO * sinw * cosi) * vx_orb + (-cosO * sinw - sinO * cosw * cosi) * vy_orb;
  const vy = (sinO * cosw + cosO * sinw * cosi) * vx_orb + (-sinO * sinw + cosO * cosw * cosi) * vy_orb;
  const vz = (sinw * sini) * vx_orb + (cosw * sini) * vy_orb;

  return { x, y, z, r, vx, vy, vz, nu };
}

// Date parsing
function parseDate(dateStr) {
  const parts = dateStr.split('-').map(Number);
  if (parts.length === 3) {
    const [day, month, year] = parts;
    if (year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { day, month, year };
    }
  }
  return null;
}

function dateToJD(day, month, year) {
  let y = year, m = month;
  if (m <= 2) { y -= 1; m += 12; }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  const jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
  return jd;
}

function jdToDate(jd) {
  const jdInt = Math.floor(jd + 0.5);
  const f = jd + 0.5 - jdInt;
  let jdAdjusted = jdInt;
  if (jdInt >= 2299161) {
    const a = Math.floor((jdInt - 1867216.25) / 36524.25);
    jdAdjusted += 1 + a - Math.floor(a / 4);
  }
  const b = jdAdjusted + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const day = b - d - Math.floor(30.6001 * e) + f;
  const month = e < 13.5 ? e - 1 : e - 13;
  const year = month > 2.5 ? c - 4716 : c - 4715;
  return { day: Math.floor(day), month, year };
}

function updateInputsFromJD(jd) {
  const date = jdToDate(jd);
  dateInput.value = `${String(date.day).padStart(2, '0')}-${String(date.month).padStart(2, '0')}-${date.year}`;
  jdInput.value = jd.toFixed(6);
  currentJD = jd;
}

function getJDFromInputs() {
  const dateStr = dateInput.value.trim();
  const jdStr = jdInput.value.trim();

  if (dateStr) {
    const parsed = parseDate(dateStr);
    if (parsed) return dateToJD(parsed.day, parsed.month, parsed.year);
  }
  if (jdStr) {
    const jd = parseFloat(jdStr);
    if (!isNaN(jd)) return jd;
  }
  return null;
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

  const centerX = w / 2;
  const centerY = h / 2;

  // Compute scale to fit Neptune orbit
  const maxAU = 30.1; // Neptune semi-major axis
  const baseScale = Math.min(w, h) * 0.4 / maxAU;
  const scale = baseScale * viewScale;

  // Visual scaling: use sqrt to spread out inner planets
  // This makes Mercury/Venus/Earth/Mars more visually separated
  function visualAU(realAU) {
    // Square root scaling: compresses outer, expands inner
    const maxVisual = Math.sqrt(maxAU);
    return (Math.sqrt(realAU) / maxVisual) * maxAU;
  }

  // Compute all planet positions
  const positions = [];
  for (const planet of PLANETS) {
    const pos = computePlanetPosition(planet, currentJD);
    positions.push({ planet, ...pos });
  }

  // Draw orbits
  if (showOrbitsInput.checked) {
    for (const { planet, x, y, r } of positions) {
      // Draw ellipse approximation
      ctx.strokeStyle = planet.color + '40';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      // Simple circle approximation for orbit - use visual scaling
      ctx.arc(centerX, centerY, visualAU(planet.a) * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Draw trails
  if (showTrailsInput.checked) {
    for (const { planet, x, y } of positions) {
      if (!trails[planet.name]) trails[planet.name] = [];
      // Store real positions for trails
      trails[planet.name].push({ x, y });
      if (trails[planet.name].length > 300) trails[planet.name].shift();

      if (trails[planet.name].length > 1) {
        ctx.strokeStyle = planet.color + '80';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < trails[planet.name].length; i++) {
          const trailPos = trails[planet.name][i];
          const trailR = Math.sqrt(trailPos.x * trailPos.x + trailPos.y * trailPos.y);
          const angle = Math.atan2(trailPos.y, trailPos.x);
          const visualR = visualAU(trailR / AU_KM * 149597870.7); // convert back to AU
          const tx = centerX + visualR * scale * Math.cos(angle);
          const ty = centerY + visualR * scale * Math.sin(angle);
          if (i === 0) ctx.moveTo(tx, ty);
          else ctx.lineTo(tx, ty);
        }
        ctx.stroke();
      }
    }
  }

  // Draw Sun
  const sunSize = Math.max(12, Math.min(30, w * 0.025));
  const sunGradient = ctx.createRadialGradient(centerX - sunSize * 0.3, centerY - sunSize * 0.3, 0, centerX, centerY, sunSize);
  sunGradient.addColorStop(0, '#fff8e7');
  sunGradient.addColorStop(0.3, '#ffcc00');
  sunGradient.addColorStop(0.7, '#ff8800');
  sunGradient.addColorStop(1, '#cc4400');
  ctx.fillStyle = sunGradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, sunSize, 0, Math.PI * 2);
  ctx.fill();

  // Sun glow
  ctx.shadowColor = '#ffcc00';
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(centerX, centerY, sunSize * 1.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 204, 0, 0.1)';
  ctx.fill();
  ctx.shadowBlur = 0;

  // Sun label
  if (showLabelsInput.checked) {
    ctx.fillStyle = colors.fg;
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('☉ Sun', centerX, centerY + sunSize + 18);
  }

  // Draw planets
  let hoveredPlanet = null;
  const mouseX = planetInfoEl._mouseX || 0;
  const mouseY = planetInfoEl._mouseY || 0;

  for (const { planet, x, y, r, nu } of positions) {
    // Apply visual scaling to position
    const angle = Math.atan2(y, x);
    const visualR = visualAU(r / AU_KM * 149597870.7); // convert r from km to AU
    const px = centerX + visualR * scale * Math.cos(angle);
    const py = centerY + visualR * scale * Math.sin(angle);

    // Planet size (scaled for visibility)
    let pSize = Math.max(4, Math.min(20, planet.radius * 2 * viewScale));
    if (planet.name === 'Jupiter') pSize = Math.max(8, Math.min(35, 15 * viewScale));
    if (planet.name === 'Saturn') pSize = Math.max(7, Math.min(30, 12 * viewScale));

    // Check hover
    const dist = Math.hypot(px - mouseX, py - mouseY);
    if (dist < pSize + 4) hoveredPlanet = { planet, px, py, x, y, r, nu };

    // Draw planet
    const pGradient = ctx.createRadialGradient(px - pSize * 0.3, py - pSize * 0.3, 0, px, py, pSize);
    // Use planet color with lighter/darker variants
    pGradient.addColorStop(0, lightenColor(planet.color, 0.3));
    pGradient.addColorStop(0.5, planet.color);
    pGradient.addColorStop(1, darkenColor(planet.color, 0.3));
    ctx.fillStyle = pGradient;
    ctx.beginPath();
    ctx.arc(px, py, pSize, 0, Math.PI * 2);
    ctx.fill();

    // Saturn's rings
    if (planet.name === 'Saturn') {
      ctx.strokeStyle = '#c9b896';
      ctx.lineWidth = Math.max(1, pSize * 0.3);
      ctx.beginPath();
      ctx.ellipse(px, py, pSize * 1.8, pSize * 0.6, 0.3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Label
    if (showLabelsInput.checked) {
      ctx.fillStyle = colors.fg;
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(planet.name.charAt(0), px, py + pSize + 14);
    }
  }

  // Show planet info on hover
  if (hoveredPlanet) {
    showPlanetInfo(hoveredPlanet);
  } else {
    planetInfoEl.classList.remove('visible');
  }

  // Draw legend
  drawLegend();
}

function lightenColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.floor((num >> 16) + 255 * amount));
  const g = Math.min(255, Math.floor(((num >> 8) & 0xFF) + 255 * amount));
  const b = Math.min(255, Math.floor((num & 0xFF) + 255 * amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function darkenColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.floor((num >> 16) * (1 - amount)));
  const g = Math.max(0, Math.floor(((num >> 8) & 0xFF) * (1 - amount)));
  const b = Math.max(0, Math.floor((num & 0xFF) * (1 - amount)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function showPlanetInfo({ planet, px, py, x, y, r, nu }) {
  const distanceAU = r;
  const distanceKm = distanceAU * AU_KM;
  const speed = Math.sqrt(
    (2 * Math.PI * planet.a * AU_KM / (planet.period * 86400)) ** 2
  );
  // Actual orbital speed at current position
  const v = Math.sqrt(GM_SUN * (2 / (distanceKm) - 1 / (planet.a * AU_KM)));

  planetInfoEl.innerHTML = `
    <div class="name">${planet.name}</div>
    <div class="detail">Distance: ${distanceAU.toFixed(4)} AU (${(distanceKm / 1e6).toFixed(1)} Mkm)</div>
    <div class="detail">Orbital Speed: ${v.toFixed(1)} km/s</div>
    <div class="detail">Period: ${planet.period.toFixed(1)} days</div>
    <div class="detail">True Anomaly: ${(nu * RAD_TO_DEG).toFixed(2)}°</div>
    <div class="detail">Eccentricity: ${planet.e}</div>
    <div class="detail">Inclination: ${planet.i.toFixed(4)}°</div>
  `;

  planetInfoEl.style.left = (px + 20) + 'px';
  planetInfoEl.style.top = (py - 10) + 'px';
  planetInfoEl.classList.add('visible');
}

function drawLegend() {
  legendEl.innerHTML = '';
  for (const planet of PLANETS) {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <span class="legend-color" style="background: ${planet.color}"></span>
      <span>${planet.name}</span>
    `;
    legendEl.appendChild(item);
  }
}

function animate(time) {
  if (!running) return;
  if (!lastTime) lastTime = time;
  const dt = (time - lastTime) / 1000 * timeScale;
  lastTime = time;

  currentJD += dt / 86400;
  updateInputsFromJD(currentJD);

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
  const jd = getJDFromInputs();
  currentJD = jd !== null ? jd : J2000;
  trails = {};
  updateInputsFromJD(currentJD);
  draw();
}

function setNow() {
  const now = new Date();
  const jd = dateToJD(now.getUTCDate(), now.getUTCMonth() + 1, now.getUTCFullYear()) +
    (now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds()) / 86400;
  currentJD = jd;
  trails = {};
  updateInputsFromJD(currentJD);
  draw();
}

function init() {
  resizeCanvas();
  const jd = getJDFromInputs();
  currentJD = jd !== null ? jd : J2000;
  updateInputsFromJD(currentJD);
  draw();

  // Initialize time scale display
  timeScaleVal.textContent = timeScaleInput.value + '×';
  viewScaleVal.textContent = viewScaleInput.value + '×';

  // Event listeners
  dateInput.addEventListener('change', () => {
    const jd = getJDFromInputs();
    if (jd !== null) {
      currentJD = jd;
      trails = {};
      updateInputsFromJD(currentJD);
      draw();
    }
  });

  jdInput.addEventListener('change', () => {
    const jd = parseFloat(jdInput.value);
    if (!isNaN(jd)) {
      currentJD = jd;
      trails = {};
      updateInputsFromJD(currentJD);
      draw();
    }
  });

  timeScaleInput.addEventListener('input', (e) => {
    timeScale = parseFloat(e.target.value);
    timeScaleVal.textContent = timeScale + '×';
  });

  viewScaleInput.addEventListener('input', (e) => {
    viewScale = parseFloat(e.target.value);
    viewScaleVal.textContent = viewScale + '×';
    draw();
  });

  showOrbitsInput.addEventListener('change', draw);
  showTrailsInput.addEventListener('change', () => { if (!showTrailsInput.checked) trails = {}; draw(); });
  showLabelsInput.addEventListener('change', draw);

  playPauseBtn.addEventListener('click', togglePlayPause);
  resetBtn.addEventListener('click', reset);
  nowBtn.addEventListener('click', setNow);

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.date) {
        const parsed = parseDate(btn.dataset.date);
        if (parsed) currentJD = dateToJD(parsed.day, parsed.month, parsed.year);
      }
      trails = {};
      updateInputsFromJD(currentJD);
      draw();
    });
  });

  // Mouse tracking for hover info
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    planetInfoEl._mouseX = e.clientX - rect.left;
    planetInfoEl._mouseY = e.clientY - rect.top;
  });
  canvas.addEventListener('mouseleave', () => {
    planetInfoEl._mouseX = -9999;
    planetInfoEl._mouseY = -9999;
  });

  window.addEventListener('resize', () => { resizeCanvas(); draw(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseAnimation(); });
}

init();