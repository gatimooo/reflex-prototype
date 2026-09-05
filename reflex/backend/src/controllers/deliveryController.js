const deliveries = require('../models/deliveryModel');
const { broadcastDeliveryUpdate, broadcastDeliveryCreated } = require('../sockets');

const VALID_TRANSITIONS = {
  Assigned: ['Picked Up', 'Failed', 'Cancelled'],
  'Picked Up': ['Delivered', 'Failed'],
};

exports.create = (req, res) => {
  const { customer_name, customer_phone, customer_address, item_description } = req.body;
  if (!customer_name || !customer_phone || !customer_address || !item_description) {
    return res.status(400).json({ error: 'customer_name, customer_phone, customer_address, and item_description are all required' });
  }

  const delivery = deliveries.createDelivery({
    retailer_id: req.user.id,
    customer_name,
    customer_phone,
    customer_address,
    item_description,
  });

  broadcastDeliveryCreated(delivery);
  res.status(201).json(delivery);
};

exports.list = (req, res) => {
  const { role, id } = req.user;
  if (role === 'retailer_staff') return res.json(deliveries.getByRetailer(id));
  if (role === 'rider') return res.json(deliveries.getByRider(id));
  // dispatcher sees everything
  return res.json(deliveries.getAll());
};

exports.getOne = (req, res) => {
  const delivery = deliveries.getById(req.params.id);
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
  const history = deliveries.getHistory(req.params.id);
  res.json({ ...delivery, history });
};

exports.assign = (req, res) => {
  const { rider_id } = req.body;
  if (!rider_id) return res.status(400).json({ error: 'rider_id is required' });

  const existing = deliveries.getById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Delivery not found' });
  if (existing.status !== 'Requested') {
    return res.status(409).json({ error: `Cannot assign a delivery that is already '${existing.status}'` });
  }

  const updated = deliveries.assignRider(req.params.id, rider_id, req.user.id);
  broadcastDeliveryUpdate(updated);
  res.json(updated);
};

exports.updateStatus = (req, res) => {
  const { status, note } = req.body;
  const existing = deliveries.getById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Delivery not found' });

  if (existing.assigned_rider_id !== req.user.id) {
    return res.status(403).json({ error: 'You are not the rider assigned to this delivery' });
  }

  const allowed = VALID_TRANSITIONS[existing.status] || [];
  if (!allowed.includes(status)) {
    return res.status(409).json({ error: `Cannot move from '${existing.status}' to '${status}'` });
  }
  if (status === 'Delivered') {
    return res.status(400).json({ error: 'Use POST /deliveries/:id/proof to mark Delivered — proof is required' });
  }

  const updated = deliveries.setStatus(req.params.id, status, req.user.id, note);
  broadcastDeliveryUpdate(updated);
  res.json(updated);
};

exports.attachProof = (req, res) => {
  const existing = deliveries.getById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Delivery not found' });
  if (existing.assigned_rider_id !== req.user.id) {
    return res.status(403).json({ error: 'You are not the rider assigned to this delivery' });
  }
  if (existing.status !== 'Picked Up') {
    return res.status(409).json({ error: `Cannot confirm delivery from status '${existing.status}'` });
  }
  if (!req.file) return res.status(400).json({ error: 'A proof photo is required' });

  const relativePath = `/uploads/${req.file.filename}`;
  const updated = deliveries.attachProof(req.params.id, relativePath, req.user.id, req.body.note);
  broadcastDeliveryUpdate(updated);
  res.json(updated);
};
