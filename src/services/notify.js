const db = require('../db');

// Crée une notification. Ne plante jamais : une notification ratée ne doit pas bloquer l'action.
async function notify({ userId = null, type, body, link = null, actorId = null }) {
  try {
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