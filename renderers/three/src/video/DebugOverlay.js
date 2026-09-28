/**
 * Preview-only transport and read-out.
 *
 * This is plain DOM sitting beside the composite canvas — it is never drawn
 * into the frame, so it cannot leak into the render. The offline renderer
 * never constructs it at all.
 */
const fmt = (t) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const f = Math.floor((t % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(f).padStart(2, '0')}`;
};

/**
 * Stream-copying the MP3 out of the MPEG program stream drops the container's
 * padding, so the preview file runs ~12 ms ahead of the master that ffmpeg
 * muxes from voiceover.mpeg. Correct for it here and the HUD's SYNC read-out
 * reflects the finished video, not the preview copy.
 */
const PREVIEW_AUDIO_OFFSET = 0.012;

export function createDebugOverlay({ app, audio, root }) {
  const el = document.createElement('div');
  el.className = 'hud';
  el.innerHTML = `
    <div class="hud-bar">
      <button class="hud-btn" data-act="play">▶</button>
      <span class="hud-time" data-f="time">00:00.00</span>
      <span class="hud-sep"></span>
      <span class="hud-k">FRAME</span><span data-f="frame">0</span>
      <span class="hud-sep"></span>
      <span class="hud-k">SECTION</span><span data-f="section">—</span>
      <span class="hud-sep"></span>
      <span class="hud-k">SHOT</span><span data-f="shot">—</span>
      <span class="hud-sep"></span>
      <span class="hud-k">GO TO</span>
      <input class="hud-goto" type="text" placeholder="7:15" size="6" aria-label="Jump to timestamp" />
      <span class="hud-grow"></span>
      <span class="hud-k">HEATSINK</span><span data-f="heatsink">0.00</span>
      <span class="hud-sep"></span>
      <span class="hud-k">SYNC</span><span data-f="sync">—</span>
    </div>
    <div class="hud-bar hud-bar-thin">
      <span class="hud-k">CUES</span><span data-f="cues" class="hud-cues">—</span>
    </div>
    <div class="hud-bar">
      <input class="hud-scrub" type="range" min="0" max="1000" value="0" step="1" />
    </div>
    <div class="hud-bar hud-chapters"></div>
    <p class="hud-help">space play/pause · ←/→ 1 frame · shift+←/→ 1 s · alt+←/→ 10 s · , . prev/next chapter · c captions (reload)</p>
  `;
  root.appendChild(el);

  const f = (name) => el.querySelector(`[data-f="${name}"]`);
  const scrub = el.querySelector('.hud-scrub');
  const playBtn = el.querySelector('[data-act="play"]');
  const chapters = el.querySelector('.hud-chapters');
  const goto = el.querySelector('.hud-goto');

  app.story.sections.forEach((s) => {
    const b = document.createElement('button');
    b.className = 'hud-chip';
    b.textContent = `${s.index} ${s.label}`;
    b.onclick = () => setTime(s.from + 0.05);
    chapters.appendChild(b);
  });

  let time = 0;
  let playing = false;

  function setTime(t, { fromAudio = false } = {}) {
    time = Math.max(0, Math.min(app.duration, t));
    if (!fromAudio && audio) {
      const target = Math.max(0, Math.min(time - PREVIEW_AUDIO_OFFSET, audio.duration || app.audioDuration));
      if (Math.abs(audio.currentTime - target) > 0.05) audio.currentTime = target;
    }
    render();
  }

  function render() {
    app.seek(time);
    const d = app.describeAt(time);
    f('time').textContent = fmt(time);
    f('frame').textContent = String(Math.round(time * app.fps));
    f('section').textContent = `${d.section.index} ${d.section.label}`;
    f('shot').textContent = `${d.camera.index} ${d.camera.view} (${d.camera.motion})`;
    f('heatsink').textContent = d.heatsink.toFixed(2);
    f('cues').textContent = d.cues.length ? d.cues.join('  ·  ') : '—';
    if (audio) {
      const drift = (audio.currentTime + PREVIEW_AUDIO_OFFSET - time) * 1000;
      f('sync').textContent = `${drift >= 0 ? '+' : ''}${drift.toFixed(0)} ms`;
      f('sync').style.color = Math.abs(drift) > 60 ? '#FF7A6B' : '#5CFF8A';
    }
    scrub.value = String(Math.round((time / app.duration) * 1000));
  }

  function play() {
    if (playing) return;
    playing = true;
    playBtn.textContent = '❚❚';
    audio?.play().catch(() => {});
  }

  function pause() {
    playing = false;
    playBtn.textContent = '▶';
    audio?.pause();
  }

  // "7:15", "7:15.5" or a bare number of seconds.
  goto.onkeydown = (e) => {
    if (e.key !== 'Enter') return;
    const parts = goto.value.trim().split(':').map(Number);
    if (!parts.length || parts.some(Number.isNaN)) return;
    pause();
    setTime(parts.reduce((a, p) => a * 60 + p, 0));
    goto.blur();
  };

  playBtn.onclick = () => (playing ? pause() : play());
  scrub.oninput = () => {
    pause();
    setTime((Number(scrub.value) / 1000) * app.duration);
  };

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement && e.target !== scrub) return;
    if (document.activeElement === goto) return;
    const step = e.altKey ? 10 : e.shiftKey ? 1 : 1 / app.fps;
    if (e.code === 'Space') {
      e.preventDefault();
      playing ? pause() : play();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      pause();
      setTime(time + step);
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      pause();
      setTime(time - step);
    } else if (e.key === '.' || e.key === ',') {
      e.preventDefault();
      pause();
      const list = app.story.sections;
      const i = list.findIndex((s) => time >= s.from && time < s.to);
      const j = Math.max(0, Math.min(list.length - 1, i + (e.key === '.' ? 1 : -1)));
      setTime(list[j].from + 0.05);
    } else if (e.key === 'c') {
      const u = new URL(location.href);
      u.searchParams.set('captions', u.searchParams.get('captions') === '1' ? '0' : '1');
      u.searchParams.set('t', time.toFixed(2));
      location.href = u.toString();
    }
  });

  function frame() {
    if (playing) {
      const t = audio && !audio.paused ? audio.currentTime + PREVIEW_AUDIO_OFFSET : time + 1 / 60;
      if (t >= app.duration) {
        pause();
        setTime(app.duration);
      } else setTime(t, { fromAudio: true });
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return { setTime, play, pause, render, get time() { return time; } };
}
