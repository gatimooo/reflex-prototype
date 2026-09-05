let deliveries = [];

async function boot() {
  const users = await ReflexAPI.getUsers();
  const retailers = users.filter((u) => u.role === 'retailer_staff');
  const select = document.getElementById('userSelect');
  select.innerHTML = retailers.map((u) => `<option value="${u.id}">${u.name}</option>`).join('');

  const saved = ReflexAPI.currentUserId;
  if (saved && retailers.some((u) => u.id === saved)) select.value = saved;
  else ReflexAPI.setUser(select.value);

  select.addEventListener('change', () => {
    ReflexAPI.setUser(select.value);
    loadDeliveries();
  });

  await loadDeliveries();

  connectSocket(
    (updated) => {
      if (updated.retailer_id !== ReflexAPI.currentUserId) return;
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
  const list = document.getElementById('deliveryList');
  document.getElementById('deliveryCount').textContent = `(${deliveries.length})`;

  if (deliveries.length === 0) {
    list.innerHTML = '<div class="empty-state">No requests logged yet. Once you log one, you\'ll see its status update here in real time.</div>';
    return;
  }

  list.innerHTML = deliveries.map((d) => `
    <div class="delivery-row">
      <div class="delivery-main">
        <div class="customer">${escapeHtml(d.customer_name)}</div>
        <div class="meta">${escapeHtml(d.item_description)} &middot; ${escapeHtml(d.customer_address)}</div>
        <div class="meta">${d.rider_name ? `Rider: ${escapeHtml(d.rider_name)}` : 'Not yet assigned'} &middot; updated ${timeAgo(d.updated_at)}</div>
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

document.getElementById('deliveryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  try {
    await ReflexAPI.createDelivery({
      customer_name: document.getElementById('customer_name').value.trim(),
      customer_phone: document.getElementById('customer_phone').value.trim(),
      customer_address: document.getElementById('customer_address').value.trim(),
      item_description: document.getElementById('item_description').value.trim(),
    });
    e.target.reset();
    showToast('Delivery request logged');
    await loadDeliveries();
  } catch (err) {
    showToast(err.message);
  } finally {
    btn.disabled = false;
  }
});

boot();
