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

async function createTransaction({ product, buyerId, provider, phone }) {
  const reference = 'VM-' + crypto.randomBytes(5).toString('hex').toUpperCase();
  await db.query(`
    INSERT INTO transactions (reference, product_id, buyer_id, seller_id, amount_fcfa, provider, payer_phone, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
  `, [reference, product.id, buyerId, product.seller_id, product.price_fcfa, provider, phone]);
  return reference;
}

// Valide le paiement et marque l'annonce comme vendue (une seule fois, tout ou rien)
function confirmTransaction(reference, buyerId) {
  return db.transaction(async (client) => {
    const { rows: [tx] } = await client.query(
      'SELECT * FROM transactions WHERE reference = $1 AND buyer_id = $2 FOR UPDATE', [reference, buyerId]
    );
    if (!tx || tx.status !== 'pending') return { ok: false, message: 'Transaction introuvable ou déjà traitée.' };

    if (new Date(tx.created_at).getTime() < Date.now() - PENDING_MINUTES * 60000) {
      await client.query("UPDATE transactions SET status = 'failed' WHERE id = $1", [tx.id]);
      return { ok: false, message: 'Transaction expirée. Recommence le paiement.' };
    }

    const sold = await client.query("UPDATE products SET status = 'sold' WHERE id = $1 AND status = 'published'", [tx.product_id]);
    if (sold.rowCount === 0) {
      await client.query("UPDATE transactions SET status = 'failed' WHERE id = $1", [tx.id]);
      return { ok: false, message: 'Cette annonce n\'est plus disponible.' };
    }
    await client.query("UPDATE transactions SET status = 'paid', paid_at = now() WHERE id = $1", [tx.id]);
    return { ok: true };
  });
}

module.exports = { isSimulation, createTransaction, confirmTransaction };
