"use strict";

function packetAtTime(packet, time) {
  const {x, y, kx, ky, sigma, phase} = packet;
  const spread = time / (sigma * sigma);
  const profile = 1 / (sigma * sigma * (1 + spread * spread));
  return {
    x: x + kx * time, y: y + ky * time, kx, ky,
    profile, chirp: spread * profile,
    amplitude: Math.sqrt(profile / Math.PI),
    phase: phase + (kx * kx + ky * ky) * time / 2 - Math.atan(spread),
  };
}

// Evaluate the coherent sum and its spatial gradient at a single point.
function waveAt(x, y, states, out) {
  let re = 0, im = 0, dxRe = 0, dxIm = 0, dyRe = 0, dyIm = 0;
  let incoherentDensity = 0, envelopeProduct = 1;
  for (const state of states) {
    const dx = x - state.x, dy = y - state.y;
    const distance = dx * dx + dy * dy;
    const amplitude = state.amplitude * Math.exp(-state.profile * distance / 2);
    incoherentDensity += amplitude * amplitude;
    envelopeProduct *= amplitude;
    const phase = state.phase + state.kx * dx + state.ky * dy + state.chirp * distance / 2;
    const a = amplitude * Math.cos(phase);
    const b = amplitude * Math.sin(phase);
    const phaseX = state.kx + state.chirp * dx;
    const phaseY = state.ky + state.chirp * dy;
    re += a;
    im += b;
    dxRe += -state.profile * dx * a - phaseX * b;
    dxIm += -state.profile * dx * b + phaseX * a;
    dyRe += -state.profile * dy * a - phaseY * b;
    dyIm += -state.profile * dy * b + phaseY * a;
  }
  const density = re * re + im * im;
  out.re = re;
  out.im = im;
  out.density = density;
  out.incoherentDensity = incoherentDensity;
  out.overlap = 2 * envelopeProduct;
  out.jx = re * dxIm - im * dxRe;
  out.jy = re * dyIm - im * dyRe;
  return out;
}

function render(canvas, context) {
  // One segment per step. Old pixels retain 93% of their opacity.
  const coolColors = [
    "rgba(94,234,212,.5)", "rgba(94,234,212,.34)", "rgba(125,211,252,.22)",
    "rgba(147,197,253,.28)", "rgba(186,230,253,.4)", "rgba(202,239,255,.54)"
  ];
  const goldColors = ["rgba(233,167,64,.45)", "rgba(251,191,60,.67)", "rgba(255,218,130,.87)"];
  const colors = [...coolColors, ...goldColors];
  const thresholds = [.35, .7, 1.05, 1.4, 2.3];
  const opacityLevels = [.36, .68, 1];
  const buckets = opacityLevels.map(() => colors.map(() => []));
  const goldThreshold = .061;
  const shoulderThreshold = .115;
  const packetInterval = .78;
  const playheadStep = .0045;
  const interactionSlowdown = .52;
  const displayStep = 1000 / 60;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const velocity = {};
  const seedSample = {};
  let width, height, scale, originX, packets;
  let firstTime, lastTime, speedReference, cohortCount, tracersPerCohort;
  let meetingTime, overlapWidth;
  let cohorts = [];
  let random, overlapRandom;
  let lastFrame = 0, elapsed = 0, frameRequest = 0;
  let visible = false, ready = false;

  function seededRandom(seed) {
    return () => {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function spawn(tracer, states, random) {
    for (let i = 0; i < 12; i++) {
      const state = states[random() < .5 ? 0 : 1];
      const angle = 2 * Math.PI * random();
      const radius = Math.sqrt(-Math.log(1 - random()) / state.profile);
      tracer.x = state.x + radius * Math.cos(angle);
      tracer.y = state.y + radius * Math.sin(angle);
      const proposal = states.reduce((sum, square) =>
        sum + square.amplitude ** 2 * Math.exp(-square.profile *
          ((tracer.x - square.x) ** 2 + (tracer.y - square.y) ** 2)), 0);
      const {density} = waveAt(tracer.x, tracer.y, states, seedSample);
      if (2 * proposal * random() <= density) break;
    }
    tracer.life = 145 + 220 * random();
  }

  // Slow the display clock near each encounter while retaining the flow of
  // newly arriving pairs. The velocity field still uses physical time.
  function modelTime(playhead) {
    return playhead - interactionSlowdown * overlapWidth *
      Math.tanh((playhead - meetingTime) / overlapWidth);
  }

  function placeCohort(cohort, playhead) {
    const time = modelTime(playhead);
    const states = packets.map(packet => packetAtTime(packet, time));
    cohort.playhead = playhead;
    cohort.overlapTracers = null;
    for (const tracer of cohort.tracers) spawn(tracer, states, random);
  }

  function trace(tracers, {start, middle, dt, level, peakDensity}, random, extra = false) {
    for (const tracer of tracers) {
      const {x, y} = tracer;
      const initial = waveAt(x, y, start, velocity);
      if (initial.density < 1e-6 || --tracer.life < 0) {
        spawn(tracer, start, random);
        continue;
      }
      const midX = x + dt / 2 * initial.jx / initial.density;
      const midY = y + dt / 2 * initial.jy / initial.density;
      const mid = waveAt(midX, midY, middle, velocity);
      const ux = mid.jx / mid.density, uy = mid.jy / mid.density;
      const speed = Math.hypot(ux, uy);
      // Near interference nodes, replace the tracer instead of drawing a jump.
      if (mid.density < 1e-6 || !Number.isFinite(speed) || speed > 25) {
        spawn(tracer, middle, random);
        continue;
      }
      tracer.x += ux * dt;
      tracer.y += uy * dt;

      const px = originX + scale * x, py = height / 2 - scale * y;
      if (px < -4 || px > width + 4 || py < -4 || py > height + 4) continue;
      // Positive cross terms mark constructive interference between the two packets.
      const interference = (mid.density - mid.incoherentDensity) / peakDensity;
      let color = 0;
      if (extra) {
        const overlap = mid.overlap / peakDensity;
        if (overlap < shoulderThreshold || interference >= goldThreshold) continue;
        color = overlap < .36 ? 1 : 0;
      } else if (interference >= goldThreshold) {
        color = coolColors.length + Math.min(goldColors.length - 1, Math.floor((interference - goldThreshold) / .20));
      } else {
        while (color < thresholds.length && speed / speedReference >= thresholds[color]) color++;
      }
      buckets[level][color].push(px, py, originX + scale * tracer.x, height / 2 - scale * tracer.y);
    }
  }

  function advance() {
    for (const level of buckets) for (const bucket of level) bucket.length = 0;
    for (const cohort of cohorts) {
      const {playhead} = cohort;
      if (playhead >= lastTime) {
        placeCohort(cohort, firstTime + (playhead - lastTime));
        continue;
      }
      // The two packets in each cohort interfere coherently. The displayed
      // cohorts are independent, staggered encounters, not one periodic state.
      const time = modelTime(playhead);
      const nextTime = modelTime(playhead + playheadStep);
      const dt = nextTime - time;
      const start = packets.map(packet => packetAtTime(packet, time));
      const middle = packets.map(packet => packetAtTime(packet, time + dt / 2));
      const peakDensity = middle[0].amplitude ** 2 + middle[1].amplitude ** 2;
      const edgeTime = Math.min(playhead - firstTime, lastTime - playhead);
      const level = edgeTime < .18 ? 0 : edgeTime < .40 ? 1 : 2;
      const step = {start, middle, dt, level, peakDensity};
      trace(cohort.tracers, step, random);
      if (Math.abs(time - meetingTime) < 1.6 * overlapWidth) {
        // Sample extra tracers from the same wave density only near the encounter.
        cohort.overlapTracers ??= Array.from({length: Math.round(tracersPerCohort * .56)}, () => {
          const tracer = {};
          spawn(tracer, start, overlapRandom);
          return tracer;
        });
        trace(cohort.overlapTracers, step, overlapRandom, true);
      } else {
        cohort.overlapTracers = null;
      }
      cohort.playhead += playheadStep;
    }
  }

  function paint() {
    context.globalCompositeOperation = "destination-out";
    context.fillStyle = "rgba(0,0,0,.07)";
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "source-over";
    for (let level = 0; level < buckets.length; level++) {
      context.globalAlpha = opacityLevels[level];
      for (let color = 0; color < colors.length; color++) {
        const segments = buckets[level][color];
        if (!segments.length) continue;
        context.lineWidth = color < coolColors.length ? 1.1 : 1.45 + .15 * (color - coolColors.length);
        context.strokeStyle = colors[color];
        context.beginPath();
        for (let i = 0; i < segments.length; i += 4) {
          context.moveTo(segments[i], segments[i + 1]);
          context.lineTo(segments[i + 2], segments[i + 3]);
        }
        context.stroke();
      }
    }
    context.globalAlpha = 1;
  }

  function configurePackets() {
    const left = originX / scale;
    const right = (width - originX) / scale;
    const ingressTime = Math.max(1.65, Math.max(left, right) / 6.4);
    const leftSpeed = (left + .9 - .12) / ingressTime;
    const rightSpeed = (right + .9 - .12) / ingressTime;
    const angle = Math.min(.72, .91 / ingressTime);
    const sigma = Math.min(1.18, .99 + .08 * (ingressTime - 1.65));
    packets = [
      {x: -.12, y: -.56, kx: leftSpeed, ky: angle, sigma, phase: 0},
      {x: .12, y: .56, kx: -rightSpeed, ky: -angle, sigma, phase: .73},
    ];
    speedReference = Math.sqrt(leftSpeed * rightSpeed);
    const [first, second] = packets;
    const dx = second.x - first.x, dy = second.y - first.y;
    const vx = first.kx - second.kx, vy = first.ky - second.ky;
    const relativeSpeed = Math.hypot(vx, vy);
    meetingTime = (dx * vx + dy * vy) / (relativeSpeed * relativeSpeed);
    overlapWidth = 2.6 * sigma / relativeSpeed;
    const padding = interactionSlowdown * overlapWidth;
    firstTime = -ingressTime - .78 - padding;
    const exitTime = Math.max((right + 1) / leftSpeed, (left + 1) / rightSpeed);
    cohortCount = Math.ceil((exitTime + .7 + padding - firstTime) / packetInterval);
    lastTime = firstTime + cohortCount * packetInterval;
    const total = Math.min(2200, Math.max(1250, Math.round(width * height / 180)));
    tracersPerCohort = Math.max(88, Math.floor(total / cohortCount));
  }

  function reset() {
    context.clearRect(0, 0, width, height);
    const warmup = 29;
    const duration = lastTime - firstTime;
    random = seededRandom(1295587);
    overlapRandom = seededRandom(4179109);
    cohorts = Array.from({length: cohortCount}, (_, index) => {
      const playhead = meetingTime - .12 + index * packetInterval;
      const wrappedTime = firstTime + (playhead - firstTime) % duration;
      const cohort = {playhead: 0, tracers: Array.from({length: tracersPerCohort}, () => ({}))};
      placeCohort(cohort, wrappedTime - warmup * playheadStep);
      return cohort;
    });
    for (let i = 0; i < warmup; i++) {
      advance();
      paint();
    }
  }

  function size() {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(bounds.width * ratio);
    const pixelHeight = Math.round(bounds.height * ratio);
    if (ready && width === bounds.width && height === bounds.height &&
        canvas.width === pixelWidth && canvas.height === pixelHeight) return;
    width = bounds.width;
    height = bounds.height;
    const compact = width <= 680;
    originX = width * (compact ? .56 : .67);
    scale = Math.min(width / (compact ? 10.7 : 14.3), height / 4.55);
    configurePackets();
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    context.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
    context.lineCap = "round";
    reset();
    ready = true;
  }

  function frame(timestamp) {
    if (lastFrame) elapsed += Math.min(40, timestamp - lastFrame);
    lastFrame = timestamp;
    while (elapsed >= displayStep) {
      elapsed -= displayStep;
      advance();
      paint();
    }
    frameRequest = requestAnimationFrame(frame);
  }

  function sync() {
    if (ready && visible && !document.hidden && !reduced.matches) {
      if (!frameRequest) frameRequest = requestAnimationFrame(frame);
    } else if (frameRequest) {
      cancelAnimationFrame(frameRequest);
      frameRequest = 0;
      lastFrame = 0;
      elapsed = 0;
    }
  }

  reduced.addEventListener("change", () => { reset(); sync(); });
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("resize", () => { size(); sync(); }, {passive: true});
  new ResizeObserver(() => { size(); sync(); }).observe(canvas);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(canvas);
  size();
}

const canvas = document.querySelector(".publications-wave-canvas");
const context = canvas?.getContext("2d");
if (context) render(canvas, context);
