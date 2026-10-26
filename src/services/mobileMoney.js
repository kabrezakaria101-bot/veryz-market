// Mobile Money — MODE SIMULATION : aucun argent réel n'est déplacé.
// Pour passer en réel : brancher ici l'API de ton prestataire (voir README).
const crypto = require('crypto');
const db = require('../db');
const config = require('../config');

function isSimulation() {
  return config.mobileMoney.mode === 'simulation';
}

function createTransaction({ product, buyerId, provider, phone }) {
  const reference = 'VM-' + crypto.randomBytes(5).toString('hex').toUpperCase();
  db.prepare(`
    INSERT INTO transactions (reference, product_id, buyer_id, seller_id, amount_fcfa, provider, payer_phone, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(reference, product.id, buyerId, product.seller_id, product.price_fcfa, provider, phone);
  return reference;
}

// Valide le paiement et marque l'annonce comme vendue
const confirmTransaction = db.transaction((reference, buyerId) => {
  const tx = db.prepare('SELECT * FROM transactions WHERE reference = ? AND buyer_id = ?').get(reference, buyerId);
  if (!tx || tx.status !== 'pending') return { ok: false, message: 'Transaction introuvable ou déjà traitée.' };
  const sold = db.prepare("UPDATE products SET status = 'sold' WHERE id = ? AND status = 'published'").run(tx.product_id);
  if (sold.changes === 0) {
    db.prepare("UPDATE transactions SET status = 'failed' WHERE id = ?").run(tx.id);
    return { ok: false, message: 'Cette annonce n\'est plus disponible.' };
  }
  db.prepare("UPDATE transactions SET status = 'paid', paid_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(tx.id);
  return { ok: true };
});

module.exports = { isSimulation, createTransaction, confirmTransaction };
