// Mobile Money
//
// MODE SIMULATION (par défaut) : aucun argent réel n'est déplacé, le code de confirmation est 1234.
//   -> Sur un site EN LIGNE (NODE_ENV=production), la simulation est BLOQUÉE, sinon n'importe qui
//      pourrait « acheter » gratuitement. Pour une démonstration publique, ajoute ALLOW_SIMULATION=true.
// MODE LIVE : à brancher avec l'API d'un prestataire agréé (voir README).
const crypto = require('crypto');
const db = require('../db');
const config = require('../config');

const PENDING_MINUTES = 30; // une transaction non confirmée expire après 30 minutes

function isSimulation() {
  if (config.mobileMoney.mode !== 'simulation') return false;
  return !config.isProduction || process.env.ALLOW_SIMULATION === 'true';
}

function createTransaction({ product, buyerId, provider, phone }) {
  const reference = 'VM-' + crypto.randomBytes(5).toString('hex').toUpperCase();
  db.prepare(`
    INSERT INTO transactions (reference, product_id, buyer_id, seller_id, amount_fcfa, provider, payer_phone, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(reference, product.id, buyerId, product.seller_id, product.price_fcfa, provider, phone);
  return reference;
}

// Valide le paiement et marque l'annonce comme vendue (une seule fois, tout ou rien)
const confirmTransaction = db.transaction((reference, buyerId) => {
  const tx = db.prepare('SELECT * FROM transactions WHERE reference = ? AND buyer_id = ?').get(reference, buyerId);
  if (!tx || tx.status !== 'pending') return { ok: false, message: 'Transaction introuvable ou déjà traitée.' };

  if (Date.parse(tx.created_at) < Date.now() - PENDING_MINUTES * 60000) {
    db.prepare("UPDATE transactions SET status = 'failed' WHERE id = ?").run(tx.id);
    return { ok: false, message: 'Transaction expirée. Recommence le paiement.' };
  }

  const sold = db.prepare("UPDATE products SET status = 'sold' WHERE id = ? AND status = 'published'").run(tx.product_id);
  if (sold.changes === 0) {
    db.prepare("UPDATE transactions SET status = 'failed' WHERE id = ?").run(tx.id);
    return { ok: false, message: 'Cette annonce n\'est plus disponible.' };
  }
  db.prepare("UPDATE transactions SET status = 'paid', paid_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(tx.id);
  return { ok: true };
});

module.exports = { isSimulation, createTransaction, confirmTransaction };
