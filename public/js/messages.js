(async function () {
  const { h, api, toast } = VM;
  const root = document.getElementById('messages-root');
  await VM.ready;
  if (!VM.user) { location.href = '/login.html?next=/messages.html'; return; }

  const isAdmin = VM.user.role === 'admin';
  const STICKERS = ['👍', '❤️', '😂', '🙏', '😮', '😢', '🔥', '✅', '👋', '🎉', '😡', '🤝', '😊', '🙌', '💯', '❓'];
  let currentUser = null; // admin : utilisateur dont la conversation est ouverte
  let lastSig = '';

  const url = () => (isAdmin ? `/api/messages/admin/${currentUser}` : '/api/messages');
  const when = (iso) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  // ----- Éléments -----
  const chat = h('div', { class: 'chat' });
  const title = h('p', { class: 'meta' });
  const list = h('div', { class: 'threads' });
  const input = h('textarea', { maxlength: '1000', rows: '1', placeholder: 'Écris ton message…' });
  const fileInput = h('input', { type: 'file', accept: 'image/*', class: 'hidden' });
  const stickerBtn = h('button', { class: 'icon-btn', type: 'button', title: 'Stickers' }, '😊');
  const photoBtn = h('button', { class: 'icon-btn', type: 'button', title: 'Envoyer une photo' }, '📷');
  const micBtn = h('button', { class: 'icon-btn', type: 'button', title: 'Message vocal' }, '🎤');
  const sendBtn = h('button', { class: 'btn', type: 'submit' }, 'Envoyer');
  const recTime = h('span', { class: 'rec-time' }, '0:00');
  const recCancel = h('button', { class: 'icon-btn', type: 'button', title: 'Annuler' }, '✖');
  const recSend = h('button', { class: 'icon-btn rec', type: 'button', title: 'Envoyer le vocal' }, '⏹');
  const recBar = h('div', { class: 'rec-bar' }, h('span', { class: 'rec-dot' }, '● Enregistrement'), recTime, recCancel, recSend);
  const form = h('form', { class: 'chat-form' }, stickerBtn, photoBtn, fileInput, input, micBtn, sendBtn, recBar);
  const stickerPanel = h('div', { class: 'stickers hidden' },
    STICKERS.map((s) => h('button', { type: 'button', onclick: () => { stickerPanel.classList.add('hidden'); post({ kind: 'sticker', body: s }); } }, s)));

  // ----- Affichage -----
  function bubble(m) {
    const mine = isAdmin ? 'admin' : 'user';
    const who = (m.sender_role === 'admin' && !isAdmin ? 'Administrateur · ' : '') + when(m.created_at);
    const cls = 'bubble ' + (m.sender_role === mine ? 'me' : 'other') + (m.kind === 'sticker' ? ' sticker' : '');
    let content;
    if (m.kind === 'image') {
      content = [h('a', { href: m.media_url, target: '_blank', rel: 'noopener' }, h('img', { class: 'chat-img', src: m.media_url, alt: 'Photo', loading: 'lazy' })), m.body || null];
    } else if (m.kind === 'audio') {
      content = [h('audio', { controls: 'controls', preload: 'none', src: m.media_url })];
    } else {
      content = [m.body];
    }
    return h('div', { class: cls }, content, h('small', {}, who));
  }

  function draw(items, force) {
    const sig = items.map((i) => i.id).join(',');
    if (!force && sig === lastSig) return; // évite de couper un vocal en cours d'écoute
    lastSig = sig;
    chat.replaceChildren(...(items.length
      ? items.map(bubble)
      : [h('p', { class: 'empty' }, isAdmin ? 'Choisis une conversation.' : 'Écris-nous si tu as un problème : l\'administrateur te répondra ici.')]));
    chat.scrollTop = chat.scrollHeight;
  }

  async function loadChat(force) {
    if (isAdmin && !currentUser) return draw([], true);
    try { draw((await api(url())).items, force); } catch (e) { /* on réessaiera */ }
  }

  async function loadThreads() {
    const { items } = await api('/api/messages/admin/threads');
    list.replaceChildren(...(items.length ? items.map((t) => h('button', {
      type: 'button',
      class: 'thread' + (t.user_id === currentUser ? ' active' : ''),
      onclick: () => { currentUser = t.user_id; lastSig = ''; title.textContent = `${t.full_name} · ${t.phone}`; loadThreads(); loadChat(true); }
    }, h('b', {}, t.full_name), t.unread ? h('span', { class: 'fab-badge' }, t.unread) : null,
       h('div', { class: 'meta' }, (t.last_body || '').slice(0, 40)))) : [h('p', { class: 'empty' }, 'Aucun message pour le moment.')]));
  }

  // ----- Envoi -----
  async function post(payload) {
    if (isAdmin && !currentUser) { toast('Choisis d\'abord une conversation.', true); return false; }
    try {
      await api(url(), { method: 'POST', body: payload });
      await loadChat(true);
      if (isAdmin) loadThreads();
      return true;
    } catch (e) { toast(e.message, true); return false; }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    sendBtn.disabled = true;
    if (await post({ kind: 'text', body: text })) input.value = '';
    sendBtn.disabled = false;
  });

  // Entrée = envoyer, Maj+Entrée = nouvelle ligne
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
  });

  stickerBtn.onclick = () => stickerPanel.classList.toggle('hidden');

  // ----- Photos (réduites à 900 px avant l'envoi) -----
  function shrink(file) {
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
      img.onerror = () => reject(new Error('Image illisible.'));
      img.src = URL.createObjectURL(file);
    });
  }

  photoBtn.onclick = () => fileInput.click();
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const media = await shrink(file);
      if (await post({ kind: 'image', body: input.value.trim(), media })) input.value = '';
    } catch (e) { toast(e.message, true); }
  });

  // ----- Vocaux -----
  let recorder = null, stream = null, chunks = [], timer = null, startedAt = 0, cancelled = false;

  async function startRecording() {
    if (isAdmin && !currentUser) { toast('Choisis d\'abord une conversation.', true); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      toast('Vocal indisponible : ouvre le site en https ou sur localhost.', true); return;
    }
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { toast('Micro refusé ou indisponible.', true); return; }

    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
      .find((t) => MediaRecorder.isTypeSupported(t));
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : { audioBitsPerSecond: 32000 });
    chunks = []; cancelled = false;
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      clearInterval(timer);
      form.classList.remove('recording');
      if (cancelled || !chunks.length) return;
      const base = (recorder.mimeType || mime || 'audio/webm').split(';')[0];
      const blob = new Blob(chunks, { type: base });
      if (blob.size > 1.4 * 1024 * 1024) { toast('Vocal trop long.', true); return; }
      const dataUrl = await new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.readAsDataURL(blob);
      });
      await post({ kind: 'audio', media: 'data:' + base + ';base64,' + dataUrl.split(',')[1] });
    };
    recorder.start();
    startedAt = Date.now();
    recTime.textContent = '0:00';
    form.classList.add('recording');
    timer = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt) / 1000);
      recTime.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      if (s >= 90) recorder.stop(); // limite 1 min 30
    }, 500);
  }

  micBtn.onclick = startRecording;
  recSend.onclick = () => recorder && recorder.state !== 'inactive' && recorder.stop();
  recCancel.onclick = () => { cancelled = true; if (recorder && recorder.state !== 'inactive') recorder.stop(); };

  // ----- Page -----
  const right = h('div', {}, title, chat, stickerPanel, form);
  root.replaceChildren(isAdmin ? h('div', { class: 'msg-layout' }, list, right) : h('div', { class: 'narrow' }, right));

  if (isAdmin) await loadThreads();
  loadChat(true);
  setInterval(() => { if (isAdmin) loadThreads(); loadChat(false); }, 10000);
})();
