const db = require('../db');
const config = require('../config');
const { readToken } = require('../services/security');

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

// Ajoute req.user si la personne est connectée
function attachUser(req, res, next) {
  req.user = null;
  const data = readToken(readCookie(req, config.cookieName));
  if (data) {
    req.user = db.prepare(
      'SELECT id, full_name, phone, role, city FROM users WHERE id = ?'
    ).get(data.uid) || null;
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Connecte-toi pour continuer.' });
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Connecte-toi pour continuer.' });
    if (req.user.role !== role) return res.status(403).json({ success: false, message: 'Accès refusé.' });
    next();
  };
}

module.exports = { attachUser, requireAuth, requireRole };
