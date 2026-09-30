// Aquaponics Monitor — simulated sensor feed with threshold-based alerts.
// Swap `readSensors()` for a fetch() to your ESP32/Raspberry Pi endpoint to go live.

const METRICS = [
  { key: "waterTemp", label: "Water temp", unit: "°C", min: 22, max: 28, start: 25, drift: 0.15, ok: [24, 27] },
  { key: "ph",        label: "pH",         unit: "",   min: 5.5, max: 8.5, start: 6.9, drift: 0.05, ok: [6.4, 7.4] },
  { key: "oxygen",    label: "Dissolved O₂", unit: "mg/L", min: 3, max: 10, start: 6.5, drift: 0.2, ok: [5, 9] },
  { key: "ammonia",   label: "Ammonia",    unit: "ppm", min: 0, max: 2, start: 0.2, drift: 0.05, ok: [0, 0.5] },
  { key: "airTemp",   label: "Air temp",   unit: "°C", min: 15, max: 35, start: 24, drift: 0.2, ok: [18, 30] },
  { key: "humidity",  label: "Humidity",   unit: "%",  min: 30, max: 95, start: 65, drift: 0.8, ok: [50, 80] },
  { key: "light",     label: "Light",      unit: "lux", min: 0, max: 20000, start: 9000, drift: 300, ok: [4000, 18000] },
  { key: "waterLevel",label: "Water level",unit: "%",  min: 40, max: 100, start: 88, drift: 0.3, ok: [70, 100] },
];
const HISTORY = 60;
const state = Object.fromEntries(METRICS.map(m => [m.key, [m.start]]));

function readSensors() {
  // Random walk that occasionally wanders out of range so alerts have something to show.
  return Object.fromEntries(METRICS.map(m => {
    const prev = state[m.key].at(-1);
    let next = prev + (Math.random() - 0.5) * 2 * m.drift;
    if (Math.random() < 0.02) next += (Math.random() < 0.5 ? -1 : 1) * m.drift * 8;
    return [m.key, Math.min(m.max, Math.max(m.min, next))];
  }));
}

function level(m, v) {
  const [lo, hi] = m.ok, pad = (hi - lo) * 0.15;
  if (v < lo - pad || v > hi + pad) return "bad";
  if (v < lo || v > hi) return "warn";
  return "ok";
}
const fmt = (m, v) => m.unit === "lux" ? Math.round(v).toLocaleString() : v.toFixed(m.key === "ph" || m.key === "ammonia" ? 2 : 1);

// --- UI -------------------------------------------------------------------
const grid = document.getElementById("metrics");
const cards = {};
for (const m of METRICS) {
  const el = document.createElement("div");
  el.className = "card";
  el.innerHTML = `<div class="label">${m.label}</div><div class="value"><span></span><small>${m.unit}</small></div><div class="range">ok ${m.ok[0]}–${m.ok[1]} ${m.unit}</div>`;
  grid.appendChild(el);
  cards[m.key] = el;
}

const select = document.getElementById("chart-select");
for (const m of METRICS) select.add(new Option(m.label, m.key));
select.value = "waterTemp";
select.onchange = draw;

const canvas = document.getElementById("chart");
function draw() {
  const m = METRICS.find(x => x.key === select.value), data = state[m.key];
  const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = 180;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);
  const y = v => h - 10 - ((v - m.min) / (m.max - m.min)) * (h - 20);
  const x = i => (i / (HISTORY - 1)) * w;

  ctx.fillStyle = "rgba(46,204,143,.08)";
  ctx.fillRect(0, y(m.ok[1]), w, y(m.ok[0]) - y(m.ok[1]));
  ctx.strokeStyle = "#3fb8d8"; ctx.lineWidth = 2; ctx.beginPath();
  data.forEach((v, i) => i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)));
  ctx.stroke();
  ctx.fillStyle = "#7f9aa3"; ctx.font = "11px system-ui";
  ctx.fillText(`${m.max} ${m.unit}`, 4, 12); ctx.fillText(`${m.min} ${m.unit}`, 4, h - 2);
}

const alerts = document.getElementById("alerts"), status = document.getElementById("status"), statusText = document.getElementById("status-text");
const lastLevel = {};
function tick() {
  const r = readSensors();
  let worst = "ok";
  for (const m of METRICS) {
    state[m.key].push(r[m.key]); if (state[m.key].length > HISTORY) state[m.key].shift();
    const lv = level(m, r[m.key]);
    cards[m.key].className = `card ${lv}`;
    cards[m.key].querySelector(".value span").textContent = fmt(m, r[m.key]);
    if (lv !== "ok" && lastLevel[m.key] !== lv) {
      if (alerts.firstElementChild?.classList.contains("muted")) alerts.innerHTML = "";
      const li = document.createElement("li");
      li.innerHTML = `<time>${new Date().toLocaleTimeString()}</time><span class="${lv}">${m.label} ${lv === "bad" ? "critical" : "out of range"}: ${fmt(m, r[m.key])} ${m.unit}</span>`;
      alerts.prepend(li); while (alerts.children.length > 8) alerts.lastChild.remove();
    }
    lastLevel[m.key] = lv;
    if (lv === "bad" || (lv === "warn" && worst === "ok")) worst = lv;
  }
  status.className = `status ${worst}`;
  statusText.textContent = { ok: "All systems normal", warn: "Attention needed", bad: "Critical reading" }[worst];
  draw();
}
for (let i = 0; i < HISTORY - 1; i++) tick(); alerts.innerHTML = '<li class="muted">No alerts yet.</li>'; tick(); setInterval(tick, 2000); window.addEventListener("resize", draw);
