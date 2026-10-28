(async function () {
  const { h, api, toast } = VM;
  await VM.ready;
  if (!VM.user || VM.user.role !== 'admin') { location.href = '/login.html?next=/admin-ads.html'; return; }

  const form = document.getElementById('ad-form');
  const input = document.getElementById('ad-photo');
  const preview = document.getElementById('ad-preview');
  const listEl = document.getElementById('ad-list');
  let photo = null;

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('Lecture impossible.'));
      r.readAsDataURL(file);
    });
  }
  // Bannière : 1200 px de large au maximum
  async function shrink(file) {
    const source = await readFile(file);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, 1200 / img.width);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => reject(new Error('Photo illisible.'));
      img.src = source;
    });
  }

  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    try {
      photo = await shrink(file);
      preview.replaceChildren(h('img', { src: photo, alt: 'Aperçu' }));
    } catch (e) { toast(e.message, true); }
  });

  async function draw() {
    const { items } = await api('/api/ads/admin');
    listEl.replaceChildren(...(items.length ? items.map((a) => h('div', { class: 'ad-row' },
      h('img', { src: a.image_url, alt: 'Publicité' }),
      h('div', { class: 'ad-info' },
        h('div', { class: 'meta' }, a.link_url || 'Sans lien'),
        h('div', {}, h('span', { class: 'badge ' + (a.active ? 'published' : 'rejected') }, a.active ? 'Visible' : 'Cachée'))),
      h('div', { class: 'ad-actions' },
        h('button', { class: 'btn light', type: 'button', onclick: async () => { await api('/api/ads/' + a.id + '/toggle', { method: 'POST' }); draw(); } }, a.active ? 'Cacher' : 'Afficher'),
        h('button', { class: 'btn light', type: 'button', onclick: async () => {
          if (!confirm('Supprimer cette publicité ?')) return;
          await api('/api/ads/' + a.id, { method: 'DELETE' }); draw();
        } }, 'Supprimer'))
    )) : [h('p', { class: 'meta' }, 'Aucune publicité pour le moment.')]));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!photo) return toast('Choisis une photo.', true);
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await api('/api/ads', { method: 'POST', body: { image: photo, link_url: form.link_url.value } });
      toast('Publicité ajoutée.');
      photo = null; preview.replaceChildren(); form.reset();
      draw();
    } catch (err) { toast(err.message, true); }
    btn.disabled = false;
  });

  draw();
})();
