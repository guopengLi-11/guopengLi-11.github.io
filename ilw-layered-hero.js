import {paintTracers} from "./ilw-tracer-painter.js?v=20261124-2";

const stepSeconds = 1 / 60;
const waveTimeStep = .88 * stepSeconds;
const sweepSeconds = 20;
const interfaceLevel = .43;
const projection = .162;
const fieldSize = 512;
const waveCopies = 3;
const turn = 2 * Math.PI;
const colors = {
  water: ["#10151b", "#0a0d12", "#06090d"],
  tint: "71,176,158",
  particles: ["rgba(135,157,174,.20)", "rgba(149,173,192,.30)", "rgba(83,203,176,.30)",
    "rgba(94,234,212,.46)", "rgba(251,191,60,.67)"],
};
// The coordinate stretch and eddy shapes distinguish the wells while
// retaining the same water and tracer colors.
const appearance = {
  bo: {
    depthStretch: 1.5,
    bands: [.102, .064, .034, .015, .006],
    eddies: [
      {offset: -.87, depth: .548, radius: .91, depthRadius: .093, spin: 1.12},
      {offset: 1.10, depth: .323, radius: .65, depthRadius: .053, spin: 1.04},
    ],
  },
  kdv: {
    depthStretch: -.90,
    bands: [.108, .077, .051, .032, .017],
    eddies: [
      {offset: -1.62, depth: .562, radius: 1.65, depthRadius: .061, spin: .77},
      {offset: 1.84, depth: .337, radius: 1.15, depthRadius: .038, spin: .82},
    ],
  },
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

  const style = appearance[figure.dataset.ilwLimit];
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const field = new Float64Array(fieldSize);
  const bins = colors.particles.map(() => []);
  const shearColor = colors.particles.length - 1;
  let width = 0, height = 0, scale = 1, spacing = 0, trainLength = 0, phase = 0;
  let age = 0, motionTime = 0, profile = profileAt(0), background, lowerWater, interfaceLight;
  let particles = [], eddies = [], interfacePoints = new Float64Array(0);
  let frameId = 0, lastTime, lag = 0, visible = false;

  function sampleProfile() {
    // Repeat isolated passages in the picture. Join only their outer tails
    // so the analytic profile near each crest retains its shape.
    const half = spacing / 2;
    const joinWidth = Math.min(.9, half / 5);
    for (let i = 0; i < fieldSize; i++) {
      const x = Math.abs(spacing * i / fieldSize - half);
      const value = profile(x);
      const blend = Math.max(0, (x - (half - joinWidth)) / joinWidth);
      const smooth = blend * blend * (3 - 2 * blend);
      const correction = smooth ? smooth * (profile(spacing - x) - value) / 2 : 0;
      field[i] = -projection * (value + correction);
    }
  }

  function displacement(worldX, wavePhase) {
    const index = wrap(worldX - wavePhase + spacing / 2, spacing) * fieldSize / spacing;
    const left = Math.min(fieldSize - 1, Math.floor(index));
    const first = field[left], second = field[(left + 1) % fieldSize];
    return first + (second - first) * (index - left);
  }

  function eddyDepth(x, z, wavePhase) {
    return z + displacement(x, wavePhase) * Math.sin(Math.PI * z);
  }

  function screenDepth(y) {
    // Stretch only the display, anchoring the water edges and undisturbed interface.
    return height * (y + style.depthStretch * y * y * (1 - y) * (y - interfaceLevel));
  }

  function displayedDepth(p, x, y, wavePhase, time) {
    // Neighbors share a soft wavering motion, with a smaller individual drift.
    const relativeAngle = turn * (x - wavePhase) / spacing;
    const shared = .0038 * Math.sin(2 * relativeAngle + 6 * p.z + .9 * time)
      + .0018 * Math.sin(3 * relativeAngle - 5 * p.z - .57 * time);
    const individual = p.drift * Math.sin(p.driftPhase + p.driftRate * time);
    return y + p.mode * (shared + individual);
  }

  function orbitRadius(p, angle) {
    return 1 + p.bend * Math.sin(2 * angle + p.bendPhase);
  }

  function traceEddies(nextPhase) {
    const right = width / scale;
    for (const eddy of eddies) {
      // Wrap only the part of the wave train outside the canvas.
      const margin = eddy.radius + .55;
      const center = wrap(phase + eddy.offset + margin, trainLength) - margin;
      const nextCenter = center + nextPhase - phase;
      const onScreen = center <= right + margin;
      for (const p of eddy.particles) {
        const nextAngle = wrap(p.angle + p.spin * waveTimeStep, turn);
        const radius = orbitRadius(p, nextAngle);
        const nextOffsetX = radius * p.rx * Math.cos(nextAngle);
        const nextX = nextCenter + nextOffsetX;
        const z = eddy.depth + radius * p.ry * Math.sin(nextAngle);
        const nextY = eddyDepth(nextX, z, nextPhase);
        if (onScreen) {
          const x = center + p.offsetX;
          bins[p.shade].push(x * scale, screenDepth(p.y), nextX * scale, screenDepth(nextY));
        }
        p.angle = nextAngle;
        p.offsetX = nextOffsetX;
        p.y = nextY;
      }
    }
  }

  function trace(nextPhase) {
    for (const bin of bins) bin.length = 0;
    const edge = .5;
    const end = width / scale + edge;
    const nextTime = motionTime + waveTimeStep;
    for (const p of particles) {
      const a = displacement(p.x, phase);
      const velocity = waveSpeed + (p.current - waveSpeed) / (1 + a * p.slope);
      const mid = displacement(p.x + velocity * waveTimeStep / 2, (phase + nextPhase) / 2);
      const vx = waveSpeed + (p.current - waveSpeed) / (1 + mid * p.slope);
      const nextX = p.x + vx * waveTimeStep;
      if (nextX <= -edge || nextX >= end) {
        p.x = -edge + wrap(nextX + edge, end + edge);
        p.y = p.z + displacement(p.x, nextPhase) * p.mode;
        p.shownY = displayedDepth(p, p.x, p.y, nextPhase, nextTime);
        continue;
      }
      const nextY = p.z + displacement(nextX, nextPhase) * p.mode;
      const nextShownY = displayedDepth(p, nextX, nextY, nextPhase, nextTime);
      const ySpeed = Math.abs(nextY - p.y) * height;
      const color = p.near && p.shade >= 3 && ySpeed > .15 ? shearColor : p.shade;
      bins[color].push(p.x * scale, screenDepth(p.shownY), nextX * scale, screenDepth(nextShownY));
      p.x = nextX;
      p.y = nextY;
      p.shownY = nextShownY;
    }
    traceEddies(nextPhase);
    paintTracers(ink, width, height, bins, colors.particles);
    motionTime = nextTime;
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
      interfacePoints[i] = screenDepth(interfaceLevel + mode * displacement(i * dx / scale, phase));
    }
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    context.fillStyle = lowerWater;
    for (const offset of [-.075, -.048, -.026, -.009, .009, .028, .049, .078]) {
      layer(offset * height);
    }
    context.fillStyle = interfaceLight;
    for (const thickness of style.bands) {
      layer(-thickness * height, thickness * height);
    }
    context.drawImage(trails, 0, 0, width, height);
  }

  function seed() {
    const count = Math.round(Math.min(4600, Math.max(1825, width * height / 83)));
    const span = width / scale + 1;
    const clusterPhase = turn * Math.random();
    const detailPhase = turn * Math.random();
    const clusterStart = Math.sin(clusterPhase);
    const detailStart = Math.sin(detailPhase);
    particles = Array.from({length: count}, (_, i) => {
      const position = (i + Math.random()) / count;
      const cluster = Math.sin(2 * turn * position + clusterPhase);
      const detail = Math.sin(5 * turn * position + detailPhase);
      const shifted = position + .026 * (cluster - clusterStart) + .007 * (detail - detailStart);
      const near = Math.random() < .55 + .11 * cluster;
      const x = -.5 + span * shifted;
      const z = near
        ? interfaceLevel + (Math.random() + Math.random() + Math.random() - 1.5) * .09
        : .025 + .95 * Math.random();
      const mode = Math.sin(Math.PI * z);
      const tone = Math.random();
      const shade = near ? (tone < .32 ? 1 : tone < .81 ? 2 : 3) : (tone < .75 ? 0 : 1);
      const p = {
        x, z, mode, shade, near, slope: Math.PI * Math.cos(Math.PI * z), current: .20 + .18 * Math.random(),
        y: z + displacement(x, phase) * mode, drift: (near ? .0016 : .0026) + (near ? .0027 : .0066) * Math.random(),
        driftPhase: turn * Math.random(), driftRate: .65 + .6 * Math.random(),
      };
      p.shownY = displayedDepth(p, x, p.y, phase, motionTime);
      return p;
    });
  }

  function seedEddy(crest, shape, direction, count) {
    // Orbit tracers visualize local circulation in the frame of each wave.
    const offset = crest + shape.offset;
    const depth = shape.depth + .025 * Math.random();
    const radius = shape.radius * (.93 + .14 * Math.random());
    const particles = Array.from({length: count}, () => {
      const radial = .16 + .84 * Math.sqrt(Math.random());
      const angle = turn * Math.random();
      const rx = radius * radial * (.83 + .17 * Math.random());
      const ry = shape.depthRadius * radial * (.85 + .15 * Math.random());
      const spin = direction * shape.spin * (1.42 + 1.60 * (1 - radial)) * (.86 + .28 * Math.random());
      const tone = Math.random();
      let shade = tone > .27 ? 3 : 2;
      if (tone < .13) shade = 1;
      else if (radial < .70 && tone > .62) shade = shearColor;
      const p = {angle, rx, ry, spin, shade, bend: .06 + .06 * Math.random(), bendPhase: turn * Math.random()};
      const strength = orbitRadius(p, angle);
      p.offsetX = strength * rx * Math.cos(angle);
      const z = depth + strength * ry * Math.sin(angle);
      p.y = eddyDepth(phase + offset + p.offsetX, z, phase);
      return p;
    });
    return {offset, depth, radius, particles};
  }

  function seedEddies() {
    const count = width > 680 ? 172 : 115;
    eddies = [];
    for (let i = 0; i < waveCopies; i++) {
      const crest = i * spacing;
      const direction = i === 1 ? -1 : 1;
      eddies.push(
        seedEddy(crest, style.eddies[0], direction, count),
        seedEddy(crest, style.eddies[1], -direction, Math.round(count * .60))
      );
    }
  }

  function size() {
    const box = sizeCanvas(canvas, context);
    if (!box || (width === box.width && height === box.height && !box.resized)) return;
    const phaseInWaves = width ? phase / spacing : .58;
    width = box.width;
    height = box.height;
    scale = Math.min(width / 23.5, height / 4.6);
    spacing = .46 * width / scale;
    trainLength = waveCopies * spacing;
    phase = wrap(phaseInWaves * spacing, trainLength);
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
    phase = wrap(phase - waveSpeed * waveTimeStep * 22, trainLength);
    motionTime -= waveTimeStep * 22;
    seed();
    seedEddies();
    for (let i = 0; i < 22; i++) {
      const nextPhase = phase + waveSpeed * waveTimeStep;
      trace(nextPhase);
      phase = wrap(nextPhase, trainLength);
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
      phase = wrap(nextPhase, trainLength);
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
