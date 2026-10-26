(function () {
  const { api, toast, params, safeNext } = VM;
  const next = safeNext(params().get('next'));
  const L = document.getElementById('form-login'), R = document.getElementById('form-register');
  const tl = document.getElementById('tab-login'), tr = document.getElementById('tab-register');

  VM.ready.then(() => { if (VM.user) location.href = next; });

  function show(login) {
    L.classList.toggle('hidden', !login); R.classList.toggle('hidden', login);
    tl.className = 'btn' + (login ? '' : ' light'); tr.className = 'btn' + (login ? ' light' : '');
  }
  tl.onclick = () => show(true); tr.onclick = () => show(false);
  if (params().get('register')) show(false);

  async function submit(e, url) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      await api(url, { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
      location.href = next;
    } catch (err) { toast(err.message, true); btn.disabled = false; }
  }
  L.addEventListener('submit', (e) => submit(e, '/api/auth/login'));
  R.addEventListener('submit', (e) => submit(e, '/api/auth/register'));
})();
