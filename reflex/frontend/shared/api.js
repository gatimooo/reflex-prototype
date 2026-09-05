// Shared client helpers: API base config, fetch wrapper that attaches the
// demo "current user" header, a Socket.io connection, and a tiny toast util.
// Loaded by every persona page before its own <page>.js.

const API_BASE = window.REFLEX_API_BASE || 'https://reflex-backend-1.onrender.com/';

const ReflexAPI = {
  currentUserId: localStorage.getItem('reflex_user_id') || null,

  setUser(id) {
    this.currentUserId = id;
    localStorage.setItem('reflex_user_id', id);
  },

  async request(path, { method = 'GET', body, isForm = false } = {}) {
    const headers = {};
    if (this.currentUserId) headers['X-User-Id'] = this.currentUserId;
    if (!isForm) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  },

  getUsers() { return this.request('/api/users'); },
  getRiders() { return this.request('/api/users/riders'); },
  getDeliveries() { return this.request('/api/deliveries'); },
  getDelivery(id) { return this.request(`/api/deliveries/${id}`); },
  createDelivery(body) { return this.request('/api/deliveries', { method: 'POST', body }); },
  assignDelivery(id, riderId) {
    return this.request(`/api/deliveries/${id}/assign`, { method: 'PATCH', body: { rider_id: riderId } });
  },
  updateStatus(id, status, note) {
    return this.request(`/api/deliveries/${id}/status`, { method: 'PATCH', body: { status, note } });
  },
  attachProof(id, formData) {
    return this.request(`/api/deliveries/${id}/proof`, { method: 'POST', body: formData, isForm: true });
  },
  fileUrl(relativePath) { return `${API_BASE}${relativePath}`; },
};

function connectSocket(onUpdate, onConnectionChange) {
  const socket = io(API_BASE);
  socket.on('connect', () => onConnectionChange && onConnectionChange(true));
  socket.on('disconnect', () => onConnectionChange && onConnectionChange(false));
  socket.on('delivery:created', (d) => onUpdate && onUpdate(d));
  socket.on('delivery:update', (d) => onUpdate && onUpdate(d));
  return socket;
}

function showToast(message) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

function statusClass(status) {
  return `status-${status.replace(/\s+/g, '-')}`;
}

function timeAgo(isoLike) {
  const then = new Date(isoLike.replace(' ', 'T') + 'Z').getTime();
  const diffMin = Math.round((Date.now() - then) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}
