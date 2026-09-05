const express = require('express');
const currentUser = require('../middleware/currentUser');
const upload = require('../middleware/upload');
const deliveryController = require('../controllers/deliveryController');

const router = express.Router();

// Any authenticated role can list/view (scoped per-role inside the controller).
router.get('/', currentUser(), deliveryController.list);
router.get('/:id', currentUser(), deliveryController.getOne);

// Retailer staff log new requests.
router.post('/', currentUser('retailer_staff'), deliveryController.create);

// Dispatcher assigns a rider.
router.patch('/:id/assign', currentUser('dispatcher'), deliveryController.assign);

// Rider updates status along the way (Picked Up, Failed, Cancelled).
router.patch('/:id/status', currentUser('rider'), deliveryController.updateStatus);

// Rider confirms delivery with a photo — this is the one transition that requires proof.
router.post('/:id/proof', currentUser('rider'), upload.single('photo'), deliveryController.attachProof);

module.exports = router;
