// Particle drawing adapted from Jiawei Li's homepage (used with permission).
// https://jiaweili-math.github.io/

export const tracerColors = ['rgba(94,234,212,.5)', 'rgba(94,234,212,.34)', 'rgba(125,211,252,.22)',
            'rgba(147,197,253,.28)', 'rgba(186,230,253,.4)', 'rgba(251,191,36,.5)'];
export const speedThresholds = [0.35, 0.7, 1.05, 1.4, 2.3];

export function paintTracers(ctx, W, H, bins, palette = tracerColors) {
    let i, j, s;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,.07)'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 1.1;
    for (i = 0; i < bins.length; i++) {
      s = bins[i]; if (!s.length) continue;
      ctx.strokeStyle = palette[i]; ctx.beginPath();
      for (j = 0; j < s.length; j += 4) { ctx.moveTo(s[j], s[j + 1]); ctx.lineTo(s[j + 2], s[j + 3]); }
      ctx.stroke();
    }
}
