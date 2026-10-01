// הגוף: שישה צירים ניצבים במרחב בן 6 ממדים, מוטלים לתלת־ממד.
// ששת הכיוונים הם שישה קודקודי איקוסהדרון שאינם נגדיים זה לזה —
// זו ההטלה של ה־6-orthoplex לתלת־ממד. 0 במרכז, 9 במעטפת.
import { RULERS, MAX } from './data.js';

const PHI = (1 + Math.sqrt(5)) / 2;
const RAW = [[0, 1, PHI], [0, -1, PHI], [1, PHI, 0], [-1, PHI, 0], [PHI, 0, 1], [-PHI, 0, 1]];
const DIRS = RAW.map(v => { const l = Math.hypot(...v); return v.map(x => x / l); });

// מרכז התצוגה: אמצע המעטפת, כדי שהגוף יישב במרכז המסך
const CENTER = [0, 1, 2].map(a => DIRS.reduce((s, d) => s + d[a], 0) / DIRS.length / 2);

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = a => { const l = Math.hypot(...a) || 1; return a.map(x => x / l); };

// קמור של עד 7 נקודות, בכוח גס
function hull(pts) {
  const faces = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
    let nrm = cross(sub(pts[j], pts[i]), sub(pts[k], pts[i]));
    if (Math.hypot(...nrm) < 1e-9) continue;
    let pos = 0, neg = 0;
    for (let m = 0; m < n; m++) {
      if (m === i || m === j || m === k) continue;
      const d = dot(nrm, sub(pts[m], pts[i]));
      if (d > 1e-7) pos++; else if (d < -1e-7) neg++;
    }
    if (pos && neg) continue;
    faces.push(pos ? [i, k, j] : [i, j, k]); // נורמל כלפי חוץ
  }
  return faces;
}

export function createBody(canvas) {
  const ctx = canvas.getContext('2d');
  let values = Object.fromEntries(RULERS.map(r => [r.id, 5]));
  let rotY = 0.6, rotX = -0.35, auto = true, drag = null, raf = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = n => getComputedStyle(canvas).getPropertyValue(n).trim();

  function points() {
    // ריצוד זעיר ודטרמיניסטי כדי להימנע ממשטחים שטוחים לגמרי
    const pts = RULERS.map((r, i) => {
      const t = Math.max(values[r.id], 0) / MAX;
      return DIRS[i].map((x, a) => x * t + (a === i % 3 ? 0.004 : -0.002) * (i + 1));
    });
    pts.push([0.001, -0.002, 0.003]); // המרכז
    return pts;
  }

  function rot(p) {
    p = sub(p, CENTER);
    const cy = Math.cos(rotY), sy = Math.sin(rotY), cx = Math.cos(rotX), sx = Math.sin(rotX);
    const x = p[0] * cy + p[2] * sy, z0 = -p[0] * sy + p[2] * cy;
    const y = p[1] * cx - z0 * sx, z = p[1] * sx + z0 * cx;
    return [x, y, z];
  }

  function draw() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const R = Math.min(w, h) * 0.42, cx = w / 2, cy = h / 2;
    const proj = p => { const s = 1 / (1 - p[2] * 0.25); return [cx + p[0] * R * s, cy - p[1] * R * s]; };
    const ink = css('--lapis') || '#1f3a8a', gold = css('--gold') || '#b8860b', line = css('--line') || '#ccc';

    // הצירים עד המעטפת
    ctx.lineWidth = 1; ctx.strokeStyle = line;
    const c0 = proj(rot([0, 0, 0]));
    DIRS.forEach(d => { const e = proj(rot(d)); ctx.beginPath(); ctx.moveTo(...c0); ctx.lineTo(...e); ctx.stroke();
      ctx.beginPath(); ctx.arc(e[0], e[1], 2, 0, Math.PI * 2); ctx.fillStyle = line; ctx.fill(); });

    const pts = points();
    const rp = pts.map(rot);
    const faces = hull(pts).map(f => {
      const a = rp[f[0]], b = rp[f[1]], c = rp[f[2]];
      const n = norm(cross(sub(b, a), sub(c, a)));
      return { f, z: (a[2] + b[2] + c[2]) / 3, n };
    }).sort((p, q) => p.z - q.z);
    const light = norm([0.3, 0.6, 0.8]);
    for (const { f, n } of faces) {
      const lum = 0.35 + 0.65 * Math.max(0, dot(n, light));
      ctx.beginPath();
      f.forEach((idx, i) => { const q = proj(rp[idx]); i ? ctx.lineTo(...q) : ctx.moveTo(...q); });
      ctx.closePath();
      ctx.globalAlpha = n[2] > 0 ? 0.55 : 0.18;
      ctx.fillStyle = shade(ink, lum);
      ctx.fill();
      ctx.globalAlpha = 0.9; ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // קודקודים ושמות
    ctx.font = '600 12px Assistant, sans-serif'; ctx.textAlign = 'center';
    RULERS.forEach((r, i) => {
      const q = proj(rp[i]);
      ctx.beginPath(); ctx.arc(q[0], q[1], 4, 0, Math.PI * 2); ctx.fillStyle = gold; ctx.fill();
      const e = proj(rot(DIRS[i].map(x => x * 1.13)));
      ctx.fillStyle = css('--muted') || '#555';
      ctx.fillText(r.name, e[0], e[1] + 4);
    });
  }

  function shade(hex, l) {
    const m = hex.replace('#', '');
    const [r, g, b] = [0, 2, 4].map(i => parseInt(m.slice(i, i + 2), 16));
    const k = v => Math.round(Math.min(255, v * l + 40 * (1 - l)));
    return `rgb(${k(r)},${k(g)},${k(b)})`;
  }

  function loop() { if (auto && !reduced) rotY += 0.004; draw(); raf = requestAnimationFrame(loop); }

  canvas.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; auto = false; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    rotY += (e.clientX - drag[0]) * 0.01; rotX += (e.clientY - drag[1]) * 0.01;
    rotX = Math.max(-1.4, Math.min(1.4, rotX)); drag = [e.clientX, e.clientY];
  });
  const end = () => { drag = null; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);

  loop();
  return {
    set(v) { values = { ...v }; },
    stop() { cancelAnimationFrame(raf); },
  };
}
