(() => {
  const data = JSON.parse(document.getElementById('slideshow-data').textContent);
  const lastIndex = Math.max(0, data.slides.length - 1);
  const slideCss = '<style>' + data.css + '</style>';
  const screen = document.querySelector('.screen');
  const overlay = document.querySelector('.notes-overlay');
  const hint = document.querySelector('.hint');
  const NEXT_KEYS = ['ArrowRight', 'ArrowDown', ' ', 'PageDown'];
  const PREVIOUS_KEYS = ['ArrowLeft', 'ArrowUp', 'PageUp'];
  const HINT_SHOWN_MS = 4000;

  let current = 0;
  let presenter = null;

  function drawSlide(host, index) {
    const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
    const slide = data.slides[index];
    root.innerHTML = slide ? slideCss + slide.html : '';
  }

  function fitInto(box) {
    const frame = box.querySelector('.frame');
    const host = box.querySelector('.slide');
    const scale = Math.min(box.clientWidth / data.width, box.clientHeight / data.height);
    frame.style.width = data.width * scale + 'px';
    frame.style.height = data.height * scale + 'px';
    host.style.transform = 'scale(' + scale + ')';
  }

  function notesOf(index) {
    const slide = data.slides[index];
    return slide ? slide.notes : '';
  }

  function twoDigits(n) {
    return String(n).padStart(2, '0');
  }

  function elapsedText(ms) {
    const seconds = Math.floor(ms / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return (h > 0 ? h + ':' : '') + twoDigits(m) + ':' + twoDigits(s);
  }

  function presenterIsOpen() {
    return presenter !== null && !presenter.window.closed;
  }

  function presenterPart(name) {
    return presenter.window.document.querySelector('[data-presenter="' + name + '"]');
  }

  function drawPresenter() {
    if (!presenterIsOpen()) return;
    drawSlide(presenterPart('current').querySelector('.slide'), current);
    drawSlide(presenterPart('next').querySelector('.slide'), current < lastIndex ? current + 1 : -1);
    presenterPart('notes').textContent = notesOf(current);
    presenterPart('position').textContent = current + 1 + ' / ' + data.slides.length;
    fitPresenter();
  }

  function fitPresenter() {
    if (!presenterIsOpen()) return;
    fitInto(presenterPart('current'));
    fitInto(presenterPart('next'));
  }

  function tickElapsed() {
    if (!presenterIsOpen()) return;
    presenterPart('elapsed').textContent = elapsedText(Date.now() - presenter.startedAt);
  }

  function show(index) {
    current = Math.min(lastIndex, Math.max(0, index));
    screen.dataset.current = String(current);
    drawSlide(screen.querySelector('.slide'), current);
    overlay.textContent = notesOf(current);
    drawPresenter();
  }

  function toggleNotesOverlay() {
    overlay.hidden = !overlay.hidden;
  }

  function toggleFullscreen() {
    const request = document.fullscreenElement ? document.exitFullscreen : document.documentElement.requestFullscreen;
    if (!request) return;
    const target = document.fullscreenElement ? document : document.documentElement;
    Promise.resolve(request.call(target)).catch(() => {});
  }

  function openPresenter() {
    if (presenterIsOpen()) {
      presenter.window.focus();
      return;
    }
    const win = window.open('', '_blank', 'width=1100,height=700');
    if (!win) {
      toggleNotesOverlay();
      return;
    }
    presenter = { window: win, startedAt: Date.now() };
    win.document.title = '発表者の画面 - ' + data.title;
    win.document.body.innerHTML = document.getElementById('presenter-template').innerHTML;
    win.document.addEventListener('keydown', onKey);
    win.addEventListener('resize', fitPresenter);
    win.setInterval(tickElapsed, 1000);
    tickElapsed();
    drawPresenter();
  }

  function hideHint() {
    if (hint) hint.classList.add('gone');
  }

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    hideHint();
    if (NEXT_KEYS.includes(e.key)) show(current + 1);
    else if (PREVIOUS_KEYS.includes(e.key)) show(current - 1);
    else if (e.key === 'Home') show(0);
    else if (e.key === 'End') show(lastIndex);
    else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    else if (e.key === 'p' || e.key === 'P') openPresenter();
    else if (e.key === 'n' || e.key === 'N') toggleNotesOverlay();
    else return;
    e.preventDefault();
  }

  document.addEventListener('keydown', onKey);
  screen.addEventListener('click', () => {
    hideHint();
    show(current + 1);
  });
  window.addEventListener('resize', () => fitInto(screen));
  window.addEventListener('pagehide', () => {
    if (presenterIsOpen()) presenter.window.close();
  });
  setTimeout(hideHint, HINT_SHOWN_MS);

  fitInto(screen);
  show(0);
})();
