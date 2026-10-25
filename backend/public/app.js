// Admin API Key helper
function getAdminHeaders() {
  const params = new URLSearchParams(window.location.search);
  const key = params.get('adminKey') || localStorage.getItem('ZAMBO_ADMIN_KEY') || '';
  return key ? { 'X-Admin-Key': key } : {};
}

// ── ZamboAlert Admin Control Dashboard Logic ────────────────────────────────

let rescuers = [];
let stats = {};
let currentFilter = 'all';

// DOM Elements
const rescuerGrid = document.getElementById('rescuerGrid');
const emptyState = document.getElementById('emptyState');
const refreshBtn = document.getElementById('refreshBtn');
const searchInput = document.getElementById('searchInput');
const filterTabs = document.querySelectorAll('.filter-tab');
const listCount = document.getElementById('listCount');

const statPending = document.getElementById('statPending');
const statApproved = document.getElementById('statApproved');
const statTotal = document.getElementById('statTotal');

// Toast Notification Function
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'success' ? 'toast-success' : 'toast-info'}`;
  toast.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="toast-icon"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  
  // Animate Entry
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Remove Toast
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Fetch Stats from Backend
async function fetchStats() {
  try {
    const res = await fetch('/api/admin/stats', { headers: getAdminHeaders() });
    if (!res.ok) throw new Error('Failed to load stats');
    stats = await res.json();
    
    // Update Stats UI
    statPending.textContent = stats.pendingRescuers;
    statApproved.textContent = stats.approvedRescuers;
    statTotal.textContent = stats.totalRescuers;
  } catch (error) {
    console.error('Error fetching stats:', error);
    showToast('Failed to load dashboard metrics.', 'error');
  }
}

// Fetch Rescuers list from Backend
async function fetchRescuers() {
  try {
    const res = await fetch('/api/admin/rescuers', { headers: getAdminHeaders() });
    if (!res.ok) throw new Error('Failed to load rescuers');
    rescuers = await res.json();
    renderRescuers();
  } catch (error) {
    console.error('Error fetching rescuers:', error);
    showToast('Failed to load rescuers list.', 'error');
  }
}

// Render Rescuers Card Grid
function renderRescuers() {
  const query = searchInput.value.toLowerCase().trim();
  
  // Filter list
  const filtered = rescuers.filter(r => {
    // 1. Status Filter
    if (currentFilter === 'pending' && r.isRescuerVerified !== false) return false;
    if (currentFilter === 'approved' && r.isRescuerVerified !== true) return false;
    
    // 2. Search query filter
    if (query) {
      const fullName = `${r.firstName} ${r.lastName}`.toLowerCase();
      const email = r.email.toLowerCase();
      const idNum = (r.idNumber || '').toLowerCase();
      return fullName.includes(query) || email.includes(query) || idNum.includes(query);
    }
    
    return true;
  });

  // Update List Count badge
  listCount.textContent = `${filtered.length} Listed`;

  // Clear Grid
  rescuerGrid.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');

  filtered.forEach(rescuer => {
    const card = document.createElement('div');
    card.className = 'rescuer-card';
    
    const initials = `${rescuer.firstName[0] || ''}${rescuer.lastName[0] || ''}`.toUpperCase();
    const isApproved = rescuer.isRescuerVerified;
    const isEmailVerified = rescuer.isVerified;

    let statusText = 'PENDING';
    let statusClass = 'badge-pending';
    if (isApproved) {
      statusText = 'APPROVED';
      statusClass = 'badge-approved';
    } else if (!isEmailVerified) {
      statusText = 'UNVERIFIED EMAIL';
      statusClass = 'badge-unverified';
    }

    card.innerHTML = `
      <span class="status-badge ${statusClass}">${statusText}</span>
      
      <div class="rescuer-card-header">
        <div class="avatar-circle">${initials}</div>
        <div class="profile-meta">
          <h4>${rescuer.firstName} ${rescuer.lastName}</h4>
          <span class="email">${rescuer.email}</span>
          <span class="phone">${rescuer.contactNumber}</span>
        </div>
      </div>

      <div class="credentials-info">
        <p>ID Provided: <strong>${rescuer.idType || 'Barangay ID'}</strong></p>
        <p>ID Number: <strong>${rescuer.idNumber || 'N/A'}</strong></p>
      </div>

      <!-- Simulated official Barangay ID graphic preview -->
      <div class="id-card-preview">
        <div class="id-card-header">
          <div class="id-seal"></div>
          <div class="id-header-text">
            <h5>Republic of the Philippines</h5>
            <p>Official ${rescuer.idType || 'Barangay ID'} Badge</p>
          </div>
        </div>
        <div class="id-body">
          <div class="id-photo-placeholder">
            ${rescuer.idFrontUri 
              ? `<img src="${rescuer.idFrontUri}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px; cursor: zoom-in;" onclick="viewImage('${rescuer.idFrontUri}', '${rescuer.firstName} ${rescuer.lastName} - ID Front')" />`
              : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="id-photo-icon"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
            }
          </div>
          <div class="id-details-graph">
            <h6>${rescuer.lastName.toUpperCase()}, ${rescuer.firstName}</h6>
            <p>ID NO: ${rescuer.idNumber || 'BRGY-00000'}</p>
            <p>TITLE: Barangay Emergency Responder</p>
            <div class="id-barcode"></div>
          </div>
        </div>
      </div>

      <!-- Real uploaded ID photos preview -->
      <div class="id-images-row">
        <div class="id-image-wrapper">
          <span>FRONT SIDE</span>
          ${rescuer.idFrontUri 
            ? `<img src="${rescuer.idFrontUri}" class="id-image-preview" onclick="viewImage('${rescuer.idFrontUri}', '${rescuer.firstName} ${rescuer.lastName} - ID Front')" />`
            : `<div class="id-image-missing">No Front Photo</div>`
          }
        </div>
        <div class="id-image-wrapper">
          <span>BACK SIDE</span>
          ${rescuer.idBackUri 
            ? `<img src="${rescuer.idBackUri}" class="id-image-preview" onclick="viewImage('${rescuer.idBackUri}', '${rescuer.firstName} ${rescuer.lastName} - ID Back')" />`
            : `<div class="id-image-missing">No Back Photo</div>`
          }
        </div>
      </div>

      <div class="card-actions">
        ${!isApproved 
          ? `<button class="btn btn-primary" onclick="approveRescuer('${rescuer.id}')">
               <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
               Approve
             </button>`
          : `<button class="btn btn-danger" onclick="rejectRescuer('${rescuer.id}')">
               <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
               Revoke Status
             </button>`
        }
      </div>
    `;

    rescuerGrid.appendChild(card);
  });
}

// Approve Rescuer Network Action
async function approveRescuer(id) {
  try {
    const res = await fetch(`/api/admin/rescuers/${id}/approve`, {
      method: 'POST',
      headers: { ...getAdminHeaders() }
    });
    if (!res.ok) throw new Error('Approval request failed');
    const data = await res.json();
    showToast(data.message || 'Rescuer approved successfully.');
    
    // Refresh Data
    await fetchStats();
    await fetchRescuers();
  } catch (error) {
    console.error('Error approving rescuer:', error);
    showToast('Failed to approve rescuer.', 'error');
  }
}

// Reject Rescuer Network Action
async function rejectRescuer(id) {
  if (!confirm('Are you sure you want to revoke verification for this rescuer? They will no longer be able to log in.')) return;
  try {
    const res = await fetch(`/api/admin/rescuers/${id}/reject`, {
      method: 'POST',
      headers: { ...getAdminHeaders() }
    });
    if (!res.ok) throw new Error('Revoke request failed');
    const data = await res.json();
    showToast(data.message || 'Rescuer status revoked.', 'info');
    
    // Refresh Data
    await fetchStats();
    await fetchRescuers();
  } catch (error) {
    console.error('Error revoking status:', error);
    showToast('Failed to revoke status.', 'error');
  }
}

// Event Listeners
refreshBtn.addEventListener('click', async () => {
  refreshBtn.disabled = true;
  await fetchStats();
  await fetchRescuers();
  showToast('Dashboard metrics refreshed.', 'info');
  refreshBtn.disabled = false;
});

searchInput.addEventListener('input', renderRescuers);

filterTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    filterTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.getAttribute('data-filter');
    renderRescuers();
  });
});

// Initialization load
window.addEventListener('DOMContentLoaded', async () => {
  await fetchStats();
  await fetchRescuers();
});

// Image Lightbox Functions
function viewImage(src, caption) {
  const modal = document.getElementById('imageModal');
  const modalImg = document.getElementById('modalImage');
  const captionText = document.getElementById('modalCaption');
  
  modal.classList.remove('hidden');
  modalImg.src = src;
  captionText.textContent = caption || 'ID Preview';
}

function closeImageModal() {
  const modal = document.getElementById('imageModal');
  modal.classList.add('hidden');
}
