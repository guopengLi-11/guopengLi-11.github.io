import {paintTracers} from "./ilw-tracer-painter.js?v=20261124-2";

"use strict";

const depth = 1.7;
const inverseWidth = 1.08;
const period = 7.35;
const theta = inverseWidth * depth;
const sinTheta = Math.sin(theta);
const cosTheta = Math.cos(theta);
const palette = [
  "rgba(135,157,174,.20)", "rgba(149,173,192,.30)", "rgba(173,193,212,.40)",
  "rgba(83,203,176,.25)", "rgba(94,234,212,.40)", "rgba(129,242,215,.54)",
  "rgba(232,166,70,.32)", "rgba(251,191,36,.48)", "rgba(255,207,112,.62)",
];

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

function smoothBetween(low, high, value) {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}

function textBounds(element, endNode, endOffset) {
  const range = document.createRange();
  range.selectNodeContents(element);
  if (endNode) range.setEnd(endNode, endOffset);
  return range.getBoundingClientRect();
}

function stageStops(hero, box, vertical) {
  const name = textBounds(hero.querySelector("h1"));
  const role = textBounds(hero.querySelector(".hero-role"));
  const street = hero.querySelector(".hero-address p");
  const roadLine = [...street.childNodes].find(node => node.textContent.startsWith("No. 9 Liangxiang East Road"));
  const marker = roadLine?.textContent.indexOf(" · Li") ?? -1;
  const address = textBounds(street, marker < 0 ? null : roadLine, marker + " · Li".length);
  const startOf = rect => vertical ? (rect.top - box.top) / box.height : (rect.left - box.left) / box.width;
  const endOf = rect => vertical ? (rect.bottom - box.top) / box.height : (rect.right - box.left) / box.width;
  const formAt = Math.max(.035, Math.min(.22, startOf(name) + .014));
  const formedBy = Math.min(.56, Math.max(formAt + .17, endOf(role) + .058));
  const fadeAt = Math.min(.91, Math.max(formedBy + .23, endOf(address)));
  return {formAt, formedBy, fadeAt};
}

function render(canvas, context) {
  const hero = canvas.closest(".home-wave-hero");
  const buckets = palette.map(() => []);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const physicsStep = .89 / 60;
  const displayStep = 1000 / 60;
  const backgroundCurrent = .088;
  const displacementScale = .174;
  const samples = Float64Array.from({length:2048}, (_, i) =>
    -displacementScale * ilwProfile(i * period / 2048));
  let width = 0, height = 0, along = 0, across = 0, span = 0;
  let vertical = false, stops;
  let phase = 0, particles = [], inletParticles = [];
  let lastFrame = 0, elapsed = 0, request = 0, visible = false;

  function displacement(x) {
    const location = wrap(x, period) * samples.length / period;
    const floor = Math.floor(location);
    const index = floor % samples.length;
    const first = samples[index];
    const second = samples[(index + 1) % samples.length];
    return first + (location - floor) * (second - first);
  }

  function fraction(x) {
    return .5 + x / span;
  }

  function inletWeight(progress) {
    return 1 - smoothBetween(stops.formAt, stops.formedBy, progress);
  }

  function inletStart() {
    return -span / 2 - .35;
  }

  function deformationGain(x) {
    const progress = fraction(x);
    return smoothBetween(stops.formAt, stops.formedBy, progress) *
      (1 - smoothBetween(stops.fadeAt, 1, progress));
  }

  // The window only changes the displayed kinematic flow. The ILW wave above
  // still translates at its exact phase speed.
  function horizontalVelocity(particle, x, time) {
    const gain = deformationGain(x);
    const thickness = 1 + displacement(x - time) * particle.slope;
    const velocity = waveSpeed - (waveSpeed - backgroundCurrent) / thickness;
    return backgroundCurrent + gain * (velocity - backgroundCurrent);
  }

  function displayedDepth(particle, x, time) {
    return particle.z + deformationGain(x) * displacement(x - time) * particle.mode;
  }

  function appendSegment(bucket, x, y, nextX, nextY, tail = 0) {
    const from = along * fraction(x), to = along * fraction(nextX);
    const depthFrom = across * y, depthTo = across * nextY;
    const stretch = tail ? tail / Math.max(.025, Math.hypot(to - from, depthTo - depthFrom)) : 0;
    const tailStart = from - (to - from) * stretch;
    const tailDepth = depthFrom - (depthTo - depthFrom) * stretch;
    if (vertical) bucket.push(tailDepth, tailStart, depthTo, to);
    else bucket.push(tailStart, tailDepth, to, depthTo);
  }

  // Let each tracer re-enter from offscreen after its tail fades into the wave.
  function advanceInlet(nextPhase) {
    const start = inletStart();
    const end = (stops.formedBy - .5) * span;
    for (const particle of inletParticles) {
      const {x, y, step, shade, rank} = particle;
      const weight = inletWeight(fraction(x));
      const nextX = x + step * (.60 + .40 * weight);
      if (nextX >= end) {
        particle.x = start + wrap(nextX - end, end - start);
        particle.y = displayedDepth(particle, particle.x, nextPhase);
        continue;
      }
      const nextY = displayedDepth(particle, nextX, nextPhase);
      if (rank < weight) appendSegment(buckets[shade], x, y, nextX, nextY);
      particle.x = nextX;
      particle.y = nextY;
    }
  }

  function advance() {
    const dt = physicsStep;
    const nextPhase = phase + waveSpeed * dt;
    const midpoint = (phase + nextPhase) / 2;
    for (const bucket of buckets) bucket.length = 0;
    const limit = span / 2 + .6;
    for (const particle of particles) {
      const {x, y, rank, tint, shade, inletTrail} = particle;
      const first = horizontalVelocity(particle, x, phase);
      const midX = x + first * dt / 2;
      const speedX = horizontalVelocity(particle, midX, midpoint);
      const nextX = x + speedX * dt;
      if (nextX < -limit || nextX >= limit) {
        particle.x = nextX < -limit ? limit : -limit;
        particle.y = displayedDepth(particle, particle.x, nextPhase);
        continue;
      }
      const nextY = displayedDepth(particle, nextX, nextPhase);
      particle.x = nextX;
      particle.y = nextY;

      const f = fraction(x);
      const entry = .29 + .71 * smoothBetween(.018, stops.formedBy, f);
      const fading = 1 - smoothBetween(stops.fadeAt, 1, f);
      if (rank > entry * fading) continue;
      const speed = Math.hypot(speedX, (nextY - y) / dt * across * span / along);
      const gain = deformationGain(x);
      const wave = smoothBetween(.06, .52, gain);
      const core = smoothBetween(.39, .77, speed) * smoothBetween(.34, .70, gain);
      const color = tint < core ? 6 : tint < wave ? 3 : 0;
      if (color === 0 && rank > entry * fading * (1 - inletWeight(f))) continue;
      appendSegment(buckets[color + shade], x, y, nextX, nextY, inletTrail * (1 - wave));
    }
    advanceInlet(nextPhase);
    phase = wrap(nextPhase, period);
  }

  function reset() {
    // Seed the entire flow and draw its recent history before playback begins.
    const warmup = 30;
    phase -= waveSpeed * physicsStep * warmup;
    context.clearRect(0, 0, width, height);
    const count = Math.round(Math.min(1780, Math.max(750, width * height / 265)));
    particles = Array.from({length:count}, (_, i) => {
      const q = (i * .41421356237 + .23 + .035 * (Math.random() - .5)) % 1;
      const z = i % 3 ? .12 + .78 * q : .02 + .96 * q;
      const x = ((i * .61803398875 + .11 + .008 * (Math.random() - .5)) % 1 - .5) * (span + 1.2);
      const brightness = Math.random();
      const particle = {x, z, mode:Math.sin(Math.PI * z), slope:Math.PI * Math.cos(Math.PI * z),
        rank:(i * .7548776662467 + .13) % 1, tint:Math.random(),
        shade:brightness < .22 ? 0 : brightness < .9 ? 1 : 2, inletTrail:3.5 + 4.5 * Math.random()};
      particle.y = displayedDepth(particle, x, phase);
      return particle;
    });
    const start = inletStart();
    const length = (stops.formedBy - .5) * span - start;
    const inletCount = Math.max(42, Math.round(count * stops.formedBy * .49));
    inletParticles = Array.from({length: inletCount}, (_, i) => {
      const x = start + length * (i + Math.random()) / inletCount;
      const z = .045 + .91 * Math.random();
      const brightness = Math.random();
      const particle = {x, z, mode:Math.sin(Math.PI * z), rank:Math.random(),
        shade:brightness < .27 ? 0 : brightness < .90 ? 1 : 2,
        step:span / along * (.70 + .55 * Math.random())};
      particle.y = displayedDepth(particle, x, phase);
      return particle;
    });
    for (let i = 0; i < warmup; i++) {
      advance();
      paintTracers(context, width, height, buckets, palette);
    }
  }

  function size() {
    const box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const stacked = matchMedia("(max-width: 680px)").matches;
    stops = stageStops(hero, box, stacked);
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const w = Math.round(box.width * ratio), h = Math.round(box.height * ratio);
    if (width === box.width && height === box.height && vertical === stacked &&
        canvas.width === w && canvas.height === h) return;
    const initial = !width;
    width = box.width;
    height = box.height;
    vertical = stacked;
    along = vertical ? height : width;
    across = vertical ? width : height;
    span = Math.max(6.9, along / across * 3.6);
    if (initial) phase = (stops.formedBy - .5) * span;
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
      advance();
      paintTracers(context, width, height, buckets, palette);
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
  document.fonts?.ready.then(size);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(canvas);
  size();
}

if (typeof document !== "undefined") {
  const canvas = document.querySelector(".home-ilw-canvas");
  const context = canvas?.getContext("2d");
  if (context) render(canvas, context);
}
