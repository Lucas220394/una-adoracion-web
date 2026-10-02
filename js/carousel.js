// Carrusel 3D de música (versión sin dependencias del componente "MusicCarousel" de Framer).
// Edita las pistas aquí. `audio` es opcional: sin archivo, el botón de play se oculta.
const MC_TRACKS = [
  { title: 'En el río', artist: 'UNA ADORACIÓN', cover: 'img/foto-04.jpg', audio: 'audio/en-el-rio.mp3' },
  { title: 'Todo lo demás', artist: 'UNA ADORACIÓN', cover: 'img/foto-03.jpg', audio: '' },
  { title: 'Nombre del tema', artist: 'UNA ADORACIÓN', cover: 'img/foto-02.jpg', audio: '' },
  { title: 'Nombre del tema', artist: 'UNA ADORACIÓN', cover: 'img/foto-01.jpg', audio: '' },
];

(function () {
  const root = document.getElementById('mc');
  if (!root) return;
  const stage = document.getElementById('mcStage');
  const playBtn = document.getElementById('mcPlay');
  const dotsEl = document.getElementById('mcDots');
  const heroAudio = document.getElementById('plAudio');
  const BG = '#0a0a0c';
  const cfg = { cardW: 280, cardH: 280, sideScale: 0.6, gap: 80, rotateY: 35, reflH: 80, reflOpacity: 0.4 };
  const n = MC_TRACKS.length;
  let cur = 0, audio = null, playing = false, wasPlaying = false, auto = null;

  // ----- Construcción de tarjetas -----
  const cards = MC_TRACKS.map((t, i) => {
    const el = document.createElement('div');
    el.className = 'mc__card';
    el.innerHTML = `
      <div class="mc__face">
        <img src="${t.cover}" alt="Portada de ${t.title}" draggable="false">
        <div class="mc__shade"></div>
        <div class="mc__txt"><span>${t.artist}</span><strong>${t.title}</strong></div>
      </div>
      <div class="mc__ref"><img src="${t.cover}" alt="" draggable="false"><i></i></div>`;
    el.addEventListener('click', () => { if (!dragged && i !== cur) go(i); });
    stage.append(el);
    return el;
  });
  const dots = MC_TRACKS.map((t, i) => {
    const b = document.createElement('button');
    b.setAttribute('aria-label', `Ir a ${t.title}`);
    b.addEventListener('click', () => go(i));
    dotsEl.append(b);
    return b;
  });

  // ----- Posición 3D de cada tarjeta -----
  function layout() {
    const w = root.clientWidth;
    const k = Math.min(1, w / 760);                 // reduce en pantallas chicas
    cfg.cardW = cfg.cardH = Math.round(280 * Math.max(k, 0.62));
    cfg.gap = Math.round(80 * Math.max(k, 0.4));
    stage.style.width = cfg.cardW + 'px';
    stage.style.height = cfg.cardH + cfg.reflH + 60 + 'px';
    cards.forEach((el, i) => {
      let d = i - cur;
      if (d > n / 2) d -= n;
      if (d < -n / 2) d += n;
      const abs = Math.abs(d), center = d === 0, dir = d < 0 ? -1 : d > 0 ? 1 : 0;
      const scale = center ? 1 : Math.max(0.4, cfg.sideScale - Math.min(abs, 3) * 0.1);
      const x = center ? 0 : dir * (cfg.cardW * 0.5 + cfg.gap + abs * 30);
      const z = center ? 100 : -abs * 50;
      const ry = center ? 0 : d < 0 ? cfg.rotateY : -cfg.rotateY;
      el.style.width = el.style.height = cfg.cardW + 'px';
      el.style.zIndex = 100 - abs;
      el.style.transform = `translateX(${x}px) translateZ(${z}px) rotateY(${ry}deg) scale(${scale})`;
      el.style.cursor = center ? 'default' : 'pointer';
      el.classList.toggle('is-center', center);
      el.querySelector('.mc__ref').style.opacity = cfg.reflOpacity * scale;
      el.querySelector('.mc__ref').style.height = cfg.reflH + 'px';
      el.querySelector('.mc__ref img').style.height = cfg.cardH + 'px';
      el.setAttribute('aria-hidden', center ? 'false' : 'true');
    });
    dots.forEach((b, i) => b.classList.toggle('on', i === cur));
  }

  // ----- Audio -----
  function loadAudio() {
    if (audio) { audio.pause(); audio = null; }
    setPlaying(false);
    const t = MC_TRACKS[cur];
    playBtn.classList.toggle('has-audio', !!t.audio);
    if (!t.audio) return;
    audio = new Audio(t.audio);
    audio.addEventListener('ended', () => { setPlaying(false); wasPlaying = false; });
    audio.addEventListener('error', () => { playBtn.classList.remove('has-audio'); setPlaying(false); });
    if (wasPlaying) { stopHero(); audio.play().then(() => setPlaying(true)).catch(() => {}); }
  }
  function setPlaying(v) {
    playing = v;
    playBtn.classList.toggle('playing', v);
    playBtn.setAttribute('aria-label', v ? 'Pausar' : 'Reproducir');
  }
  function stopHero() { if (heroAudio && !heroAudio.paused) heroAudio.pause(); }
  playBtn.addEventListener('click', () => {
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); wasPlaying = false; }
    else { stopHero(); audio.play().then(() => { setPlaying(true); wasPlaying = true; }).catch(() => {}); }
  });
  // Un solo audio a la vez: si suena el del hero, pausa el carrusel
  if (heroAudio) heroAudio.addEventListener('play', () => { if (audio && playing) { audio.pause(); setPlaying(false); wasPlaying = false; } });

  // ----- Navegación -----
  function go(i) { cur = (i + n) % n; layout(); loadAudio(); }
  document.getElementById('mcPrev').addEventListener('click', () => go(cur - 1));
  document.getElementById('mcNext').addEventListener('click', () => go(cur + 1));

  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(n - 1); }
    else if (e.key === ' ' && audio) { e.preventDefault(); playBtn.click(); }
    else if (/^[1-9]$/.test(e.key) && +e.key <= n) { e.preventDefault(); go(+e.key - 1); }
  });

  // ----- Arrastrar / deslizar -----
  let sx = 0, dx = 0, down = false, dragged = false, t0 = 0;
  stage.addEventListener('pointerdown', (e) => { down = true; dragged = false; sx = e.clientX; dx = 0; t0 = performance.now(); stage.classList.add('grabbing'); });
  window.addEventListener('pointermove', (e) => { if (down) { dx = e.clientX - sx; if (Math.abs(dx) > 6) dragged = true; } });
  window.addEventListener('pointerup', () => {
    if (!down) return;
    down = false; stage.classList.remove('grabbing');
    const v = Math.abs(dx) / Math.max(performance.now() - t0, 1) * 1000;
    if (Math.abs(dx) > 50 || v > 500) go(dx > 0 ? cur - 1 : cur + 1);
    setTimeout(() => (dragged = false), 0);
  });

  window.addEventListener('resize', layout);
  layout();
  loadAudio();
})();
