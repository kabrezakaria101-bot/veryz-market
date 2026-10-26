(async function () {
  const { h, api, fcfa, date, toast, badge } = VM;
  const body = document.getElementById('admin-body');
  await VM.ready;
  if (!VM.user || VM.user.role !== 'admin') {
    body.replaceChildren(h('p', { class: 'empty' }, 'Accès réservé à l\'administrateur.')); return;
  }

  const tabs = { pending: 'À valider', published: 'Publiées', rejected: 'Refusées', sold: 'Vendues', users: 'Utilisateurs', tx: 'Transactions' };
  const stats = h('div', { class: 'stats' });
  const bar = h('div', { class: 'tabs' });
  const content = h('div');
  body.replaceChildren(stats, bar, content);

  async function loadStats() {
    const { stats: s } = await api('/api/admin/stats');
    stats.replaceChildren(...[['Utilisateurs', s.users], ['À valider', s.pending], ['Publiées', s.published], ['Vendues', s.sold], ['Total payé', fcfa(s.paid_total)]]
      .map(([l, v]) => h('div', { class: 'stat' }, h('b', {}, v), l)));
  }

  async function setStatus(id, status) {
    try { await api(`/api/admin/products/${id}/status`, { method: 'POST', body: { status } }); show(current); loadStats(); }
    catch (e) { toast(e.message, true); }
  }

  let current = 'pending';
  async function show(tab) {
    current = tab;
    bar.replaceChildren(...Object.entries(tabs).map(([k, l]) =>
      h('button', { class: 'btn small' + (k === tab ? '' : ' light'), onclick: () => show(k) }, l)));
    content.replaceChildren(h('p', { class: 'empty' }, 'Chargement…'));
    try {
      if (tab === 'users') {
        const { items } = await api('/api/admin/users');
        content.replaceChildren(table(['Nom', 'Téléphone', 'Rôle', 'Ville', 'Inscrit'], items.map((u) => [u.full_name, u.phone, u.role, u.city || '', date(u.created_at)])));
      } else if (tab === 'tx') {
        const { items } = await api('/api/admin/transactions');
        content.replaceChildren(items.length ? table(['Date', 'Réf.', 'Annonce', 'Acheteur', 'Vendeur', 'Montant', 'Statut'],
          items.map((t) => [date(t.created_at), t.reference, t.title, t.buyer_name, t.seller_name, fcfa(t.amount_fcfa), badge(t.status)]))
          : h('p', { class: 'empty' }, 'Aucune transaction.'));
      } else {
        const { items } = await api('/api/admin/products?status=' + tab);
        content.replaceChildren(...(items.length ? items.map((p) => h('div', { class: 'row' },
          p.image_url ? h('img', { src: p.image_url, alt: '' }) : h('div', { class: 'noimg' }, '—'),
          h('div', { class: 'info' }, h('b', {}, p.title), h('div', { class: 'price' }, fcfa(p.price_fcfa)),
            h('div', { class: 'meta' }, `${p.category_name || ''} · ${p.city} · ${p.seller_name} (${p.seller_phone})`),
            h('div', { class: 'meta' }, p.description.slice(0, 140))),
          tab !== 'published' && tab !== 'sold' ? h('button', { class: 'btn small', onclick: () => setStatus(p.id, 'published') }, 'Publier') : null,
          tab !== 'rejected' && tab !== 'sold' ? h('button', { class: 'btn danger small', onclick: () => setStatus(p.id, 'rejected') }, 'Refuser') : null
        )) : [h('p', { class: 'empty' }, 'Rien ici pour le moment.')]));
      }
    } catch (e) { content.replaceChildren(h('p', { class: 'empty' }, e.message)); }
  }

  const table = (heads, rows) => h('div', { class: 'table-wrap' }, h('table', {},
    h('tr', {}, heads.map((t) => h('th', {}, t))),
    rows.map((r) => h('tr', {}, r.map((c) => h('td', {}, c))))));

  loadStats(); show('pending');
})();
