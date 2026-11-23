import {paintTracers, speedThresholds, tracerColors} from "./ilw-tracer-painter.js?v=20261124-2";
import {mountLayeredHero} from "./ilw-layered-hero.js?v=20261124-2";

const waveSpeed = .86;
const regimes = {
  bo: {
    name: "BO",
    initialDepth: 1.2,
    liveInitialDepth: .45,
    endpoint: "∞",
    depth(initial, remaining) { return initial / remaining ** 2; },
    limit(x) { return -2 * waveSpeed / (1 + (waveSpeed * x) ** 2); },
    note: "Deep-water comparison at fixed wave speed. Each depth uses its exact ILW solitary-wave profile.",
  },
  kdv: {
    name: "KdV",
    initialDepth: 3,
    liveInitialDepth: 4.5,
    endpoint: "0",
    depth(initial, remaining) { return initial * remaining ** 2; },
    limit(x) { return -(3 * waveSpeed / 2) / Math.cosh(Math.sqrt(waveSpeed) * x / 2) ** 2; },
    note: "Shallow-water comparison of (3/δ)uδ(3t/δ, x) at fixed rescaled wave speed.",
  },
};

function solitaryWave(delta, regime) {
  let lower = 0, upper = Math.PI;
  if (regime === "bo") {
    // Solve for π−aδ directly to avoid cancellation at great depth.
    const target = waveSpeed * delta - 1;
    if (target > 0) upper = Math.min(Math.PI / 2, Math.PI / (target + 1));
    for (let i = 0; i < 64; i++) {
      const angle = (lower + upper) / 2;
      if ((Math.PI - angle) / Math.tan(angle) > target) lower = angle;
      else upper = angle;
    }
    const angle = (lower + upper) / 2;
    const a = (Math.PI - angle) / delta;
    const numerator = -a * Math.sin(angle);
    const offset = Math.sin(angle / 2) ** 2;
    return x => numerator / (2 * (Math.sinh(a * x / 2) ** 2 + offset));
  }
  const target = delta * delta * waveSpeed / 3;
  upper = Math.min(upper, Math.sqrt(3 * target));
  for (let i = 0; i < 64; i++) {
    const theta = (lower + upper) / 2;
    const square = theta * theta;
    const deficit = theta < .004
      ? square * (1 / 3 + square * (1 / 45 + square * 2 / 945))
      : 1 - theta / Math.tan(theta);
    if (deficit < target) lower = theta;
    else upper = theta;
  }
  const theta = (lower + upper) / 2;
  const a = theta / delta;
  const numerator = -3 * a * a * Math.sin(theta) / theta;
  const offset = Math.cos(theta / 2) ** 2;
  return x => numerator / (2 * (Math.sinh(a * x / 2) ** 2 + offset));
}

function comparisonAt(regime, progress, liveHero = false) {
  const setting = regimes[regime];
  if (progress >= 1) return {profile: setting.limit, depthLabel: "δ → " + setting.endpoint};
  const initialDepth = liveHero ? setting.liveInitialDepth : setting.initialDepth;
  const delta = setting.depth(initialDepth, 1 - progress);
  const label = delta < .01 || delta >= 1000 ? delta.toExponential(1) : String(+delta.toPrecision(3));
  return {profile: solitaryWave(delta, regime), depthLabel: "δ = " + label};
}

function sizeCanvas(canvas, context) {
  const {width, height} = canvas.getBoundingClientRect();
  if (!width || !height) return null;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(width * ratio), pixelHeight = Math.round(height * ratio);
  const resized = canvas.width !== pixelWidth || canvas.height !== pixelHeight;
  if (resized) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    context.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
    context.lineCap = "round";
  }
  return {width, height, resized};
}

function mountPreview(figure, preview) {
  const scene = figure.querySelector(".ilw-limit-tracers");
  const plot = figure.querySelector(".ilw-limit-profile");
  const context = scene?.getContext("2d"), graph = plot?.getContext("2d");
  if (!context) return;
  const depthText = figure.querySelector("[data-depth-value]");
  const nameText = figure.querySelector("[data-limit-name]");
  const slider = preview?.querySelector("#depth-progress");
  const errorText = preview?.querySelector("#difference");
  const note = preview?.querySelector("#note");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const displacementFactor = .118;
  const bins = tracerColors.map(() => []);
  const displayStep = 1000 / 60;
  const tracerStep = .58 / 60;
  const sweepSeconds = 24;
  const sweepStep = 1 / (60 * sweepSeconds);
  let regime = figure.dataset.ilwLimit;
  let progress = 0, current = comparisonAt(regime, progress), autoSweep = true;
  let width = 0, height = 0, span = 0, particles = [];
  let chartHeight = graph ? chartScale() : 0;
  let raf = 0, lastFrame = 0, elapsed = 0, visible = false;
  let graphSteps = 0;

  function chartScale() {
    return Math.max(-regimes[regime].limit(0), -comparisonAt(regime, 0).profile(0)) * 1.16;
  }

  function advection(particle, at, profile) {
    const deformation = -displacementFactor * profile(at);
    return (.071 - waveSpeed) / (1 + deformation * particle.slope);
  }

  function drawStep(next) {
    for (const bin of bins) bin.length = 0;
    const scale = width / span;
    const origin = width * .5;
    const leftEdge = -origin / scale - .55, rightEdge = (width - origin) / scale + .55;
    for (const particle of particles) {
      const {x, y, z, mode} = particle;
      const midpoint = x + tracerStep * advection(particle, x, current.profile) / 2;
      const vx = (advection(particle, midpoint, current.profile) + advection(particle, midpoint, next.profile)) / 2;
      const nextX = x + tracerStep * vx;
      if (nextX < leftEdge) {
        particle.x = nextX + (rightEdge - leftEdge);
        particle.y = z - displacementFactor * next.profile(particle.x) * mode;
        continue;
      }
      const nextY = z - displacementFactor * next.profile(nextX) * mode;
      const referenceSpeed = Math.hypot(vx + waveSpeed, (nextY - y) / tracerStep) / .155;
      let color = 0;
      while (color < speedThresholds.length && referenceSpeed >= speedThresholds[color]) color++;
      bins[color].push(origin + scale * x, y * height, origin + scale * nextX, nextY * height);
      particle.x = nextX;
      particle.y = nextY;
    }
    paintTracers(context, width, height, bins);
    current = next;
  }

  function prepareScene() {
    context.clearRect(0, 0, width, height);
    const count = Math.round(Math.min(1300, Math.max(360, width * height / 245)));
    particles = Array.from({length: count}, (_, i) => {
      const x = ((i * .61803398875 + .11) % 1 - .5) * (span + 1.1);
      const z = .025 + .95 * ((i * .41421356237 + .23) % 1);
      const mode = Math.sin(Math.PI * z);
      return {x, z, mode, slope: Math.PI * Math.cos(Math.PI * z),
        y: z - displacementFactor * current.profile(x) * mode};
    });
    for (let i = 0; i < 31; i++) drawStep(current);
  }

  function drawProfile() {
    if (!graph) return;
    const size = sizeCanvas(plot, graph);
    if (!size) return;
    const {width: w, height: h} = size;
    const left = 9, right = w - 9;
    graph.clearRect(0, 0, w, h);
    graph.strokeStyle = "rgba(166,193,204,.19)";
    graph.lineWidth = 1;
    graph.beginPath();
    graph.moveTo(left, 9);
    graph.lineTo(right, 9);
    graph.stroke();
    for (const [curve, color, dash] of [[current.profile, "#82eddb", []], [regimes[regime].limit, "#f6cc87", [4,3]]]) {
      graph.beginPath();
      const count = Math.max(110, Math.ceil(w / 1.5));
      for (let i = 0; i <= count; i++) {
        const fraction = i / count;
        const x = left + (right - left) * fraction;
        const y = 9 - (h - 17) * curve(-7 + 14 * fraction) / chartHeight;
        if (i === 0) graph.moveTo(x,y);
        else graph.lineTo(x,y);
      }
      graph.strokeStyle = color;
      graph.lineWidth = 1.8;
      graph.setLineDash(dash);
      graph.stroke();
    }
    graph.setLineDash([]);
  }

  function refreshLabels() {
    drawProfile();
    if (depthText) depthText.textContent = current.depthLabel;
    if (slider) {
      slider.value = String(Math.round(progress * 1000));
      slider.setAttribute("aria-valuetext", current.depthLabel);
    }
    if (errorText) {
      let error = 0;
      for (let i = -350; i <= 350; i++) {
        const x = i / 50;
        error = Math.max(error, Math.abs(current.profile(x) - regimes[regime].limit(x)));
      }
      errorText.textContent = "Sampled max difference " + (error === 0 ? "0" : error.toExponential(2));
    }
  }

  function seek(nextProgress) {
    progress = nextProgress;
    current = comparisonAt(regime, progress);
    for (const particle of particles) {
      particle.y = particle.z - displacementFactor * current.profile(particle.x) * particle.mode;
    }
    refreshLabels();
  }

  function selectMode(next) {
    regime = next;
    figure.dataset.ilwLimit = next;
    chartHeight = chartScale();
    nameText.textContent = "ILW → " + regimes[next].name;
    figure.querySelector("[data-limit-key]").textContent = regimes[next].name;
    plot.setAttribute("aria-label", "ILW and " + regimes[next].name + " solitary-wave profile comparison");
    if (note) note.textContent = regimes[next].note + " Tracers illustrate motion in a frame following the wave.";
    for (const button of preview?.querySelectorAll("[data-limit-choice]") ?? []) {
      button.setAttribute("aria-pressed", String(button.dataset.limitChoice === next));
    }
    autoSweep = true;
    seek(0);
  }

  function size() {
    const dimensions = sizeCanvas(scene, context);
    if (dimensions && (!width || dimensions.resized)) {
      width = dimensions.width;
      height = dimensions.height;
      span = Math.max(7, width / height * 3.45);
      prepareScene();
    }
    drawProfile();
  }

  function frame(timestamp) {
    if (lastFrame) elapsed += Math.min(40, timestamp - lastFrame);
    lastFrame = timestamp;
    while (elapsed >= displayStep) {
      elapsed -= displayStep;
      const next = autoSweep ? Math.min(1, progress + sweepStep) : progress;
      const changed = next !== progress;
      drawStep(changed ? comparisonAt(regime, next) : current);
      progress = next;
      if (changed && (++graphSteps % 3 === 0 || progress === 1)) refreshLabels();
    }
    raf = requestAnimationFrame(frame);
  }

  function sync() {
    if (width && visible && !document.hidden && !reducedMotion.matches) {
      if (!raf) raf = requestAnimationFrame(frame);
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      lastFrame = 0;
      elapsed = 0;
    }
  }

  for (const button of preview?.querySelectorAll("[data-limit-choice]") ?? []) {
    button.addEventListener("click", () => selectMode(button.dataset.limitChoice));
  }
  slider?.addEventListener("input", () => { autoSweep = false; seek(Number(slider.value) / 1000); });
  preview?.querySelector("#replay")?.addEventListener("click", () => { autoSweep = true; seek(0); });
  reducedMotion.addEventListener("change", sync);
  document.addEventListener("visibilitychange", sync);
  const resize = new ResizeObserver(() => { size(); sync(); });
  resize.observe(scene);
  if (plot) resize.observe(plot);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(figure);
  selectMode(new URLSearchParams(location.search).get("limit") === "kdv" ? "kdv" : "bo");
  size();
}

for (const figure of document.querySelectorAll("[data-ilw-limit]")) {
  const preview = figure.closest("[data-ilw-preview]");
  if (preview) {
    mountPreview(figure, preview);
  } else {
    const regime = figure.dataset.ilwLimit;
    mountLayeredHero(figure, {waveSpeed, sizeCanvas, profileAt: progress => comparisonAt(regime, progress, true).profile});
  }
}
