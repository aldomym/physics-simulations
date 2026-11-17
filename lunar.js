// Lunar Motion Simulation using ELP 2000-82B (Chapront-Touzé & Chapront)
// Computes Moon's geocentric position in J2000 mean ecliptic frame

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const dateInput = document.getElementById('dateInput');
const jdInput = document.getElementById('jdInput');
const timeScaleInput = document.getElementById('timeScale');
const viewScaleInput = document.getElementById('viewScale');
const showTrailInput = document.getElementById('showTrail');
const playPauseBtn = document.getElementById('playPauseBtn');
const playIcon = document.getElementById('playIcon');
const playText = document.getElementById('playText');
const resetBtn = document.getElementById('resetBtn');
const nowBtn = document.getElementById('nowBtn');
const presetBtns = document.querySelectorAll('.preset-btn');

const distVal = document.getElementById('distVal');
const lonVal = document.getElementById('lonVal');
const latVal = document.getElementById('latVal');
const phaseVal = document.getElementById('phaseVal');
const illumVal = document.getElementById('illumVal');
const jdVal = document.getElementById('jdVal');
const timeScaleVal = document.getElementById('timeScaleVal');
const viewScaleVal = document.getElementById('viewScaleVal');

let running = false, lastTime = 0, animationId = null;
let currentJD = 0;
let timeScale = 100;
let viewScale = 1;
let trail = [];

// Constants
const ARCSEC_TO_RAD = Math.PI / (180 * 3600);
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const J2000 = 2451545.0; // J2000.0 epoch
const CENTURIES_PER_DAY = 1 / 36525;
const EARTH_RADIUS_KM = 6371;
const MOON_RADIUS_KM = 1737.4;

// Fundamental arguments (Simon et al. 1994, Chapront-Touzé & Chapront 1988)
// t = centuries from J2000.0
function computeFundamentalArguments(t) {
  // Mean anomalies
  const l = (485868.249036 + 1717915923.2178 * t + 31.8792 * t * t + 0.051635 * t * t * t - 0.00024470 * t * t * t * t) * ARCSEC_TO_RAD; // Moon
  const lp = (1287104.79305 + 129596581.0481 * t - 0.5532 * t * t + 0.000136 * t * t * t - 0.00001149 * t * t * t * t) * ARCSEC_TO_RAD; // Sun

  // Mean elongation of Moon from Sun
  const D = (1072260.70369 + 1602961601.2090 * t - 6.3706 * t * t + 0.006593 * t * t * t - 0.00003169 * t * t * t * t) * ARCSEC_TO_RAD;

  // Mean argument of latitude
  const F = (335779.526232 + 1739527262.8478 * t - 12.7512 * t * t - 0.001037 * t * t * t + 0.00000417 * t * t * t * t) * ARCSEC_TO_RAD;

  // Mean longitude of Moon (for longitude computation)
  const L = (2183166.56069 + 1732559343.5739 * t + 31.8792 * t * t + 0.051635 * t * t * t - 0.00024470 * t * t * t * t) * ARCSEC_TO_RAD;

  // Mean longitude of Sun
  const Lp = (1287104.79305 + 129596581.0481 * t - 0.5532 * t * t + 0.000136 * t * t * t - 0.00001149 * t * t * t * t) * ARCSEC_TO_RAD;

  return { l, lp, D, F, L, Lp };
}

// Sum periodic terms for longitude, latitude, distance
function sumSeries(series, t, l, lp, F, D) {
  let sum = 0;
  for (const term of series) {
    const arg = term.i1 * l + term.i2 * lp + term.i3 * F + term.i4 * D;
    const phase = term.B1 + term.B2 * t + term.B3 * t * t + term.B4 * t * t * t + term.B5 * t * t * t * t + term.B6 * t * t * t * t * t;
    sum += term.A * Math.sin(arg + phase * ARCSEC_TO_RAD);
  }
  return sum;
}

// Main ELP 2000-82B computation
function computeLunarPosition(jd) {
  // Convert TT to TDB (approximately TT + 32.184s, but we'll use TT for simplicity)
  // For higher accuracy, a proper TDB-TT conversion would be needed
  const t = (jd - J2000) * CENTURIES_PER_DAY;

  const args = computeFundamentalArguments(t);
  const { l, lp, D, F, L } = args;

  // Use embedded ELP data
  const data = ELP_DATA;

  // Longitude (arcseconds) - relative to mean longitude
  const deltaLon = sumSeries(data.ELP01, t, l, lp, F, D);
  const longitude = (L + deltaLon * ARCSEC_TO_RAD) % (2 * Math.PI);
  const lonDeg = (longitude * RAD_TO_DEG + 360) % 360;

  // Latitude (arcseconds)
  const latitude = sumSeries(data.ELP02, t, l, lp, F, D) * ARCSEC_TO_RAD;
  const latDeg = latitude * RAD_TO_DEG;

  // Distance (km)
  const distance = sumSeries(data.ELP03, t, l, lp, F, D);

  // Convert to Cartesian coordinates (J2000 ecliptic)
  const x = distance * Math.cos(latitude) * Math.cos(longitude);
  const y = distance * Math.cos(latitude) * Math.sin(longitude);
  const z = distance * Math.sin(latitude);

  // Sun position (approximate, for phase calculation)
  // Using mean Sun position
  const sunDist = 149597870.7; // AU in km
  const sunLon = args.Lp % (2 * Math.PI);
  const sunLat = 0; // Ecliptic latitude of Sun is ~0
  const sunX = sunDist * Math.cos(sunLon);
  const sunY = sunDist * Math.sin(sunLon);
  const sunZ = 0;

  // Phase angle
  const moonToSunX = sunX - x;
  const moonToSunY = sunY - y;
  const moonToSunZ = sunZ - z;
  const moonSunDist = Math.sqrt(moonToSunX * moonToSunX + moonToSunY * moonToSunY + moonToSunZ * moonToSunZ);

  const phaseAngle = Math.acos((x * moonToSunX + y * moonToSunY + z * moonToSunZ) / (distance * moonSunDist));
  const phaseDeg = phaseAngle * RAD_TO_DEG;

  // Illumination fraction
  const illumination = (1 + Math.cos(phaseAngle)) / 2 * 100;

  return {
    jd,
    t,
    x, y, z,
    distance,
    longitude: lonDeg,
    latitude: latDeg,
    phaseAngle: phaseDeg,
    illumination,
    sunX, sunY, sunZ
  };
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
  // Convert Gregorian calendar date to Julian Day (at 0h UT)
  // Using Fliegel & Van Flandern algorithm
  let y = year, m = month;
  if (m <= 2) { y -= 1; m += 12; }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  const jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
  return jd;
}

function jdToDate(jd) {
  // Convert Julian Day to Gregorian date
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
    if (parsed) {
      return dateToJD(parsed.day, parsed.month, parsed.year);
    }
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
  const scale = Math.min(w, h) * 0.35 * viewScale;

  // Compute current position
  const pos = computeLunarPosition(currentJD);

  // Draw Earth
  const earthSize = Math.max(15, Math.min(40, w * 0.05));
  const gradient = ctx.createRadialGradient(centerX - earthSize * 0.3, centerY - earthSize * 0.3, 0, centerX, centerY, earthSize);
  gradient.addColorStop(0, '#4a90d9');
  gradient.addColorStop(0.5, '#2a6ab8');
  gradient.addColorStop(1, '#1a4a8a');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, earthSize, 0, Math.PI * 2);
  ctx.fill();

  // Earth label
  ctx.fillStyle = colors.fg;
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Earth', centerX, centerY + earthSize + 18);

  // Draw orbit trail
  if (showTrailInput.checked && trail.length > 1) {
    ctx.strokeStyle = colors.muted + '80';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < trail.length; i++) {
      const tx = centerX + trail[i].x * scale;
      const ty = centerY + trail[i].y * scale;
      if (i === 0) ctx.moveTo(tx, ty);
      else ctx.lineTo(tx, ty);
    }
    ctx.stroke();
  }

  // Draw Moon
  const moonX = centerX + pos.x * scale / pos.distance;
  const moonY = centerY + pos.y * scale / pos.distance;
  const moonSize = Math.max(6, Math.min(16, w * 0.015));

  // Moon shadow (phase)
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonSize, 0, Math.PI * 2);
  ctx.fill();

  // Lit portion
  const phaseAngle = pos.phaseAngle * DEG_TO_RAD;
  ctx.fillStyle = '#e8e8e8';
  ctx.beginPath();
  if (phaseAngle < Math.PI / 2) {
    // Waxing
    ctx.arc(moonX, moonY, moonSize, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(moonX, moonY + moonSize);
  } else if (phaseAngle < 3 * Math.PI / 2) {
    // Waning
    ctx.arc(moonX, moonY, moonSize, Math.PI / 2, 3 * Math.PI / 2);
    ctx.lineTo(moonX, moonY - moonSize);
  } else {
    // Full
    ctx.arc(moonX, moonY, moonSize, 0, Math.PI * 2);
  }
  ctx.fill();

  // Moon label
  ctx.fillStyle = colors.fg;
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Moon', moonX, moonY + moonSize + 15);

  // Distance line
  ctx.strokeStyle = colors.muted + '60';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(moonX, moonY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Distance label
  const midX = (centerX + moonX) / 2;
  const midY = (centerY + moonY) / 2;
  ctx.fillStyle = colors.muted;
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${(pos.distance / 1000).toFixed(0)}k km`, midX, midY - 5);

  // Sun direction indicator
  const sunDist = Math.sqrt(pos.sunX * pos.sunX + pos.sunY * pos.sunY);
  const sunDirX = pos.sunX / sunDist;
  const sunDirY = pos.sunY / sunDist;
  const sunIndicatorDist = Math.min(w, h) * 0.45;
  ctx.strokeStyle = '#ffcc00';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX + sunDirX * sunIndicatorDist * 0.8, centerY + sunDirY * sunIndicatorDist * 0.8);
  ctx.lineTo(centerX + sunDirX * sunIndicatorDist, centerY + sunDirY * sunIndicatorDist);
  ctx.stroke();
  ctx.fillStyle = '#ffcc00';
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.textAlign = sunDirX > 0 ? 'left' : 'right';
  ctx.fillText('☉ Sun', centerX + sunDirX * sunIndicatorDist + (sunDirX > 0 ? 8 : -8), centerY + sunDirY * sunIndicatorDist + 4);

  // Coordinate axes
  ctx.strokeStyle = colors.muted + '40';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX - scale * 1.2, centerY);
  ctx.lineTo(centerX + scale * 1.2, centerY);
  ctx.moveTo(centerX, centerY - scale * 1.2);
  ctx.lineTo(centerX, centerY + scale * 1.2);
  ctx.stroke();

  // Labels
  ctx.fillStyle = colors.muted;
  ctx.font = '9px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('Vernal Equinox (♈)', centerX + scale * 1.1, centerY - 5);

  // Update readouts
  distVal.textContent = pos.distance.toFixed(1);
  lonVal.textContent = pos.longitude.toFixed(4);
  latVal.textContent = pos.latitude.toFixed(4);
  phaseVal.textContent = pos.phaseAngle.toFixed(2);
  illumVal.textContent = pos.illumination.toFixed(1);
  jdVal.textContent = pos.jd.toFixed(6);

  // Add to trail
  if (showTrailInput.checked) {
    trail.push({ x: pos.x / pos.distance, y: pos.y / pos.distance });
    if (trail.length > 500) trail.shift();
  }
}

function animate(time) {
  if (!running) return;
  if (!lastTime) lastTime = time;
  const dt = (time - lastTime) / 1000 * timeScale;
  lastTime = time;

  currentJD += dt / 86400; // seconds to days
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
  if (jd !== null) {
    currentJD = jd;
  } else {
    currentJD = J2000;
  }
  trail = [];
  updateInputsFromJD(currentJD);
  draw();
}

function setNow() {
  const now = new Date();
  // Convert to JD (UTC)
  const jd = dateToJD(now.getUTCDate(), now.getUTCMonth() + 1, now.getUTCFullYear()) +
    (now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds()) / 86400;
  currentJD = jd;
  trail = [];
  updateInputsFromJD(currentJD);
  draw();
}

function init() {
  resizeCanvas();
  const jd = getJDFromInputs();
  currentJD = jd !== null ? jd : J2000;
  updateInputsFromJD(currentJD);
  draw();

  console.log('ELP 2000-82B data loaded:', {
    ELP01: ELP_DATA.ELP01.length,
    ELP02: ELP_DATA.ELP02.length,
    ELP03: ELP_DATA.ELP03.length
  });

  // Event listeners
  dateInput.addEventListener('change', () => {
    const jd = getJDFromInputs();
    if (jd !== null) {
      currentJD = jd;
      trail = [];
      updateInputsFromJD(currentJD);
      draw();
    }
  });

  jdInput.addEventListener('change', () => {
    const jd = parseFloat(jdInput.value);
    if (!isNaN(jd)) {
      currentJD = jd;
      trail = [];
      updateInputsFromJD(currentJD);
      draw();
    }
  });

  timeScaleInput.addEventListener('input', (e) => {
    timeScale = parseFloat(e.target.value);
    timeScaleVal.textContent = timeScale + '×';
  });

  // Initialize time scale display
  timeScaleVal.textContent = timeScaleInput.value + '×';

  viewScaleInput.addEventListener('input', (e) => {
    viewScale = parseFloat(e.target.value);
    viewScaleVal.textContent = viewScale + '×';
    draw();
  });

  showTrailInput.addEventListener('change', () => {
    if (!showTrailInput.checked) trail = [];
    draw();
  });

  playPauseBtn.addEventListener('click', togglePlayPause);
  resetBtn.addEventListener('click', reset);
  nowBtn.addEventListener('click', setNow);

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.date) {
        const parsed = parseDate(btn.dataset.date);
        if (parsed) {
          currentJD = dateToJD(parsed.day, parsed.month, parsed.year);
        }
      } else if (btn.dataset.jd) {
        currentJD = parseFloat(btn.dataset.jd);
      }
      trail = [];
      updateInputsFromJD(currentJD);
      draw();
    });
  });

  window.addEventListener('resize', () => { resizeCanvas(); draw(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseAnimation(); });
}

// Start
init();