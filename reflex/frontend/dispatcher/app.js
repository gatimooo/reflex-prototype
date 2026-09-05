let deliveries = [];
let riders = [];

async function boot() {
  const users = await ReflexAPI.getUsers();
  const dispatchers = users.filter((u) => u.role === 'dispatcher');
  const select = document.getElementById('userSelect');
  select.innerHTML = dispatchers.map((u) => `<option value="${u.id}">${u.name}</option>`).join('');

  const saved = ReflexAPI.currentUserId;
  if (saved && dispatchers.some((u) => u.id === saved)) select.value = saved;
  else ReflexAPI.setUser(select.value);

  select.addEventListener('change', () => ReflexAPI.setUser(select.value));

  riders = await ReflexAPI.getRiders();
  await loadDeliveries();

  connectSocket(
    (updated) => {
      const idx = deliveries.findIndex((d) => d.id === updated.id);
      if (idx >= 0) deliveries[idx] = updated; else deliveries.unshift(updated);
      render();
    },
    (isConnected) => {
      document.getElementById('connDot').classList.toggle('live', isConnected);
      document.getElementById('connLabel').textContent = isConnected ? 'live' : 'offline';
    }
  );
}

async function loadDeliveries() {
  deliveries = await ReflexAPI.getDeliveries();
  render();
}

function render() {
  renderOpen();
  renderAll();
}

function renderOpen() {
  const open = deliveries.filter((d) => d.status === 'Requested');
  const list = document.getElementById('openList');
  document.getElementById('openCount').textContent = `(${open.length})`;

  if (open.length === 0) {
    list.innerHTML = '<div class="empty-state">No unassigned requests right now.</div>';
    return;
  }

  list.innerHTML = open.map((d) => `
    <div class="delivery-row">
      <div class="delivery-main">
        <div class="customer">${escapeHtml(d.customer_name)}</div>
        <div class="meta">${escapeHtml(d.item_description)} &middot; ${escapeHtml(d.customer_address)}</div>
        <div class="meta">From ${escapeHtml(d.retailer_shop_name || d.retailer_name)} &middot; logged ${timeAgo(d.created_at)}</div>
      </div>
      <select class="assign-select" data-id="${d.id}">
        <option value="">Assign rider…</option>
        ${riders.map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('')}
      </select>
      <span></span>
    </div>
  `).join('');

  list.querySelectorAll('.assign-select').forEach((sel) => {
    sel.addEventListener('change', async () => {
      if (!sel.value) return;
      sel.disabled = true;
      try {
        await ReflexAPI.assignDelivery(sel.dataset.id, sel.value);
        showToast('Rider assigned');
        await loadDeliveries();
      } catch (err) {
        showToast(err.message);
        sel.disabled = false;
      }
    });
  });
}

function renderAll() {
  const list = document.getElementById('allList');
  document.getElementById('allCount').textContent = `(${deliveries.length})`;

  if (deliveries.length === 0) {
    list.innerHTML = '<div class="empty-state">No deliveries yet.</div>';
    return;
  }

  list.innerHTML = deliveries.map((d) => `
    <div class="delivery-row">
      <div class="delivery-main">
        <div class="customer">${escapeHtml(d.customer_name)}</div>
        <div class="meta">${escapeHtml(d.item_description)}</div>
        <div class="meta">
          ${d.rider_name ? `Rider: ${escapeHtml(d.rider_name)}` : 'Unassigned'}
          &middot; updated ${timeAgo(d.updated_at)}
        </div>
      </div>
      <span class="status-pill ${statusClass(d.status)}"><span class="dot"></span>${d.status}</span>
    </div>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

boot();
