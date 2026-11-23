"use strict";

const depth = 1.7;
const inverseWidth = 1.08;
const period = 7.35;
const theta = inverseWidth * depth;
const sinTheta = Math.sin(theta);
const cosTheta = Math.cos(theta);

function correction() {
  let sum = 0;
  for (let n = 1; n <= 8; n++) {
    sum += 1 / (Math.sinh(inverseWidth * n * period / 2) ** 2 + sinTheta ** 2);
  }
  return inverseWidth * Math.sin(2 * theta) * sum;
}

const waveSpeed = 1 / depth - inverseWidth / Math.tan(theta) - correction();

function wrap(x, length) {
  return x - length * Math.floor(x / length);
}

function ilwProfile(x) {
  // Chapouto et al., §§4.1–4.2. Periodize the solitary wave and correct its speed.
  const centered = wrap(x + period / 2, period) - period / 2;
  let sum = 0;
  for (let n = -6; n <= 6; n++) {
    sum += 1 / (Math.cosh(inverseWidth * (centered + n * period)) + cosTheta);
  }
  return -inverseWidth * sinTheta * sum;
}

function render(canvas, context) {
  const colors = [
    "rgba(132,152,173,.21)", "rgba(152,177,199,.30)", "rgba(175,197,215,.40)",
    "rgba(94,234,212,.5)", "rgba(94,234,212,.34)", "rgba(125,211,252,.22)",
    "rgba(147,197,253,.28)", "rgba(186,230,253,.4)", "rgba(251,191,36,.5)"
  ];
  const thresholds = [.35, .7, 1.05, 1.4, 2.3];
  const buckets = colors.map(() => []);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const physicsStep = 1.18 / 60;
  const displaySeconds = 1 / 60;
  const displayStep = 1000 * displaySeconds;
  const openingSeconds = 1.4;
  const formationSeconds = 3.6;
  const animationReadyAt = openingSeconds + formationSeconds;
  const backgroundCurrent = .088;
  const displacementScale = .174;
  const samples = Float64Array.from({length:2048}, (_, i) =>
    -displacementScale * ilwProfile(i * period / 2048));
  let width = 0, height = 0, span = 0;
  let phase = .42, particles = [];
  let age = reduced.matches ? animationReadyAt : 0;
  let driftTime = 0;
  let lastFrame = 0, elapsed = 0, request = 0, visible = false;

  function displacement(x) {
    const location = wrap(x, period) * samples.length / period;
    const floor = Math.floor(location);
    const index = floor % samples.length;
    const first = samples[index];
    const second = samples[(index + 1) % samples.length];
    return first + (location - floor) * (second - first);
  }

  function formation(time) {
    const t = Math.max(0, Math.min(1, (time - openingSeconds) / formationSeconds));
    return t * t * (3 - 2 * t);
  }

  function horizontalVelocity(particle, heightOffset, formed) {
    const thickness = 1 + heightOffset * particle.slope;
    const current = backgroundCurrent + (1 - formed) * (particle.openingCurrent - backgroundCurrent);
    // Once formed, recover the original kinematic field of the traveling wave.
    return waveSpeed - (waveSpeed - current) / thickness;
  }

  function visibleDepth(particle, depth, time) {
    return depth + particle.drift * Math.sin(particle.driftRate * time + particle.driftPhase);
  }

  function advance(nextAge = age) {
    const nextPhase = phase + waveSpeed * physicsStep;
    const midpoint = (phase + nextPhase) / 2;
    const nextDrift = driftTime + physicsStep;
    const formed = formation(age);
    const halfFormed = formation((age + nextAge) / 2);
    const nextFormed = formation(nextAge);
    for (const bucket of buckets) bucket.length = 0;
    const limit = span / 2 + .6;
    for (const particle of particles) {
      const {x, y, z, mode, shownY} = particle;
      const first = horizontalVelocity(particle, formed * displacement(x - phase), formed);
      const midX = x + first * physicsStep / 2;
      const midOffset = halfFormed * displacement(midX - midpoint);
      const speedX = horizontalVelocity(particle, midOffset, halfFormed);
      const nextX = x + speedX * physicsStep;
      if (nextX < -limit || nextX >= limit) {
        particle.x = nextX < -limit ? limit : -limit;
        particle.y = z + nextFormed * displacement(particle.x - nextPhase) * mode;
        particle.shownY = visibleDepth(particle, particle.y, nextDrift);
        continue;
      }
      const nextY = z + nextFormed * displacement(nextX - nextPhase) * mode;
      const nextShownY = visibleDepth(particle, nextY, nextDrift);
      let tone = particle.shade;
      if (particle.colorRank < nextFormed) {
        // As the colors form, measure the wave current without the faster
        // opening drift, so the entrance does not look like a gold crest.
        const waveVelocity = halfFormed === 1 ? speedX : horizontalVelocity(particle, midOffset, 1);
        const speed = Math.hypot(waveVelocity, (nextY - y) / physicsStep * height * span / width);
        let color = 0;
        while (color < thresholds.length && speed / .21 >= thresholds[color]) color++;
        tone = 3 + color;
      }
      buckets[tone].push(x, shownY, nextX, nextShownY);
      particle.x = nextX;
      particle.y = nextY;
      particle.shownY = nextShownY;
    }
    phase = wrap(nextPhase, period);
    driftTime = nextDrift;
    age = nextAge;
  }

  function paint() {
    context.globalCompositeOperation = "destination-out";
    context.fillStyle = "rgba(0,0,0,.07)";
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "source-over";
    context.lineWidth = 1.1;
    const scale = width / span;
    for (let color = 0; color < buckets.length; color++) {
      const segments = buckets[color];
      if (!segments.length) continue;
      context.strokeStyle = colors[color];
      context.beginPath();
      for (let i = 0; i < segments.length; i += 4) {
        context.moveTo(width / 2 + scale * segments[i], height * segments[i + 1]);
        context.lineTo(width / 2 + scale * segments[i + 2], height * segments[i + 3]);
      }
      context.stroke();
    }
  }

  function reset() {
    const warmup = 40;
    phase -= waveSpeed * physicsStep * warmup;
    driftTime -= physicsStep * warmup;
    context.clearRect(0, 0, width, height);
    const count = Math.round(1.5 * Math.min(1600, Math.max(680, width * height / 325)));
    const formed = formation(age);
    particles = Array.from({length:count}, (_, i) => {
      const q = (i * .41421356237 + .23 + .042 * (Math.random() - .5)) % 1;
      const z = i % 3 ? .12 + .78 * q : .02 + .96 * q;
      const x = ((i * .61803398875 + .11 + .014 * (Math.random() - .5)) % 1 - .5) * (span + 1.2);
      const mode = Math.sin(Math.PI * z);
      const y = z + formed * displacement(x - phase) * mode;
      const shade = Math.random();
      const particle = {
        x, y, z, mode, slope: Math.PI * Math.cos(Math.PI * z),
        shade: shade < .23 ? 0 : shade < .88 ? 1 : 2,
        colorRank: Math.random(),
        openingCurrent: (.73 + .46 * Math.random()) * span / (width * physicsStep),
        drift: (.0035 + .005 * Math.random()) * mode,
        driftRate: 2.2 + 3.6 * Math.random(),
        driftPhase: 2 * Math.PI * Math.random(),
      };
      particle.shownY = visibleDepth(particle, y, driftTime);
      return particle;
    });
    for (let i = 0; i < warmup; i++) {
      advance();
      paint();
    }
  }

  function size() {
    const box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const w = Math.round(box.width * ratio), h = Math.round(box.height * ratio);
    if (width === box.width && height === box.height && canvas.width === w && canvas.height === h) return;
    width = box.width;
    height = box.height;
    span = Math.max(6.9, width / height * 3.6);
    canvas.width = w;
    canvas.height = h;
    context.setTransform(w / width, 0, 0, h / height, 0, 0);
    context.lineCap = "round";
    reset();
  }

  function frame(timestamp) {
    if (lastFrame) elapsed += Math.min(40, timestamp - lastFrame);
    lastFrame = timestamp;
    while (elapsed >= displayStep) {
      elapsed -= displayStep;
      advance(Math.min(animationReadyAt, age + displaySeconds));
      paint();
    }
    request = requestAnimationFrame(frame);
  }

  function sync() {
    if (width && visible && !document.hidden && !reduced.matches) {
      if (!request) request = requestAnimationFrame(frame);
    } else if (request) {
      cancelAnimationFrame(request);
      request = 0;
      lastFrame = 0;
      elapsed = 0;
    }
  }

  reduced.addEventListener("change", sync);
  document.addEventListener("visibilitychange", sync);
  new ResizeObserver(() => { size(); sync(); }).observe(canvas);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(canvas);
  size();
}

if (typeof document !== "undefined") {
  const canvas = document.querySelector(".home-ilw-canvas");
  const context = canvas?.getContext("2d");
  if (context) render(canvas, context);
}
