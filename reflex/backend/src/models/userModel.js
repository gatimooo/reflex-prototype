const db = require('../db');

const listUsers = db.prepare('SELECT id, name, role, shop_name, phone FROM users ORDER BY role, name');
const getUser = db.prepare('SELECT id, name, role, shop_name, phone FROM users WHERE id = ?');
const listRiders = db.prepare("SELECT id, name, phone FROM users WHERE role = 'rider' ORDER BY name");

module.exports = {
  getAllUsers: () => listUsers.all(),
  getUserById: (id) => getUser.get(id),
  getRiders: () => listRiders.all(),
};
