(async function () {
  const { h, api, fcfa, date, toast, badge } = VM;
  const root = document.getElementById('product');
  const id = VM.params().get('id');
  await VM.ready;

  let p;
  try { p = (await api('/api/products/' + encodeURIComponent(id))).product; }
  catch (e) { root.replaceChildren(h('p', { class: 'empty' }, e.message)); return; }
  document.title = p.title + ' — VERYZ MARKET';

  const isOwner = VM.user && VM.user.id === p.seller_id;
  const wa = 'https://wa.me/226' + p.seller_phone + '?text=' + encodeURIComponent(`Bonjour, je suis intéressé par « ${p.title} » sur VERYZ MARKET.`);

  const actions = h('div', { class: 'actions' });
  if (p.status === 'published' && !isOwner) {
    actions.append(
      h('a', { class: 'btn orange', href: wa, target: '_blank', rel: 'noopener' }, 'Contacter sur WhatsApp'),
      h('a', { class: 'btn light', href: 'tel:+226' + p.seller_phone }, 'Appeler le vendeur')
    );
    const payBox = h('div', { id: 'pay' });
    actions.append(h('button', { class: 'btn', type: 'button', onclick: () => openPay(payBox) }, 'Acheter avec Mobile Money'), payBox);
  } else if (p.status !== 'published') {
    actions.append(h('p', { class: 'meta' }, 'Cette annonce n\'est pas disponible à l\'achat.'));
  }

  async function openPay(box) {
    if (!VM.user) { location.href = '/login.html?next=' + encodeURIComponent(location.pathname + location.search); return; }
    const { providers } = await api('/api/payments/providers');
    const select = h('select', { name: 'provider' }, providers.map((x) => h('option', { value: x.id }, x.name)));
    const phone = h('input', { name: 'phone', inputmode: 'numeric', placeholder: 'Ton numéro Mobile Money' });
    const go = h('button', { class: 'btn', type: 'button' }, `Payer ${fcfa(p.price_fcfa)}`);
    box.replaceChildren(
      h('div', { class: 'sim' }, 'MODE SIMULATION : aucun argent réel n\'est débité.'),
      h('label', {}, 'Moyen de paiement'), select, h('label', {}, 'Numéro'), phone, h('p', {}, go)
    );
    go.onclick = async () => {
      go.disabled = true;
      try {
        const r = await api('/api/payments', { method: 'POST', body: { product_id: p.id, provider: select.value, phone: phone.value } });
        const code = h('input', { inputmode: 'numeric', placeholder: 'Code de confirmation' });
        const ok = h('button', { class: 'btn orange', type: 'button' }, 'Confirmer le paiement');
        box.replaceChildren(
          h('div', { class: 'sim' }, `Référence ${r.reference}. Simulation : entre le code 1234 pour confirmer.`),
          code, h('p', {}, ok));
        ok.onclick = async () => {
          ok.disabled = true;
          try {
            await api(`/api/payments/${r.reference}/confirm`, { method: 'POST', body: { code: code.value } });
            toast('Paiement confirmé (simulation) !');
            setTimeout(() => location.reload(), 1200);
          } catch (e) { toast(e.message, true); ok.disabled = false; }
        };
      } catch (e) { toast(e.message, true); go.disabled = false; }
    };
  }
// Galerie : grande photo + petites photos cliquables
  const images = (p.images && p.images.length) ? p.images : (p.image_url ? [p.image_url] : []);
  const main = images.length ? h('img', { src: images[0], alt: p.title }) : h('div', { class: 'noimg' }, 'Pas de photo');
  const thumbs = images.length > 1 ? h('div', { class: 'thumbs' }, images.map((url, i) => h('img', {
    src: url, alt: 'Photo ' + (i + 1), class: i === 0 ? 'on' : '',
    onclick: (e) => {
      main.src = url;
      thumbs.querySelectorAll('img').forEach((t) => t.classList.remove('on'));
      e.target.classList.add('on');
    }
  }))) : null;

  root.replaceChildrenh(
    'div', { class: 'detail' },
    h('div', {}, h('div', { class: 'photo' }, main), thumbs),

  root.replaceChildren(
      h('div', { class: 'panel' },
      h('p', {}, badge(p.status), ' ', h('span', { class: 'meta' }, p.category_name || '')),
      h('h1', { style: 'margin:6px 0' }, p.title),
      h('div', { class: 'price', style: 'font-size:1.6rem' }, fcfa(p.price_fcfa)),
      h('p', { class: 'meta' }, '📍 ' + [p.city, p.neighborhood].filter(Boolean).join(' · ') + ' — publiée le ' + date(p.created_at)),
      h('p', { class: 'desc' }, p.description || 'Pas de description.'),
      h('p', {}, 'Vendeur : ', h('b', {}, p.seller_name)),
      actions
    )
  ));
})();
