(async function () {
  const { h, api, toast } = VM;
  await VM.ready;
  if (!VM.user) { location.href = '/login.html?next=/sell.html'; return; }

  const MAX = 6; // photos maximum
  const form = document.getElementById('sell-form');
  const input = document.getElementById('photos');
  const previews = document.getElementById('previews');
  const count = document.getElementById('photo-count');

  const { categories } = await api('/api/categories');
  categories.forEach((c) => form.category_id.append(h('option', { value: c.id }, c.name)));
  if (VM.user.city) form.city.value = VM.user.city;

  let photos = []; // photos réduites (texte data:image/jpeg...)

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Lecture de la photo impossible.'));
      reader.readAsDataURL(file);
    });
  }

  // Réduit chaque photo (900 px max) pour que l'envoi reste léger, même avec peu de réseau
  async function shrink(file) {
    const source = await readFile(file);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 900 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject(new Error('Photo illisible. Essaie une photo JPEG ou PNG.'));
      img.src = source;
    });
  }

  function draw() {
    previews.replaceChildren(...photos.map((src, i) => h('div', { class: 'thumb' },
      h('img', { src, alt: 'Photo ' + (i + 1) }),
      i === 0 ? h('span', { class: 'cover' }, 'Principale') : null,
      h('button', { type: 'button', class: 'x', title: 'Retirer', onclick: () => { photos.splice(i, 1); draw(); } }, '×')
    )));
    count.textContent = photos.length
      ? `${photos.length} photo${photos.length > 1 ? 's' : ''} sur ${MAX}. La première est la photo principale.`
      : 'Aucune photo. La première sera la photo principale.';
  }

  input.addEventListener('change', async () => {
    const files = Array.from(input.files || []);
    input.value = ''; // permet de rechoisir les mêmes photos
    for (const file of files) {
      if (photos.length >= MAX) { toast(`${MAX} photos maximum.`, true); break; }
      try { photos.push(await shrink(file)); }
      catch (e) { toast(e.message, true); }
    }
    draw();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = photos.length ? 'Envoi des photos…' : 'Envoi…';
    const body = {
      title: form.title.value, category_id: form.category_id.value, price_fcfa: form.price_fcfa.value,
      city: form.city.value, neighborhood: form.neighborhood.value, description: form.description.value,
      images: photos
    };
    try {
      const r = await api('/api/products', { method: 'POST', body });
      toast(r.status === 'published' ? 'Annonce publiée !' : 'Annonce envoyée : elle sera visible après validation.');
      setTimeout(() => (location.href = '/account.html'), 1200);
    } catch (err) {
      toast(err.message, true);
      btn.disabled = false;
      btn.textContent = 'Publier';
    }
  });
})();
