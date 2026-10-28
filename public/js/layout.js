// En-tête et pied de page communs à toutes les pages + état de connexion
(function () {
  const { h, api } = VM;

  VM.ready = api('/api/auth/me').then((r) => (VM.user = r.user)).catch(() => (VM.user = null));

  VM.ready.then(() => {
    const nav = h('nav', { class: 'nav' },
      h('a', { href: '/' }, 'Accueil'),
      h('a', { href: '/sell.html', class: 'cta' }, '+ Vendre')
    );
    if (VM.user) {
      nav.append(h('a', { href: '/account.html' }, 'Mon compte'));
      if (VM.user.role === 'admin') {
        nav.append(h('a', { href: '/admin.html' }, 'Admin'));
        nav.append(h('a', { href: '/admin-ads.html' }, 'Pubs'));
      }
      nav.append(h('button', {
        type: 'button',
        onclick: async () => { await api('/api/auth/logout', { method: 'POST' }); location.href = '/'; }
      }, 'Déconnexion'));
    } else {
      nav.append(h('a', { href: '/login.html?next=' + encodeURIComponent(location.pathname + location.search) }, 'Connexion'));
    }
    const header = document.getElementById('app-header');
    header.className = 'header';
    header.append(h('div', { class: 'container' },
      h('a', { class: 'logo', href: '/' }, 'VERYZ ', h('span', {}, 'MARKET')), nav));

    const footer = document.getElementById('app-footer');
    footer.className = 'footer';
    footer.append('© VERYZ MARKET — Achète. Vends. Trouve près de chez toi.');
    // Bouton messagerie flottant
    const fab = h('a', {
      class: 'msg-fab',
      href: VM.user ? '/messages.html' : '/login.html?next=/messages.html',
      title: 'Écrire à l\'administrateur'
    }, '💬');
    document.body.append(fab);
    if (VM.user) {
      const refreshBadge = () => api('/api/messages/unread').then((r) => {
        const old = fab.querySelector('.fab-badge');
        if (old) old.remove();
        if (r.unread > 0) fab.append(h('span', { class: 'fab-badge' }, r.unread));
      }).catch(() => {});
      refreshBadge();
      setInterval(refreshBadge, 30000);
    }

  });
})();
