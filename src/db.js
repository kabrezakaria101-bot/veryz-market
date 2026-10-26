const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDb() {
  // 1. Création des tables (même structure que ton ancien SQLite mais en Postgres)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer', 'seller', 'admin')),
      country TEXT NOT NULL DEFAULT 'BF',
      city TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_products_status_city ON products(status, city);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);

    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      reference TEXT UNIQUE NOT NULL,
      product_id INTEGER NOT NULL REFERENCES products(id),
      buyer_id INTEGER NOT NULL REFERENCES users(id),
      seller_id INTEGER NOT NULL REFERENCES users(id),
      amount_fcfa INTEGER NOT NULL CHECK (amount_fcfa >= 0),
      provider TEXT NOT NULL,
      payer_phone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      paid_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_buyer ON transactions(buyer_id);
  `);

  // 2. Seed catégories (comme ton ancien seed)
  const categories = [
    ['Téléphones et informatique', 'telephones-informatique'],
    ['Vêtements et chaussures', 'vetements-chaussures'],
    ['Maison et meubles', 'maison-meubles'],
    ['Alimentation et élevage', 'alimentation-elevage'],
    ['Motos et véhicules', 'motos-vehicules'],
    ['Services et réparations', 'services-reparations'],
    ['Emploi et opportunités', 'emploi-opportunites']
  ];

  for (const [name, slug] of categories) {
    await pool.query(
      'INSERT INTO categories (name, slug) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING',
      [name, slug]
    );
  }

  // 3. Seed ADMIN 77656484 / Veryz199@ (depuis .env sur Render)
  const adminPhone = process.env.ADMIN_PHONE || '77656484';
  const adminPass = process.env.ADMIN_PASSWORD || 'Veryz199@';

  const { rows } = await pool.query('SELECT id FROM users WHERE phone = $1', [adminPhone]);
  if (rows.length === 0) {
    const hash = await bcrypt.hash(adminPass, 10);
    await pool.query(
      `INSERT INTO users (full_name, phone, password_hash, role, city) VALUES ($1, $2, $3, 'admin', 'Ouagadougou')`,
      ['Admin VERYZ', adminPhone, hash]
    );
    console.log('✅ Admin créé:', adminPhone);
  }

  console.log('Base Postgres initialisée.');
}

initDb().catch(e => console.error('Erreur DB:', e.message));

// Pour que tes anciennes routes qui font db.query marchent
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
