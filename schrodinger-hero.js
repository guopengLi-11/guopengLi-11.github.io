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
  for (const state of states) {
    const dx = x - state.x, dy = y - state.y;
    const distance = dx * dx + dy * dy;
    const amplitude = state.amplitude * Math.exp(-state.profile * distance / 2);
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
  out.jx = re * dxIm - im * dxRe;
  out.jy = re * dyIm - im * dyRe;
  return out;
}

function render(canvas, context) {
  // One 1.1 px segment per step. Old pixels retain 93% of their opacity.
  const colors = [
    "rgba(94,234,212,.5)", "rgba(94,234,212,.34)", "rgba(125,211,252,.22)",
    "rgba(147,197,253,.28)", "rgba(186,230,253,.4)", "rgba(251,191,36,.5)"
  ];
  const thresholds = [.35, .7, 1.05, 1.4, 2.3];
  const opacityLevels = [.36, .68, 1];
  const buckets = opacityLevels.map(() => colors.map(() => []));
  const packetInterval = .78;
  const physicsStep = .0045;
  const displayStep = 1000 / 60;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const velocity = {};
  const seedSample = {};
  let width, height, scale, originX, packets;
  let firstTime, lastTime, speedReference, cohortCount, tracersPerCohort;
  let cohorts = [];
  let randomState = 1295587;
  let lastFrame = 0, elapsed = 0, frameRequest = 0;
  let visible = false, ready = false;

  function random() {
    randomState = (Math.imul(1664525, randomState) + 1013904223) >>> 0;
    return randomState / 4294967296;
  }

  function spawn(tracer, states) {
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

  function placeCohort(cohort, time) {
    const states = packets.map(packet => packetAtTime(packet, time));
    cohort.time = time;
    for (const tracer of cohort.tracers) spawn(tracer, states);
  }

  function advance() {
    for (const level of buckets) for (const bucket of level) bucket.length = 0;
    for (const cohort of cohorts) {
      const {time} = cohort;
      if (time >= lastTime) {
        placeCohort(cohort, firstTime + (time - lastTime));
        continue;
      }
      // The two packets in each cohort interfere coherently. The displayed
      // cohorts are independent, staggered encounters, not one periodic state.
      const start = packets.map(packet => packetAtTime(packet, time));
      const middle = packets.map(packet => packetAtTime(packet, time + physicsStep / 2));
      const edgeTime = Math.min(time - firstTime, lastTime - time);
      const level = edgeTime < .18 ? 0 : edgeTime < .40 ? 1 : 2;

      for (const tracer of cohort.tracers) {
        const {x, y} = tracer;
        const initial = waveAt(x, y, start, velocity);
        if (initial.density < 1e-6 || --tracer.life < 0) {
          spawn(tracer, start);
          continue;
        }
        const midX = x + physicsStep / 2 * initial.jx / initial.density;
        const midY = y + physicsStep / 2 * initial.jy / initial.density;
        const mid = waveAt(midX, midY, middle, velocity);
        const ux = mid.jx / mid.density, uy = mid.jy / mid.density;
        const speed = Math.hypot(ux, uy);
        // Near interference nodes, replace the tracer instead of drawing a jump.
        if (mid.density < 1e-6 || !Number.isFinite(speed) || speed > 25) {
          spawn(tracer, middle);
          continue;
        }
        tracer.x += ux * physicsStep;
        tracer.y += uy * physicsStep;

        const px = originX + scale * x, py = height / 2 - scale * y;
        if (px < -4 || px > width + 4 || py < -4 || py > height + 4) continue;
        let color = 0;
        while (color < thresholds.length && speed / speedReference >= thresholds[color]) color++;
        buckets[level][color].push(px, py, originX + scale * tracer.x, height / 2 - scale * tracer.y);
      }
      cohort.time += physicsStep;
    }
  }

  function paint() {
    context.globalCompositeOperation = "destination-out";
    context.fillStyle = "rgba(0,0,0,.07)";
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "source-over";
    context.lineWidth = 1.1;
    for (let level = 0; level < buckets.length; level++) {
      context.globalAlpha = opacityLevels[level];
      for (let color = 0; color < colors.length; color++) {
        const segments = buckets[level][color];
        if (!segments.length) continue;
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
    firstTime = -ingressTime - .78;
    const exitTime = Math.max((right + 1) / leftSpeed, (left + 1) / rightSpeed);
    cohortCount = Math.ceil((exitTime + .7 - firstTime) / packetInterval);
    lastTime = firstTime + cohortCount * packetInterval;
    const total = Math.min(2200, Math.max(1250, Math.round(width * height / 180)));
    tracersPerCohort = Math.max(88, Math.floor(total / cohortCount));
  }

  function reset() {
    context.clearRect(0, 0, width, height);
    const warmup = 29;
    const duration = lastTime - firstTime;
    randomState = 1295587;
    cohorts = Array.from({length: cohortCount}, (_, index) => {
      const time = -.12 + index * packetInterval;
      const wrappedTime = firstTime + (time - firstTime) % duration;
      const cohort = {time: 0, tracers: Array.from({length: tracersPerCohort}, () => ({}))};
      placeCohort(cohort, wrappedTime - warmup * physicsStep);
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
