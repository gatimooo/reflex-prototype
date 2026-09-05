let deliveries = [];
let proofTargetId = null;

async function boot() {
  const users = await ReflexAPI.getUsers();
  const riders = users.filter((u) => u.role === 'rider');
  const select = document.getElementById('userSelect');
  select.innerHTML = riders.map((u) => `<option value="${u.id}">${u.name}</option>`).join('');

  const saved = ReflexAPI.currentUserId;
  if (saved && riders.some((u) => u.id === saved)) select.value = saved;
  else ReflexAPI.setUser(select.value);

  select.addEventListener('change', () => {
    ReflexAPI.setUser(select.value);
    loadDeliveries();
  });

  await loadDeliveries();

  connectSocket(
    (updated) => {
      if (updated.assigned_rider_id !== ReflexAPI.currentUserId) return;
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
  const active = deliveries.filter((d) => d.status !== 'Delivered' && d.status !== 'Failed' && d.status !== 'Cancelled');
  const list = document.getElementById('myList');
  document.getElementById('myCount').textContent = `(${active.length})`;

  if (active.length === 0) {
    list.innerHTML = '<div class="empty-state">Nothing assigned to you right now.</div>';
    return;
  }

  list.innerHTML = active.map((d) => `
    <div class="rider-card ${statusClass(d.status)}">
      <div class="customer">${escapeHtml(d.customer_name)}</div>
      <div class="addr">${escapeHtml(d.customer_address)} &middot; <a class="tel-link" href="tel:${escapeHtml(d.customer_phone)}">${escapeHtml(d.customer_phone)}</a></div>
      <div class="item"><strong>Item:</strong> ${escapeHtml(d.item_description)}</div>
      <div class="actions">
        ${d.status === 'Assigned' ? `<button class="btn btn-block" data-action="pickup" data-id="${d.id}">Mark picked up</button>` : ''}
        ${d.status === 'Picked Up' ? `<button class="btn btn-block" data-action="confirm" data-id="${d.id}">Confirm delivery (photo)</button>` : ''}
        <button class="btn-secondary" data-action="fail" data-id="${d.id}">Report problem</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-action="pickup"]').forEach((btn) => {
    btn.addEventListener('click', () => setStatus(btn.dataset.id, 'Picked Up'));
  });
  list.querySelectorAll('[data-action="fail"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const note = prompt('What went wrong? (e.g. customer unreachable, wrong address)');
      if (note !== null) setStatus(btn.dataset.id, 'Failed', note);
    });
  });
  list.querySelectorAll('[data-action="confirm"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      proofTargetId = btn.dataset.id;
      document.getElementById('proofInput').click();
    });
  });
}

async function setStatus(id, status, note) {
  try {
    await ReflexAPI.updateStatus(id, status, note);
    showToast(`Marked as ${status}`);
    await loadDeliveries();
  } catch (err) {
    showToast(err.message);
  }
}

document.getElementById('proofInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file || !proofTargetId) return;

  const formData = new FormData();
  formData.append('photo', file);
  try {
    await ReflexAPI.attachProof(proofTargetId, formData);
    showToast('Delivery confirmed');
    await loadDeliveries();
  } catch (err) {
    showToast(err.message);
  } finally {
    proofTargetId = null;
  }
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

boot();
