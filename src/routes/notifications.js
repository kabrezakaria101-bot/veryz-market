const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Mes notifications : celles qui me sont adressées + celles pour tout le monde (sauf les miennes)
const MINE = '(n.user_id = $1 OR (n.user_id IS NULL AND (n.actor_id IS NULL OR n.actor_id <> $1)))';

router.get('/', requireAuth, async (req, res) => {
  const me = await db.one('SELECT notifs_seen_at FROM users WHERE id = $1', [req.user.id]);
  const items = await db.all(`
    SELECT n.id, n.type, n.body, n.link, n.created_at,
           CASE WHEN n.user_id IS NULL THEN n.created_at <= $2 ELSE n.is_read = 1 END AS seen
    FROM notifications n WHERE ${MINE}
    ORDER BY n.created_at DESC, n.id DESC LIMIT 30
  `, [req.user.id, me.notifs_seen_at]);
  res.json({ success: true, items });
});

router.get('/count', requireAuth, async (req, res) => {
  const r = await db.one(`
    SELECT COUNT(*)::int AS n
    FROM notifications n, (SELECT notifs_seen_at FROM users WHERE id = $1) u
    WHERE ${MINE}
      AND CASE WHEN n.user_id IS NULL THEN n.created_at > u.notifs_seen_at ELSE n.is_read = 0 END
  `, [req.user.id]);
  res.json({ success: true, unread: r.n });
});

router.post('/read', requireAuth, async (req, res) => {
  await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = $1 AND is_read = 0', [req.user.id]);
  await db.query('UPDATE users SET notifs_seen_at = now() WHERE id = $1', [req.user.id]);
  res.json({ success: true });
});

module.exports = router;
