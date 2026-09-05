const users = require('../models/userModel');

exports.list = (req, res) => res.json(users.getAllUsers());
exports.listRiders = (req, res) => res.json(users.getRiders());
