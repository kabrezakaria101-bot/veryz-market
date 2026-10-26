(async function () {
  const { h, api, card, params } = VM;
  const form = document.getElementById('search-form');
  const grid = document.getElementById('grid');
  const pager = document.getElementById('pager');
  const chips = document.getElementById('chips');
  const title = document.getElementById('list-title');

  const cats = await VM.fillCategories(form.category);
  const p = params();
  form.q.value = p.get('q') || '';
  form.city.value = p.get('city') || '';
  form.category.value = p.get('category') || '';
  let page = parseInt(p.get('page'), 10) || 1;

  function renderChips() {
    chips.replaceChildren(
      h('a', { class: 'chip' + (!form.category.value ? ' active' : ''), href: '/' }, 'Tout'),
      ...cats.map((c) => h('a', {
        class: 'chip' + (form.category.value === c.slug ? ' active' : ''),
        href: '/?category=' + c.slug
      }, c.name + (c.count ? ` (${c.count})` : '')))
    );
  }

  async function load() {
    grid.replaceChildren(h('p', { class: 'empty' }, 'Chargement…'));
    const qs = new URLSearchParams({ page });
    for (const k of ['q', 'city', 'category']) if (form[k].value.trim()) qs.set(k, form[k].value.trim());
    try {
      const data = await api('/api/products?' + qs);
      title.textContent = (form.q.value || form.city.value || form.category.value) ? `Résultats (${data.total})` : 'Dernières annonces';
      grid.replaceChildren(...(data.items.length
        ? data.items.map(card)
        : [h('p', { class: 'empty' }, 'Aucune annonce trouvée. Sois le premier à publier !')]));
      pager.replaceChildren();
      if (data.pages > 1) {
        pager.append(
          h('button', { class: 'btn light small', disabled: page <= 1 || null, onclick: () => go(page - 1) }, '← Précédent'),
          h('span', {}, `Page ${data.page} / ${data.pages}`),
          h('button', { class: 'btn light small', disabled: page >= data.pages || null, onclick: () => go(page + 1) }, 'Suivant →')
        );
      }
    } catch (e) { grid.replaceChildren(h('p', { class: 'empty' }, e.message)); }
    renderChips();
  }

  function go(n) { page = n; load(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  form.addEventListener('submit', (e) => { e.preventDefault(); page = 1; load(); });
  form.category.addEventListener('change', () => { page = 1; load(); });
  load();
})();
