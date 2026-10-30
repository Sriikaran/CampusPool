const API = '/api';
const itemsGrid = document.getElementById('items-grid');
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const typeFilter = document.getElementById('type-filter');
const itemForm = document.getElementById('item-form');
const requestDialog = document.getElementById('request-dialog');
const requestForm = document.getElementById('request-form');
let searchTimer;

const categoryIcons = {
  Books: '📚', Electronics: '🎧', Calculators: '🧮',
  'Lab Equipment': '🧪', Other: '🎒'
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function money(value) {
  const amount = Number(value || 0);
  return amount > 0 ? `₹${amount.toLocaleString('en-IN')}` : 'Free';
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2800);
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Something went wrong.');
  return data;
}

async function loadStats() {
  try {
    const stats = await apiRequest(`${API}/stats`);
    document.getElementById('stat-items').textContent = stats.availableItems;
    document.getElementById('stat-categories').textContent = stats.categories;
  } catch {
    document.getElementById('stat-items').textContent = '—';
    document.getElementById('stat-categories').textContent = '—';
  }
}

function renderItems(items) {
  document.getElementById('results-count').textContent = `${items.length} ${items.length === 1 ? 'item' : 'items'} found`;
  if (!items.length) {
    itemsGrid.innerHTML = '<div class="empty-state">No items found. Try another search or be the first to list one!</div>';
    return;
  }

  itemsGrid.innerHTML = items.map((item) => {
    const icon = categoryIcons[item.category] || '🎒';
    const typeClass = item.listingType.toLowerCase();
    const priceLabel = item.listingType === 'Sell' ? money(item.price) : (Number(item.price) > 0 ? `₹${Number(item.price).toLocaleString('en-IN')} <small>deposit</small>` : 'Free');
    return `
      <article class="item-card">
        <div class="item-top"><span class="category-icon">${icon}</span><span class="type-pill ${typeClass}">${escapeHtml(item.listingType)}</span></div>
        <h3>${escapeHtml(item.title)}</h3>
        <p class="item-description">${escapeHtml(item.description)}</p>
        <div class="item-meta"><span>${escapeHtml(item.category)}</span><span>·</span><span>${escapeHtml(item.condition)}</span></div>
        <div class="item-bottom"><div class="item-price">${priceLabel}</div><button class="request-button" data-request-id="${item._id}" data-request-title="${escapeHtml(item.title)}">Request item ↗</button></div>
        <div class="owner-line">Listed by ${escapeHtml(item.ownerName)} (${escapeHtml(item.ownerEmail)})</div>
      </article>`;
  }).join('');
}

async function loadItems() {
  itemsGrid.innerHTML = '<div class="empty-state">Loading campus listings...</div>';
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set('search', searchInput.value.trim());
  if (categoryFilter.value !== 'All') params.set('category', categoryFilter.value);
  if (typeFilter.value !== 'All') params.set('type', typeFilter.value);
  try {
    const data = await apiRequest(`${API}/items?${params.toString()}`);
    renderItems(data.items);
  } catch (error) {
    itemsGrid.innerHTML = `<div class="empty-state">${escapeHtml(error.message)} Please refresh the page.</div>`;
  }
}

itemForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = itemForm.querySelector('button[type="submit"]');
  const message = document.getElementById('item-form-message');
  const formData = new FormData(itemForm);
  const payload = Object.fromEntries(formData.entries());
  button.disabled = true;
  button.textContent = 'Publishing...';
  message.textContent = '';
  message.classList.remove('error');
  try {
    await apiRequest(`${API}/items`, { method: 'POST', body: JSON.stringify(payload) });
    itemForm.reset();
    message.textContent = 'Your listing is live!';
    showToast('Item successfully listed.');
    await Promise.all([loadItems(), loadStats()]);
    document.getElementById('browse').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    message.textContent = error.message;
    message.classList.add('error');
  } finally {
    button.disabled = false;
    button.innerHTML = 'Publish listing <span>↗</span>';
  }
});

itemsGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-request-id]');
  if (!button) return;
  requestForm.reset();
  requestForm.elements.itemId.value = button.dataset.requestId;
  document.getElementById('request-item-title').textContent = `You're requesting: ${button.dataset.requestTitle}`;
  const message = document.getElementById('request-form-message');
  message.textContent = '';
  message.classList.remove('error');
  requestDialog.showModal();
});

requestForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = requestForm.querySelector('button[type="submit"]');
  const message = document.getElementById('request-form-message');
  const payload = Object.fromEntries(new FormData(requestForm).entries());
  button.disabled = true;
  button.textContent = 'Sending...';
  message.textContent = '';
  message.classList.remove('error');
  try {
    await apiRequest(`${API}/requests`, { method: 'POST', body: JSON.stringify(payload) });
    requestDialog.close();
    showToast('Request sent! The owner can review and accept it.');
  } catch (error) {
    message.textContent = error.message;
    message.classList.add('error');
  } finally {
    button.disabled = false;
    button.innerHTML = 'Send request <span>↗</span>';
  }
});

document.getElementById('close-dialog').addEventListener('click', () => requestDialog.close());

// --- My Requests Section ---
const myRequestsDialog = document.getElementById('my-requests-dialog');
const navMyRequests = document.getElementById('nav-my-requests');
const closeMyRequests = document.getElementById('close-my-requests');
const trackForm = document.getElementById('track-requests-form');
const trackEmailInput = document.getElementById('track-email-input');
const myRequestsList = document.getElementById('my-requests-list');

async function renderMyRequests(email) {
  myRequestsList.innerHTML = '<div style="font-size:12px; color:var(--muted); text-align:center; padding:15px;">Loading your requests...</div>';
  try {
    const data = await apiRequest(`${API}/requests?email=${encodeURIComponent(email)}`);
    if (!data.requests || !data.requests.length) {
      myRequestsList.innerHTML = '<div class="empty-state">You haven\'t requested any items yet.</div>';
      return;
    }
    myRequestsList.innerHTML = data.requests.map((req) => {
      const itemTitle = req.item ? escapeHtml(req.item.title) : 'Unknown item';
      const statusClass = req.status.toLowerCase();
      const isAcceptedOrDone = ['Accepted', 'Completed', 'Returned'].includes(req.status);

      let contactHtml = '';
      if (isAcceptedOrDone && req.item) {
        contactHtml = `
          <div class="contact-panel">
            <div class="contact-panel-title">🤝 Owner Contact Information</div>
            <p>Your request has been accepted! You can now contact the item owner directly and arrange a meeting on campus. CampusLoop does not process payments or arrange delivery.</p>
            <div class="contact-links">
              <span>Owner: <strong>${escapeHtml(req.item.ownerName)}</strong></span>
              <a href="mailto:${escapeHtml(req.item.ownerEmail)}">✉ ${escapeHtml(req.item.ownerEmail)}</a>
              ${req.item.ownerPhone ? `<a href="tel:${escapeHtml(req.item.ownerPhone)}">📞 ${escapeHtml(req.item.ownerPhone)}</a>` : ''}
            </div>
          </div>`;
      } else {
        contactHtml = `<p style="margin:6px 0 0; font-size:11px; color:var(--muted);">Status: Pending owner review. Contact details will be displayed here once accepted.</p>`;
      }

      return `
        <div style="border:1px solid var(--line); border-radius:10px; padding:12px; margin-bottom:12px; background:#fff;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <strong style="font-size:14px;">${itemTitle}</strong>
            <span class="type-pill ${statusClass}">${escapeHtml(req.status)}</span>
          </div>
          ${req.message ? `<p style="margin:4px 0 8px; color:var(--muted); font-size:12px;">"${escapeHtml(req.message)}"</p>` : ''}
          <div style="font-size:11px; color:#879087; margin-bottom:6px;">Date submitted: ${new Date(req.createdAt).toLocaleDateString()}</div>
          ${contactHtml}
        </div>`;
    }).join('');
  } catch (err) {
    myRequestsList.innerHTML = `<div style="font-size:12px; color:#b64e40; text-align:center; padding:15px;">${escapeHtml(err.message)}</div>`;
  }
}

if (navMyRequests && myRequestsDialog) {
  navMyRequests.addEventListener('click', (e) => {
    e.preventDefault();
    myRequestsDialog.showModal();
  });
  closeMyRequests.addEventListener('click', () => myRequestsDialog.close());

  trackForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = trackEmailInput.value.trim();
    if (!email) return;
    await renderMyRequests(email);
  });
}

// --- Requests Received Section ---
const requestsReceivedDialog = document.getElementById('requests-received-dialog');
const navRequestsReceived = document.getElementById('nav-requests-received');
const closeRequestsReceived = document.getElementById('close-requests-received');
const ownerRequestsForm = document.getElementById('owner-requests-form');
const ownerEmailInput = document.getElementById('owner-email-input');
const requestsReceivedList = document.getElementById('requests-received-list');

async function renderRequestsReceived(ownerEmail) {
  requestsReceivedList.innerHTML = '<div style="font-size:12px; color:var(--muted); text-align:center; padding:15px;">Loading incoming requests...</div>';
  try {
    const data = await apiRequest(`${API}/requests/received?email=${encodeURIComponent(ownerEmail)}`);
    if (!data.grouped || !data.grouped.length) {
      requestsReceivedList.innerHTML = '<div class="empty-state">No students have requested your items yet.</div>';
      return;
    }

    requestsReceivedList.innerHTML = data.grouped.map((group) => {
      const itemTitle = escapeHtml(group.item.title);
      const listingType = escapeHtml(group.item.listingType);
      const typeClass = group.item.listingType.toLowerCase();

      const reqCards = group.requests.map((r) => {
        const statusClass = r.status.toLowerCase();
        const isPending = r.status === 'Pending';
        const isAccepted = r.status === 'Accepted';
        const isCompleted = r.status === 'Completed';
        const isReturned = r.status === 'Returned';

        let contactSection = '';
        if (isAccepted || isCompleted || isReturned) {
          contactSection = `
            <div class="contact-panel">
              <div class="contact-panel-title">🤝 Requester Contact Information</div>
              <p>Your request has been accepted! You can now contact the requester directly and arrange a meeting on campus. CampusLoop does not process payments or arrange delivery.</p>
              <div class="contact-links">
                <span>Student: <strong>${escapeHtml(r.requesterName)}</strong></span>
                <a href="mailto:${escapeHtml(r.requesterEmail)}">✉ ${escapeHtml(r.requesterEmail)}</a>
                ${r.requesterPhone ? `<a href="tel:${escapeHtml(r.requesterPhone)}">📞 ${escapeHtml(r.requesterPhone)}</a>` : ''}
              </div>
            </div>`;
        } else {
          contactSection = `
            <div style="font-size:11px; color:var(--muted); margin:6px 0;">
              <span>Student: <strong>${escapeHtml(r.requesterName)}</strong></span> · 
              <span style="color:#78847d;">🔒 Contact info protected until accepted</span>
            </div>`;
        }

        let actionBtns = '';
        if (isPending) {
          actionBtns = `
            <div class="action-buttons">
              <button class="btn-sm btn-accept" data-action="accept" data-req-id="${r._id}">Accept Request</button>
              <button class="btn-sm btn-decline" data-action="decline" data-req-id="${r._id}">Decline Request</button>
            </div>`;
        } else if (isAccepted) {
          actionBtns = `
            <div class="action-buttons">
              <button class="btn-sm btn-complete" data-action="complete" data-req-id="${r._id}">Mark as Completed</button>
              ${group.item.listingType === 'Borrow' ? `<button class="btn-sm btn-return" data-action="return" data-req-id="${r._id}">Mark as Returned</button>` : ''}
            </div>`;
        } else if (isCompleted && group.item.listingType === 'Borrow') {
          actionBtns = `
            <div class="action-buttons">
              <button class="btn-sm btn-return" data-action="return" data-req-id="${r._id}">Mark as Returned</button>
            </div>`;
        }

        return `
          <div class="sub-request-card">
            <div class="sub-request-header">
              <strong style="font-size:13px;">${escapeHtml(r.requesterName)}</strong>
              <span class="type-pill ${statusClass}">${escapeHtml(r.status)}</span>
            </div>
            ${r.message ? `<p style="margin:4px 0 6px; font-size:12px; color:var(--muted);">"${escapeHtml(r.message)}"</p>` : ''}
            <div style="font-size:10px; color:#879087;">Submitted: ${new Date(r.createdAt).toLocaleDateString()}</div>
            ${contactSection}
            ${actionBtns}
          </div>`;
      }).join('');

      return `
        <div class="request-item-group">
          <div class="group-header">
            <span>📦 ${itemTitle}</span>
            <span class="type-pill ${typeClass}">${listingType}</span>
          </div>
          ${reqCards}
        </div>`;
    }).join('');
  } catch (err) {
    requestsReceivedList.innerHTML = `<div style="font-size:12px; color:#b64e40; text-align:center; padding:15px;">${escapeHtml(err.message)}</div>`;
  }
}

if (navRequestsReceived && requestsReceivedDialog) {
  navRequestsReceived.addEventListener('click', (e) => {
    e.preventDefault();
    requestsReceivedDialog.showModal();
  });
  closeRequestsReceived.addEventListener('click', () => requestsReceivedDialog.close());

  ownerRequestsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ownerEmail = ownerEmailInput.value.trim();
    if (!ownerEmail) return;
    await renderRequestsReceived(ownerEmail);
  });

  // Action button clicks delegation
  requestsReceivedList.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const reqId = btn.dataset.reqId;
    const ownerEmail = ownerEmailInput.value.trim();

    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Processing...';

    try {
      const res = await apiRequest(`${API}/requests/${reqId}/${action}`, {
        method: 'PATCH',
        body: JSON.stringify({ ownerEmail })
      });
      showToast(res.message || 'Updated successfully.');
      await Promise.all([
        renderRequestsReceived(ownerEmail),
        loadItems(),
        loadStats()
      ]);
    } catch (err) {
      showToast(err.message);
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
}

searchInput.addEventListener('input', () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(loadItems, 250);
});
categoryFilter.addEventListener('change', loadItems);
typeFilter.addEventListener('change', loadItems);

loadItems();
loadStats();
