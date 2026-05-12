const initSqlJs = require('sql.js');
const fs = require('fs');

(async () => {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync('C:/Users/PABX/A/menuai-portatil/data/menuai.db');
  const db = new SQL.Database(buf);
  
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log('=== TABLES ===');
  tables[0].values.forEach(row => console.log(' -', row[0]));
  
  // Check for order-related tables
  const orderTables = ['orders', 'order_items', 'transactions', 'rentals', 'consumptions', 'suites', 'financeiro'];
  orderTables.forEach(name => {
    const r = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`);
    if (r.length > 0 && r[0].values.length > 0) {
      console.log(`\n=== ${name} TABLE ===`);
      const cols = db.exec(`PRAGMA table_info(${name})`);
      cols[0].values.forEach(row => console.log(' ', row[1], row[2]));
    } else {
      console.log(`\n=== ${name}: DOES NOT EXIST ===`);
    }
  });
  
  // Show all data from analytics
  console.log('\n=== ANALYTICS DATA ===');
  const anal = db.exec("SELECT * FROM analytics_events ORDER BY created_at DESC LIMIT 20");
  if (anal.length > 0) {
    console.log('columns:', anal[0].columns);
    anal[0].values.forEach(row => console.log(row));
  } else {
    console.log('No analytics data');
  }
  
  db.close();
})();
