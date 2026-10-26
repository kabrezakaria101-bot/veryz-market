(async function () {
  const { api, toast } = VM;
  await VM.ready;
  if (!VM.user) { location.href = '/login.html?next=/sell.html'; return; }

  const form = document.getElementById('sell-form');
  const preview = document.getElementById('preview');
  const { categories } = await api('/api/categories');
  categories.forEach((c) => form.category_id.append(VM.h('option', { value: c.id }, c.name)));
  if (VM.user.city) form.city.value = VM.user.city;

  let imageData = null;

  // Réduit la photo (900 px max) pour que l'envoi soit léger, même avec peu de réseau
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 900 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject(new Error('Image illisible.'));
      img.src = URL.createObjectURL(file);
    });
  }

  form.photo.addEventListener('change', async () => {
    const file = form.photo.files[0];
    imageData = null; preview.classList.add('hidden');
    if (!file) return;
    try {
      imageData = await shrink(file);
      preview.src = imageData; preview.classList.remove('hidden');
    } catch (e) { toast(e.message, true); }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
    const body = {
      title: form.title.value, category_id: form.category_id.value, price_fcfa: form.price_fcfa.value,
      city: form.city.value, neighborhood: form.neighborhood.value, description: form.description.value,
      image: imageData
    };
    try {
      const r = await api('/api/products', { method: 'POST', body });
      toast(r.status === 'published' ? 'Annonce publiée !' : 'Annonce envoyée : elle sera visible après validation.');
      setTimeout(() => (location.href = '/account.html'), 1200);
    } catch (err) { toast(err.message, true); btn.disabled = false; }
  });
})();
