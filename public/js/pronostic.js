(async function () {
  const { h, api, toast } = VM;
  const root = document.getElementById('pronostic-root');
  await VM.ready;
  const isAdmin = !!(VM.user && VM.user.role === 'admin');
  let page = 1;

  const feed = h('div', { class: 'pronos' });
  const pager = h('div', { class: 'pager' });

  // Photo réduite à 1200 px (assez grande pour lire les cotes)
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Image illisible.'));
      img.src = URL.createObjectURL(file);
    });
  }

  function post(p) {
    const when = new Date(p.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    return h('article', { class: 'prono' },
      (p.title || p.is_new) ? h('h3', {}, p.title || 'Pronostic', p.is_new ? h('span', { class: 'new-tag' }, 'NOUVEAU') : null) : null,
      h('a', { href: p.image_url, target: '_blank', rel: 'noopener' },
        h('img', { class: 'prono-img', src: p.image_url, alt: p.title || 'Pronostic', loading: 'lazy' })),
      p.note ? h('p', { class: 'prono-note' }, p.note) : null,
      h('small', { class: 'meta' }, when),
      isAdmin ? h('p', {}, h('button', {
        class: 'btn light small', type: 'button',
        onclick: async () => {
          if (!confirm('Supprimer ce pronostic ?')) return;
          try { await api('/api/pronostics/' + p.id, { method: 'DELETE' }); toast('Supprimé.'); load(); }
          catch (e) { toast(e.message, true); }
        }
      }, 'Supprimer')) : null
    );
  }

  function adminForm() {
    const title = h('input', { type: 'text', maxlength: '100', placeholder: 'Titre (ex : Ticket du jour)' });
    const note = h('textarea', { maxlength: '1000', rows: '2', placeholder: 'Note (facultatif)' });
    const file = h('input', { type: 'file', accept: 'image/*' });
    const preview = h('img', { class: 'prono-preview hidden', alt: '' });
    const btn = h('button', { class: 'btn', type: 'submit' }, 'Publier le pronostic');
    const form = h('form', { class: 'prono-form' }, h('h3', {}, 'Publier un pronostic'), title, note, file, preview, btn);

    file.addEventListener('change', () => {
      const f = file.files[0];
      if (!f) { preview.classList.add('hidden'); return; }
      preview.src = URL.createObjectURL(f);
      preview.classList.remove('hidden');
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = file.files[0];
      if (!f) { toast('Choisis une photo.', true); return; }
      btn.disabled = true;
      try {
        const media = await shrink(f);
        await api('/api/pronostics', { method: 'POST', body: { title: title.value, note: note.value, media } });
        toast('Pronostic publié !');
        form.reset();
        preview.classList.add('hidden');
        page = 1;
        load();
      } catch (err) { toast(err.message, true); }
      btn.disabled = false;
    });
    return form;
  }

  async function load() {
    try {
      const data = await api('/api/pronostics?page=' + page);
      feed.replaceChildren(...(data.items.length
        ? data.items.map(post)
        : [h('p', { class: 'empty' }, 'Aucun pronostic pour le moment. Reviens bientôt !')]));
      pager.replaceChildren();
      if (data.pages > 1) {
        pager.append(
          h('button', { class: 'btn light small', disabled: page <= 1 || null, onclick: () => { page--; load(); } }, '← Plus récents'),
          h('span', {}, `Page ${data.page} / ${data.pages}`),
          h('button', { class: 'btn light small', disabled: page >= data.pages || null, onclick: () => { page++; load(); } }, 'Plus anciens →')
        );
      }
    } catch (e) { feed.replaceChildren(h('p', { class: 'empty' }, e.message)); }
    // La page est ouverte : la pastille du menu repart à zéro
    await api('/api/pronostics/seen', { method: 'POST' }).catch(() => {});
    if (VM.refreshPronoBadge) VM.refreshPronoBadge();

  }

  const warning = h('p', { class: 'meta' }, '⚠️ Les pronostics ne garantissent aucun gain. Joue avec modération (18 ans et plus).');
  root.replaceChildren(...[warning, isAdmin ? adminForm() : null, feed, pager].filter(Boolean));
  load();
})();
