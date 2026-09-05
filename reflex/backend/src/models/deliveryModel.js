const { v4: uuid } = require('uuid');
const db = require('../db');

const BASE_SELECT = `
  SELECT
    d.id, d.customer_name, d.customer_phone, d.customer_address, d.item_description,
    d.status, d.proof_photo_path, d.proof_note, d.created_at, d.updated_at,
    d.retailer_id, ret.name AS retailer_name, ret.shop_name AS retailer_shop_name,
    d.assigned_rider_id, rid.name AS rider_name, rid.phone AS rider_phone
  FROM deliveries d
  JOIN users ret ON ret.id = d.retailer_id
  LEFT JOIN users rid ON rid.id = d.assigned_rider_id
`;

const insertDelivery = db.prepare(`
  INSERT INTO deliveries (id, retailer_id, customer_name, customer_phone, customer_address, item_description)
  VALUES (@id, @retailer_id, @customer_name, @customer_phone, @customer_address, @item_description)
`);

const insertHistory = db.prepare(`
  INSERT INTO delivery_status_history (id, delivery_id, status, changed_by, note)
  VALUES (@id, @delivery_id, @status, @changed_by, @note)
`);

const getById = db.prepare(`${BASE_SELECT} WHERE d.id = ?`);
const getAll = db.prepare(`${BASE_SELECT} ORDER BY d.created_at DESC`);
const getByRider = db.prepare(`${BASE_SELECT} WHERE d.assigned_rider_id = ? ORDER BY d.created_at DESC`);
const getByRetailer = db.prepare(`${BASE_SELECT} WHERE d.retailer_id = ? ORDER BY d.created_at DESC`);
const getUnassigned = db.prepare(`${BASE_SELECT} WHERE d.status = 'Requested' ORDER BY d.created_at ASC`);

const updateAssignment = db.prepare(`
  UPDATE deliveries SET assigned_rider_id = ?, status = 'Assigned', updated_at = datetime('now') WHERE id = ?
`);

const updateStatus = db.prepare(`
  UPDATE deliveries SET status = ?, updated_at = datetime('now') WHERE id = ?
`);

const updateProof = db.prepare(`
  UPDATE deliveries SET proof_photo_path = ?, proof_note = ?, status = 'Delivered', updated_at = datetime('now') WHERE id = ?
`);

const getHistory = db.prepare(`
  SELECT h.id, h.status, h.note, h.changed_at, u.name AS changed_by_name, u.role AS changed_by_role
  FROM delivery_status_history h
  JOIN users u ON u.id = h.changed_by
  WHERE h.delivery_id = ?
  ORDER BY h.changed_at ASC
`);

function createDelivery({ retailer_id, customer_name, customer_phone, customer_address, item_description }) {
  const id = uuid();
  insertDelivery.run({ id, retailer_id, customer_name, customer_phone, customer_address, item_description });
  logHistory(id, 'Requested', retailer_id, 'Delivery request logged');
  return getById.get(id);
}

function logHistory(delivery_id, status, changed_by, note = null) {
  insertHistory.run({ id: uuid(), delivery_id, status, changed_by, note });
}

function assignRider(deliveryId, riderId, dispatcherId) {
  const delivery = getById.get(deliveryId);
  if (!delivery) return null;
  updateAssignment.run(riderId, deliveryId);
  logHistory(deliveryId, 'Assigned', dispatcherId, `Assigned to rider`);
  return getById.get(deliveryId);
}

function setStatus(deliveryId, status, riderId, note = null) {
  const delivery = getById.get(deliveryId);
  if (!delivery) return null;
  updateStatus.run(status, deliveryId);
  logHistory(deliveryId, status, riderId, note);
  return getById.get(deliveryId);
}

function attachProof(deliveryId, photoPath, riderId, note = null) {
  const delivery = getById.get(deliveryId);
  if (!delivery) return null;
  updateProof.run(photoPath, note, deliveryId);
  logHistory(deliveryId, 'Delivered', riderId, note || 'Proof of delivery captured');
  return getById.get(deliveryId);
}

module.exports = {
  createDelivery,
  assignRider,
  setStatus,
  attachProof,
  getById: (id) => getById.get(id),
  getAll: () => getAll.all(),
  getByRider: (riderId) => getByRider.all(riderId),
  getByRetailer: (retailerId) => getByRetailer.all(retailerId),
  getUnassigned: () => getUnassigned.all(),
  getHistory: (deliveryId) => getHistory.all(deliveryId),
};
