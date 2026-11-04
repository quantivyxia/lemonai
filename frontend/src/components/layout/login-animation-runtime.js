// Animation behavior from login-animado (1).html, scoped to this component.
export function startLoginAnimation(root) {
  const frames = new Set(), intervals = new Set(), listeners = [];
  const document = { getElementById: id => root.querySelector('[id="' + id + '"]') };
  const window = { get devicePixelRatio() { return globalThis.devicePixelRatio }, get innerWidth() { return globalThis.innerWidth }, get innerHeight() { return globalThis.innerHeight }, addEventListener(type, fn) { globalThis.addEventListener(type, fn); listeners.push([type, fn]); } };
  const requestAnimationFrame = fn => { const id = globalThis.requestAnimationFrame(t => { frames.delete(id); fn(t); }); frames.add(id); return id; };
  const setInterval = (fn, delay) => { const id = globalThis.setInterval(fn, delay); intervals.add(id); return id; };
  /* ============ Network background ============ */
  const canvas = document.getElementById("net");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, pts = [];
  const mouse = { x: -9999, y: -9999 };

  function resizeNet() {
    const dpr = window.devicePixelRatio || 1;
    W = canvas.offsetWidth; H = canvas.offsetHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round((W * H) / 9000);
    pts = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
    }));
  }
  function drawNet() {
    ctx.clearRect(0, 0, W, H);
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
    }
    const max = 130;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      for (let j = i + 1; j < pts.length; j++) {
        const b = pts[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < max) {
          ctx.strokeStyle = `rgba(150,180,255,${(1 - d / max) * 0.35})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      const md = Math.hypot(a.x - mouse.x, a.y - mouse.y);
      if (md < 180) {
        ctx.strokeStyle = `rgba(255,220,90,${(1 - md / 180) * 0.5})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
      }
      ctx.fillStyle = "rgba(190,210,255,0.7)";
      ctx.beginPath(); ctx.arc(a.x, a.y, 1.4, 0, Math.PI * 2); ctx.fill();
    }
    requestAnimationFrame(drawNet);
  }
  resizeNet(); drawNet();
  window.addEventListener("resize", resizeNet);
  window.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  });

  /* ============ 3D stack tilt ============ */
  const stack = document.getElementById("stack");
  let tgt = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  window.addEventListener("mousemove", (e) => {
    tgt.x = (e.clientX / window.innerWidth - 0.5) * 2;
    tgt.y = (e.clientY / window.innerHeight - 0.5) * 2;
  });
  function tiltLoop(t) {
    cur.x += (tgt.x - cur.x) * 0.06;
    cur.y += (tgt.y - cur.y) * 0.06;
    const idle = Math.sin(t / 2600) * 3;
    stack.style.transform = `rotateX(${10 - cur.y * 8}deg) rotateY(${-16 + cur.x * 12 + idle}deg)`;
    requestAnimationFrame(tiltLoop);
  }
  requestAnimationFrame(tiltLoop);

  /* ============ Revenue live chart ============ */
  const N = 40;
  let pts2 = Array.from({ length: N }, (_, i) => 55 + Math.sin(i / 4) * 8);
  const revArea = document.getElementById("revArea");
  const revLine = document.getElementById("revLine");
  const revDot = document.getElementById("revDot");
  function drawRev() {
    const line = pts2.map((y, i) => `${(i / (N - 1)) * 100},${100 - y}`).join(" ");
    revLine.setAttribute("points", line);
    revArea.setAttribute("points", `0,100 ${line} 100,100`);
    revDot.setAttribute("cx", "100");
    revDot.setAttribute("cy", String(100 - pts2[N - 1]));
  }
  setInterval(() => {
    const last = pts2[N - 1];
    const next = Math.max(25, Math.min(80, last + (Math.random() - 0.48) * 9));
    pts2 = [...pts2.slice(1), next];
    drawRev();
  }, 600);
  drawRev();

  /* ============ Students counter ============ */
  const stuNum = document.getElementById("stuNum");
  const stuPct = document.getElementById("stuPct");
  let target = 6144, shown = 6144;
  setInterval(() => { target += Math.round(Math.random() * 14 - 4); }, 2600);
  function counterLoop() {
    shown += (target - shown) * 0.06;
    if (Math.abs(target - shown) < 0.5) shown = target;
    stuNum.textContent = Math.round(shown).toLocaleString("pt-BR");
    stuPct.textContent = "▲ " + ((target - 6144) / 6144 * 100 + 5.1).toFixed(1).replace(".", ",") + "%";
    requestAnimationFrame(counterLoop);
  }
  counterLoop();

  /* ============ Branch bars ============ */
  const barsBox = document.getElementById("branchBars");
  
  let bars = [80, 62, 30, 68, 50, 32, 28, 86];
  barsBox.innerHTML = bars.map(() => "<div></div>").join("");
  const barEls = [...barsBox.children];
  function paintBars() { bars.forEach((b, i) => (barEls[i].style.height = b + "%")); }
  setInterval(() => {
    bars = bars.map((b) => Math.max(18, Math.min(100, b + (Math.random() * 34 - 17))));
    paintBars();
  }, 1500);
  paintBars();

  /* ============ Code typer ============ */
  const CODE = [
    [["c", "// LemonAI · pipeline de dados"]],
    [["k", "const "], ["t", "dados = "], ["k", "await"]],
    [["t", "lemon."], ["f", "query"], ["t", "("], ["s", "'alunos_ativos'"], ["t", ");"]],
    [["k", "const "], ["t", "insight = "], ["f", "analisar"], ["t", "(dados, {"]],
    [["t", "periodo: "], ["s", "'12m'"], ["t", " });"]],
    [["t", "dashboard."], ["f", "render"], ["t", "(insight); "], ["c", "// ✓ 128ms"]],
  ];
  const total = CODE.flat().reduce((n, [, s]) => n + s.length, 0);
  const codeBox = document.getElementById("codeBox");
  let typed = 0;
  function renderCode() {
    let left = typed;
    let html = "";
    for (const row of CODE) {
      html += "<div>";
      for (const [k, s] of row) {
        const shown = s.slice(0, Math.max(0, left));
        left -= s.length;
        if (shown) html += `<span class="tok-${k}">${shown.replace(/</g, "<")}</span>`;
      }
      html += "</div>";
    }
    if (typed < total) html += '<span class="caret"></span>';
    codeBox.innerHTML = html;
  }
  setInterval(() => {
    typed = typed > total + 60 ? 0 : typed + 1;
    renderCode();
  }, 45);
  renderCode();


return () => { frames.forEach(id => globalThis.cancelAnimationFrame(id)); intervals.forEach(id => globalThis.clearInterval(id)); listeners.forEach(([type, fn]) => globalThis.removeEventListener(type, fn)); };
}
