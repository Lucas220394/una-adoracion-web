// ===== Configuración editable =====
const WHATSAPP_NUMBER = ''; // Ej: '5215512345678' (código de país + número, sin + ni espacios)

// Pistas del reproductor del hero. Coloca los .mp3 en /audio y ajusta aquí.
const TRACKS = [
  { title: 'En el río', artist: 'UNA ADORACIÓN', src: 'audio/en-el-rio.mp3', cover: 'img/foto-04.jpg' },
];

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (id) => document.getElementById(id);

// ===== Navegación =====
const nav = $('nav');
const toggle = $('navToggle');
const links = $('navLinks');
function setMenu(open) {
  links.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', open);
}
toggle.addEventListener('click', () => setMenu(!links.classList.contains('open')));
links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));

// ===== Reveal con escalonado =====
document.querySelectorAll('.team, .gallery, .events, .stats, .platforms, .hero__cta').forEach(group => {
  group.querySelectorAll(':scope > .reveal').forEach((el, i) => el.style.setProperty('--d', `${i * 0.1}s`));
});
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// ===== Titulares que se iluminan palabra por palabra al hacer scroll =====
const statements = [...document.querySelectorAll('.statement')];
const wordGroups = statements.map(h => {
  const words = [];
  const wrap = (node) => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(part); return; }
          const s = document.createElement('span');
          s.className = 'word'; s.textContent = part;
          words.push(s); frag.append(s);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') wrap(n);
    });
  };
  wrap(h);
  h.classList.add('in'); // el efecto lo da .word, no el reveal del bloque
  return { el: h, words };
});

// ===== Efectos ligados al scroll (parallax, progreso, palabras) =====
const progress = $('progress');
const heroBg = document.querySelector('.hero__bg');
const heroContent = document.querySelector('.hero__content');
const playerEl = $('player');
const hero = $('inicio');
const worldmap = $('worldmap');
const parallaxImgs = [...document.querySelectorAll('.ph img, .feature__art img, .member__photo img')];

let ticking = false;
function onScroll() {
  const y = window.scrollY, vh = window.innerHeight;
  nav.classList.toggle('scrolled', y > 40);
  const max = document.documentElement.scrollHeight - vh;
  progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  if (reduceMotion) return;

  if (y < vh * 1.2) {
    const p = Math.min(y / vh, 1);
    heroBg.style.transform = `translate3d(0, ${y * 0.28}px, 0) scale(${1.06 + p * 0.1})`;
    heroContent.style.transform = `translate3d(0, ${y * 0.18}px, 0) scale(${1 - p * 0.06})`;
    heroContent.style.opacity = 1 - p * 1.25;
    playerEl.style.transform = `translate3d(0, ${y * 0.1}px, 0)`;
    playerEl.style.opacity = 1 - p * 0.9;
  }

  if (worldmap) {
    const r = worldmap.parentElement.getBoundingClientRect();
    if (r.bottom > 0 && r.top < vh) worldmap.style.transform = `translate3d(0, ${(r.top + r.height / 2 - vh / 2) * -0.04}px, 0)`;
  }

  parallaxImgs.forEach(img => {
    const r = img.parentElement.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh) return;
    const off = ((r.top + r.height / 2) - vh / 2) / vh; // -1..1 aprox
    img.style.transform = `translate3d(0, ${off * -28}px, 0)`;
  });

  wordGroups.forEach(({ el, words }) => {
    const r = el.getBoundingClientRect();
    if (r.bottom < -100 || r.top > vh) return;
    const start = vh * 0.88, end = vh * 0.38;
    const prog = Math.min(Math.max((start - r.top) / (start - end), 0), 1) * words.length;
    words.forEach((w, i) => w.style.setProperty('--p', Math.min(Math.max(prog - i, 0), 1)));
  });
}
window.addEventListener('scroll', () => {
  if (!ticking) { ticking = true; requestAnimationFrame(() => { onScroll(); ticking = false; }); }
}, { passive: true });
window.addEventListener('resize', onScroll);
onScroll();

// ===== Contadores =====
const cio = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    cio.unobserve(e.target);
    const end = +e.target.dataset.count, t0 = performance.now();
    const tick = (t) => {
      const p = Math.min((t - t0) / 1400, 1);
      e.target.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}, { threshold: 0.6 });
document.querySelectorAll('[data-count]').forEach(el => cio.observe(el));

// ===== Reproductor del hero =====
(function initPlayer() {
  const audio = $('plAudio'), playBtn = $('plPlay'), prevBtn = $('plPrev'), nextBtn = $('plNext');
  const seek = $('plSeek'), cur = $('plCur'), dur = $('plDur'), note = $('plNote');
  const canvas = $('plWave'), ctx = canvas.getContext('2d');
  let idx = 0, actx, analyser, data, raf, ready = false;

  const fmt = (s) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');
  const showNote = (t) => { note.hidden = !t; note.textContent = t || ''; };

  function load(i) {
    idx = (i + TRACKS.length) % TRACKS.length;
    const t = TRACKS[idx];
    $('plTitle').textContent = t.title;
    $('plArtist').textContent = t.artist;
    $('plCover').src = t.cover;
    ready = false; showNote('');
    audio.src = t.src;
    seek.value = 0; seek.style.setProperty('--fill', '0%');
    cur.textContent = '0:00'; dur.textContent = '0:00';
  }
  prevBtn.disabled = nextBtn.disabled = TRACKS.length < 2;

  function setupAnalyser() {
    if (actx) return;
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = actx.createAnalyser();
      analyser.fftSize = 128;
      actx.createMediaElementSource(audio).connect(analyser);
      analyser.connect(actx.destination);
      data = new Uint8Array(analyser.frequencyBinCount);
    } catch (_) { analyser = null; }
  }

  // Onda: barras espejadas; con audio real reacciona, si no, oscila suave
  function draw(t = 0) {
    const w = canvas.width, h = canvas.height, bars = 44, gap = 3, bw = w / bars - gap;
    ctx.clearRect(0, 0, w, h);
    const playing = !audio.paused;
    if (playing && analyser) analyser.getByteFrequencyData(data);
    for (let i = 0; i < bars; i++) {
      let v;
      if (playing && analyser) v = data[Math.floor(i / bars * data.length * 0.7)] / 255;
      else if (playing) v = 0.35 + 0.35 * Math.sin(t / 220 + i * 0.6) * Math.sin(t / 530 + i);
      else v = 0.08 + 0.05 * Math.sin(i * 0.5);
      const bh = Math.max(3, v * h * 0.95);
      ctx.fillStyle = `rgba(242, 92, 42, ${0.35 + v * 0.65})`;
      ctx.beginPath();
      ctx.roundRect(i * (bw + gap), (h - bh) / 2, bw, bh, 2);
      ctx.fill();
    }
    raf = requestAnimationFrame(draw);
  }
  draw();

  async function play() {
    if (!ready && !audio.src) return;
    setupAnalyser();
    try { if (actx && actx.state === 'suspended') await actx.resume(); await audio.play(); }
    catch (_) { showNote('No se pudo reproducir. Agrega el archivo de audio en la carpeta /audio.'); }
  }
  playBtn.addEventListener('click', () => (audio.paused ? play() : audio.pause()));
  prevBtn.addEventListener('click', () => { const was = !audio.paused; load(idx - 1); if (was) play(); });
  nextBtn.addEventListener('click', () => { const was = !audio.paused; load(idx + 1); if (was) play(); });

  audio.addEventListener('play', () => { playerEl.classList.add('playing'); playBtn.setAttribute('aria-label', 'Pausar'); });
  audio.addEventListener('pause', () => { playerEl.classList.remove('playing'); playBtn.setAttribute('aria-label', 'Reproducir'); });
  audio.addEventListener('ended', () => (TRACKS.length > 1 ? (load(idx + 1), play()) : (audio.currentTime = 0)));
  audio.addEventListener('loadedmetadata', () => { ready = true; dur.textContent = fmt(audio.duration); });
  audio.addEventListener('error', () => showNote('Agrega tu audio en “audio/en-el-rio.mp3” para activar el reproductor.'));
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    seek.value = pct; seek.style.setProperty('--fill', `${pct}%`);
    cur.textContent = fmt(audio.currentTime);
  });
  seek.addEventListener('input', () => {
    if (audio.duration) audio.currentTime = (seek.value / 100) * audio.duration;
    seek.style.setProperty('--fill', `${seek.value}%`);
  });

  load(0);
})();

// ===== FAQ (acordeón: uno abierto a la vez) =====
document.querySelectorAll('.faq__q').forEach(btn => {
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') === 'true';
    document.querySelectorAll('.faq__q').forEach(b => b.setAttribute('aria-expanded', 'false'));
    btn.setAttribute('aria-expanded', String(!open));
  });
});

// ===== Formulario -> WhatsApp =====
const form = $('form');
const formNote = $('formNote');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(form));
  const text = `Hola UNA ADORACIÓN, soy ${d.nombre} (${d.correo}).\nFecha: ${d.fecha || 'por definir'}\nLugar: ${d.lugar || 'por definir'}\n\n${d.mensaje}`;
  if (!WHATSAPP_NUMBER) {
    formNote.textContent = 'Configura WHATSAPP_NUMBER en js/main.js para activar el envío.';
    return;
  }
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
});

$('year').textContent = new Date().getFullYear();
