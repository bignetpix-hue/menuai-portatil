const express = require('express');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  var envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(function (line) {
    var match = line.match(/^([^=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  });
}

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(function (e) { return e.trim().toLowerCase(); }).filter(Boolean);
const DB_PATH = path.join(__dirname, '..', 'data', 'menuai.db');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const OPENROUTER_KEY = process.env.OPENROUTER_KEY || '';

for (const dir of [path.dirname(DB_PATH), UPLOADS_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// --- Database helpers ---
var db = null;

function sqlRun(sql, params) {
  if (params) db.run(sql, params);
  else db.run(sql);
  saveDb();
}

function sqlAll(sql, params) {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function sqlOne(sql, params) {
  const rows = sqlAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function saveDb() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// --- Auth middleware ---
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Acesso restrito a administradores' });
  }
  next();
}

// --- File upload ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, UPLOADS_DIR); },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (!file) return cb();
    if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(path.extname(file.originalname))) cb(null, true);
    else cb(new Error('Apenas imagens (jpg, png, gif, webp, svg)'));
  }
});

// --- Rate Limiting disabled for local usage ---

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));

// ===================== AUTH =====================

app.post('/api/auth/register', function (req, res) {
  try {
    const { email, password, nome, whatsapp, categoria } = req.body;
    if (!email || !password || !nome) {
      return res.status(400).json({ error: 'Email, senha e nome são obrigatórios' });
    }
    const existing = sqlOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) return res.status(400).json({ error: 'Email já cadastrado' });

    const userId = uuidv4();
    const isAdminEmail = ADMIN_EMAILS.includes(email.toLowerCase());
    const hash = bcrypt.hashSync(password, 10);
    const slug = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '-' + Math.random().toString(36).slice(2, 6);

    sqlRun('INSERT INTO users (id, email, name, password_hash, is_admin) VALUES (?, ?, ?, ?, ?)', [userId, email, nome, hash, isAdminEmail ? 1 : 0]);

    const restId = uuidv4();
    sqlRun('INSERT INTO restaurants (id, user_id, name, slug, phone, category, plan, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [restId, userId, nome, slug, whatsapp || '', categoria || '', 'starter', 1]);

    const token = jwt.sign({ id: userId, email, is_admin: isAdminEmail }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: userId, email, name: nome }, restaurant: { id: restId, name: nome, slug } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', function (req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });

    const user = sqlOne('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, is_admin: !!user.is_admin }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, is_admin: !!user.is_admin } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/me', auth, function (req, res) {
  const user = sqlOne('SELECT id, email, name, is_admin, created_at FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json({ user: { ...user, is_admin: !!user.is_admin } });
});

// ===================== RESTAURANTS =====================

app.get('/api/restaurants', auth, adminOnly, function (req, res) {
  const restaurants = sqlAll('SELECT * FROM restaurants ORDER BY created_at DESC');
  res.json({ data: restaurants });
});

app.get('/api/restaurants/mine', auth, function (req, res) {
  let rest = sqlOne('SELECT * FROM restaurants WHERE user_id = ?', [req.user.id]);
  if (!rest) {
    const slug = 'meu-restaurante-' + Math.random().toString(36).slice(2, 6);
    const user = sqlOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const restId = uuidv4();
    sqlRun('INSERT INTO restaurants (id, user_id, name, slug, phone, category, plan, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [restId, req.user.id, user ? user.name : 'Meu Restaurante', slug, '', '', 'starter', 1]);
    rest = sqlOne('SELECT * FROM restaurants WHERE id = ?', [restId]);
  }
  res.json({ data: rest });
});

app.get('/api/restaurants/slug/:slug', function (req, res) {
  const rest = sqlOne('SELECT * FROM restaurants WHERE slug = ? AND is_active = 1', [req.params.slug]);
  if (!rest) return res.status(404).json({ error: 'Restaurante não encontrado', data: null });
  res.json({ data: rest });
});

app.get('/api/restaurants/:id', auth, function (req, res) {
  const rest = sqlOne('SELECT * FROM restaurants WHERE id = ?', [req.params.id]);
  if (!rest) return res.status(404).json({ error: 'Restaurante não encontrado' });
  res.json({ data: rest });
});

app.put('/api/restaurants/:id', auth, function (req, res) {
  const rest = sqlOne('SELECT * FROM restaurants WHERE id = ?', [req.params.id]);
  if (!rest) return res.status(404).json({ error: 'Restaurante não encontrado' });
  if (rest.user_id !== req.user.id && !req.user.is_admin) {
    return res.status(403).json({ error: 'Sem permissão' });
  }

  const allowed = ['name', 'phone', 'whatsapp', 'category', 'plan', 'is_active', 'slug', 'logo_url', 'banner_url', 'email'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  updates.updated_at = new Date().toISOString();

  const setClauses = Object.keys(updates).map(function (k) { return k + ' = ?'; }).join(', ');
  const values = Object.values(updates);
  values.push(req.params.id);

  sqlRun('UPDATE restaurants SET ' + setClauses + ' WHERE id = ?', values);
  const updated = sqlOne('SELECT * FROM restaurants WHERE id = ?', [req.params.id]);
  res.json({ data: updated });
});

app.delete('/api/restaurants/:id', auth, adminOnly, function (req, res) {
  sqlRun('DELETE FROM analytics_events WHERE restaurant_id = ?', [req.params.id]);
  sqlRun('DELETE FROM products WHERE restaurant_id = ?', [req.params.id]);
  sqlRun('DELETE FROM restaurants WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.post('/api/restaurants', auth, adminOnly, function (req, res) {
  const { name, slug, email, plan } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'Nome e slug são obrigatórios' });

  const existing = sqlOne('SELECT id FROM restaurants WHERE slug = ?', [slug]);
  if (existing) return res.status(400).json({ error: 'Slug já existe' });

  const id = uuidv4();
  sqlRun('INSERT INTO restaurants (id, name, slug, email, plan, is_active) VALUES (?, ?, ?, ?, ?, ?)', [id, name, slug, email || null, plan || 'starter', 1]);

  // Adicionar 10 produtos de exemplo
  const sampleProducts = [
    { name: 'Prato Especial da Casa', gourmet_name: 'Chef\'s Special', description: ' nosso prato assinatura com ingredientes selecionados e preparo exclusivo do chef.', price: 45.90, category: 'Pratos Principais', highlight: true },
    { name: 'Hambúrguer Artesanal', gourmet_name: 'Gourmet Burger', description: 'Hambúrguer com carne 100% Angus, queijo coalho derretido, bacon crocante, alface, tomate e molho especial.', price: 32.90, category: 'Lanches', highlight: false },
    { name: 'Pizza Margherita', gourmet_name: 'Classic Italian', description: 'Massa italiana tradicional com tomate San Marzano, mozzarella de búfala, manjericão fresco e azeite extra virgem.', price: 58.90, category: 'Pizzas', highlight: false },
    { name: 'Salada Caesar', gourmet_name: 'Caesar Salad', description: 'Alface romana, croutons crocantes, parmesão ralado e nosso molho caesar feito em casa.', price: 28.90, category: 'Entradas', highlight: false },
    { name: 'Filé de Salmão', gourmet_name: 'Grilled Salmon', description: 'Salmão fresco grelhado, servido com legumes no vapor e batatas rústicas.', price: 52.90, category: 'Pratos Principais', highlight: false },
    { name: 'Risoto de Funghi', gourmet_name: 'Mushroom Risotto', description: 'Arroz arbório cozido lentamente com mix de cogumelos shiitake, портobello e paris, finish com parmesão aged.', price: 42.90, category: 'Pratos Principais', highlight: false },
    { name: 'Sobremesa do Dia', gourmet_name: 'Dessert of the Day', description: 'Deliciosa sobremesa caseira que muda todos os dias. Consulte nosso garçom.', price: 18.90, category: 'Sobremesas', highlight: false },
    { name: 'Refrigerante Lata', gourmet_name: 'Soft Drink', description: 'Linha completa de refrigerantes. Coca-Cola, Guaraná Antarctica, Sprite, Fanta.', price: 6.90, category: 'Bebidas', highlight: false },
    { name: 'Cerveja Artesanal', gourmet_name: 'Craft Beer', description: 'Cervejas artesanais selecionadas. Weiss, IPA, Pilsen, Stout. Consulte disponibilidade.', price: 15.90, category: 'Bebidas', highlight: false },
    { name: 'Combo Família', gourmet_name: 'Family Combo', description: 'Ideal para compartilhar. 2 pizzas grandi, 1 acompanhamento e 2 refrigerantes 2L.', price: 89.90, category: 'Combos', highlight: true }
  ];

  sampleProducts.forEach(function (prod, index) {
    const prodId = uuidv4();
    sqlRun('INSERT INTO products (id, restaurant_id, name, gourmet_name, description, price, category, highlight, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [prodId, id, prod.name, prod.gourmet_name, prod.description, prod.price, prod.category, prod.highlight ? 1 : 0, 1, index]);
  });

  const rest = sqlOne('SELECT * FROM restaurants WHERE id = ?', [id]);
  res.json({ data: rest });
});

// ===================== PRODUCTS =====================

app.get('/api/restaurants/:id/products', function (req, res) {
  const { status, category, search, page, pageSize } = req.query;
  var where = ['restaurant_id = ?'];
  var params = [req.params.id];

  if (status && status !== 'all') {
    where.push('is_active = ?');
    params.push(status === 'active' ? 1 : 0);
  }
  if (category && category !== 'all') {
    where.push('category = ?');
    params.push(category);
  }
  if (search) {
    where.push('(name LIKE ? OR description LIKE ? OR gourmet_name LIKE ?)');
    const like = '%' + search + '%';
    params.push(like, like, like);
  }
  const whereClause = where.join(' AND ');
  const countRow = sqlOne('SELECT COUNT(*) as total FROM products WHERE ' + whereClause, params);
  const total = countRow.total;

  var orderSql = ' ORDER BY sort_order ASC, created_at DESC';
  if (page && pageSize) {
    const p = parseInt(page), ps = parseInt(pageSize);
    orderSql += ' LIMIT ' + ps + ' OFFSET ' + ((p - 1) * ps);
  }

  const products = sqlAll('SELECT * FROM products WHERE ' + whereClause + orderSql, params);
  res.json({ data: products, count: total });
});

app.get('/api/restaurants/:id/products/all', function (req, res) {
  const products = sqlAll('SELECT * FROM products WHERE restaurant_id = ? ORDER BY sort_order ASC, created_at DESC', [req.params.id]);
  res.json({ data: products });
});

app.post('/api/restaurants/:id/products', auth, function (req, res) {
  const rest = sqlOne('SELECT * FROM restaurants WHERE id = ?', [req.params.id]);
  if (!rest) return res.status(404).json({ error: 'Restaurante não encontrado' });
  if (rest.user_id !== req.user.id && !req.user.is_admin) {
    return res.status(403).json({ error: 'Sem permissão' });
  }

  const { name, price, category, gourmet_name, description, image_url, is_highlight, is_active, sort_order } = req.body;
  if (!name || price === undefined) return res.status(400).json({ error: 'Nome e preço são obrigatórios' });

  const id = uuidv4();
  const maxSort = sqlOne('SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM products WHERE restaurant_id = ?', [req.params.id]);
  sqlRun('INSERT INTO products (id, restaurant_id, name, price, category, gourmet_name, description, image_url, is_highlight, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, req.params.id, name, price, category || null, gourmet_name || null, description || null, image_url || null, is_highlight ? 1 : 0, is_active !== undefined ? (is_active ? 1 : 0) : 1, sort_order !== undefined ? sort_order : maxSort.next]);

  const prod = sqlOne('SELECT * FROM products WHERE id = ?', [id]);
  res.json({ data: prod });
});

app.put('/api/products/:id', auth, function (req, res) {
  const prod = sqlOne('SELECT p.*, r.user_id as rest_user_id FROM products p JOIN restaurants r ON r.id = p.restaurant_id WHERE p.id = ?', [req.params.id]);
  if (!prod) return res.status(404).json({ error: 'Produto não encontrado' });
  if (prod.rest_user_id !== req.user.id && !req.user.is_admin) {
    return res.status(403).json({ error: 'Sem permissão' });
  }

  const allowed = ['name', 'price', 'category', 'gourmet_name', 'description', 'image_url', 'is_highlight', 'is_active', 'sort_order'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  updates.updated_at = new Date().toISOString();

  const setClauses = Object.keys(updates).map(function (k) { return k + ' = ?'; }).join(', ');
  const values = Object.values(updates);
  values.push(req.params.id);

  sqlRun('UPDATE products SET ' + setClauses + ' WHERE id = ?', values);
  const updated = sqlOne('SELECT * FROM products WHERE id = ?', [req.params.id]);
  res.json({ data: updated });
});

app.delete('/api/products/:id', auth, function (req, res) {
  const prod = sqlOne('SELECT p.*, r.user_id as rest_user_id FROM products p JOIN restaurants r ON r.id = p.restaurant_id WHERE p.id = ?', [req.params.id]);
  if (!prod) return res.status(404).json({ error: 'Produto não encontrado' });
  if (prod.rest_user_id !== req.user.id && !req.user.is_admin) {
    return res.status(403).json({ error: 'Sem permissão' });
  }
  sqlRun('DELETE FROM products WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ===================== ANALYTICS =====================

app.post('/api/analytics', function (req, res) {
  const { restaurant_id, event_type, metadata } = req.body;
  if (!restaurant_id || !event_type) return res.status(400).json({ error: 'restaurant_id e event_type são obrigatórios' });
  sqlRun('INSERT INTO analytics_events (id, restaurant_id, event_type, metadata) VALUES (?, ?, ?, ?)',
    [uuidv4(), restaurant_id, event_type, JSON.stringify(metadata || {})]);
  res.json({ success: true });
});

app.get('/api/analytics/:restaurantId', auth, function (req, res) {
  const events = sqlAll('SELECT * FROM analytics_events WHERE restaurant_id = ? ORDER BY created_at DESC', [req.params.restaurantId]);
  res.json({ data: events });
});

app.get('/api/analytics/:restaurantId/count/:eventType', auth, function (req, res) {
  const result = sqlOne('SELECT COUNT(*) as count FROM analytics_events WHERE restaurant_id = ? AND event_type = ?', [req.params.restaurantId, req.params.eventType]);
  res.json({ count: result.count });
});

// ===================== ADMIN SETTINGS =====================

app.get('/api/admin/settings', function (req, res) {
  const settings = sqlOne('SELECT * FROM admin_settings LIMIT 1');
  res.json({ data: settings || null });
});

app.put('/api/admin/settings', auth, adminOnly, function (req, res) {
  const allowed = ['phone', 'whatsapp', 'email', 'business_hours'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  updates.updated_at = new Date().toISOString();

  const existing = sqlOne('SELECT id FROM admin_settings LIMIT 1');
  if (existing) {
    const setClauses = Object.keys(updates).map(function (k) { return k + ' = ?'; }).join(', ');
    const values = Object.values(updates);
    values.push(existing.id);
    sqlRun('UPDATE admin_settings SET ' + setClauses + ' WHERE id = ?', values);
  } else {
    updates.id = uuidv4();
    const keys = Object.keys(updates).join(', ');
    const qmarks = Object.values(updates).map(function () { return '?'; }).join(', ');
    sqlRun('INSERT INTO admin_settings (' + keys + ') VALUES (' + qmarks + ')', Object.values(updates));
  }
  const settings = sqlOne('SELECT * FROM admin_settings LIMIT 1');
  res.json({ data: settings });
});

// ===================== AI =====================

app.post('/api/ai/description', auth, async function (req, res) {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt é obrigatório' });

    if (!OPENROUTER_KEY) {
      return res.json({
        nome: prompt,
        descricao: 'Delicioso ' + prompt.toLowerCase() + ' preparado com ingredientes selecionados.',
        categoria: 'Pratos Principais'
      });
    }

    const fetch = (await import('node-fetch')).default;
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + openrouterKey,
        'HTTP-Referer': req.headers.origin || 'http://localhost:3000',
        'X-Title': 'MENUAI'
      },
      body: JSON.stringify({
        model: 'minimax/minimax-m2.5:free',
        messages: [
          { role: 'system', content: 'Você é um sommelier de cardápios. Gere um nome gourmet, descrição curta (1 frase) e categoria para um item de menu.' },
          { role: 'user', content: 'Item: ' + prompt + '. Responda APENAS no formato JSON: {"nome":"...","descricao":"...","categoria":"..."}' }
        ],
        max_tokens: 300
      })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

    const content = data.choices[0].message.content;
    const json = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(json);
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===================== UPLOAD =====================

app.post('/api/upload', auth, upload.single('file'), function (req, res) {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  res.json({ url: '/uploads/' + req.file.filename });
});

// ===================== STATIC FILES =====================

app.use(express.static(path.join(__dirname, '..'), { index: ['index.html', 'app.html'] }));

app.get('*', function (req, res) {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ===================== INIT =====================

async function start() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  db.run('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password_hash TEXT NOT NULL, is_admin INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime(\'now\')))');
  db.run('CREATE TABLE IF NOT EXISTS restaurants (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, phone TEXT, whatsapp TEXT, category TEXT, plan TEXT DEFAULT \'starter\', is_active INTEGER DEFAULT 1, logo_url TEXT, banner_url TEXT, email TEXT, created_at TEXT DEFAULT (datetime(\'now\')), updated_at TEXT DEFAULT (datetime(\'now\')))');
  db.run('CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, restaurant_id TEXT REFERENCES restaurants(id) ON DELETE CASCADE, name TEXT NOT NULL, price REAL NOT NULL, category TEXT, gourmet_name TEXT, description TEXT, image_url TEXT, is_highlight INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime(\'now\')), updated_at TEXT DEFAULT (datetime(\'now\')))');
  db.run('CREATE TABLE IF NOT EXISTS analytics_events (id TEXT PRIMARY KEY, restaurant_id TEXT REFERENCES restaurants(id) ON DELETE CASCADE, event_type TEXT NOT NULL, metadata TEXT DEFAULT \'{}\', created_at TEXT DEFAULT (datetime(\'now\')))');
  db.run('CREATE TABLE IF NOT EXISTS admin_settings (id TEXT PRIMARY KEY, phone TEXT, whatsapp TEXT, email TEXT, business_hours TEXT, created_at TEXT DEFAULT (datetime(\'now\')), updated_at TEXT DEFAULT (datetime(\'now\')))');

  var settingsCheck = sqlOne('SELECT id FROM admin_settings LIMIT 1');
  if (!settingsCheck) {
    sqlRun('INSERT INTO admin_settings (id) VALUES (?)', [uuidv4()]);
  }

  saveDb();

  app.listen(PORT, '0.0.0.0', function () {
    console.log('');
    console.log('  MENUAI - Cardápio Digital');
    console.log('  ' + '='.repeat(40));
    console.log('  Local:    http://localhost:' + PORT);
    console.log('  Server:   http://0.0.0.0:' + PORT);
    console.log('  ' + '='.repeat(40));
    console.log('');
  });
}

start().catch(function (e) {
  console.error('Failed to start:', e);
  process.exit(1);
});
