// Outils communs : appels API, création d'éléments, formats, cartes produits
window.VM = window.VM || {};

VM.api = async function (path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin'
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* réponse vide */ }
  if (!res.ok || data.success === false) {
    const err = new Error(data.message || 'Une erreur est survenue.');
    err.status = res.status;
    throw err;
  }
  return data;
};

// h('div', {class:'x', onclick: fn}, enfants...) — le texte est toujours échappé
VM.h = function (tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
};

VM.fcfa = (n) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';
VM.date = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
VM.params = () => new URLSearchParams(location.search);

VM.statusLabels = { pending: 'En attente', published: 'Publiée', rejected: 'Refusée', sold: 'Vendue', paid: 'Payée', failed: 'Échec' };
VM.badge = (status) => VM.h('span', { class: 'badge ' + status }, VM.statusLabels[status] || status);

VM.toast = function (message, isError) {
  const t = VM.h('div', { class: 'toast' + (isError ? ' error' : '') }, message);
  document.body.append(t);
  setTimeout(() => t.remove(), 3500);
};

VM.image = (url, alt) => url
  ? VM.h('img', { class: 'pic', src: url, alt: alt || '', loading: 'lazy' })
  : VM.h('div', { class: 'noimg' }, 'Pas de photo');

VM.card = (p) => VM.h('a', { class: 'card', href: '/product.html?id=' + p.id },
  VM.image(p.image_url, p.title),
  VM.h('div', { class: 'body' },
    VM.h('h3', {}, p.title),
    VM.h('div', { class: 'price' }, VM.fcfa(p.price_fcfa)),
    VM.h('div', { class: 'meta' }, [p.city, p.neighborhood].filter(Boolean).join(' · ')),
    VM.h('div', { class: 'meta' }, p.category_name || '')
  )
);

VM.fillCategories = async function (select, { all = true } = {}) {
  const { categories } = await VM.api('/api/categories');
  if (all) select.append(VM.h('option', { value: '' }, 'Toutes les catégories'));
  categories.forEach((c) => select.append(VM.h('option', { value: c.slug }, c.name)));
  return categories;
};

VM.safeNext = (next) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
