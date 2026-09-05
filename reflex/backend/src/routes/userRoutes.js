const express = require('express');
const userController = require('../controllers/userController');

const router = express.Router();

// No auth required: this only powers the demo "pick a user to log in as" screen.
router.get('/', userController.list);
router.get('/riders', userController.listRiders);

module.exports = router;
