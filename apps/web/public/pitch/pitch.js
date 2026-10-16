const $ = (id) => document.getElementById(id);
let slides = [];
let current = 0;

function paragraphs(target, lines) {
  target.replaceChildren();
  for (const line of lines) {
    const p = document.createElement('p');
    for (const part of line.split(/(https?:\/\/[^\s]+)/g)) {
      if (/^https?:\/\//.test(part)) {
        const a = document.createElement('a');
        a.href = part; a.textContent = part; a.target = '_blank'; a.rel = 'noopener noreferrer'; p.append(a);
      } else p.append(document.createTextNode(part));
    }
    target.append(p);
  }
}

function show(index, updateHash = true) {
  if (!slides.length) return;
  current = Math.max(0, Math.min(slides.length - 1, index));
  const slide = slides[current];
  $('error').hidden = true;
  $('slide').src = slide.image;
  $('slide').alt = `${current + 1} / ${slides.length}: ${slide.title}. 원문 텍스트는 아래에서 확인할 수 있습니다.`;
  $('counter').textContent = `${String(current + 1).padStart(2, '0')} / ${slides.length}`;
  $('slide-title').textContent = slide.title;
  $('progress-fill').style.width = `${(current + 1) / slides.length * 100}%`;
  $('prev').disabled = current === 0;
  $('next').disabled = current === slides.length - 1;
  document.querySelectorAll('.thumbnail').forEach((button, i) => button.setAttribute('aria-current', String(i === current)));
  paragraphs($('slide-text'), slide.text);
  paragraphs($('slide-notes'), slide.notes);
  if (updateHash) history.replaceState(null, '', `#slide-${current + 1}`);
  document.title = `SweetHome | ${current + 1}. ${slide.title.replaceAll('PolicyMap', 'SweetHome')}`;
}

function hashIndex() { return Math.max(0, Number(location.hash.match(/^#slide-(\d+)$/)?.[1] || 1) - 1); }
async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else $('fullscreen').textContent = '브라우저 전체화면을 사용해 주세요';
  } catch { $('fullscreen').textContent = '전체화면을 다시 시도해 주세요'; }
}
$('prev').onclick = () => show(current - 1);
$('next').onclick = () => show(current + 1);
$('fullscreen').onclick = fullscreen;
$('slide').onerror = () => { $('error').hidden = false; };
addEventListener('hashchange', () => show(hashIndex(), false));
addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); show(current + 1); }
  if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); show(current - 1); }
  if (event.key === 'Home') { event.preventDefault(); show(0); }
  if (event.key === 'End') { event.preventDefault(); show(slides.length - 1); }
  if (event.key.toLowerCase() === 'f') { event.preventDefault(); fullscreen(); }
});
try {
  const response = await fetch('./deck.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Deck unavailable');
  const deck = await response.json();
  $('download-pptx').href = `./${encodeURIComponent(deck.source)}`;
  slides = deck.slides.map(slide => ({ ...slide, image: `${slide.image}?v=${deck.sha256.slice(0, 12)}` }));
  if (!slides.length) throw new Error('Empty deck');
  slides.forEach((slide, i) => {
    const button = document.createElement('button');
    button.className = 'thumbnail'; button.setAttribute('aria-label', `${i + 1}. ${slide.title}`);
    const img = document.createElement('img'); img.src = slide.thumbnail ? `${slide.thumbnail}?v=${deck.sha256.slice(0, 12)}` : slide.image; img.alt = ''; img.loading = 'lazy';
    const label = document.createElement('span'); label.textContent = `${String(i + 1).padStart(2, '0')} ${slide.title}`;
    button.append(img, label); button.onclick = () => show(i); $('thumbnails').append(button);
  });
  show(hashIndex(), false);
} catch { $('error').hidden = false; }
