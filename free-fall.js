(() => {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  const planetSelect = document.getElementById('planet');
  const heightInput = document.getElementById('initialHeight');
  const velInput = document.getElementById('initialVelocity');
  const massInput = document.getElementById('mass');
  const areaInput = document.getElementById('crossSection');
  const cdInput = document.getElementById('dragCoeff');
  const mediumSelect = document.getElementById('mediumPreset');
  const densityInput = document.getElementById('mediumDensity');
  const dtInput = document.getElementById('timeStep');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const playIcon = document.getElementById('playIcon');
  const playText = document.getElementById('playText');
  const resetBtn = document.getElementById('resetBtn');
  const airRadios = document.querySelectorAll('input[name="airResistance"]');

  const timeVal = document.getElementById('timeVal');
  const heightReadoutVal = document.getElementById('heightReadoutVal');
  const velReadoutVal = document.getElementById('velReadoutVal');
  const termVelVal = document.getElementById('termVelVal');
  const impactTimeVal = document.getElementById('impactTimeVal');
  const impactVelVal = document.getElementById('impactVelVal');
  const distFallenVal = document.getElementById('distFallenVal');
  const heightVal = document.getElementById('heightVal');
  const velVal = document.getElementById('velVal');
  const massVal = document.getElementById('massVal');
  const areaVal = document.getElementById('areaVal');
  const cdVal = document.getElementById('cdVal');
  const densityVal = document.getElementById('densityVal');
  const dtVal = document.getElementById('dtVal');

  const paramsAir = document.getElementById('paramsAir');
  const densityGroup = document.getElementById('densityGroup');

  let g = 9.81, h0 = 100.0, v0 = 0.0, m = 1.0, A = 0.01, Cd = 0.47, rho = 1.225, dt = 0.01;
  let running = false, lastTime = 0, animationId = null;
  let y = 0, v = 0, simTime = 0;
  let airResistance = true;
  let mediumPreset = 'air';
  let history = [];
  let maxHistoryPoints = 1000;
  let impactTime = null, impactVelocity = null;
  let vacuumY = 0, vacuumV = 0;
  let showVacuum = false;

  const planetNames = {
    '9.81': 'earth',
    '1.62': 'moon',
    '3.71': 'mars',
    '24.79': 'jupiter',
    '8.87': 'venus',
    '3.70': 'mercury',
    '10.44': 'saturn',
    '8.69': 'uranus',
    '11.15': 'neptune',
    '0.62': 'pluto'
  };

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

  function getAcceleration(v, withAir) {
    let a = -g;
    if (withAir && airResistance) {
      const dragForce = 0.5 * rho * Cd * A * v * v;
      a += dragForce / m * (v > 0 ? -1 : 1);
    }
    return a;
  }

  function step(dtStep) {
    const a = getAcceleration(v, true);
    y += v * dtStep + 0.5 * a * dtStep * dtStep;
    const aNew = getAcceleration(v + a * dtStep, true);
    v += 0.5 * (a + aNew) * dtStep;
    simTime += dtStep;

    // Vacuum comparison
    const aVac = -g;
    vacuumY += vacuumV * dtStep + 0.5 * aVac * dtStep * dtStep;
    vacuumV += aVac * dtStep;
  }

  function getTerminalVelocity() {
    if (!airResistance || rho === 0) return Infinity;
    return Math.sqrt((2 * m * g) / (rho * Cd * A));
  }

  function draw() {
    const colors = getColors();
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);

    const groundY = h - 30;
    const skyH = groundY - 20;
    const maxH = Math.max(h0, 10);

    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, groundY);
    grad.addColorStop(0, colors.bg);
    grad.addColorStop(1, colors.elevated);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, groundY);

    // Ground
    ctx.fillStyle = colors.elevated;
    ctx.fillRect(0, groundY, w, 30);

    // Ground texture
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(w, groundY);
    ctx.stroke();

    // Height markers
    ctx.fillStyle = colors.muted;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const markerH = (i / 5) * maxH;
      const markerY = groundY - (markerH / maxH) * skyH;
      ctx.fillText(`${markerH.toFixed(0)} m`, 50, markerY + 4);
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 0.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(50, markerY);
      ctx.lineTo(w - 20, markerY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Object position
    const objY = groundY - (y / maxH) * skyH;
    const objX = w / 2;
    const objSize = Math.max(15, Math.min(40, w * 0.05));

    // Trail
    if (history.length > 1) {
      ctx.strokeStyle = colors.accent + '80';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < history.length; i++) {
        const py = groundY - (history[i].y / maxH) * skyH;
        const px = objX + Math.sin(i * 0.3) * 5;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Vacuum comparison object
    if (showVacuum && airResistance) {
      const vacY = groundY - (vacuumY / maxH) * skyH;
      ctx.fillStyle = colors.muted + '80';
      ctx.fillRect(objX + objSize + 10, vacY - objSize / 2, objSize, objSize);
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(objX + objSize + 10, vacY - objSize / 2, objSize, objSize);
      ctx.fillStyle = colors.muted;
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('Vacuum', objX + objSize + 10, vacY - objSize / 2 - 5);
    }

    // Falling object
    ctx.fillStyle = colors.accent;
    ctx.fillRect(objX - objSize / 2, objY - objSize / 2, objSize, objSize);
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(objX - objSize / 2, objY - objSize / 2, objSize, objSize);

    // Velocity vector
    if (Math.abs(v) > 0.1) {
      const arrowLen = Math.min(Math.abs(v) * 2, 80);
      ctx.strokeStyle = colors.fg;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(objX, objY);
      ctx.lineTo(objX, objY + (v > 0 ? arrowLen : -arrowLen));
      ctx.stroke();
      // Arrow head
      const ay = objY + (v > 0 ? arrowLen : -arrowLen);
      ctx.beginPath();
      ctx.moveTo(objX - 6, ay - (v > 0 ? -10 : 10));
      ctx.lineTo(objX, ay);
      ctx.lineTo(objX + 6, ay - (v > 0 ? -10 : 10));
      ctx.stroke();
    }

    // Labels
    ctx.fillStyle = colors.fg;
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`y = ${y.toFixed(2)} m`, objX, objY - objSize / 2 - 15);
    ctx.fillText(`v = ${v.toFixed(2)} m/s`, objX, objY + objSize / 2 + 25);

    // Time
    ctx.fillStyle = colors.muted;
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`t = ${simTime.toFixed(2)} s`, w - 10, h - 10);

    // Legend
    ctx.fillStyle = colors.accent;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('With Air', 10, 20);
    if (showVacuum && airResistance) {
      ctx.fillStyle = colors.muted;
      ctx.fillText('Vacuum', 10, 35);
    }
  }

  function animate(time) {
    if (!running) return;
    if (!lastTime) lastTime = time;
    const dtFrame = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    const steps = Math.max(1, Math.ceil(dtFrame / dt));
    const subDt = dtFrame / steps;
    for (let i = 0; i < steps; i++) {
      if (y > 0) {
        step(subDt);
        history.push({ y: Math.max(0, y), v, t: simTime });
        if (history.length > maxHistoryPoints) history.shift();
      } else if (impactTime === null) {
        impactTime = simTime;
        impactVelocity = v;
        y = 0;
        v = 0;
      }
    }

    updateReadouts();
    draw();
    animationId = requestAnimationFrame(animate);
  }

  function updateReadouts() {
    timeVal.textContent = simTime.toFixed(2);
    heightReadoutVal.textContent = Math.max(0, y).toFixed(2);
    velReadoutVal.textContent = v.toFixed(2);

    const termV = getTerminalVelocity();
    if (termV === Infinity) {
      termVelVal.textContent = '∞';
    } else {
      termVelVal.textContent = termV.toFixed(2);
    }

    if (impactTime !== null) {
      impactTimeVal.textContent = impactTime.toFixed(2);
      impactVelVal.textContent = impactVelocity.toFixed(2);
    } else {
      // Predict impact time
      if (v < 0) {
        // Approximate with terminal velocity
        const predTime = simTime + y / Math.abs(v);
        impactTimeVal.textContent = `~${predTime.toFixed(2)}`;
        impactVelVal.textContent = `~${getTerminalVelocity() === Infinity ? Math.sqrt(v*v + 2*g*y) : getTerminalVelocity()}`;
      } else {
        impactTimeVal.textContent = '—';
        impactVelVal.textContent = '—';
      }
    }

    distFallenVal.textContent = (h0 - Math.max(0, y)).toFixed(2);
  }

  function startAnimation() {
    running = true;
    lastTime = 0;
    playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    playText.textContent = window.I18N?.t('pause') || 'Pause';
    animationId = requestAnimationFrame(animate);
  }

  function pauseAnimation() {
    running = false;
    if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
    playIcon.innerHTML = '<path d="M5 4v16l14-8-14-8z"/>';
    playText.textContent = window.I18N?.t('play') || 'Play';
  }

  function togglePlayPause() { if (running) pauseAnimation(); else startAnimation(); }

  function reset() {
    pauseAnimation();
    y = parseFloat(heightInput.value);
    v = parseFloat(velInput.value);
    simTime = 0;
    vacuumY = y;
    vacuumV = v;
    history = [{ y, v, t: 0 }];
    impactTime = null;
    impactVelocity = null;
    updateReadouts();
    draw();
  }

  function updateParams() {
    g = parseFloat(planetSelect.value);
    h0 = parseFloat(heightInput.value);
    v0 = parseFloat(velInput.value);
    m = parseFloat(massInput.value);
    A = parseFloat(areaInput.value);
    Cd = parseFloat(cdInput.value);
    rho = parseFloat(densityInput.value);
    dt = parseFloat(dtInput.value);

    // Update planet name display if custom
    if (g === 0) {
      // Custom gravity - would need an input, for now just use 9.81
      g = 9.81;
    }

    heightVal.textContent = h0.toFixed(1);
    velVal.textContent = v0.toFixed(1);
    massVal.textContent = m.toFixed(2);
    areaVal.textContent = A.toFixed(3);
    cdVal.textContent = Cd.toFixed(2);
    densityVal.textContent = rho.toFixed(3);
    dtVal.textContent = dt.toFixed(3);

    // Show/hide air resistance params
    if (airResistance) {
      paramsAir.classList.add('visible');
      densityGroup.style.display = 'block';
    } else {
      paramsAir.classList.remove('visible');
      densityGroup.style.display = 'none';
    }

    if (!running) reset();
  }

  function setAirResistance(val) {
    airResistance = val === 'on';
    if (airResistance) {
      paramsAir.classList.add('visible');
      densityGroup.style.display = 'block';
    } else {
      paramsAir.classList.remove('visible');
      densityGroup.style.display = 'none';
    }
    if (!running) reset();
  }

  function setMediumPreset(preset) {
    mediumPreset = preset;
    switch (preset) {
      case 'vacuum':
        rho = 0;
        break;
      case 'air':
        rho = 1.225;
        break;
      case 'water':
        rho = 997;
        break;
      case 'glycerin':
        rho = 1260;
        break;
      case 'custom':
      default:
        // Keep current value
        break;
    }
    densityInput.value = rho;
    densityVal.textContent = rho.toFixed(3);
    if (!running) reset();
  }

  function updateMediumPresetOptions(lang) {
    // This is called from HTML script on language change
    // The i18n system handles the option text updates
  }

  // Event listeners
  planetSelect.addEventListener('change', updateParams);
  heightInput.addEventListener('input', updateParams);
  velInput.addEventListener('input', updateParams);
  massInput.addEventListener('input', updateParams);
  areaInput.addEventListener('input', updateParams);
  cdInput.addEventListener('input', updateParams);
  densityInput.addEventListener('input', updateParams);
  dtInput.addEventListener('input', updateParams);
  mediumSelect.addEventListener('change', (e) => setMediumPreset(e.target.value));

  airRadios.forEach(radio => radio.addEventListener('change', (e) => setAirResistance(e.target.value)));

  playPauseBtn.addEventListener('click', togglePlayPause);
  resetBtn.addEventListener('click', reset);

  window.addEventListener('resize', () => { resizeCanvas(); draw(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseAnimation(); });

  function init() { resizeCanvas(); updateParams(); draw(); }
  init();
})();