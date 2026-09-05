// Seeds a handful of demo users so the prototype is usable without a signup flow.
// Run with: npm run seed
const { v4: uuid } = require('uuid');
const db = require('./index');

const users = [
  { id: uuid(), name: 'Amina (Sasa Electronics)', role: 'retailer_staff', shop_name: 'Sasa Electronics', phone: '0711000001' },
  { id: uuid(), name: 'Brian (Citycare Pharmacy)', role: 'retailer_staff', shop_name: 'Citycare Pharmacy', phone: '0711000002' },
  { id: uuid(), name: 'David (Dispatch)', role: 'dispatcher', shop_name: null, phone: '0711000010' },
  { id: uuid(), name: 'Fatuma (Rider)', role: 'rider', shop_name: null, phone: '0711000020' },
  { id: uuid(), name: 'Kevo (Rider)', role: 'rider', shop_name: null, phone: '0711000021' },
];

const insert = db.prepare(`
  INSERT INTO users (id, name, role, shop_name, phone) VALUES (@id, @name, @role, @shop_name, @phone)
`);

const existing = db.prepare('SELECT COUNT(*) AS n FROM users').get();
if (existing.n === 0) {
  const insertMany = db.transaction((rows) => rows.forEach((r) => insert.run(r)));
  insertMany(users);
  console.log(`Seeded ${users.length} demo users:`);
  users.forEach((u) => console.log(`  [${u.role}] ${u.name} — id: ${u.id}`));
} else {
  console.log('Users already exist, skipping seed. Delete backend/data/reflex.db to reseed.');
}
