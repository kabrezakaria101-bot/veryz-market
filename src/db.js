// Base de données PostgreSQL (Neon). Les tables se créent toutes seules, sans jamais effacer les données.
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL manquant : colle l\'adresse de connexion Neon dans les variables d\'environnement.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000 // laisse le temps à Neon de se réveiller
});

// Neon ferme les connexions inactives : on ignore l'erreur au lieu de planter
pool.on('error', (err) => console.error('Connexion inactive fermée :', err.message));

const query = (text, params) => pool.query(text, params);
const one = async (text, params) => (await pool.query(text, params)).rows[0] || null;
const all = async (text, params) => (await pool.query(text, params)).rows;

// Exécute plusieurs requêtes « tout ou rien »
async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (e) { /* ignoré */ }
    throw error;
  } finally {
    client.release();
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS ads (
  id SERIAL PRIMARY KEY,
  image_url TEXT NOT NULL,
  link_url TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer', 'seller', 'admin')),
    country TEXT NOT NULL DEFAULT 'BF',
    city TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER NOT NULL REFERENCES users(id),
    category_id INTEGER REFERENCES categories(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price_fcfa INTEGER NOT NULL CHECK (price_fcfa >= 0),
    city TEXT NOT NULL,
    neighborhood TEXT,
    image_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected', 'sold')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_products_status_city ON products(status, city);
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
  CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
  CREATE TABLE IF NOT EXISTS product_images (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);


  CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    reference TEXT NOT NULL UNIQUE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    buyer_id INTEGER NOT NULL REFERENCES users(id),
    seller_id INTEGER NOT NULL REFERENCES users(id),
    amount_fcfa INTEGER NOT NULL CHECK (amount_fcfa >= 0),
    provider TEXT NOT NULL,
    payer_phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS idx_transactions_buyer ON transactions(buyer_id);

  CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'admin')),
    kind TEXT NOT NULL DEFAULT 'text',
    body TEXT NOT NULL,
    media_url TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
`;

const CATEGORIES = [
  ['Téléphones et informatique', 'telephones-informatique'],
  ['Vêtements et chaussures', 'vetements-chaussures'],
  ['Maison et meubles', 'maison-meubles'],
  ['Alimentation et élevage', 'alimentation-elevage'],
  ['Motos et véhicules', 'motos-vehicules'],
  ['Services et réparations', 'services-reparations'],
  ['Emploi et opportunités', 'emploi-opportunites']
];

// À appeler une fois au démarrage
async function init() {
  await pool.query(SCHEMA);
  for (const [name, slug] of CATEGORIES) {
    await pool.query('INSERT INTO categories (name, slug) VALUES ($1, $2) ON CONFLICT DO NOTHING', [name, slug]);
  }
  console.log('Base PostgreSQL prête.');
}

module.exports = { pool, query, one, all, transaction, init };
