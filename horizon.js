// Horizon Visibility Simulation
// Computes visible distance accounting for Earth curvature and atmospheric refraction

// Use shared i18n module
function t(key) {
  return window.I18N?.t(key, window.I18N.currentLanguage?.()) || key;
}

function getCurrentLanguage() {
  return window.I18N?.currentLanguage?.() || 'en';
}

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Inputs
const obsHeightInput = document.getElementById('obsHeightInput');
const latInput = document.getElementById('latInput');
const lonInput = document.getElementById('lonInput');
const targetHeightInput = document.getElementById('targetHeightInput');
const targetDistInput = document.getElementById('targetDistInput');
const refractionSelect = document.getElementById('refractionSelect');
const customKInput = document.getElementById('customKInput');
const customKControl = document.getElementById('customKControl');
const tempInput = document.getElementById('tempInput');
const pressureInput = document.getElementById('pressureInput');

// Value displays
const obsHeightVal = document.getElementById('obsHeightVal');
const latVal = document.getElementById('latVal');
const lonVal = document.getElementById('lonVal');
const targetHeightVal = document.getElementById('targetHeightVal');
const targetDistVal = document.getElementById('targetDistVal');
const customKVal = document.getElementById('customKVal');
const tempVal = document.getElementById('tempVal');
const pressureVal = document.getElementById('pressureVal');

// Results
const horizonDistVal = document.getElementById('horizonDistVal');
const dipAngleVal = document.getElementById('dipAngleVal');
const hiddenHeightVal = document.getElementById('hiddenHeightVal');
const visibleHeightVal = document.getElementById('visibleHeightVal');
const targetVisibleVal = document.getElementById('targetVisibleVal');
const effRadiusVal = document.getElementById('effRadiusVal');

// View mode
const viewRadios = document.querySelectorAll('input[name="view"]');

// Controls
const resetBtn = document.getElementById('resetBtn');

// Presets
const presetSeaLevel = document.getElementById('presetSeaLevel');
const presetBuilding = document.getElementById('presetBuilding');
const presetMountain = document.getElementById('presetMountain');
const presetPlane = document.getElementById('presetPlane');
const presetISS = document.getElementById('presetISS');

// Constants
const EARTH_RADIUS = 6371000; // meters
const EARTH_RADIUS_KM = 6371; // km

// State
let obsHeight = 1.7; // meters
let lat = 45;
let lon = 0;
let targetHeight = 0;
let targetDist = 0; // km
let refractionModel = 'standard';
let customK = 4/3;
let temperature = 15; // °C
let pressure = 1013; // hPa
let viewMode = 'profile';

let viewScale = 1;
let viewOffsetX = 0;
let viewOffsetY = 0;
let isDragging = false;
let lastMouseX = 0, lastMouseY = 0;

// Refraction models
const refractionModels = {
  standard: 4/3,    // Standard atmospheric refraction
  none: 1,          // No refraction
  super: 7/6,       // Super-refraction (ducting)
  sub: 1.15,        // Sub-refraction
  custom: 4/3
};

function getKFactor() {
  if (refractionModel === 'custom') return customK;
  return refractionModels[refractionModel] || refractionModels.standard;
}

function getEffectiveRadius() {
  return EARTH_RADIUS * getKFactor();
}

// Distance to horizon (meters)
function horizonDistance(h, R_eff = getEffectiveRadius()) {
  if (h <= 0) return 0;
  return Math.sqrt(2 * R_eff * h + h * h);
}

// Dip angle to horizon (radians)
function dipAngle(h, R_eff = getEffectiveRadius()) {
  if (h <= 0) return 0;
  return Math.acos(R_eff / (R_eff + h));
}

// Hidden height of target at distance d (meters)
function hiddenHeight(obsH, targetDistKm, R_eff = getEffectiveRadius()) {
  const d = targetDistKm * 1000;
  if (d <= 0) return 0;

  const dHorizon = horizonDistance(obsH, R_eff);
  if (d <= dHorizon) return 0;

  // Height hidden by curvature beyond horizon
  const dBeyond = d - dHorizon;
  return (dBeyond * dBeyond) / (2 * R_eff);
}

// Visible portion of target
function visibleHeight(targetH, obsH, targetDistKm, R_eff = getEffectiveRadius()) {
  const hidden = hiddenHeight(obsH, targetDistKm, R_eff);
  return Math.max(0, targetH - hidden);
}

// Check if target is visible
function isTargetVisible(targetH, obsH, targetDistKm, R_eff = getEffectiveRadius()) {
  if (targetH <= 0 || targetDistKm <= 0) return null;
  const vis = visibleHeight(targetH, obsH, targetDistKm, R_eff);
  return vis > 0.01; // at least 1cm visible
}

// Calculate refraction coefficient from temp/pressure (approximate)
// Using standard formula: k = 1 / (1 - R * dN/dh)
// where N-refractivity depends on T, P
function calculateKFromAtmosphere(tempC, pressureHpa) {
  // Simplified: standard k at 15°C, 1013 hPa is 4/3
  // k varies roughly with P/T
  const T = tempC + 273.15;
  const P = pressureHpa;
  const kStandard = 4/3;
  const k = kStandard * (P / 1013) * (288.15 / T);
  return Math.max(1, Math.min(2, k)); // Clamp to reasonable range
}

// Update calculations and UI
function updateCalculations() {
  const lang = getCurrentLanguage();
  const R_eff = getEffectiveRadius();
  const R_eff_km = R_eff / 1000;

  const hDist = horizonDistance(obsHeight, R_eff) / 1000;
  const dip = dipAngle(obsHeight, R_eff);
  const hidden = targetDist > 0 ? hiddenHeight(obsHeight, targetDist, R_eff) : 0;
  const visible = targetHeight > 0 ? visibleHeight(targetHeight, obsHeight, targetDist, R_eff) : 0;
  const targetVis = targetHeight > 0 && targetDist > 0 ? isTargetVisible(targetHeight, obsHeight, targetDist, R_eff) : null;

  horizonDistVal.textContent = hDist.toFixed(2) + ' ' + t('km');
  dipAngleVal.textContent = (dip * 180 / Math.PI).toFixed(3) + '°';
  hiddenHeightVal.textContent = hidden.toFixed(1) + ' m';
  visibleHeightVal.textContent = visible.toFixed(1) + ' m';
  targetVisibleVal.textContent = targetVis === null ? '—' : (targetVis ? t('targetVisibleYes') : t('targetVisibleNo'));
  effRadiusVal.textContent = R_eff_km.toFixed(0) + ' km';
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

  if (viewMode === 'profile') {
    drawProfile(w, h, colors);
  } else if (viewMode === 'map') {
    drawMap(w, h, colors);
  } else if (viewMode === 'comparison') {
    drawComparison(w, h, colors);
  }
}

function drawProfile(w, h, colors) {
  const lang = getCurrentLanguage();
  const R_eff = getEffectiveRadius();
  const R_earth = EARTH_RADIUS;

  // Local tangent plane view: observer at origin, Earth curves away
  // This shows a cross-section through the observer's position

  const dHorizon = horizonDistance(obsHeight, R_eff);
  const horizonKm = dHorizon / 1000;

  // View extent: show from observer to 1.5x horizon distance (or target distance)
  const maxDistKm = Math.max(horizonKm * 1.8, targetDist * 1.3, 10);
  const maxDistM = maxDistKm * 1000;

  // Scale: horizontal pixels per meter
  const scaleX = w * 0.8 / maxDistM;
  // Vertical scale: same as horizontal for true geometry
  const scaleY = scaleX;

  // Origin: observer at left, ground level at y=0, observer at y=obsHeight
  const originX = w * 0.1;
  const originY = h * 0.7; // ground level in canvas coordinates

  // Draw Earth surface (true radius) - curve using circle equation
  // Earth center is at (0, -R_earth) in local coords
  // Surface: y = -R_earth + sqrt(R_earth^2 - x^2) ≈ -x^2/(2*R_earth) for small x

  // Draw effective Earth surface (with refraction)
  const R_eff_m = R_eff;

  // Draw Earth surface curve
  const numPoints = 200;

  // True Earth surface (green/brown)
  const earthGradient = ctx.createLinearGradient(0, originY - 200, 0, originY + 100);
  earthGradient.addColorStop(0, '#2d5a3d');
  earthGradient.addColorStop(0.5, '#1a3a2a');
  earthGradient.addColorStop(1, '#0d2b1a');

  ctx.fillStyle = earthGradient;
  ctx.beginPath();
  ctx.moveTo(originX, originY + 100); // bottom left

  for (let i = 0; i <= numPoints; i++) {
    const x = (i / numPoints) * maxDistM;
    // True Earth surface: y = R_earth - sqrt(R_earth^2 - x^2)
    // For large R_earth, use approximation: y ≈ x^2 / (2*R_earth)
    // But we want accurate curve, so use exact:
    const y = R_earth - Math.sqrt(Math.max(0, R_earth * R_earth - x * x));
    const px = originX + x * scaleX;
    const py = originY - y * scaleY;
    if (i === 0) ctx.lineTo(px, py);
    else ctx.lineTo(px, py);
  }

  ctx.lineTo(originX + maxDistM * scaleX, originY + 100);
  ctx.closePath();
  ctx.fill();

  // Earth outline (true)
  ctx.strokeStyle = colors.fg + '80';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= numPoints; i++) {
    const x = (i / numPoints) * maxDistM;
    const y = R_earth - Math.sqrt(Math.max(0, R_earth * R_earth - x * x));
    const px = originX + x * scaleX;
    const py = originY - y * scaleY;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Effective Earth surface (refraction) - dashed
  if (R_eff !== R_earth) {
    ctx.strokeStyle = colors.accent + '60';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    for (let i = 0; i <= numPoints; i++) {
      const x = (i / numPoints) * maxDistM;
      const y = R_eff_m - Math.sqrt(Math.max(0, R_eff_m * R_eff_m - x * x));
      const px = originX + x * scaleX;
      const py = originY - y * scaleY;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Label
    ctx.fillStyle = colors.accent + '80';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    const labelX = originX + 20;
    const labelY = originY - (R_eff_m - Math.sqrt(Math.max(0, R_eff_m * R_eff_m - 20000 * 20000))) * scaleY - 10;
    ctx.fillText(t('effectiveR').replace('{0}', getKFactor().toFixed(2)), labelX, labelY);
  }

  // Observer position
  const obsX = originX;
  const obsY = originY - obsHeight * scaleY;

  // Observer marker
  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.arc(obsX, obsY, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = colors.fg;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Observer label
  ctx.fillStyle = colors.fg;
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(t('observer'), obsX, obsY - 18);

  // Height label
  ctx.fillStyle = colors.muted;
  ctx.font = '9px "JetBrains Mono", monospace';
  ctx.fillText(`${obsHeight.toFixed(1)} m`, obsX, obsY + 18);

  // Horizon line (tangent from observer to effective Earth)
  const dip = dipAngle(obsHeight, R_eff);

  // Horizon point on effective Earth
  // The line of sight is tangent to effective Earth
  // At horizon distance, the effective Earth surface height is:
  const horizSurfHeight = R_eff_m - Math.sqrt(Math.max(0, R_eff_m * R_eff_m - dHorizon * dHorizon));
  const horizX = originX + dHorizon * scaleX;
  const horizY = originY - horizSurfHeight * scaleY;

  // Line of sight to horizon
  ctx.strokeStyle = colors.accent + '80';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(obsX, obsY);
  ctx.lineTo(horizX, horizY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Horizon marker
  ctx.fillStyle = colors.accent + '80';
  ctx.beginPath();
  ctx.arc(horizX, horizY, 6, 0, Math.PI * 2);
  ctx.fill();

  // Horizon distance label
  ctx.fillStyle = colors.muted;
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  const midX = (obsX + horizX) / 2;
  const midY = (obsY + horizY) / 2 - 15;
  ctx.fillText(`${t('horizonDistance')}: ${horizonKm.toFixed(1)} ${t('km')}`, midX, midY);

  // Dip angle arc at observer
  if (obsHeight > 0) {
    const arcRadius = Math.min(80, w * 0.1);
    ctx.strokeStyle = colors.muted + '60';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // Arc from horizontal (0) to line of sight (-dip)
    ctx.arc(obsX, obsY, arcRadius, 0, -dip);
    ctx.stroke();

    ctx.fillStyle = colors.muted;
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    const arcMid = -dip / 2;
    const labelX = obsX + arcRadius * 1.3 * Math.cos(arcMid);
    const labelY = obsY + arcRadius * 1.3 * Math.sin(arcMid);
    ctx.fillText(`${t('dipAngle')}: ${(dip*180/Math.PI).toFixed(2)}°`, labelX, labelY);
  }

  // Horizontal reference line from observer
  ctx.strokeStyle = colors.muted + '30';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(obsX, obsY);
  ctx.lineTo(originX + maxDistM * scaleX, obsY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = colors.muted + '60';
  ctx.font = '9px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(t('horizontal'), obsX - 5, obsY - 5);

  // Target (if set)
  if (targetHeight > 0 && targetDist > 0) {
    const targetDistM = targetDist * 1000;

    // Target base on true Earth
    const targetBaseHeight = R_earth - Math.sqrt(Math.max(0, R_earth * R_earth - targetDistM * targetDistM));
    const targetBaseX = originX + targetDistM * scaleX;
    const targetBaseY = originY - targetBaseHeight * scaleY;

    // Target top
    const targetTopY = targetBaseY - targetHeight * scaleY;

    // Draw target as vertical line
    const R_eff_calc = getEffectiveRadius();
    const hidden = hiddenHeight(obsHeight, targetDist, R_eff_calc);
    const visible = visibleHeight(targetHeight, obsHeight, targetDist, R_eff_calc);
    const isVis = isTargetVisible(targetHeight, obsHeight, targetDist, R_eff_calc);

    // Hidden portion (below line of sight)
    // Line of sight to target base at observer height
    // Actually: line of sight from observer tangent to effective Earth
    // At target distance, the line of sight height above true Earth is:
    // LOS height = obsHeight - (targetDistM^2 / (2*R_eff)) approximately
    // But more accurately: the line from observer to tangent point on effective Earth

    // Line of sight equation: y = obsHeight - x * tan(dip) approximately
    // Better: compute line of sight to effective Earth at targetDist
    const effSurfHeight = R_eff_calc - Math.sqrt(Math.max(0, R_eff_calc * R_eff_calc - targetDistM * targetDistM));
    const losHeightAtTarget = obsHeight - (targetDistM / dHorizon) * (obsHeight - effSurfHeight); // linear interp along LOS

    const losY = originY - losHeightAtTarget * scaleY;
    const hiddenTopY = Math.max(targetBaseY, losY);

    if (hidden > 0.1) {
      ctx.strokeStyle = '#e85d2a80';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(targetBaseX, targetBaseY);
      ctx.lineTo(targetBaseX, hiddenTopY);
      ctx.stroke();
    }

    // Visible portion
    if (visible > 0.1) {
      const visibleBaseY = Math.min(targetTopY, losY);
      ctx.strokeStyle = isVis ? '#4ade80' : colors.accent;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(targetBaseX, visibleBaseY);
      ctx.lineTo(targetBaseX, targetTopY);
      ctx.stroke();
    }

    // Target label
    ctx.fillStyle = colors.fg;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(t('targetLabel').replace('{0}', targetDist), targetBaseX, targetTopY - 10);

    // Line of sight to target top
    ctx.strokeStyle = colors.muted + '60';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(obsX, obsY);
    ctx.lineTo(targetBaseX, targetTopY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Distance markers
  ctx.fillStyle = colors.muted + '60';
  ctx.font = '9px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  const markerStep = Math.pow(10, Math.floor(Math.log10(maxDistKm)));
  for (let d = markerStep; d <= maxDistKm; d += markerStep) {
    const x = originX + d * 1000 * scaleX;
    ctx.strokeStyle = colors.muted + '30';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, originY - 5);
    ctx.lineTo(x, originY + 5);
    ctx.stroke();
    ctx.fillText(`${d} ${t('km')}`, x, originY + 20);
  }

  // Scale bar
  const barLengthKm = markerStep;
  const barLengthPx = barLengthKm * 1000 * scaleX;
  if (barLengthPx < w * 0.3) {
    const barX = originX;
    const barY = originY + 50;
    ctx.strokeStyle = colors.fg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(barX, barY);
    ctx.lineTo(barX + barLengthPx, barY);
    ctx.stroke();
    ctx.fillStyle = colors.muted;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${barLengthKm} ${t('km')}`, barX, barY - 5);
  }
}

function drawMap(w, h, colors) {
  const lang = getCurrentLanguage();
  const R_eff = getEffectiveRadius();
  const R_earth = EARTH_RADIUS;

  // Center
  const cx = w / 2;
  const cy = h / 2;

  // Scale to show horizon circle
  const horizonKm = horizonDistance(obsHeight, R_eff) / 1000;
  const maxViewKm = Math.max(horizonKm * 3, targetDist * 2, 100);
  const scale = Math.min(w, h) * 0.4 / (maxViewKm * 1000);

  const earthRadiusPx = R_earth * scale;

  // Draw Earth
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, earthRadiusPx);
  gradient.addColorStop(0, '#1a3a5c');
  gradient.addColorStop(0.7, '#0d2b3a');
  gradient.addColorStop(1, '#051a25');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, earthRadiusPx, 0, Math.PI * 2);
  ctx.fill();

  // Observer at center (top-down view puts observer at center)
  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = colors.fg;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Horizon circle (on effective Earth)
  const effRadiusPx = R_eff * scale;
  ctx.strokeStyle = colors.accent + '80';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, effRadiusPx, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Horizon circle (true Earth, no refraction)
  if (R_eff !== R_earth) {
    ctx.strokeStyle = '#e85d2a80';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(cx, cy, earthRadiusPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Target distance circle
  if (targetDist > 0) {
    const targetRadiusPx = targetDist * 1000 * scale;
    if (targetRadiusPx < Math.max(w, h)) {
      ctx.strokeStyle = colors.muted + '60';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, targetRadiusPx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Target marker at "north"
      const tx = cx;
      const ty = cy - targetRadiusPx;
      ctx.fillStyle = targetHeight > 0 ? (isTargetVisible(targetHeight, obsHeight, targetDist, R_eff) ? '#4ade80' : '#e85d2a') : colors.muted;
      ctx.beginPath();
      ctx.arc(tx, ty, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Labels
  ctx.fillStyle = colors.fg;
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(t('observer'), cx, cy - 18);

  ctx.fillStyle = colors.accent + '80';
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.fillText(`${t('horizonDistance')}: ${horizonKm.toFixed(1)} ${t('km')}`, cx, cy + effRadiusPx + 20);

  if (R_eff !== R_earth) {
    ctx.fillStyle = '#e85d2a80';
    const noRefrKm = (horizonDistance(obsHeight, R_earth)/1000).toFixed(1);
    ctx.fillText(`${t('noRefraction')}: ${noRefrKm} ${t('km')}`, cx, cy + effRadiusPx + 35);
  }

  // Scale
  const barLengthKm = Math.pow(10, Math.floor(Math.log10(maxViewKm)));
  const barLengthPx = barLengthKm * 1000 * scale;
  if (barLengthPx < w * 0.3) {
    const barX = 20;
    const barY = h - 40;
    ctx.strokeStyle = colors.fg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(barX, barY);
    ctx.lineTo(barX + barLengthPx, barY);
    ctx.stroke();
    ctx.fillStyle = colors.muted;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${barLengthKm} ${t('km')}`, barX, barY - 5);
  }
}

function drawComparison(w, h, colors) {
  const lang = getCurrentLanguage();
  // Show multiple refraction models side by side
  const models = [
    { key: 'none', label: t('noRefraction'), color: '#e85d2a' },
    { key: 'sub', label: t('subRefraction'), color: '#e8a85d' },
    { key: 'standard', label: t('stdRefraction'), color: colors.accent },
    { key: 'super', label: t('superRefraction'), color: '#4ade80' }
  ];

  const n = models.length;
  const panelW = w / n;
  const R_earth = EARTH_RADIUS;

  for (let i = 0; i < n; i++) {
    const model = models[i];
    const k = refractionModels[model.key];
    const R_eff = R_earth * k;

    const px = i * panelW + panelW / 2;
    const py = h * 0.5;

    const horizonKm = horizonDistance(obsHeight, R_eff) / 1000;
    const maxViewKm = horizonKm * 2;
    const scale = Math.min(panelW, h) * 0.35 / (maxViewKm * 1000);
    const earthRadiusPx = R_earth * scale;
    const effRadiusPx = R_eff * scale;

    // Panel background
    ctx.fillStyle = i % 2 === 0 ? colors.bg : colors.elevated;
    ctx.fillRect(i * panelW, 0, panelW, h);

    // Panel border
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(i * panelW + 0.5, 0.5, panelW - 1, h - 1);

    // Earth
    const gradient = ctx.createRadialGradient(px, py, 0, px, py, earthRadiusPx);
    gradient.addColorStop(0, '#1a3a2a');
    gradient.addColorStop(1, '#0d2b1a');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(px, py, earthRadiusPx, 0, Math.PI * 2);
    ctx.fill();

    // Effective Earth circle
    ctx.strokeStyle = model.color + '80';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(px, py, effRadiusPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Observer
    const obsR = R_earth + obsHeight;
    const obsAngle = -Math.PI / 2;
    const obsX = px + obsR * scale * Math.cos(obsAngle);
    const obsY = py + obsR * scale * Math.sin(obsAngle);

    ctx.fillStyle = model.color;
    ctx.beginPath();
    ctx.arc(obsX, obsY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Horizon line
    const dHorizon = horizonDistance(obsHeight, R_eff);
    const horizonAngle = dipAngle(obsHeight, R_eff);
    const horizX = px + R_eff * scale * Math.cos(obsAngle + horizonAngle);
    const horizY = py + R_eff * scale * Math.sin(obsAngle + horizonAngle);

    ctx.strokeStyle = model.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(obsX, obsY);
    ctx.lineTo(horizX, horizY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    ctx.fillStyle = colors.fg;
    ctx.font = '12px "Space Grotesk", sans-serif';
    ctx.fontWeight = '600';
    ctx.textAlign = 'center';
    ctx.fillText(model.label, px, 30);

    ctx.fillStyle = model.color;
    ctx.font = '18px "JetBrains Mono", monospace';
    ctx.fontWeight = '700';
    ctx.fillText(`${horizonKm.toFixed(1)} ${t('km')}`, px, 55);

    ctx.fillStyle = colors.muted;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(`${t('dipAngle')}: ${(dipAngle(obsHeight, R_eff)*180/Math.PI).toFixed(2)}°`, px, 75);
    ctx.fillText(`k = ${k.toFixed(2)}`, px, 90);

    // Target visibility
    if (targetHeight > 0 && targetDist > 0) {
      const hidden = hiddenHeight(obsHeight, targetDist, R_eff);
      const visible = visibleHeight(targetHeight, obsHeight, targetDist, R_eff);
      const isVis = isTargetVisible(targetHeight, obsHeight, targetDist, R_eff);

      ctx.fillStyle = isVis ? '#4ade80' : '#e85d2a';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText(isVis ? t('visible') : t('hidden'), px, h - 40);
      ctx.fillStyle = colors.muted;
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText(`${t('hiddenHeight')}: ${hidden.toFixed(1)}m`, px, h - 25);
    }
  }
}

// Event handlers
function updateParams() {
  obsHeight = parseFloat(obsHeightInput.value);
  lat = parseFloat(latInput.value);
  lon = parseFloat(lonInput.value);
  targetHeight = parseFloat(targetHeightInput.value);
  targetDist = parseFloat(targetDistInput.value);
  refractionModel = refractionSelect.value;
  customK = parseFloat(customKInput.value);
  temperature = parseFloat(tempInput.value);
  pressure = parseFloat(pressureInput.value);

  obsHeightVal.textContent = obsHeight.toFixed(obsHeight < 10 ? 2 : 1);
  latVal.textContent = lat.toFixed(1);
  lonVal.textContent = lon.toFixed(1);
  targetHeightVal.textContent = targetHeight.toFixed(0);
  targetDistVal.textContent = targetDist.toFixed(0);
  customKVal.textContent = customK.toFixed(2);
  tempVal.textContent = temperature.toFixed(0);
  pressureVal.textContent = pressure.toFixed(0);

  customKControl.style.display = refractionModel === 'custom' ? 'block' : 'none';

  updateCalculations();
  draw();
}

function applyPreset(height) {
  obsHeight = height;
  obsHeightInput.value = height;
  updateParams();
}

function resetView() {
  viewScale = 1;
  viewOffsetX = 0;
  viewOffsetY = 0;
  draw();
}

function init() {
  resizeCanvas();
  updateParams();

  // Event listeners
  obsHeightInput.addEventListener('input', updateParams);
  latInput.addEventListener('input', updateParams);
  lonInput.addEventListener('input', updateParams);
  targetHeightInput.addEventListener('input', updateParams);
  targetDistInput.addEventListener('input', updateParams);
  refractionSelect.addEventListener('change', updateParams);
  customKInput.addEventListener('input', updateParams);
  tempInput.addEventListener('input', updateParams);
  pressureInput.addEventListener('input', updateParams);

  // Presets
  presetSeaLevel.addEventListener('click', () => applyPreset(1.7));
  presetBuilding.addEventListener('click', () => applyPreset(50));
  presetMountain.addEventListener('click', () => applyPreset(2000));
  presetPlane.addEventListener('click', () => applyPreset(10000));
  presetISS.addEventListener('click', () => applyPreset(400000));

  // View modes
  viewRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      viewMode = e.target.value;
      draw();
    });
  });

  resetBtn.addEventListener('click', resetView);

  // Mouse drag for panning (profile view)
  canvas.addEventListener('mousedown', (e) => {
    if (viewMode === 'profile') {
      isDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      canvas.style.cursor = 'grabbing';
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (isDragging) {
      viewOffsetX += e.clientX - lastMouseX;
      viewOffsetY += e.clientY - lastMouseY;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      draw();
    }
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    canvas.style.cursor = 'default';
  });

  // Wheel zoom
  canvas.addEventListener('wheel', (e) => {
    if (viewMode === 'profile') {
      e.preventDefault();
      const zoom = e.deltaY > 0 ? 0.9 : 1.1;
      viewScale *= zoom;
      viewScale = Math.max(0.1, Math.min(10, viewScale));
      draw();
    }
  }, { passive: false });

  window.addEventListener('resize', () => { resizeCanvas(); draw(); });

  // Handle language change for canvas redraw
  window.onLanguageChange = function(lang) {
    draw();
  };
}

init();