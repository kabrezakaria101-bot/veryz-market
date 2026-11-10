const db = require('../db');

// Crée une notification. Ne plante jamais : une notification ratée ne doit pas bloquer l'action.
// once: true = pas de nouvelle notification s'il en existe déjà une non lue du même type et de la même personne.
async function notify({ userId = null, type, body, link = null, actorId = null, once = false }) {
  try {
    if (once && userId) {
      const dup = await db.one(
        'SELECT 1 AS ok FROM notifications WHERE user_id = $1 AND type = $2 AND is_read = 0 AND actor_id IS NOT DISTINCT FROM $3::int',
        [userId, type, actorId]
      );
      if (dup) return;
    }
    await db.query(
      'INSERT INTO notifications (user_id, type, body, link, actor_id) VALUES ($1, $2, $3, $4, $5)',
      [userId, type, body, link, actorId]
    );
  } catch (e) { console.error('Notification non créée :', e.message); }
}

async function notifyAdmins(args) {
  try {
    const admins = await db.all("SELECT id FROM users WHERE role = 'admin'");
    for (const a of admins) if (a.id !== args.actorId) await notify({ ...args, userId: a.id });
  } catch (e) { console.error('Notification admin non créée :', e.message); }
}

module.exports = { notify, notifyAdmins };