(async function () {
  const { h, api, fcfa, date, toast, badge, image } = VM;
  await VM.ready;
  if (!VM.user) { location.href = '/login.html?next=/account.html'; return; }
  document.getElementById('hello').textContent = 'Bonjour ' + VM.user.full_name;
  const mine = document.getElementById('mine'), tx = document.getElementById('tx');

  async function loadMine() {
    const { items } = await api('/api/me/products');
    mine.replaceChildren(...(items.length ? items.map((p) => h('div', { class: 'row' },
      p.image_url ? h('img', { src: p.image_url, alt: '' }) : h('div', { class: 'noimg' }, '—'),
      h('div', { class: 'info' },
        h('a', { href: '/product.html?id=' + p.id }, h('b', {}, p.title)),
        h('div', { class: 'price' }, fcfa(p.price_fcfa)),
        h('div', { class: 'meta' }, `${p.city} · ${date(p.created_at)}`)),
      badge(p.status),
      p.status === 'published' ? h('button', { class: 'btn light small', onclick: () => act(p.id, 'sold') }, 'Marquer vendue') : null,
      h('button', { class: 'btn danger small', onclick: () => act(p.id, 'delete') }, 'Supprimer')
    )) : [h('p', { class: 'empty' }, 'Tu n\'as pas encore d\'annonce.')]));
  }

  async function act(id, what) {
    try {
      if (what === 'delete') {
        if (!confirm('Supprimer cette annonce ?')) return;
        await api('/api/products/' + id, { method: 'DELETE' });
      } else await api(`/api/products/${id}/sold`, { method: 'POST' });
      loadMine();
    } catch (e) { toast(e.message, true); }
  }

  const { items } = await api('/api/me/transactions');
  tx.replaceChildren(items.length ? h('div', { class: 'table-wrap' }, h('table', {},
    h('tr', {}, ['Date', 'Type', 'Annonce', 'Montant', 'Moyen', 'Statut', 'Réf.'].map((t) => h('th', {}, t))),
    items.map((t) => h('tr', {},
      h('td', {}, date(t.created_at)), h('td', {}, t.kind), h('td', {}, h('a', { href: '/product.html?id=' + t.product_id }, t.title)),
      h('td', {}, fcfa(t.amount_fcfa)), h('td', {}, t.provider), h('td', {}, badge(t.status)), h('td', {}, t.reference)))))
    : h('p', { class: 'empty' }, 'Aucune transaction.'));
  loadMine();
})();
