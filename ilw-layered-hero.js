import {paintTracers} from "./ilw-tracer-painter.js?v=20261124-2";

const stepSeconds = 1 / 60;
const waveTimeStep = .88 * stepSeconds;
const sweepSeconds = 20;
const interfaceLevel = .43;
const projection = .147;
const fieldSize = 512;
const colors = {
  water: ["#10151b", "#0a0d12", "#06090d"],
  tint: "71,176,158",
  particles: ["rgba(135,157,174,.20)", "rgba(149,173,192,.30)", "rgba(83,203,176,.30)",
    "rgba(94,234,212,.46)", "rgba(251,191,60,.67)"],
};

function wrap(value, length) {
  return value - length * Math.floor(value / length);
}

export function mountLayeredHero(figure, {profileAt, waveSpeed, sizeCanvas}) {
  const canvas = figure.querySelector(".ilw-limit-tracers");
  const context = canvas?.getContext("2d");
  if (!context) return;
  const trails = document.createElement("canvas");
  const ink = trails.getContext("2d");
  if (!ink) return;

  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const field = new Float64Array(fieldSize);
  const bins = colors.particles.map(() => []);
  const shearColor = colors.particles.length - 1;
  let width = 0, height = 0, scale = 1, spacing = 0, phase = 0;
  let age = 0, profile = profileAt(0), background, lowerWater, interfaceLight;
  let particles = [], interfacePoints = new Float64Array(0);
  let frameId = 0, lastTime, lag = 0, visible = false;

  function sampleProfile() {
    // Repeat isolated passages in the picture. Join only their outer tails
    // so the analytic profile near each crest retains its shape.
    const half = spacing / 2;
    const joinWidth = Math.min(1.4, half / 5);
    for (let i = 0; i < fieldSize; i++) {
      const x = Math.abs(spacing * i / fieldSize - half);
      const value = profile(x);
      const blend = Math.max(0, (x - (half - joinWidth)) / joinWidth);
      const smooth = blend * blend * (3 - 2 * blend);
      field[i] = -projection * (value + smooth * (profile(spacing - x) - value) / 2);
    }
  }

  function displacement(worldX, wavePhase) {
    const index = wrap(worldX - wavePhase + spacing / 2, spacing) * fieldSize / spacing;
    const left = Math.min(fieldSize - 1, Math.floor(index));
    const first = field[left], second = field[(left + 1) % fieldSize];
    return first + (second - first) * (index - left);
  }

  function trace(nextPhase) {
    for (const bin of bins) bin.length = 0;
    const edge = .5;
    const end = width / scale + edge;
    for (const p of particles) {
      const a = displacement(p.x, phase);
      const velocity = waveSpeed + (p.current - waveSpeed) / (1 + a * p.slope);
      const mid = displacement(p.x + velocity * waveTimeStep / 2, (phase + nextPhase) / 2);
      const vx = waveSpeed + (p.current - waveSpeed) / (1 + mid * p.slope);
      const nextX = p.x + vx * waveTimeStep;
      if (nextX <= -edge || nextX >= end) {
        p.x = -edge + wrap(nextX + edge, end + edge);
        p.y = p.z + displacement(p.x, nextPhase) * p.mode;
        continue;
      }
      const nextY = p.z + displacement(nextX, nextPhase) * p.mode;
      const ySpeed = Math.abs(nextY - p.y) * height;
      const color = p.near && p.shade >= 3 && ySpeed > .15 ? shearColor : p.shade;
      bins[color].push(p.x * scale, p.y * height, nextX * scale, nextY * height);
      p.x = nextX;
      p.y = nextY;
    }
    paintTracers(ink, width, height, bins, colors.particles);
  }

  function layer(from, below) {
    const last = interfacePoints.length - 1;
    const dx = width / last;
    context.beginPath();
    context.moveTo(0, interfacePoints[0] + from);
    for (let i = 1; i <= last; i++) context.lineTo(i * dx, interfacePoints[i] + from);
    if (below === undefined) {
      context.lineTo(width, height);
      context.lineTo(0, height);
    } else {
      for (let i = last; i >= 0; i--) context.lineTo(i * dx, interfacePoints[i] + below);
    }
    context.closePath();
    context.fill();
  }

  function draw() {
    const dx = width / (interfacePoints.length - 1);
    const mode = Math.sin(Math.PI * interfaceLevel);
    for (let i = 0; i < interfacePoints.length; i++) {
      interfacePoints[i] = height * (interfaceLevel + mode * displacement(i * dx / scale, phase));
    }
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    context.fillStyle = lowerWater;
    for (const offset of [-.075, -.048, -.026, -.009, .009, .028, .049, .078]) {
      layer(offset * height);
    }
    context.fillStyle = interfaceLight;
    for (const thickness of [.102, .070, .045, .026, .014]) {
      layer(-thickness * height, thickness * height);
    }
    context.drawImage(trails, 0, 0, width, height);
  }

  function seed() {
    const count = Math.round(Math.min(1340, Math.max(440, width * height / 245)));
    const span = width / scale + 1;
    particles = Array.from({length: count}, (_, i) => {
      const near = Math.random() < .76;
      const x = - .5 + span * (i + Math.random()) / count;
      const z = near
        ? interfaceLevel + (Math.random() + Math.random() + Math.random() - 1.5) * .09
        : .025 + .95 * Math.random();
      const mode = Math.sin(Math.PI * z);
      const tone = Math.random();
      const shade = near ? (tone < .32 ? 1 : tone < .81 ? 2 : 3) : (tone < .75 ? 0 : 1);
      return {x, z, mode, shade, near, slope: Math.PI * Math.cos(Math.PI * z),
        current: .20 + .18 * Math.random(), y: z + displacement(x, phase) * mode};
    });
  }

  function size() {
    const box = sizeCanvas(canvas, context);
    if (!box || (width === box.width && height === box.height && !box.resized)) return;
    const crestFraction = width ? phase * scale / width : .57;
    width = box.width;
    height = box.height;
    scale = Math.min(width / 8.8, height / 4.6);
    spacing = Math.max(10.8, .92 * width / scale);
    phase = wrap(crestFraction * width / scale, spacing);
    interfacePoints = new Float64Array(Math.max(94, Math.ceil(width / 7)) + 1);
    trails.width = canvas.width;
    trails.height = canvas.height;
    ink.setTransform(trails.width / width, 0, 0, trails.height / height, 0, 0);
    ink.lineCap = "round";

    background = context.createLinearGradient(0, 0, 0, height);
    for (const [i, color] of colors.water.entries()) background.addColorStop(i / 2, color);
    lowerWater = context.createLinearGradient(0, height * .34, 0, height);
    lowerWater.addColorStop(0, "rgba(3,10,19,.045)");
    lowerWater.addColorStop(1, "rgba(3,10,19,.13)");
    interfaceLight = context.createLinearGradient(0, 0, width, 0);
    const tint = colors.tint;
    interfaceLight.addColorStop(0, "rgba(" + tint + ",.032)");
    interfaceLight.addColorStop(.64, "rgba(" + tint + ",.074)");
    interfaceLight.addColorStop(1, "rgba(" + tint + ",.051)");
    sampleProfile();
    phase = wrap(phase - waveSpeed * waveTimeStep * 22, spacing);
    seed();
    for (let i = 0; i < 22; i++) {
      const nextPhase = phase + waveSpeed * waveTimeStep;
      trace(nextPhase);
      phase = wrap(nextPhase, spacing);
    }
    draw();
  }

  function frame(time) {
    if (lastTime !== undefined) lag += Math.min(.05, (time - lastTime) / 1000);
    lastTime = time;
    let advanced = false;
    while (lag >= stepSeconds) {
      lag -= stepSeconds;
      if (age < sweepSeconds) {
        age = Math.min(sweepSeconds, age + stepSeconds);
        profile = profileAt(age / sweepSeconds);
        sampleProfile();
      }
      const nextPhase = phase + waveSpeed * waveTimeStep;
      trace(nextPhase);
      phase = wrap(nextPhase, spacing);
      advanced = true;
    }
    if (advanced) draw();
    frameId = requestAnimationFrame(frame);
  }

  function sync() {
    if (width && visible && !motion.matches && !document.hidden) {
      if (!frameId) frameId = requestAnimationFrame(frame);
    } else if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = 0;
      lastTime = undefined;
      lag = 0;
    }
  }

  motion.addEventListener("change", sync);
  document.addEventListener("visibilitychange", sync);
  new ResizeObserver(() => { size(); sync(); }).observe(canvas);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(figure);
  size();
}
