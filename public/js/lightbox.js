// Agrandir les photos d'une annonce : touche la photo, puis fais glisser ou utilise les flèches
(function () {
  let urls = [], i = 0, box, img, count, startX = null;

  function show(n) {
    i = (n + urls.length) % urls.length;
    img.src = urls[i];
    count.textContent = urls.length > 1 ? (i + 1) + ' / ' + urls.length : '';
    box.classList.toggle('single', urls.length < 2);
  }
  function close() { if (box) { box.remove(); box = null; document.removeEventListener('keydown', onKey); } }
  function onKey(e) {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') show(i + 1);
    else if (e.key === 'ArrowLeft') show(i - 1);
  }
  function open(list, start) {
    urls = list; close();
    box = document.createElement('div');
    box.className = 'lightbox';
    box.innerHTML = '<button type="button" class="lb-close" aria-label="Fermer">×</button>' +
      '<button type="button" class="lb-nav lb-prev" aria-label="Précédente">‹</button>' +
      '<img alt="Photo"><button type="button" class="lb-nav lb-next" aria-label="Suivante">›</button>' +
      '<div class="lb-count"></div>';
    img = box.querySelector('img');
    count = box.querySelector('.lb-count');
    box.querySelector('.lb-close').onclick = close;
    box.querySelector('.lb-prev').onclick = (e) => { e.stopPropagation(); show(i - 1); };
    box.querySelector('.lb-next').onclick = (e) => { e.stopPropagation(); show(i + 1); };
    box.addEventListener('click', (e) => { if (e.target === box) close(); });
    box.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', (e) => {
      if (startX == null) return;
      const dx = e.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(dx) > 50 && urls.length > 1) show(dx < 0 ? i + 1 : i - 1);
    });
    document.addEventListener('keydown', onKey);
    document.body.append(box);
    show(start);
  }

  document.addEventListener('click', (e) => {
    const main = e.target.closest && e.target.closest('.photo img');
    if (!main) return;
    const thumbs = Array.from(document.querySelectorAll('.thumbs img')).map((t) => t.src);
    const list = thumbs.length ? thumbs : [main.src];
    const at = list.indexOf(main.src);
    open(list, at < 0 ? 0 : at);
  });
})();
