import {paintTracers, speedThresholds, tracerColors} from "./ilw-tracer-painter.js";

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
  const buckets = tracerColors.map(() => []);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const physicsStep = 1.18 / 60;
  const displayStep = 1000 / 60;
  const backgroundCurrent = .088;
  const displacementScale = .174;
  const samples = Float64Array.from({length:2048}, (_, i) =>
    -displacementScale * ilwProfile(i * period / 2048));
  let width = 0, height = 0, span = 0;
  let phase = .42, particles = [];
  let lastFrame = 0, elapsed = 0, request = 0, visible = false;

  function displacement(x) {
    const location = wrap(x, period) * samples.length / period;
    const floor = Math.floor(location);
    const index = floor % samples.length;
    const first = samples[index];
    const second = samples[(index + 1) % samples.length];
    return first + (location - floor) * (second - first);
  }

  function horizontalVelocity(particle, heightOffset) {
    const thickness = 1 + heightOffset * particle.slope;
    // This incompressible kinematic field deforms fluid-depth labels using U.
    return waveSpeed - (waveSpeed - backgroundCurrent) / thickness;
  }

  function advance() {
    const nextPhase = phase + waveSpeed * physicsStep;
    const midpoint = (phase + nextPhase) / 2;
    for (const bucket of buckets) bucket.length = 0;
    const limit = span / 2 + .6;
    const scale = width / span;
    for (const particle of particles) {
      const {x, y, z, mode} = particle;
      const first = horizontalVelocity(particle, displacement(x - phase));
      const midX = x + first * physicsStep / 2;
      const speedX = horizontalVelocity(particle, displacement(midX - midpoint));
      const nextX = x + speedX * physicsStep;
      if (nextX < -limit || nextX >= limit) {
        particle.x = nextX < -limit ? limit : -limit;
        particle.y = z + displacement(particle.x - nextPhase) * mode;
        continue;
      }
      const nextY = z + displacement(nextX - nextPhase) * mode;
      const speed = Math.hypot(speedX, (nextY - y) / physicsStep * height * span / width);
      let color = 0;
      while (color < speedThresholds.length && speed / .21 >= speedThresholds[color]) color++;
      buckets[color].push(width / 2 + scale * x, height * y, width / 2 + scale * nextX, height * nextY);
      particle.x = nextX;
      particle.y = nextY;
    }
    phase = wrap(nextPhase, period);
  }

  function reset() {
    const warmup = 40;
    phase -= waveSpeed * physicsStep * warmup;
    context.clearRect(0, 0, width, height);
    const count = Math.round(Math.min(1600, Math.max(680, width * height / 325)));
    particles = Array.from({length:count}, (_, i) => {
      const q = (i * .41421356237 + .23) % 1;
      const z = i % 3 ? .12 + .78 * q : .02 + .96 * q;
      const x = ((i * .61803398875 + .11) % 1 - .5) * (span + 1.2);
      const mode = Math.sin(Math.PI * z);
      return {x,z,mode,slope:Math.PI * Math.cos(Math.PI * z), y:z + displacement(x - phase) * mode};
    });
    for (let i = 0; i < warmup; i++) {
      advance();
      paintTracers(context, width, height, buckets);
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
      advance();
      paintTracers(context, width, height, buckets);
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
