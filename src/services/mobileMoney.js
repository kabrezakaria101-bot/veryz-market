const db =require('../db')
const crypto = require('crypto');
const db = require('../service/db'); // vérifie que le chemin est bon : peut-être ../../Route/service/db.js

function isSimulation() {
  return true; // ou ta logique
}

async function createTransaction({ product, buyerId, provider, phone }) {
  const reference = 'VM-' + crypto.randomBytes(5).toString('hex').toUpperCase();
  
  await db.query(
    `INSERT INTO transactions (reference, product_id, buyer_id, seller_id, amount_fcfa, provider, phone, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
    [reference, product.id, buyerId, product.seller_id, product.price_fcfa, provider, phone]
  );
  
  return reference;
}

// Valide le paiement et marque l'annonce comme vendue
async function confirmTransaction(reference, buyerId) {
  try {
    await db.query('BEGIN');

    const { rows } = await db.query(
      'SELECT * FROM transactions WHERE reference = $1 AND buyer_id = $2',
      [reference, buyerId]
    );
    const tx = rows[0];

    if (!tx || tx.status !== 'pending') {
      await db.query('ROLLBACK');
      return { ok: false, message: 'Transaction introuvable ou déjà traitée.' };
    }

    const soldResult = await db.query(
      "UPDATE products SET status = 'sold' WHERE id = $1 AND status != 'sold'",
      [tx.product_id]
    );

    if (soldResult.rowCount === 0) {
      await db.query("UPDATE transactions SET status = 'failed' WHERE id = $1", [tx.id]);
      await db.query('COMMIT');
      return { ok: false, message: "Cette annonce n'est plus disponible." };
    }

    await db.query(
      "UPDATE transactions SET status = 'paid', paid_at = NOW() WHERE id = $1",
      [tx.id]
    );

    await db.query('COMMIT');
    return { ok: true };

  } catch (e) {
    await db.query('ROLLBACK');
    console.error(e);
    return { ok: false, message: 'Erreur serveur' };
  }
}

module.exports = { isSimulation, createTransaction, confirmTransaction };
