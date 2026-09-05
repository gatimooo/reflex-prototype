const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || './data/reflex.db';
const resolvedPath = path.resolve(__dirname, '../../', DB_PATH);

fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

const db = new Database(resolvedPath);
db.pragma('journal_mode = WAL');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

module.exports = db;

// Auto-seed demo users if none exist yet. This matters most when running
// without a persistent disk (e.g. Render's free tier) — the SQLite file
// resets on every restart/redeploy, so without this the login dropdowns
// come back empty until someone manually re-runs `npm run seed`.
require('./seed');
