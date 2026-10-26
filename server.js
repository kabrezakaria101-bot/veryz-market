require('dotenv').config();

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const db = require('./src/db');
const config = require('./src/config');
const { attachUser } = require('./src/middleware/auth');
const { ensureAdmin } = require('./src/services/bootstrap');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'upgrade-insecure-requests': null,
      'img-src': ["'self'", 'data:', 'blob:']
    }
  }
}));
// Les annonces peuvent contenir une photo : limite plus large pour cette route seulement
app.use('/api/products', express.json({ limit: '3mb' }));
app.use('/api/messages', express.json({ limit: '3mb' }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: 'draft-8',
  legacyHeaders: false
}));

app.get('/api/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();

    res.json({
      success: true,
      name: 'VERYZ MARKET',
      status: 'online',
      database: 'connected'
    });
  } catch (error) {
    console.error('Database health check failed:', error.message);
    res.status(503).json({
      success: false,
      status: 'unavailable'
    });
  }
});

app.use(attachUser);

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/categories', require('./src/routes/categories'));
app.use('/api/products', require('./src/routes/products'));
app.use('/api/me', require('./src/routes/me'));
app.use('/api/payments', require('./src/routes/payments'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api/messages', require('./src/routes/messages'));

app.use('/uploads', express.static(config.uploadsDir, { maxAge: '7d', index: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route API introuvable.'
  });
});

app.use((err, req, res, next) => {
  console.error(err.message);

  res.status(500).json({
    success: false,
    message: 'Une erreur interne est survenue.'
  });
});

ensureAdmin().catch((e) => console.error('Admin non créé :', e.message));

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`VERYZ MARKET : http://localhost:${PORT}`);
  console.log(`Test API : http://localhost:${PORT}/api/health`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
