const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer', 'seller', 'admin')),
      country TEXT NOT NULL DEFAULT 'BF',
      city TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_products_status_city ON products(status, city);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);

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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      paid_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_transactions_buyer ON transactions(buyer_id);

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'admin')),
      body TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      kind TEXT NOT NULL DEFAULT 'text',
      media_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
  `);

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
      `INSERT INTO categories (name, slug) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING`,
      [name, slug]
    );
  }
  console.log('Base Postgres initialisée.');
}

initDb().catch(err => {
  console.error('Erreur init Postgres:', err);
});

// Compatibilité pour que ton ancien code qui fait db.prepare ne plante pas tout de suite
// On va devoir convertir tes routes une par une après
module.exports = pool;
module.exports.query = (text, params) => pool.query(text, params);
