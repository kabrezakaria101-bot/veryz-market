const express = require('express');
const { rateLimit } = require('express-rate-limit');
const db = require('../db');
const config = require('../config');
const { hashPassword, verifyPassword, createToken, normalizePhone } = require('../services/security');

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Trop de tentatives. Réessaie dans quelques minutes.' }
});

function setSession(res, userId) {
  res.cookie(config.cookieName, createToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    maxAge: config.sessionDays * 86400000,
    path: '/'
  });
}

const publicUser = (u) => ({ id: u.id, full_name: u.full_name, phone: u.phone, role: u.role, city: u.city });

router.post('/register', limiter, async (req, res) => {
  const { full_name, phone, password, city } = req.body || {};
  const name = String(full_name || '').trim();
  const num = normalizePhone(phone);
  if (name.length < 3 || name.length > 80) return res.status(400).json({ success: false, message: 'Nom complet : 3 à 80 caractères.' });
  if (!num) return res.status(400).json({ success: false, message: 'Numéro invalide (8 chiffres, ex : 70123456).' });
  if (typeof password !== 'string' || password.length < 6 || password.length > 100) {
    return res.status(400).json({ success: false, message: 'Mot de passe : 6 caractères minimum.' });
  }
  if (db.prepare('SELECT id FROM users WHERE phone = ?').get(num)) {
    return res.status(409).json({ success: false, message: 'Ce numéro a déjà un compte.' });
  }
  const info = db.prepare(
    "INSERT INTO users (full_name, phone, password_hash, role, city) VALUES (?, ?, ?, 'buyer', ?)"
  ).run(name, num, await hashPassword(password), String(city || '').trim().slice(0, 60) || null);
  setSession(res, info.lastInsertRowid);
  const user = db.prepare('SELECT id, full_name, phone, role, city FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ success: true, user: publicUser(user) });
});

router.post('/login', limiter, async (req, res) => {
  const { phone, password } = req.body || {};
  const num = normalizePhone(phone);
  const row = num ? db.prepare('SELECT * FROM users WHERE phone = ?').get(num) : null;
  const ok = row && typeof password === 'string' && await verifyPassword(password, row.password_hash);
  if (!ok) return res.status(401).json({ success: false, message: 'Numéro ou mot de passe incorrect.' });
  setSession(res, row.id);
  res.json({ success: true, user: publicUser(row) });
});

router.post('/logout', (req, res) => {
  res.clearCookie(config.cookieName, { path: '/' });
  res.json({ success: true });
});

router.get('/me', (req, res) => {
  res.json({ success: true, user: req.user ? publicUser(req.user) : null });
});

module.exports = router;
