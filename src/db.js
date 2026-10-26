const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const databaseFile = path.resolve(
  process.cwd(),
  process.env.DATABASE_FILE || './data/veryz-market.db'
);

fs.mkdirSync(path.dirname(databaseFile), { recursive: true });

const db = new Database(databaseFile);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'buyer'
      CHECK (role IN ('buyer', 'seller', 'admin')),
    country TEXT NOT NULL DEFAULT 'BF',
    city TEXT,
    created_at TEXT NOT NULL DEFAULT (
      strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    )
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    category_id INTEGER,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price_fcfa INTEGER NOT NULL CHECK (price_fcfa >= 0),
    city TEXT NOT NULL,
    neighborhood TEXT,
    image_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'published', 'rejected', 'sold')),
    created_at TEXT NOT NULL DEFAULT (
      strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    ),
    FOREIGN KEY (seller_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );

  CREATE INDEX IF NOT EXISTS idx_products_status_city
    ON products(status, city);

  CREATE INDEX IF NOT EXISTS idx_products_category
    ON products(category_id);

  CREATE INDEX IF NOT EXISTS idx_products_seller
    ON products(seller_id);

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference TEXT NOT NULL UNIQUE,
    product_id INTEGER NOT NULL,
    buyer_id INTEGER NOT NULL,
    seller_id INTEGER NOT NULL,
    amount_fcfa INTEGER NOT NULL CHECK (amount_fcfa >= 0),
    provider TEXT NOT NULL,
    payer_phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'paid', 'failed')),
    created_at TEXT NOT NULL DEFAULT (
      strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    ),
    paid_at TEXT,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (buyer_id) REFERENCES users(id),
    FOREIGN KEY (seller_id) REFERENCES users(id)
  );
CREATE INDEX IF NOT EXISTS idx_transactions_buyer
    ON transactions(buyer_id);

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'admin')),
    body TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (
      strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    ),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_messages_user
    ON messages(user_id);

`);

// Messagerie : type de message (texte, image, audio, sticker) + fichier joint
const messageColumns = db.prepare('PRAGMA table_info(messages)').all().map((c) => c.name);
if (!messageColumns.includes('kind')) {
  db.exec("ALTER TABLE messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'text'");
}
if (!messageColumns.includes('media_url')) {
  db.exec('ALTER TABLE messages ADD COLUMN media_url TEXT');
}

const seedCategories = db.prepare(`
  INSERT OR IGNORE INTO categories (name, slug)
  VALUES (?, ?)
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

const seed = db.transaction(() => {
  for (const category of categories) {
    seedCategories.run(...category);
  }
});

seed();

console.log('Base SQLite initialisée.');

module.exports = db;
