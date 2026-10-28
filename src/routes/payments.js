const express = require('express');
const db = require('../db');
const config = require('../config');
const { requireAuth } = require('../middleware/auth');
const { normalizePhone } = require('../services/security');
const mobileMoney = require('../services/mobileMoney');

const router = express.Router();

router.get('/providers', (req, res) => {
  res.json({ success: true, mode: config.mobileMoney.mode, providers: config.mobileMoney.providers });
});

router.post('/', requireAuth, async (req, res) => {
  if (!mobileMoney.isSimulation()) {
    return res.status(501).json({ success: false, message: 'Le prestataire Mobile Money réel n\'est pas encore configuré.' });
  }
  const { product_id, provider, phone } = req.body || {};
  const productId = /^\d{1,9}$/.test(String(product_id)) ? Number(product_id) : null;
  const product = productId ? await db.one("SELECT * FROM products WHERE id = $1 AND status = 'published'", [productId]) : null;
  if (!product) return res.status(404).json({ success: false, message: 'Annonce indisponible.' });
  if (product.seller_id === req.user.id) return res.status(400).json({ success: false, message: 'Tu ne peux pas acheter ta propre annonce.' });
  if (!config.mobileMoney.providers.some((p) => p.id === provider)) return res.status(400).json({ success: false, message: 'Choisis un moyen de paiement.' });
  const payer = normalizePhone(phone);
  if (!payer) return res.status(400).json({ success: false, message: 'Numéro Mobile Money invalide (8 chiffres).' });
  const reference = await mobileMoney.createTransaction({ product, buyerId: req.user.id, provider, phone: payer });
  res.status(201).json({ success: true, reference, amount_fcfa: product.price_fcfa, mode: 'simulation' });
});

router.post('/:reference/confirm', requireAuth, async (req, res) => {
  if (!mobileMoney.isSimulation()) return res.status(501).json({ success: false, message: 'Non configuré.' });
  if (String((req.body || {}).code) !== config.mobileMoney.simulationCode) {
    return res.status(400).json({ success: false, message: 'Code incorrect (simulation : 1234).' });
  }
  const result = await mobileMoney.confirmTransaction(req.params.reference, req.user.id);
  if (!result.ok) return res.status(400).json({ success: false, message: result.message });
  res.json({ success: true });
});

module.exports = router;
