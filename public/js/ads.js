// Bandeau de publicités qui défile tout seul (accueil)
(async function () {
  const { h, api } = VM;
  let items = [];
  try { items = (await api('/api/ads')).items; } catch (e) { return; }
  if (!items.length) return;

  let host = document.getElementById('ads');
  if (!host) {
    const container = document.querySelector('main .container');
    if (!container) return;
    host = h('div', { id: 'ads' });
    container.prepend(host);
  }

  const track = h('div', { class: 'ads-track' }, items.map((a) => {
    const img = h('img', { src: a.image_url, alt: 'Publicité', loading: 'lazy' });
    return a.link_url
      ? h('a', { class: 'ads-slide', href: a.link_url, rel: 'noopener noreferrer', target: a.link_url.startsWith('/') ? '_self' : '_blank' }, img)
      : h('div', { class: 'ads-slide' }, img);
  }));
  const dots = h('div', { class: 'ads-dots' }, items.map((_, i) => h('button', { type: 'button', 'aria-label': 'Publicité ' + (i + 1), onclick: () => go(i) })));
  host.className = 'ads';
  host.replaceChildren(track, items.length > 1 ? dots : null);

  let index = 0;
  let paused = false;
  function mark() { dots.querySelectorAll('button').forEach((d, i) => d.classList.toggle('on', i === index)); }
  function go(i) {
    index = (i + items.length) % items.length;
    track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' });
    mark();
  }
  mark();
  if (items.length < 2) return;

  // Quand la personne fait glisser avec le doigt, on suit sa position
  let t;
  track.addEventListener('scroll', () => {
    clearTimeout(t);
    t = setTimeout(() => { index = Math.round(track.scrollLeft / track.clientWidth); mark(); }, 80);
  });
  host.addEventListener('pointerdown', () => { paused = true; });
  host.addEventListener('pointerup', () => { setTimeout(() => { paused = false; }, 4000); });
  setInterval(() => { if (!paused && !document.hidden) go(index + 1); }, 4000);
})();
