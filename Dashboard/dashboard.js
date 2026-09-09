const API = (window.location.protocol === 'file:')
    ? 'http://localhost:3000'
    : window.location.origin;
let TOKEN = localStorage.getItem('as_token');
let USER = JSON.parse(localStorage.getItem('as_user') || 'null');
let PERMS = JSON.parse(localStorage.getItem('as_perms') || '{}');
let ROLE_LEVEL = parseInt(localStorage.getItem('as_level') || '0');
let TAUX = 135;
let allProducts = [];
let allOrders = [];
let allStaff = [];
let allHub = [];
let currentHubReq = null;
let editingProductId = null;

// ── AUTH GUARD
if (!TOKEN || !USER) { window.location.href = 'admin-login.html'; }

// ── INIT
document.addEventListener('DOMContentLoaded', () => {
    initUI();
    loadAll();
    setupTauxInput();
});

function initUI() {
    const u = USER;
    document.getElementById('sidebarAvatar').textContent = (u.prenom?.[0] || u.email[0]).toUpperCase();
    document.getElementById('sidebarName').textContent = `${u.prenom || ''} ${u.nom || u.email}`.trim();
    const badge = document.getElementById('sidebarRoleBadge');
    badge.textContent = u.role.toUpperCase();
    badge.className = `staff-role-badge role-${u.role}`;

    // Auto-set presence to "en_ligne" on dashboard load
    api('/api/staff/me/status', { method: 'PATCH', body: JSON.stringify({ status: 'en_ligne' }) });
    document.querySelectorAll('.presence-btn').forEach(b => b.className = 'presence-btn');
    const onlineBtn = document.querySelector('.presence-btn[data-status="en_ligne"]');
    if (onlineBtn) onlineBtn.classList.add('active-online');

    // Apply sidebar permissions
    const perms = {
        tableau_de_bord: PERMS.tableau_de_bord,
        catalogue_produits: PERMS.catalogue_produits,
        gestion_commandes: PERMS.gestion_commandes,
        hub_partenariats: PERMS.hub_partenariats,
        moderation_equipe: PERMS.moderation_equipe,
        configuration: PERMS.configuration
    };
    for (const [key, allowed] of Object.entries(perms)) {
        const el = document.getElementById(`nav-${key}`);
        if (el) el.style.display = allowed ? '' : 'none';
    }
    if (ROLE_LEVEL >= 5) {
        document.getElementById('nav-kpi').style.display = '';
        document.getElementById('nav-logs').style.display = '';
        document.getElementById('nav-wallet').style.display = '';
        document.getElementById('nav-ventes').style.display = '';
    } else if (ROLE_LEVEL >= 4) {
        document.getElementById('nav-logs').style.display = '';
        document.getElementById('nav-wallet').style.display = '';
        document.getElementById('nav-ventes').style.display = '';
    } else if (ROLE_LEVEL >= 3) {
        document.getElementById('nav-wallet').style.display = '';
        document.getElementById('nav-ventes').style.display = '';
    }
    // Activate first visible section
    const firstNav = document.querySelector('.nav-item:not([style*="none"])');
    if (firstNav) switchSection(firstNav);
}

async function loadAll() {
    await Promise.all([
        loadOrderStats(),
        loadProducts(),
        loadOrders(),
        loadConfig(),
        loadHub(),
        loadStaff(),
        loadLogs(),
        loadStock(),
        loadWalletBadge(),
        loadBlogCategories(),
        loadBlogArticles()
    ]);
    if (ROLE_LEVEL >= 5) loadKPI();
    checkDemoMode();
}

async function loadWalletBadge() {
    if (ROLE_LEVEL < 3) return;
    const data = await api('/api/wallet/all?statut=en_attente&limit=1');
    if (!data) return;
    const badge = document.getElementById('badgeWallet');
    if (badge && data.total > 0) { badge.textContent = data.total; badge.style.display = ''; }
}

// ─── Helper XSS — échapper les caractères HTML ──────────────────────────
function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function api(path, opts = {}) {
    let res;
    try {
        res = await fetch(`${API}${path}`, {
            ...opts,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}`, ...(opts.headers || {}) }
        });
    } catch (_) {
        console.error('[API] Erreur réseau :', path);
        return null;
    }
    if (res.status === 401) { window.location.href = 'admin-login.html'; return null; }
    try {
        const text = await res.text();
        return text ? JSON.parse(text) : null;
    } catch (_) {
        console.error('[API] Réponse non-JSON :', path, res.status);
        return null;
    }
}

const apiFetch = api;

async function checkDemoMode() {
    let data = {};
    try {
        const res = await fetch(`${API}/api/health`);
        const text = await res.text();
        data = text ? JSON.parse(text) : {};
    } catch (_) {}
    if (data.mode === 'demo') {
        document.getElementById('demoChip').style.display = 'inline-flex';
        document.getElementById('notifDot').style.display = 'block';
    } else {
        startSSE();
    }
}

function startSSE() {
    if (!TOKEN) return;
    const es = new EventSource(`${API}/api/events?token=${encodeURIComponent(TOKEN)}`);

    es.addEventListener('connected', () => {
        console.log('[SSE] Connecté aux notifications Realtime');
    });

    es.addEventListener('nouvelle_commande', e => {
        const o = JSON.parse(e.data);
        const isRisk = o.risk_score >= 60;
        showToast(
            isRisk ? 'red' : 'green',
            isRisk ? '⚠️' : '📦',
            isRisk ? `Commande risque élevé !` : `Nouvelle commande reçue`,
            `${escHtml(o.client_nom) || '—'} — ${escHtml(o.produit_nom)} ${escHtml(o.denom_label)} ($${escHtml(String(o.eur))})`
        );
        playNotifSound(isRisk ? 'risk' : 'order');
        loadOrders();
        loadOrderStats();
        updateNavBadge('badgeOrders');
    });

    es.addEventListener('commande_risque', e => {
        const o = JSON.parse(e.data);
        showToast('red', '🚨', `Alerte risque élevé !`, `Commande ${o.id} — ${o.client_nom}`);
        playNotifSound('risk');
        loadOrders();
        loadOrderStats();
    });

    es.addEventListener('commande_update', e => {
        loadOrders();
    });

    es.addEventListener('nouvelle_demande_partenariat', e => {
        const r = JSON.parse(e.data);
        showToast('blue', '🤝', 'Nouvelle demande partenariat', `${r.nom} — ${r.type}`);
        playNotifSound('order');
        loadHub();
        updateNavBadge('badgeHub');
    });

    es.addEventListener('nouveau_brouillon', e => {
        showToast('yellow', '✍️', 'Brouillon à valider', 'Un Helper a soumis un brouillon');
        loadHub();
    });

    es.onerror = () => {
        setTimeout(() => startSSE(), 5000);
    };

    window._sse = es;
}

function playNotifSound(type) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        if (type === 'risk') {
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.setValueAtTime(440, ctx.currentTime + 0.1);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
        } else {
            osc.frequency.setValueAtTime(660, ctx.currentTime);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
        }
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
    } catch (_) { }
}

function updateNavBadge(badgeId) {
    const badge = document.getElementById(badgeId);
    if (!badge) return;
    const current = parseInt(badge.textContent) || 0;
    badge.textContent = current + 1;
    badge.style.display = '';
}

// ── NAVIGATION
function switchSection(navEl) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    navEl.classList.add('active');
    const sectionId = navEl.dataset.section;
    const section = document.getElementById(sectionId);
    if (section) section.classList.add('active');
    const titles = {
        'section-dashboard': 'Tableau de bord',
        'section-catalogue': 'Catalogue Produits',
        'section-orders': 'Gestion des Commandes',
        'section-hub': 'Hub Partenariats',
        'section-staff': 'Modération & Équipe',
        'section-config': 'Configuration Système',
        'section-kpi': 'Performance Staff',
        'section-logs': 'Historique Actions',
        'section-stock': 'Stock Numérique',
        'section-coupons': 'Codes Promo & Coupons',
        'section-wallet': 'Portefeuille Clients',
        'section-ventes': 'Ventes Produits',
        'section-blog': 'Gestion du Blog & Actualités'
    };
    document.getElementById('topbarTitle').textContent = titles[sectionId] || '';
    if (sectionId === 'section-wallet') loadWalletTx(currentWalletFilter);
    if (sectionId === 'section-ventes') loadProductSales();
    if (sectionId === 'section-coupons') loadCoupons();
    if (sectionId === 'section-config') initCurrencyRates();
    if (sectionId === 'section-blog') { loadBlogArticles(); loadBlogCategories(); }
}

// ── PRESENCE
async function setPresence(btn) {
    document.querySelectorAll('.presence-btn').forEach(b => b.className = 'presence-btn');
    const status = btn.dataset.status;
    if (status === 'en_ligne') btn.classList.add('active-online');
    else if (status === 'occupe') btn.classList.add('active-busy');
    else btn.classList.add('active-offline');
    await api('/api/staff/me/status', { method: 'PATCH', body: JSON.stringify({ status }) });
}

// ── LOAD STATS
async function loadOrderStats() {
    const data = await api('/api/orders/stats');
    if (!data) return;
    document.getElementById('statTotal').textContent = data.total || 0;
    document.getElementById('statLivrees').textContent = data.livrees || 0;
    document.getElementById('statAttente').textContent = data.en_attente || 0;
    document.getElementById('statRisque').textContent = data.risque || 0;
    document.getElementById('statCA').textContent = `$${parseFloat(data.ca_eur || 0).toFixed(2)}`;
    const riskAlert = document.getElementById('riskAlert');
    const badge = document.getElementById('badgeOrders');
    if (data.risque > 0) {
        if (document.getElementById('riskAlertCount')) document.getElementById('riskAlertCount').textContent = data.risque;
        if (riskAlert) riskAlert.style.display = 'flex';
        if (badge) { badge.textContent = data.risque; badge.style.display = ''; }
    } else {
        if (riskAlert) riskAlert.style.display = 'none';
        if (badge) badge.style.display = 'none';
    }
}

// ── PRODUCTS
async function loadProducts() {
    const data = await api('/api/products');
    if (!data) return;
    allProducts = data.products || [];
    renderProducts();
}

function renderProducts() {
    const search = document.getElementById('searchProd').value.toLowerCase();
    const cat = document.getElementById('filterCat').value;
    let prods = allProducts.filter(p =>
        (!search || p.name.toLowerCase().includes(search) || (p.desc || '').toLowerCase().includes(search)) &&
        (!cat || p.category === cat)
    );
    const tbody = document.getElementById('productsBody');
    if (!prods.length) { tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📦</div><p>Aucun produit trouvé</p></div></td></tr>`; return; }
    tbody.innerHTML = prods.map(p => `
    <tr>
      <td style="font-size:11px;color:var(--text3)">#${p.id}</td>
      <td><img src="${p.img || ''}" alt="" style="width:36px;height:36px;object-fit:cover;border-radius:7px;background:var(--dark5)" onerror="this.style.display='none'"></td>
      <td><strong>${escHtml(p.name)}</strong>${p.recommended ? ' <span style="color:var(--green);font-size:10px">★ Recommandé</span>' : ''}</td>
      <td><span style="background:var(--dark5);padding:3px 8px;border-radius:6px;font-size:11px">${p.category}</span></td>
      <td>${p.price ? `<strong>$${p.price}</strong>` : '—'}</td>
      <td style="font-size:11px;color:var(--text3)">${(p.denoms || []).length} options</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick='editProduct("${p.id}")'>✏️ Éditer</button>
        ${ROLE_LEVEL >= 4 ? `<button class="btn btn-red btn-sm" onclick='deleteProduct("${p.id}","${escHtml(p.name).replace(/'/g, "\\'")}")'>🗑</button>` : ''}
      </td>
    </tr>
  `).join('');
}

function editProduct(id) {
    const p = allProducts.find(x => String(x.id) === String(id));
    if (!p) return;
    editingProductId = id;
    document.getElementById('productModalTitle').textContent = `Modifier — ${p.name}`;
    document.getElementById('pName').value = p.name || '';
    document.getElementById('pCat').value = p.category || '';
    document.getElementById('pDesc').value = p.desc || '';
    document.getElementById('pImg').value = p.img || '';
    document.getElementById('pDiscount').value = p.discount || '';
    document.getElementById('pRating').value = p.rating || 5.0;
    document.getElementById('pSales').value = p.sales || '';
    document.getElementById('pIdLabel').value = p.idLabel || '';
    document.getElementById('pIdPh').value = p.idPlaceholder || '';
    document.getElementById('pRecommended').checked = !!p.recommended;
    renderDenomsForm(p.denoms || []);
    document.getElementById('productModalOverlay').classList.add('open');
}

function openProductModal() {
    editingProductId = null;
    document.getElementById('productModalTitle').textContent = 'Nouveau produit';
    document.getElementById('productForm').reset();
    renderDenomsForm([{ label: '', eur: '', htg: '' }]);
    document.getElementById('productModalOverlay').classList.add('open');
}

function closeProductModal() { document.getElementById('productModalOverlay').classList.remove('open'); }

function renderDenomsForm(denoms) {
    const list = document.getElementById('denomsList');
    list.innerHTML = `<div class="denom-header-row" style="font-size:10px;font-weight:600;color:var(--text3);margin-bottom:4px;display:grid;grid-template-columns:2fr 1fr 1fr 30px;gap:8px"><span>Label</span><span>USD</span><span>HTG</span><span></span></div>`;
    denoms.forEach((d, i) => {
        const row = document.createElement('div');
        row.className = 'denom-row';
        row.innerHTML = `
      <input type="text" placeholder="Label" value="${d.label || ''}" class="denom-label">
      <input type="number" placeholder="EUR" step="0.01" value="${d.eur || ''}" class="denom-eur" oninput="autoHTG(this)">
      <input type="number" placeholder="HTG" value="${d.htg || ''}" class="denom-htg">
      <button type="button" onclick="this.closest('.denom-row').remove()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px">×</button>
    `;
        list.appendChild(row);
    });
}

function addDenom() {
    const list = document.getElementById('denomsList');
    const row = document.createElement('div');
    row.className = 'denom-row';
    row.innerHTML = `
    <input type="text" placeholder="Label" class="denom-label">
    <input type="number" placeholder="EUR" step="0.01" class="denom-eur" oninput="autoHTG(this)">
    <input type="number" placeholder="HTG" class="denom-htg">
    <button type="button" onclick="this.closest('.denom-row').remove()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px">×</button>
  `;
    list.appendChild(row);
}

function autoHTG(eurInput) {
    const eur = parseFloat(eurInput.value);
    const htgInput = eurInput.closest('.denom-row').querySelector('.denom-htg');
    if (!isNaN(eur) && eur > 0) htgInput.value = Math.round(eur * TAUX);
}

function getDenomsFromForm() {
    const rows = document.querySelectorAll('#denomsList .denom-row');
    return Array.from(rows).map(row => ({
        label: row.querySelector('.denom-label')?.value || '',
        eur: parseFloat(row.querySelector('.denom-eur')?.value) || 0,
        htg: parseInt(row.querySelector('.denom-htg')?.value) || 0
    })).filter(d => d.label);
}

async function saveProduct(e) {
    e.preventDefault();
    const btn = document.getElementById('saveProductBtn');
    btn.disabled = true; btn.textContent = 'Sauvegarde...';
    const denoms = getDenomsFromForm();
    const body = {
        name: document.getElementById('pName').value,
        category: document.getElementById('pCat').value,
        desc: document.getElementById('pDesc').value,
        img: document.getElementById('pImg').value,
        discount: document.getElementById('pDiscount').value,
        rating: parseFloat(document.getElementById('pRating').value),
        sales: document.getElementById('pSales').value,
        idLabel: document.getElementById('pIdLabel').value,
        idPlaceholder: document.getElementById('pIdPh').value,
        recommended: document.getElementById('pRecommended').checked,
        price: denoms[0]?.eur || 0,
        denoms
    };
    const url = editingProductId ? `/api/products/${editingProductId}` : '/api/products';
    const method = editingProductId ? 'PUT' : 'POST';
    const data = await api(url, { method, body: JSON.stringify(body) });
    btn.disabled = false; btn.textContent = '💾 Sauvegarder';
    if (data?.success) {
        showToast('green', '✅', 'Produit sauvegardé', data.product?.name || '');
        closeProductModal();
        loadProducts();
    } else {
        showToast('red', '❌', 'Erreur', data?.error || 'Erreur inconnue');
    }
}

async function deleteProduct(id, name) {
    if (!confirm(`Supprimer "${name}" ? Cette action est irréversible.`)) return;
    const data = await api(`/api/products/${id}`, { method: 'DELETE' });
    if (data?.success) { showToast('green', '🗑️', 'Produit supprimé', name); loadProducts(); }
    else showToast('red', '❌', 'Erreur', data?.error || '');
}

// ── ORDERS
async function loadOrders() {
    const data = await api('/api/orders');
    if (!data) return;
    allOrders = data.orders || [];
    renderOrders(allOrders);
    renderRecentOrders();
}

function renderRecentOrders() {
    const tbody = document.getElementById('recentOrdersBody');
    const recent = [...allOrders].slice(0, 5);
    if (!recent.length) { tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3)">Aucune commande</td></tr>`; return; }
    tbody.innerHTML = recent.map(o => `
    <tr class="${o.statut === 'risque_eleve' ? 'risk-flash' : ''}">
      <td><code style="font-size:11px">${o.id}</code></td>
      <td>${escHtml(o.client_nom || o.client_email) || '—'}</td>
      <td>${escHtml(o.produit_nom) || '—'} <span style="font-size:11px;color:var(--text3)">${escHtml(o.denom_label)}</span></td>
      <td><strong>${o.eur}€</strong> <span style="font-size:10px;color:var(--text3)">${o.htg}HTG</span></td>
      <td style="font-size:11px">${o.methode_paiement || '—'}</td>
      <td>${statusBadge(o.statut)}</td>
    </tr>
  `).join('');
}

let currentOrderFilter = '';
function filterOrders(statut) {
    currentOrderFilter = statut;
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    const pill = document.getElementById(`pill-${statut || 'all'}`);
    if (pill) pill.classList.add('active');
    const filtered = statut ? allOrders.filter(o => o.statut === statut) : allOrders;
    renderOrders(filtered);
}

window.currentOrders = [];

function renderOrders(orders) {
    window.currentOrders = orders || [];
    const tbody = document.getElementById('ordersBody');
    if (!orders || !orders.length) { tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">🛒</div><p>Aucune commande</p></div></td></tr>`; return; }
    tbody.innerHTML = orders.map(o => `
    <tr class="${o.statut === 'risque_eleve' ? 'risk-flash' : ''}">
      <td><code style="font-size:11px">${escHtml(o.id)}</code><br><span style="font-size:10px;color:var(--text3)">${new Date(o.created_at).toLocaleString('fr-FR', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span></td>
      <td>
        <strong style="font-size:12px">${escHtml(o.client_nom) || '—'}</strong><br>
        <span style="font-size:11px;color:var(--text3)">${escHtml(o.client_email)}</span>
      </td>
      <td>
        ${escHtml(o.produit_nom) || '—'}<br>
        <span style="font-size:11px;color:var(--text3)">${escHtml(o.denom_label)}</span>
        ${(o.risk_flags || []).length ? `<br>${(o.risk_flags || []).map(f => `<span style="background:var(--red-dim);color:var(--red);font-size:10px;padding:2px 6px;border-radius:4px">${escHtml(f)}</span>`).join(' ')}` : ''}
      </td>
      <td>
        ${o.player_id ? `<code style="font-size:12px;background:rgba(0,200,135,0.1);color:#00c882;padding:2px 7px;border-radius:5px;display:inline-block">${escHtml(o.player_id)}</code>` : '<span style="color:var(--text3);font-size:11px">—</span>'}
        ${o.server ? `<br><span style="font-size:10px;color:var(--text3)">🌐 ${escHtml(o.server)}</span>` : ''}
      </td>
      <td><strong>${escHtml(String(o.eur))}€</strong><br><span style="font-size:10px;color:var(--text3)">${escHtml(String(o.htg))}HTG</span></td>
      <td style="font-size:12px">${escHtml(o.methode_paiement) || '—'}</td>
      <td>${statusBadge(o.statut)}</td>
      <td>
        ${o.locked_by ? `<span class="order-lock-banner">🔒 ${escHtml(o.locked_by)}</span>` : '<span style="color:var(--text3);font-size:11px">Libre</span>'}
      </td>
      <td>
        ${o.statut === 'en_attente' ? `<button class="btn btn-green btn-sm" onclick="lockOrder('${o.id}')">▶ Prendre</button>` : ''}
        ${o.statut === 'en_cours' ? `<button class="btn btn-green btn-sm" onclick="deliverOrder('${escHtml(o.id)}','${escHtml(o.player_id||'')}','${escHtml(o.produit_nom||'')}','${escHtml(o.denom_label||'')}')">✓ Livrer</button>` : ''}
        ${o.statut === 'en_cours' ? `<button class="btn btn-outline btn-sm" onclick="unlockOrder('${o.id}')">🔓 Libérer</button>` : ''}
        ${o.statut === 'livree' ? `<button class="btn btn-outline btn-sm" onclick="genInvoice('${o.id}')">📄 Facture</button>` : ''}
        ${o.statut === 'risque_eleve' && ROLE_LEVEL >= 3 ? `<button class="btn btn-outline btn-sm" onclick="approveRisk('${o.id}')">✅ Valider</button>` : ''}
      </td>
    </tr>
  `).join('');
}

function statusBadge(statut) {
    const m = { en_attente: ['badge-attente', 'En attente'], en_cours: ['badge-cours', 'En cours'], livree: ['badge-livree', 'Livrée'], annulee: ['badge-annulee', 'Annulée'], risque_eleve: ['badge-risque', '⚠️ Risque élevé'] };
    const [cls, label] = m[statut] || ['badge-annulee', statut];
    return `<span class="badge ${cls}">${label}</span>`;
}

async function lockOrder(id) {
    const data = await api(`/api/orders/${id}/lock`, { method: 'POST' });
    if (data?.success) { showToast('green', '🔒', 'Commande prise en charge', id); loadOrders(); }
    else showToast('red', '❌', data?.error || 'Erreur', id);
}

async function unlockOrder(id) {
    const data = await api(`/api/orders/${id}/unlock`, { method: 'POST' });
    if (data?.success) { showToast('green', '🔓', 'Commande libérée', id); loadOrders(); }
}

async function deliverOrder(id, playerId, produitNom, denomLabel) {
    const playerInfo = playerId ? `\nID Joueur : ${playerId}` : '';
    const msg = `Livraison — ${produitNom} (${denomLabel})${playerInfo}\n\nCode d'activation envoyé (optionnel) :`;
    const code = prompt(msg) || undefined;
    const data = await api(`/api/orders/${id}/statut`, { method: 'PATCH', body: JSON.stringify({ statut: 'livree', code_envoye: code }) });
    if (data?.success) { showToast('green', '✅', 'Commande livrée !', id); loadOrders(); loadOrderStats(); }
}

async function approveRisk(id) {
    const data = await api(`/api/orders/${id}/statut`, { method: 'PATCH', body: JSON.stringify({ statut: 'en_attente' }) });
    if (data?.success) { showToast('green', '✅', 'Risque validé — commande remise en attente', id); loadOrders(); }
}

async function genInvoice(id) {
    const data = await api(`/api/invoices/generate/${id}`, { method: 'POST' });
    if (data?.invoice) {
        showToast('green', '📄', 'Facture générée', `#${data.invoice.numero}`);
        downloadInvoicePDF(id, data.invoice.numero);
    } else {
        showToast('red', '❌', data?.error || 'Erreur génération facture', '');
    }
}

async function downloadInvoicePDF(commandeId, numero) {
    const token = localStorage.getItem('as_token') || TOKEN;
    const res = await fetch(`${API}/api/invoices/pdf/${commandeId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) { showToast('red', '❌', 'Erreur téléchargement PDF', ''); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `facture-${numero || commandeId}.pdf`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast('green', '📥', 'PDF téléchargé', `facture-${numero}.pdf`);
}

window.exportOrdersToCSV = function() {
    const list = window.currentOrders && window.currentOrders.length ? window.currentOrders : (allOrders || []);
    if (!list.length) {
        alert('Aucune commande disponible à exporter.');
        return;
    }
    const headers = ['ID Commande', 'Date', 'Client', 'Email', 'Produit', 'Denomination', 'Montant EUR', 'Montant HTG', 'ID Joueur', 'Methode Paiement', 'Statut'];
    const rows = list.map(o => [
        `"${o.id || ''}"`,
        `"${new Date(o.created_at || Date.now()).toLocaleString('fr-FR')}"`,
        `"${(o.client_nom || '').replace(/"/g, '""')}"`,
        `"${(o.client_email || '').replace(/"/g, '""')}"`,
        `"${(o.produit_nom || '').replace(/"/g, '""')}"`,
        `"${(o.denom_label || '').replace(/"/g, '""')}"`,
        `"${parseFloat(o.eur || 0).toFixed(2)}"`,
        `"${o.htg || 0}"`,
        `"${o.player_id || ''}"`,
        `"${o.methode_paiement || ''}"`,
        `"${o.statut || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `LootZone_Rapport_Commandes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.exportOrdersToPDF = function() {
    const list = window.currentOrders && window.currentOrders.length ? window.currentOrders : (allOrders || []);
    if (!list.length) {
        alert('Aucune commande disponible à exporter.');
        return;
    }
    const totalRev = list.reduce((sum, o) => sum + (parseFloat(o.eur) || 0), 0);
    const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const printWin = window.open('', '_blank');
    if (!printWin) {
        alert('Veuillez autoriser les fenêtres surgissantes pour ouvrir le rapport PDF.');
        return;
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <title>Rapport d'Activité LootZone - ${new Date().toLocaleDateString('fr-FR')}</title>
        <style>
            body { font-family: 'Segoe UI', Roboto, sans-serif; padding: 30px; color: #1e293b; background: #fff; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #00b67a; padding-bottom: 15px; margin-bottom: 20px; }
            .logo { font-size: 24px; font-weight: 800; color: #00b67a; letter-spacing: -0.5px; }
            .date { font-size: 13px; color: #64748b; }
            .stats-bar { display: flex; gap: 20px; margin-bottom: 25px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
            .stat-box { flex: 1; text-align: center; }
            .stat-val { font-size: 20px; font-weight: 700; color: #0f172a; }
            .stat-lbl { font-size: 12px; color: #64748b; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th { background: #0f172a; color: #fff; text-align: left; padding: 10px; font-weight: 600; }
            td { padding: 9px 10px; border-bottom: 1px solid #e2e8f0; }
            tr:nth-child(even) { background: #f8fafc; }
            .status { font-weight: 700; padding: 2px 8px; border-radius: 10px; font-size: 11px; }
            .st-livree { color: #059669; background: #d1fae5; }
            .st-attente { color: #d97706; background: #fef3c7; }
            .st-cours { color: #2563eb; background: #dbeafe; }
            .st-annulee { color: #dc2626; background: #fee2e2; }
            .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo">⚡ ASTA-SHOPS — Rapport Officiel</div>
            <div class="date">${dateStr}</div>
        </div>
        <div class="stats-bar">
            <div class="stat-box">
                <div class="stat-val">${list.length}</div>
                <div class="stat-lbl">Commandes enregistrées</div>
            </div>
            <div class="stat-box">
                <div class="stat-val">$${totalRev.toFixed(2)}</div>
                <div class="stat-lbl">Chiffre d'affaires total</div>
            </div>
            <div class="stat-box">
                <div class="stat-val">${list.filter(o => o.statut === 'livree').length}</div>
                <div class="stat-lbl">Commandes Livrées</div>
            </div>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Réf</th>
                    <th>Client</th>
                    <th>Produit</th>
                    <th>ID Joueur</th>
                    <th>Montant</th>
                    <th>Paiement</th>
                    <th>Statut</th>
                </tr>
            </thead>
            <tbody>
                ${list.map(o => `
                    <tr>
                        <td><strong>${o.id || ''}</strong></td>
                        <td>${o.client_nom || o.client_email || 'Client'}</td>
                        <td>${o.produit_nom || '—'} (${o.denom_label || ''})</td>
                        <td>${o.player_id || '—'}</td>
                        <td><strong>$${parseFloat(o.eur || 0).toFixed(2)}</strong></td>
                        <td>${o.methode_paiement || '—'}</td>
                        <td><span class="status st-${o.statut || 'attente'}">${o.statut || 'en attente'}</span></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <div class="footer">
            © 2026 LootZone · Document confidentiel d'administration interne
        </div>
        <script>
            window.onload = function() {
                setTimeout(function() { window.print(); }, 500);
            };
        <\/script>
    </body>
    </html>
    `;

    printWin.document.write(htmlContent);
    printWin.document.close();
};

// ── CONFIG
async function loadConfig() {
    const data = await api('/api/config');
    if (!data) return;
    TAUX = data.taux_eur_htg || 135;
    document.getElementById('tauxDisplay').textContent = TAUX;
    document.getElementById('tauxInput').value = TAUX;
    document.getElementById('tauxEx').textContent = TAUX;
    document.getElementById('htgEx').textContent = Math.round(9.99 * TAUX);
    document.getElementById('toggleMaintenance').checked = !!data.maintenance_mode;
    document.getElementById('maintenanceLabel').textContent = data.maintenance_mode ? '⚠️ Activé — site inaccessible' : 'Désactivé';
}

function setupTauxInput() {
    document.getElementById('tauxInput').addEventListener('input', e => {
        const v = parseFloat(e.target.value) || 135;
        document.getElementById('tauxEx').textContent = v;
        document.getElementById('htgEx').textContent = Math.round(9.99 * v);
    });
}

async function updateTaux() {
    const taux = parseFloat(document.getElementById('tauxInput').value);
    if (!taux || taux < 1) return showToast('red', '❌', 'Taux invalide', '');
    const data = await api('/api/config/taux', { method: 'PATCH', body: JSON.stringify({ taux_eur_htg: taux }) });
    if (data?.success) {
        TAUX = taux;
        document.getElementById('tauxDisplay').textContent = taux;
        showToast('green', '✅', 'Taux mis à jour', `1 EUR = ${taux} HTG`);
    } else showToast('red', '❌', data?.error || 'Erreur', '');
}

async function updateMaintenance() {
    const mode = document.getElementById('toggleMaintenance').checked;
    const data = await api('/api/config/maintenance', { method: 'PATCH', body: JSON.stringify({ maintenance_mode: mode }) });
    document.getElementById('maintenanceLabel').textContent = mode ? '⚠️ Activé — site inaccessible' : 'Désactivé';
    showToast(mode ? 'red' : 'green', mode ? '⚠️' : '✅', `Mode maintenance ${mode ? 'activé' : 'désactivé'}`, '');
}

// ── HUB PARTENARIATS
const BADGE_COLORS = {
    partenaire: { bg: '#d1fae5', color: '#065f46' },
    vendeur: { bg: '#dbeafe', color: '#1e3a8a' },
    createur: { bg: '#ede9fe', color: '#4c1d95' },
    alliance: { bg: '#fef3c7', color: '#78350f' }
};
const TYPE_LABELS = {
    partenaire: '🟢 Devenir Partenaire',
    vendeur: '🔵 Vendre sur LootZone',
    createur: '🟣 Programme Créateurs',
    alliance: '🟡 Demande d\'Alliance'
};

async function loadHub() {
    const data = await api('/api/partnerships');
    if (!data) return;
    allHub = data.requests || [];
    renderHubList();
    checkDraftAlerts();
}

function renderHubList() {
    const list = document.getElementById('hubRequestList');
    if (!allHub.length) { list.innerHTML = `<div style="padding:20px;color:var(--text3);font-size:13px;text-align:center">Aucune demande</div>`; return; }
    list.innerHTML = allHub.map(r => {
        const bc = BADGE_COLORS[r.type] || {};
        const statusC = r.statut === 'valide' ? 'var(--green)' : r.statut === 'rejete' ? 'var(--red)' : 'var(--text3)';
        return `
      <div class="hub-req-item ${currentHubReq?.id === r.id ? 'active' : ''}" onclick="selectHubReq('${r.id}')">
        <div><span class="type-badge" style="background:${bc.bg};color:${bc.color}">${TYPE_LABELS[r.type] || r.type}</span></div>
        <div class="hub-req-name">${r.nom}</div>
        <div class="hub-req-preview" style="color:${statusC}">${r.statut.toUpperCase()} · ${formatDate(r.created_at)}</div>
      </div>
    `;
    }).join('');
}

function selectHubReq(id) {
    currentHubReq = allHub.find(r => r.id === id);
    if (!currentHubReq) return;
    renderHubList();
    renderHubCenter();
    renderHubRight();
}

function renderHubCenter() {
    const r = currentHubReq;
    const center = document.getElementById('hubCenter');
    const bc = BADGE_COLORS[r.type] || {};
    center.innerHTML = `
    <div class="hub-center-header">
      <span class="type-badge" style="background:${bc.bg};color:${bc.color}">${TYPE_LABELS[r.type]}</span>
      <strong style="font-size:14px">${r.nom}</strong>
      <span style="font-size:11px;color:var(--text3);margin-left:auto">${r.email}</span>
    </div>
    <div class="hub-chat-area" id="chatArea">
      ${(r.messages_chat || []).length === 0
            ? `<div style="text-align:center;color:var(--text3);font-size:13px;padding:40px">Commencez la conversation ↓</div>`
            : (r.messages_chat || []).map(m => `
          <div class="chat-msg ${m.from === 'staff' ? 'staff' : 'client'}">
            ${m.message}
            <div class="msg-meta">${m.auteur || 'Client'} · ${formatDate(m.created_at)}</div>
          </div>
        `).join('')
        }
    </div>
    <div class="hub-input-area">
      <textarea class="hub-textarea" id="chatInput" rows="2" placeholder="Rédigez votre message..." onkeydown="if(event.ctrlKey&&event.key==='Enter')sendHubMsg()"></textarea>
      ${USER.role === 'helper' ? `
        <button class="btn btn-outline btn-sm" onclick="sendHubMsg(true)" title="Soumettre pour validation">📝 Brouillon</button>
      ` : `
        <button class="btn btn-green" onclick="sendHubMsg()">Envoyer ↑</button>
      `}
    </div>
  `;
    const chatArea = document.getElementById('chatArea');
    chatArea.scrollTop = chatArea.scrollHeight;
}

function renderHubRight() {
    const r = currentHubReq;
    const right = document.getElementById('hubRightContent');
    right.innerHTML = `
    <div class="meta-row"><div class="meta-label">Nom / Structure</div><div class="meta-val">${r.nom}${r.structure ? ` — <em>${r.structure}</em>` : ''}</div></div>
    <div class="meta-row"><div class="meta-label">Email</div><div class="meta-val"><a href="mailto:${r.email}">${r.email}</a></div></div>
    ${r.abonnes ? `<div class="meta-row"><div class="meta-label">Abonnés</div><div class="meta-val"><strong style="color:var(--green)">${r.abonnes}</strong></div></div>` : ''}
    ${r.volume_vente ? `<div class="meta-row"><div class="meta-label">Volume de vente</div><div class="meta-val">${r.volume_vente}</div></div>` : ''}
    ${Object.keys(r.reseaux || {}).length ? `
      <div class="meta-row"><div class="meta-label">Réseaux / Liens</div><div class="meta-val">
        ${Object.entries(r.reseaux).map(([k, v]) => `<a href="${v}" target="_blank">🔗 ${k}</a><br>`).join('')}
      </div></div>` : ''}
    <div class="meta-row"><div class="meta-label">Message initial</div><div class="meta-val" style="font-size:12px;color:var(--text2);line-height:1.5">${r.message || '—'}</div></div>
    ${(ROLE_LEVEL >= 4 && r.statut === 'en_attente') ? `
      <div class="hub-actions">
        <button class="btn btn-green" onclick="validatePartnership('${r.id}')">✓ Valider le Partenariat</button>
        <button class="btn btn-red" onclick="rejectPartnership('${r.id}')">✗ Rejeter</button>
      </div>` : ''}
    ${r.statut === 'valide' ? `<div style="margin-top:14px;background:var(--green-dim);border:1px solid rgba(34,197,94,0.3);border-radius:10px;padding:12px;font-size:12px"><strong style="color:var(--green)">✅ Partenariat validé</strong><br>Code affiliation : <code>${r.affiliate_code || '—'}</code></div>` : ''}
    ${r.statut === 'rejete' ? `<div style="margin-top:14px;background:var(--red-dim);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:12px;font-size:12px"><strong style="color:var(--red)">✗ Demande rejetée</strong><br>${r.motif_rejet || ''}</div>` : ''}
  `;
    document.getElementById('hubRight').querySelector('.hub-right-title').textContent = 'Fiche Demandeur';
}

async function sendHubMsg(isDraft = false) {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    const data = await api(`/api/partnerships/${currentHubReq.id}/message`, { method: 'POST', body: JSON.stringify({ message: msg, is_draft: isDraft }) });
    if (data?.success) {
        if (isDraft) showToast('green', '📝', 'Brouillon soumis pour validation', '');
        else {
            currentHubReq.messages_chat = currentHubReq.messages_chat || [];
            currentHubReq.messages_chat.push({ from: 'staff', auteur: `${USER.prenom} ${USER.nom}`, message: msg, created_at: new Date().toISOString() });
            renderHubCenter();
        }
    }
}

async function validatePartnership(id) {
    const data = await api(`/api/partnerships/${id}/valider`, { method: 'POST' });
    if (data?.success) {
        showToast('green', '🤝', 'Partenariat validé !', data.affiliate_code || '');
        loadHub();
    }
}

async function rejectPartnership(id) {
    const motif = prompt('Motif du rejet (obligatoire) :');
    if (!motif) return;
    const data = await api(`/api/partnerships/${id}/rejeter`, { method: 'POST', body: JSON.stringify({ motif }) });
    if (data?.success) { showToast('green', '✗', 'Demande rejetée', ''); loadHub(); }
}

async function checkDraftAlerts() {
    if (ROLE_LEVEL < 3) return;
    const data = await api('/api/partnerships/drafts');
    if (!data) return;
    const count = data.drafts?.length || 0;
    if (count > 0) {
        document.getElementById('draftCount').textContent = count;
        document.getElementById('draftAlert').style.display = 'flex';
        document.getElementById('badgeDrafts').textContent = count;
        document.getElementById('badgeDrafts').style.display = '';
    }
}

async function loadDraftMessages() {
    const data = await api('/api/partnerships/drafts');
    if (!data?.drafts?.length) return showToast('green', '📝', 'Aucun brouillon en attente', '');
    const list = data.drafts.map(d => `• [${d.helper_nom || 'Helper'}] : "${d.message.slice(0, 80)}..." → <button onclick="approveDraft('${d.id}')" class="btn btn-green btn-sm">✓ Approuver</button>`).join('\n');
    alert(`Brouillons en attente :\n\n${data.drafts.map(d => `[${d.helper_nom}] : ${d.message}`).join('\n\n')}`);
}

async function approveDraft(id) {
    const data = await api(`/api/partnerships/drafts/${id}/approve`, { method: 'POST' });
    if (data?.success) { showToast('green', '✅', 'Brouillon approuvé et envoyé', ''); loadHub(); }
}

// ── STAFF
async function loadStaff() {
    const data = await api('/api/staff');
    if (!data) return;
    allStaff = data.staff || [];
    renderStaff();
}

function renderStaff() {
    const grid = document.getElementById('staffGrid');
    const invBtn = document.getElementById('inviteStaffBtn');
    if (invBtn) invBtn.style.display = ROLE_LEVEL >= 4 ? '' : 'none';
    if (!allStaff.length) { grid.innerHTML = `<div style="color:var(--text3)">Aucun membre trouvé</div>`; return; }
    const colors = { directeur: '#f59e0b', manager: '#8b5cf6', administrateur: '#3b82f6', employe: '#22c55e', helper: '#9ca3af' };
    grid.innerHTML = allStaff.map(s => {
        const dotClass = { en_ligne: 'dot-online', occupe: 'dot-busy', deconnecte: 'dot-offline' }[s.statut_presence] || 'dot-offline';
        const presenceLabel = { en_ligne: 'En ligne', occupe: 'Occupé', deconnecte: 'Déconnecté' }[s.statut_presence] || '';
        const canEdit = ROLE_LEVEL >= 3 && (ROLE_LEVEL > (({ helper: 1, employe: 2, administrateur: 3, manager: 4, directeur: 5 }[s.role] || 0)));
        return `
      <div class="staff-card-item">
        <div class="staff-card-top">
          <div class="staff-avatar-sm" style="background:linear-gradient(135deg,${colors[s.role] || '#888'},#333)">
            ${(s.prenom?.[0] || s.email?.[0] || '?').toUpperCase()}
          </div>
          <div>
            <div style="font-size:14px;font-weight:700">${s.prenom || ''} ${s.nom || ''}</div>
            <div style="font-size:11px;color:var(--text3)">${s.email || ''}</div>
          </div>
        </div>
        <div style="margin-bottom:10px">
          <span class="staff-role-badge role-${s.role || 'staff'}">${(s.role || 'staff').toUpperCase()}</span>
        </div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:12px">
          <span class="presence-dot ${dotClass}"></span>${presenceLabel}
        </div>
        ${s.commandes_traitees !== undefined ? `<div style="font-size:12px;color:var(--text2)">Commandes traitées : <strong>${s.commandes_traitees}</strong></div>` : ''}
        ${canEdit ? `
          <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">
            <select onchange="changeRole('${s.id}',this)" style="flex:1;background:var(--dark4);border:1px solid var(--border);border-radius:7px;padding:5px 8px;color:var(--text);font-size:11px;outline:none">
              <option ${s.role === 'helper' ? 'selected' : ''} value="helper">Helper</option>
              <option ${s.role === 'employe' ? 'selected' : ''} value="employe">Employé</option>
              <option ${s.role === 'administrateur' ? 'selected' : ''} value="administrateur">Administrateur</option>
              ${ROLE_LEVEL >= 4 ? `<option ${s.role === 'manager' ? 'selected' : ''} value="manager">Manager</option>` : ''}
              ${ROLE_LEVEL >= 5 ? `<option ${s.role === 'directeur' ? 'selected' : ''} value="directeur">Directeur</option>` : ''}
            </select>
            ${ROLE_LEVEL >= 5 ? `<button class="btn btn-red btn-sm btn-icon-only" title="Révoquer les permissions staff" onclick="removeStaff('${s.id}','${((s.prenom || '') + ' ' + (s.nom || '')).trim().replace(/'/g, "\\'")}','${(s.email || '').replace(/'/g, "\\'")}')">🗑</button>` : ''}
          </div>
        ` : ''}
      </div>
    `;
    }).join('');
}

async function changeRole(id, select) {
    const role = select.value;
    const data = await api(`/api/staff/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
    if (data?.success) { showToast('green', '✅', 'Rôle modifié', role); loadStaff(); }
    else { showToast('red', '❌', data?.error || 'Erreur', ''); loadStaff(); }
}

let pendingRemoveStaffId = null;
let pendingRemoveStaffName = '';

function removeStaff(id, name, email) {
    pendingRemoveStaffId = id;
    pendingRemoveStaffName = name || email || 'ce membre';

    const targetNameEl = document.getElementById('removeStaffTargetName');
    const emailEl = document.getElementById('removeStaffEmailText');
    if (targetNameEl) targetNameEl.textContent = pendingRemoveStaffName;
    if (emailEl) emailEl.textContent = email || '';

    const check = document.getElementById('confirmRemoveCheck');
    if (check) check.checked = false;

    toggleConfirmRemoveBtn();
    const modal = document.getElementById('confirmRemoveStaffModal');
    if (modal) modal.classList.add('open');
}

function closeRemoveStaffModal() {
    pendingRemoveStaffId = null;
    const modal = document.getElementById('confirmRemoveStaffModal');
    if (modal) modal.classList.remove('open');
}

function toggleConfirmRemoveBtn() {
    const check = document.getElementById('confirmRemoveCheck');
    const btn = document.getElementById('confirmRemoveBtn');
    if (!check || !btn) return;
    if (check.checked) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    } else {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
    }
}

async function executeRemoveStaff() {
    if (!pendingRemoveStaffId) return;
    const btn = document.getElementById('confirmRemoveBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Révocation...'; }

    const data = await api(`/api/staff/${pendingRemoveStaffId}`, { method: 'DELETE' });
    closeRemoveStaffModal();
    if (data?.success) {
        showToast('green', '✅', 'Permissions révoquées avec succès', pendingRemoveStaffName);
        loadStaff();
    } else {
        showToast('red', '❌', data?.error || 'Erreur lors de la révocation', '');
    }
}

// ── INVITE STAFF MODAL
function openInviteModal() {
    document.getElementById('inviteEmail').value = '';
    document.getElementById('invitePrenom').value = '';
    document.getElementById('inviteNom').value = '';
    document.getElementById('inviteRole').value = 'employe';
    document.getElementById('inviteError').style.display = 'none';
    const optManager = document.getElementById('inviteOptManager');
    const optDirecteur = document.getElementById('inviteOptDirecteur');
    if (optManager) optManager.style.display = ROLE_LEVEL >= 4 ? '' : 'none';
    if (optDirecteur) optDirecteur.style.display = ROLE_LEVEL >= 5 ? '' : 'none';
    document.getElementById('inviteModal').classList.add('open');
}

function closeInviteModal() {
    document.getElementById('inviteModal').classList.remove('open');
}

async function submitInvite() {
    const email = document.getElementById('inviteEmail').value.trim();
    const prenom = document.getElementById('invitePrenom').value.trim();
    const nom = document.getElementById('inviteNom').value.trim();
    const role = document.getElementById('inviteRole').value;
    const errEl = document.getElementById('inviteError');
    errEl.style.display = 'none';
    if (!email) { errEl.textContent = 'L\'email est obligatoire.'; errEl.style.display = 'block'; return; }
    const btn = document.getElementById('inviteSubmitBtn');
    btn.disabled = true; btn.textContent = 'Envoi...';
    const data = await api('/api/staff/invite', { method: 'POST', body: JSON.stringify({ email, prenom, nom, role }) });
    btn.disabled = false; btn.textContent = "Envoyer l'invitation";
    if (data?.success) {
        closeInviteModal();
        showToast('green', '✅', 'Invitation envoyée', email);
        loadStaff();
    } else {
        errEl.textContent = data?.error || 'Erreur lors de l\'envoi.';
        errEl.style.display = 'block';
    }
}

// ── KPI
async function loadKPI() {
    const data = await api('/api/staff/kpi');
    if (!data) return;
    const grid = document.getElementById('kpiGrid');
    grid.innerHTML = (data.kpi || []).map(k => `
    <div class="kpi-card">
      <div class="kpi-name">${k.prenom || ''} ${k.nom || ''}</div>
      <div class="kpi-role"><span class="staff-role-badge role-${k.role}">${k.role.toUpperCase()}</span></div>
      <div class="kpi-metric"><span>Commandes ce mois</span><span class="val">${k.commandes_ce_mois || 0}</span></div>
      <div class="kpi-metric"><span>Satisfaction client</span><span class="val">${k.taux_satisfaction ? k.taux_satisfaction.toFixed(1) + '★' : '—'}</span></div>
      <div class="kpi-metric"><span>Temps moyen livraison</span><span class="val">${k.temps_moyen_min ? Math.round(k.temps_moyen_min) + ' min' : '—'}</span></div>
    </div>
  `).join('');
}

// ── LOGS
async function loadLogs() {
    if (ROLE_LEVEL < 4) return;
    const search = document.getElementById('searchLog')?.value || '';
    const params = search ? `?action=${encodeURIComponent(search)}` : '';
    const data = await api(`/api/logs${params}`);
    if (!data) return;
    const tbody = document.getElementById('logsBody');
    const logs = data.logs || [];
    if (!logs.length) { tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text3)">Aucun log trouvé</td></tr>`; return; }
    tbody.innerHTML = logs.map(l => `
    <tr class="log-row">
      <td>${formatDate(l.created_at)}</td>
      <td style="font-size:12px">${l.staff_id?.slice(0, 8) || '—'}...</td>
      <td><span class="staff-role-badge role-${l.staff_role}">${(l.staff_role || '').toUpperCase()}</span></td>
      <td class="log-action">${l.action}</td>
      <td class="old-val">${l.ancienne_valeur ? l.ancienne_valeur.slice(0, 40) : '—'}</td>
      <td class="new-val">${l.nouvelle_valeur ? l.nouvelle_valeur.slice(0, 40) : '—'}</td>
    </tr>
  `).join('');
}

// ── STOCK
async function loadStock() {
    const data = await api('/api/stock');
    if (!data) return;
    const tbody = document.getElementById('stockBody');
    const stock = data.stock || [];
    if (!stock.length) { tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">🔑</div><p>Aucun code chargé</p></div></td></tr>`; return; }
    tbody.innerHTML = stock.map(s => `
    <tr>
      <td style="font-size:11px;color:var(--text3)">#${s.id}</td>
      <td>${escHtml(s.produit_nom) || '—'}</td>
      <td style="font-size:12px">${s.denom_label || '—'}</td>
      <td><code style="font-size:11px;color:var(--blue)">${s.statut === 'vendu' ? '****-****-****-****' : s.code}</code></td>
      <td>${s.statut === 'disponible' ? '<span class="badge badge-livree">Disponible</span>' : '<span class="badge badge-annulee">Vendu</span>'}</td>
      <td style="font-size:11px;color:var(--text3)">${s.vendu_at ? formatDate(s.vendu_at) : '—'}</td>
    </tr>
  `).join('');
}

function openStockModal() { document.getElementById('stockModalOverlay').classList.add('open'); }
function closeStockModal() { document.getElementById('stockModalOverlay').classList.remove('open'); }

async function saveStock() {
    const produitId = parseInt(document.getElementById('stockProdId').value);
    const produitNom = document.getElementById('stockProdNom').value;
    const denomLabel = document.getElementById('stockDenom').value;
    const codesRaw = document.getElementById('stockCodes').value;
    const codes = codesRaw.split('\n').map(c => c.trim()).filter(c => c.length > 0);
    if (!produitId || !codes.length) return showToast('red', '❌', 'Données incomplètes', '');
    const data = await api('/api/stock', { method: 'POST', body: JSON.stringify({ produit_id: produitId, produit_nom: produitNom, denom_label: denomLabel, codes }) });
    if (data?.success) { showToast('green', '✅', `${data.added} codes chargés`, ''); closeStockModal(); loadStock(); }
    else showToast('red', '❌', data?.error || 'Erreur', '');
}

// ━━━━━━━━━━━━━━━━━━━━ WALLET ━━━━━━━━━━━━━━━━━━━━
let currentWalletFilter = 'en_attente';

function filterWalletTx(btn) {
    document.querySelectorAll('.wallet-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentWalletFilter = btn.dataset.wstatus;
    loadWalletTx(currentWalletFilter);
}

async function loadWalletTx(statut = 'en_attente') {
    const tbody = document.getElementById('walletTxBody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text3)">Chargement...</td></tr>`;
    const url = statut === 'all' ? '/api/wallet/all?statut=all' : `/api/wallet/all?statut=${statut}`;
    const data = await api(url);
    if (!data) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:#ef4444">Erreur de chargement.</td></tr>`;
        return;
    }
    const txs = data.transactions || [];

    // Badge en attente
    const pending = txs.filter(t => t.statut === 'en_attente').length;
    const badge = document.getElementById('badgeWallet');
    if (badge) { badge.textContent = pending; badge.style.display = pending > 0 ? '' : 'none'; }

    if (!txs.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text3)">Aucune transaction trouvée.</td></tr>`;
        return;
    }

    const methodLabel = { moncash: '📱 Moncash', natcash: '📲 Natcash', card: '💳 Carte', crypto: '₿ Crypto', manuel: '🛠️ Manuel' };
    const statutBadge = { en_attente: 'background:#f59e0b22;color:#f59e0b;border:1px solid #f59e0b44', valide: 'background:#10b98122;color:#10b981;border:1px solid #10b98144', annule: 'background:#ef444422;color:#ef4444;border:1px solid #ef444444' };
    const statutLabel = { en_attente: '⏳ En attente', valide: '✅ Validé', annule: '❌ Annulé' };

    tbody.innerHTML = txs.map(t => {
        const client = t.profiles ? `${escHtml(t.profiles.prenom || '')} ${escHtml(t.profiles.nom || '')}`.trim() + `<br><small style="color:var(--text3)">${escHtml(t.profiles.email || '')}</small>` : `<small style="color:var(--text3)">${escHtml(t.user_id)}</small>`;
        const actions = t.statut === 'en_attente'
            ? `<button class="btn btn-green btn-sm" onclick="validateWalletTx('${t.id}')">✅ Valider</button>
               <button class="btn btn-outline btn-sm" style="color:#ef4444;border-color:#ef4444" onclick="cancelWalletTx('${t.id}')">❌ Annuler</button>`
            : `<span style="color:var(--text3);font-size:12px">${t.valide_at ? formatDate(t.valide_at) : '—'}</span>`;
        return `<tr>
            <td style="font-size:12px;color:var(--text3)">${formatDate(t.created_at)}</td>
            <td>${client}</td>
            <td style="font-weight:700;color:#10b981;font-size:15px">+$${parseFloat(t.montant).toFixed(2)}</td>
            <td>${methodLabel[t.methode] || escHtml(t.methode) || '—'}</td>
            <td><span style="${statutBadge[t.statut] || ''};padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600">${statutLabel[t.statut] || t.statut}</span></td>
            <td style="font-size:12px;color:var(--text3);max-width:160px;overflow:hidden;text-overflow:ellipsis">${escHtml(t.note || '—')}</td>
            <td style="display:flex;gap:6px;flex-wrap:wrap">${actions}</td>
        </tr>`;
    }).join('');
}

async function validateWalletTx(txId) {
    if (!confirm('Valider cette recharge ? Le solde sera crédité immédiatement.')) return;
    const data = await api(`/api/wallet/transactions/${txId}/validate`, { method: 'PATCH' });
    if (data?.success) {
        showToast('success', '✅', 'Recharge validée', `Nouveau solde client : $${parseFloat(data.new_balance).toFixed(2)}`);
        loadWalletTx(currentWalletFilter);
    } else {
        showToast('error', '❌', 'Erreur', data?.error || 'Impossible de valider.');
    }
}

async function cancelWalletTx(txId) {
    const motif = prompt('Motif d\'annulation (optionnel) :');
    if (motif === null) return;
    const data = await api(`/api/wallet/transactions/${txId}/cancel`, { method: 'PATCH', body: JSON.stringify({ motif }) });
    if (data?.success) {
        showToast('success', '🗑️', 'Recharge annulée', 'La demande a été rejetée.');
        loadWalletTx(currentWalletFilter);
    } else {
        showToast('error', '❌', 'Erreur', data?.error || 'Impossible d\'annuler.');
    }
}

async function submitManualCredit() {
    const email = document.getElementById('manualEmail')?.value?.trim();
    const amount = parseFloat(document.getElementById('manualAmount')?.value);
    const note = document.getElementById('manualNote')?.value?.trim();
    const msg = document.getElementById('manualCreditMsg');
    const btn = document.getElementById('manualCreditBtn');

    if (!email || !email.includes('@')) { showMsg(msg, 'error', 'Email invalide.'); return; }
    if (!amount || amount < 0.01) { showMsg(msg, 'error', 'Montant invalide (min $0.01).'); return; }

    btn.disabled = true; btn.textContent = 'Traitement...';
    msg.style.display = 'none';

    const data = await api('/api/wallet/credit-manual', {
        method: 'POST',
        body: JSON.stringify({ email, montant: amount, note: note || 'Crédit manuel staff' })
    });

    btn.disabled = false; btn.textContent = '💸 Créditer';

    if (data?.success) {
        showMsg(msg, 'success', `✅ $${amount.toFixed(2)} crédité sur le compte de ${email}. Nouveau solde : $${parseFloat(data.new_balance).toFixed(2)}`);
        document.getElementById('manualEmail').value = '';
        document.getElementById('manualAmount').value = '';
        document.getElementById('manualNote').value = '';
        loadWalletTx(currentWalletFilter);
    } else {
        showMsg(msg, 'error', data?.error || 'Erreur lors du crédit manuel.');
    }
}

function showMsg(el, type, text) {
    if (!el) return;
    el.style.display = 'block';
    el.style.background = type === 'success' ? '#f0fdf9' : '#fef2f2';
    el.style.color = type === 'success' ? '#059669' : '#dc2626';
    el.style.border = `1px solid ${type === 'success' ? '#c8f0e0' : '#fecaca'}`;
    el.textContent = text;
}

// ── VENTES PRODUITS
let currentVentesPeriod = 'day';
let ventesData = [];

async function loadProductSales() {
    const tbody = document.getElementById('ventesBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text3)">Chargement...</td></tr>`;

    const [prodData, ordData] = await Promise.all([
        api('/api/products'),
        api('/api/orders')
    ]);
    if (!prodData || !ordData) return;

    const products = prodData.products || [];
    const orders = (ordData.orders || []).filter(o => o.statut === 'livree');

    document.getElementById('ventesStatProduits').textContent = products.length;

    ventesData = products.map(p => {
        const prodOrders = orders.filter(o => {
            const name = (o.produit_nom || o.produit || '').toLowerCase();
            const pname = (p.name || '').toLowerCase();
            return name.includes(pname.slice(0, 10)) || pname.includes((name || '').slice(0, 10));
        });
        const sales = prodOrders.length;
        const ca = prodOrders.reduce((sum, o) => sum + (parseFloat(o.eur) || parseFloat(o.montant_eur) || 0), 0);
        return { ...p, sales, ca: parseFloat(ca.toFixed(2)), orders: prodOrders };
    });

    renderVentes();
}

function getDateThreshold(period) {
    const now = new Date();
    if (period === 'day') { now.setHours(0, 0, 0, 0); return now; }
    if (period === 'week') { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d; }
    if (period === 'month') { return new Date(now.getFullYear(), now.getMonth(), 1); }
    if (period === 'year') { return new Date(now.getFullYear(), 0, 1); }
    return null;
}

function filterVentes(btn) {
    document.querySelectorAll('.ventes-period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentVentesPeriod = btn.dataset.period;
    renderVentes();
}

function renderVentes() {
    const tbody = document.getElementById('ventesBody');
    if (!tbody) return;
    if (!ventesData.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text3)">Aucun produit trouvé</td></tr>`;
        return;
    }

    const threshold = getDateThreshold(currentVentesPeriod);
    const labelMap = { day: "Aujourd'hui", week: 'Cette semaine', month: 'Ce mois', year: 'Cette année', all: 'Toutes périodes' };
    document.getElementById('ventesStatLabel').textContent = labelMap[currentVentesPeriod] || '';

    const rows = ventesData.map(p => {
        let sales, ca;
        if (threshold && currentVentesPeriod !== 'all') {
            const filtered = (p.orders || []).filter(o => o.created_at && new Date(o.created_at) >= threshold);
            sales = filtered.length;
            ca = filtered.reduce((s, o) => s + (parseFloat(o.eur) || parseFloat(o.montant_eur) || 0), 0);
        } else {
            sales = p.sales || 0;
            ca = p.ca || 0;
        }
        return { ...p, periodSales: sales, periodCA: parseFloat(ca.toFixed(2)) };
    }).sort((a, b) => b.periodSales - a.periodSales);

    const totalSales = rows.reduce((s, r) => s + r.periodSales, 0);
    const totalCA = rows.reduce((s, r) => s + r.periodCA, 0);

    document.getElementById('ventesStatVentes').textContent = totalSales;
    document.getElementById('ventesStatCA').textContent = `$${totalCA.toFixed(2)}`;
    const top = rows.find(r => r.periodSales > 0);
    document.getElementById('ventesStatTop').textContent = top ? (top.name || '—').slice(0, 22) : '—';

    if (!rows.length) { tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text3)">Aucune donnée</td></tr>`; return; }

    tbody.innerHTML = rows.map(r => {
        const pct = totalSales > 0 ? ((r.periodSales / totalSales) * 100).toFixed(1) : '0.0';
        const bar = `<div style="background:var(--dark4);border-radius:4px;height:6px;width:80px;display:inline-block;vertical-align:middle;margin-right:6px"><div style="background:var(--green);height:6px;border-radius:4px;width:${pct}%"></div></div>`;
        const trend = r.periodSales > 0 ? '📈' : (r.sales > 0 ? '📊' : '—');
        return `
      <tr>
        <td style="font-weight:600">${escHtml(r.name || '—')}</td>
        <td><span style="font-size:11px;background:var(--dark4);padding:2px 7px;border-radius:10px;color:var(--text2)">${escHtml(r.category || '—')}</span></td>
        <td style="font-weight:700;color:${r.periodSales > 0 ? 'var(--green)' : 'var(--text3)'}">${r.periodSales}</td>
        <td style="color:var(--text2)">$${r.periodCA.toFixed(2)}</td>
        <td>${bar}<span style="font-size:11px;color:var(--text3)">${pct}%</span></td>
        <td style="font-size:16px">${trend}</td>
      </tr>`;
    }).join('');
}

// ── DEVISES RÉGIONALES
function initCurrencyRates() {
    const saved = JSON.parse(localStorage.getItem('asta_currency_rates') || '{}');
    document.querySelectorAll('.currency-rate-item').forEach(item => {
        const code = item.dataset.code;
        const def = item.dataset.default;
        const input = item.querySelector('.currency-rate-input');
        if (input) input.value = saved[code] !== undefined ? saved[code] : def;
    });
}

function saveCurrencyRates() {
    const rates = {};
    document.querySelectorAll('.currency-rate-item').forEach(item => {
        const code = item.dataset.code;
        const input = item.querySelector('.currency-rate-input');
        if (input && input.value) rates[code] = parseFloat(input.value);
    });
    localStorage.setItem('asta_currency_rates', JSON.stringify(rates));
    showToast('green', '✅', 'Taux enregistrés', `${Object.keys(rates).length} devises sauvegardées`);
}

// ── LOGOUT
async function logout() {
    localStorage.removeItem("as_token"); localStorage.removeItem("as_user"); localStorage.removeItem("as_perms"); localStorage.removeItem("as_level");
    TOKEN = null;
    await fetch(`${API}/api/auth/logout`, { method: 'POST' }).catch(() => {});
    window.location.href = 'admin-login.html';
}

// ── TOAST
function showToast(type, icon, title, sub) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icon}</span><div class="toast-text"><div class="toast-title">${title}</div>${sub ? `<div class="toast-sub">${sub}</div>` : ''}</div>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity .3s'; setTimeout(() => toast.remove(), 300); }, 3500);
}

// ── UTILS
function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ── COUPONS & CODES PROMO MANAGEMENT ──
let couponsData = [];

async function loadCoupons() {
    try {
        const res = await api('/api/coupons');
        if (!res) return;
        couponsData = Array.isArray(res) ? res : (res.coupons || []);
        renderCoupons();
    } catch (e) {
        console.error('[Coupons] Erreur chargement :', e);
        showToast('red', '⚠️', 'Erreur chargement coupons', e.message);
    }
}

function renderCoupons() {
    const tbody = document.getElementById('couponsBody');
    if (!tbody) return;

    const total = couponsData.length;
    const active = couponsData.filter(c => c.is_active).length;
    const usage = couponsData.reduce((acc, c) => acc + (c.usage_count || 0), 0);

    if (document.getElementById('statCouponsTotal')) document.getElementById('statCouponsTotal').textContent = total;
    if (document.getElementById('statCouponsActive')) document.getElementById('statCouponsActive').textContent = active;
    if (document.getElementById('statCouponsUsage')) document.getElementById('statCouponsUsage').textContent = usage;

    if (couponsData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text3)">Aucun code promo créé. Cliquez sur "+ Créer un Code Promo".</td></tr>`;
        return;
    }

    tbody.innerHTML = couponsData.map(c => {
        const isExpired = c.expires_at && new Date(c.expires_at) < new Date();
        const isLimitReached = c.usage_limit && c.usage_count >= c.usage_limit;
        
        let statusBadge = '';
        if (!c.is_active) {
            statusBadge = '<span class="badge badge-annulee">Inactif</span>';
        } else if (isExpired) {
            statusBadge = '<span class="badge badge-annulee">Expiré</span>';
        } else if (isLimitReached) {
            statusBadge = '<span class="badge badge-attente">Épuisé</span>';
        } else {
            statusBadge = '<span class="badge badge-livree">Actif</span>';
        }

        const typeLabel = c.discount_type === 'percent' ? `-${c.discount_value}%` : `-$${Number(c.discount_value).toFixed(2)}`;
        const minAmtLabel = c.min_order_amount > 0 ? `$${Number(c.min_order_amount).toFixed(2)}` : 'Aucun';
        const usageLabel = c.usage_limit ? `${c.usage_count || 0} / ${c.usage_limit}` : `${c.usage_count || 0} (Illimité)`;
        const expLabel = c.expires_at ? formatDate(c.expires_at) : 'Permanence';

        return `
            <tr>
                <td><strong style="color:var(--green);font-size:14px">${c.code}</strong></td>
                <td><span style="font-weight:700;color:#fff">${typeLabel}</span></td>
                <td>${minAmtLabel}</td>
                <td>${usageLabel}</td>
                <td><span style="font-size:12px;color:var(--text2)">${expLabel}</span></td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-outline btn-sm" style="margin-right:4px" onclick="toggleCouponStatus('${c.id}', ${!c.is_active})">
                        ${c.is_active ? '⏸️ Désactiver' : '▶️ Activer'}
                    </button>
                    <button class="btn btn-red btn-sm" onclick="deleteCoupon('${c.id}')">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function openCouponModal() {
    document.getElementById('couponForm').reset();
    toggleCouponTypeUnit();
    document.getElementById('modalCoupon').classList.add('open');
}

function closeCouponModal() {
    document.getElementById('modalCoupon').classList.remove('open');
}

function toggleCouponTypeUnit() {
    const type = document.getElementById('couponType').value;
    document.getElementById('couponUnitBadge').textContent = type === 'fixed' ? '$' : '%';
}

async function submitCouponForm(e) {
    e.preventDefault();
    const code = document.getElementById('couponCode').value.trim().toUpperCase();
    const discount_type = document.getElementById('couponType').value;
    const discount_value = Number(document.getElementById('couponValue').value);
    const min_order_amount = Number(document.getElementById('couponMinAmount').value) || 0;
    const usage_limit = document.getElementById('couponLimit').value ? Number(document.getElementById('couponLimit').value) : null;
    const expires_at = document.getElementById('couponExpiresAt').value ? new Date(document.getElementById('couponExpiresAt').value).toISOString() : null;

    try {
        const res = await api('/api/coupons', {
            method: 'POST',
            body: JSON.stringify({ code, discount_type, discount_value, min_order_amount, usage_limit, expires_at })
        });
        if (res && res.success) {
            showToast('green', '✅', `Coupon ${code} créé avec succès !`);
            closeCouponModal();
            loadCoupons();
        } else {
            showToast('red', '⚠️', 'Erreur création coupon', res?.error || 'Erreur inconnue');
        }
    } catch (err) {
        showToast('red', '⚠️', 'Erreur serveur', err.message);
    }
}

async function toggleCouponStatus(id, newStatus) {
    try {
        const res = await api(`/api/coupons/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ is_active: newStatus })
        });
        if (res && res.success) {
            showToast('green', '✅', 'Statut du coupon mis à jour !');
            loadCoupons();
        }
    } catch (err) {
        showToast('red', '⚠️', 'Erreur modification coupon', err.message);
    }
}

async function deleteCoupon(id) {
    if (!confirm('Voulez-vous vraiment supprimer ce code promo ?')) return;
    try {
        const res = await api(`/api/coupons/${id}`, { method: 'DELETE' });
        if (res && res.success) {
            showToast('green', '🗑️', 'Coupon supprimé avec succès');
            loadCoupons();
        }
    } catch (err) {
        showToast('red', '⚠️', 'Erreur suppression coupon', err.message);
    }
}

// ═══════════════════════════════════════════════════════════════
//  GESTION DU BLOG & ACTUALITÉS (STYLE LOOTBAR + DASHBOARD)
// ═══════════════════════════════════════════════════════════════

let allBlogArticles = [];
let allBlogCategories = [];

async function loadBlogCategories() {
    try {
        const res = await api('/api/blogs/categories');
        const cats = Array.isArray(res) ? res : (res?.categories || []);
        if (cats && cats.length > 0) {
            allBlogCategories = cats;
            renderBlogCategoriesOptions();
            renderBlogCategoriesTable();
            const statEl = document.getElementById('statBlogCategories');
            if (statEl) statEl.textContent = allBlogCategories.length;
        }
    } catch (err) {
        console.error('[Blog] Erreur chargement catégories:', err);
    }
}

function renderBlogCategoriesOptions() {
    // Select in Article Modal Form
    const selForm = document.getElementById('blogCategorySelect');
    if (selForm) {
        const currentVal = selForm.value;
        selForm.innerHTML = '<option value="">Sélectionner une catégorie...</option>' +
            allBlogCategories.map(c => `<option value="${c.id}">${c.icon_url ? c.icon_url + ' ' : ''}${escHtml(c.name)}</option>`).join('');
        if (currentVal) selForm.value = currentVal;
    }

    // Select in Toolbar Filter
    const selFilter = document.getElementById('blogFilterCategory');
    if (selFilter) {
        const currentVal = selFilter.value;
        selFilter.innerHTML = '<option value="all">Toutes catégories</option>' +
            allBlogCategories.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
        if (currentVal) selFilter.value = currentVal;
    }
}

function renderBlogCategoriesTable() {
    const tbody = document.getElementById('blogCategoriesListBody');
    if (!tbody) return;
    if (!allBlogCategories.length) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:12px;color:var(--text3)">Aucune catégorie</td></tr>';
        return;
    }
    tbody.innerHTML = allBlogCategories.map(c => `
        <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:8px 12px;font-size:16px">${escHtml(c.icon_url || '📄')}</td>
            <td style="padding:8px 12px;font-weight:600">${escHtml(c.name)}</td>
            <td style="padding:8px 12px;color:var(--text3);font-family:monospace;font-size:11px">${escHtml(c.slug)}</td>
        </tr>
    `).join('');
}

async function loadBlogArticles() {
    const tbody = document.getElementById('blogArticlesBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text3)">Chargement des articles...</td></tr>';

    try {
        const res = await api('/api/blogs?limit=100');
        if (res && res.articles) {
            allBlogArticles = res.articles;

            // Stats
            const statTotal = document.getElementById('statBlogTotal');
            const statFeatured = document.getElementById('statBlogFeatured');
            const statPartner = document.getElementById('statBlogPartner');
            const badge = document.getElementById('badgeBlog');

            if (statTotal) statTotal.textContent = allBlogArticles.length;
            if (statFeatured) statFeatured.textContent = allBlogArticles.filter(a => a.is_featured).length;
            if (statPartner) statPartner.textContent = allBlogArticles.filter(a => a.is_partner).length;
            if (badge) {
                badge.textContent = allBlogArticles.length;
                badge.style.display = allBlogArticles.length > 0 ? '' : 'none';
            }

            filterBlogList();
        } else {
            if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text3)">Aucun article trouvé.</td></tr>';
        }
    } catch (err) {
        console.error('[Blog] Erreur chargement articles:', err);
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#ef4444">Erreur de connexion avec le serveur.</td></tr>';
    }
}

function filterBlogList() {
    const catVal = document.getElementById('blogFilterCategory')?.value || 'all';
    const typeVal = document.getElementById('blogFilterType')?.value || 'all';
    const query = (document.getElementById('blogSearchInput')?.value || '').toLowerCase().trim();

    const filtered = allBlogArticles.filter(a => {
        if (catVal !== 'all' && String(a.category_id) !== String(catVal)) return false;
        if (typeVal === 'featured' && !a.is_featured) return false;
        if (typeVal === 'partner' && !a.is_partner) return false;
        if (query) {
            const haystack = [a.title, a.excerpt, a.game_name, a.author_name, a.slug].join(' ').toLowerCase();
            if (!haystack.includes(query)) return false;
        }
        return true;
    });

    renderBlogArticles(filtered);
}

function renderBlogArticles(articles) {
    const tbody = document.getElementById('blogArticlesBody');
    if (!tbody) return;

    if (!articles || articles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text3)">Aucun article ne correspond aux filtres.</td></tr>';
        return;
    }

    tbody.innerHTML = articles.map(a => {
        const cat = allBlogCategories.find(c => String(c.id) === String(a.category_id));
        const catName = cat ? cat.name : (a.category_name || 'Général');
        const imgUrl = a.image_url || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80';
        const formattedDate = a.created_at ? new Date(a.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

        let badges = [];
        if (a.is_featured) {
            badges.push('<span style="background:rgba(34,197,94,0.15);color:#22c55e;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;white-space:nowrap">⭐ En Vedette</span>');
        }
        if (a.is_partner) {
            badges.push('<span style="background:rgba(59,130,246,0.15);color:#3b82f6;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;white-space:nowrap">🤝 Partenaire</span>');
        }
        if (!badges.length) {
            badges.push('<span style="color:var(--text3);font-size:11px">Standard</span>');
        }

        return `
            <tr>
                <td>
                    <img src="${escHtml(imgUrl)}" alt="" style="width:54px;height:40px;object-fit:cover;border-radius:6px;background:var(--dark4);display:block" onerror="this.src='https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80'">
                </td>
                <td style="max-width:240px">
                    <div style="font-weight:700;color:var(--text);font-size:13px;line-height:1.3;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(a.title)}">
                        ${escHtml(a.title)}
                    </div>
                    <div style="font-size:11px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                        ${escHtml(a.excerpt || a.slug)}
                    </div>
                </td>
                <td>
                    <div style="font-size:12px;font-weight:600;color:var(--text)">${escHtml(a.game_name || 'Général')}</div>
                    <div style="font-size:11px;color:var(--text3)">${escHtml(catName)}</div>
                </td>
                <td>
                    <div style="display:flex;flex-direction:column;gap:3px;align-items:flex-start">
                        ${badges.join('')}
                    </div>
                </td>
                <td>
                    <div style="font-size:12px">${escHtml(a.author_name || 'LootZone')}</div>
                    <div style="font-size:10px;color:var(--text3)">⏱️ ${escHtml(a.read_time || '4 min')}</div>
                </td>
                <td style="font-size:12px;color:var(--text2)">
                    👁️ ${a.views_count || 0}
                </td>
                <td style="font-size:11px;color:var(--text3);white-space:nowrap">
                    ${formattedDate}
                </td>
                <td style="text-align:right;white-space:nowrap">
                    <button class="btn btn-outline btn-sm" onclick="editBlogArticle('${a.id}')" title="Modifier l'article">✏️</button>
                    <a href="../blog.html?article=${encodeURIComponent(a.slug || a.id)}" target="_blank" class="btn btn-outline btn-sm" title="Voir sur le site">🌐</a>
                    <button class="btn btn-red btn-sm" onclick="deleteBlogArticle('${a.id}', '${escHtml(a.title).replace(/'/g, "\\'")}')" title="Supprimer">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

function autoGenerateBlogSlug(title) {
    const slugInput = document.getElementById('blogSlug');
    if (!slugInput) return;
    // Only auto-generate if article id is empty (new article) or slug matches title
    if (!document.getElementById('blogArticleId').value) {
        const slug = title
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        slugInput.value = slug;
    }
}

function updateBlogImagePreview(url) {
    const previewWrap = document.getElementById('blogImagePreviewWrap');
    const previewImg = document.getElementById('blogImagePreview');
    if (!previewWrap || !previewImg) return;
    if (url && url.trim().length > 0) {
        previewImg.src = url;
        previewWrap.style.display = 'block';
    } else {
        previewWrap.style.display = 'none';
    }
}

async function uploadBlogImageFile(input) {
    const file = input.files?.[0];
    if (!file) return;

    const statusEl = document.getElementById('blogImageUploadStatus');
    if (statusEl) statusEl.textContent = '⏳ Upload en cours vers Supabase Storage...';

    const reader = new FileReader();
    reader.onload = async function (e) {
        const base64Data = e.target.result;
        try {
            const res = await api('/api/blogs/upload-image', {
                method: 'POST',
                body: JSON.stringify({
                    fileData: base64Data,
                    fileName: file.name
                })
            });

            if (res && res.imageUrl) {
                document.getElementById('blogImageUrl').value = res.imageUrl;
                updateBlogImagePreview(res.imageUrl);
                if (statusEl) {
                    statusEl.style.color = 'var(--green)';
                    statusEl.textContent = '✅ Image uploadée avec succès !';
                }
                showToast('green', '🖼️', 'Image uploadée avec succès !');
            } else {
                throw new Error(res?.error || "Erreur lors de l'upload");
            }
        } catch (err) {
            console.error('[Blog] Erreur upload image:', err);
            if (statusEl) {
                statusEl.style.color = '#ef4444';
                statusEl.textContent = '⚠️ ' + err.message;
            }
            showToast('red', '⚠️', 'Erreur upload image', err.message);
        }
    };
    reader.readAsDataURL(file);
}

function insertBlogTag(openTag, closeTag) {
    const ta = document.getElementById('blogContent');
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.substring(start, end) || 'texte';
    const replacement = `${openTag}${selected}${closeTag}`;
    ta.value = ta.value.substring(0, start) + replacement + ta.value.substring(end);
    ta.focus();
    ta.selectionStart = start + openTag.length;
    ta.selectionEnd = start + openTag.length + selected.length;
}

function openBlogArticleModal() {
    document.getElementById('blogModalTitle').textContent = '📰 Nouvel Article de Blog';
    document.getElementById('blogArticleId').value = '';
    document.getElementById('blogTitle').value = '';
    document.getElementById('blogSlug').value = '';
    document.getElementById('blogCategorySelect').value = allBlogCategories[0]?.id || '';
    document.getElementById('blogGameName').value = 'Free Fire';
    document.getElementById('blogAuthorName').value = 'Équipe LootZone';
    document.getElementById('blogReadTime').value = '4 min';
    document.getElementById('blogImageUrl').value = '';
    document.getElementById('blogExcerpt').value = '';
    document.getElementById('blogContent').value = '';
    document.getElementById('blogIsFeatured').checked = false;
    document.getElementById('blogIsPartner').checked = false;
    document.getElementById('blogImageUploadStatus').textContent = '';
    updateBlogImagePreview('');

    document.getElementById('modalBlogArticle').classList.add('active');
}

function editBlogArticle(id) {
    const a = allBlogArticles.find(x => String(x.id) === String(id));
    if (!a) return;

    document.getElementById('blogModalTitle').textContent = `✏️ Modifier : ${a.title}`;
    document.getElementById('blogArticleId').value = a.id;
    document.getElementById('blogTitle').value = a.title || '';
    document.getElementById('blogSlug').value = a.slug || '';
    document.getElementById('blogCategorySelect').value = a.category_id || '';
    document.getElementById('blogGameName').value = a.game_name || '';
    document.getElementById('blogAuthorName').value = a.author_name || 'Équipe LootZone';
    document.getElementById('blogReadTime').value = a.read_time || '4 min';
    document.getElementById('blogImageUrl').value = a.image_url || '';
    document.getElementById('blogExcerpt').value = a.excerpt || '';
    document.getElementById('blogContent').value = a.content || '';
    document.getElementById('blogIsFeatured').checked = !!a.is_featured;
    document.getElementById('blogIsPartner').checked = !!a.is_partner;
    document.getElementById('blogImageUploadStatus').textContent = '';
    updateBlogImagePreview(a.image_url);

    document.getElementById('modalBlogArticle').classList.add('active');
}

function closeBlogArticleModal() {
    document.getElementById('modalBlogArticle').classList.remove('active');
}

async function saveBlogArticle(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSaveBlogArticle');
    btn.disabled = true;
    btn.textContent = 'Enregistrement...';

    const id = document.getElementById('blogArticleId').value;
    const title = document.getElementById('blogTitle').value.trim();
    const slug = document.getElementById('blogSlug').value.trim() || title.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const category_id = document.getElementById('blogCategorySelect').value || null;
    const game_name = document.getElementById('blogGameName').value.trim() || null;
    const author_name = document.getElementById('blogAuthorName').value.trim() || 'Équipe LootZone';
    const read_time = document.getElementById('blogReadTime').value.trim() || '4 min';
    const image_url = document.getElementById('blogImageUrl').value.trim() || null;
    const excerpt = document.getElementById('blogExcerpt').value.trim() || null;
    const content = document.getElementById('blogContent').value.trim();
    const is_featured = document.getElementById('blogIsFeatured').checked;
    const is_partner = document.getElementById('blogIsPartner').checked;

    const payload = {
        title,
        slug,
        category_id,
        game_name,
        author_name,
        read_time,
        image_url,
        excerpt,
        content,
        is_featured,
        is_partner
    };

    try {
        let res;
        if (id) {
            res = await api(`/api/blogs/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
        } else {
            res = await api('/api/blogs', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        }

        if (res && res.article) {
            showToast('green', '📰', id ? 'Article mis à jour !' : 'Article publié avec succès !');
            closeBlogArticleModal();
            await loadBlogArticles();
        } else {
            throw new Error(res?.error || 'Erreur inconnue');
        }
    } catch (err) {
        showToast('red', '⚠️', 'Erreur enregistrement article', err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 Enregistrer l\'article';
    }
}

async function deleteBlogArticle(id, title) {
    if (!confirm(`Voulez-vous vraiment supprimer l'article "${title}" ? Cette action est irréversible.`)) return;

    try {
        const res = await api(`/api/blogs/${id}`, { method: 'DELETE' });
        if (res && res.success) {
            showToast('green', '🗑️', 'Article supprimé');
            await loadBlogArticles();
        } else {
            throw new Error(res?.error || 'Erreur lors de la suppression');
        }
    } catch (err) {
        showToast('red', '⚠️', 'Erreur suppression', err.message);
    }
}

function openBlogCategoriesModal() {
    renderBlogCategoriesTable();
    document.getElementById('modalBlogCategories').classList.add('active');
}

function closeBlogCategoriesModal() {
    document.getElementById('modalBlogCategories').classList.remove('active');
}

async function saveBlogCategory(e) {
    e.preventDefault();
    const name = document.getElementById('newCatName').value.trim();
    const slug = document.getElementById('newCatSlug').value.trim();
    const icon_url = document.getElementById('newCatIcon').value.trim();

    try {
        const res = await api('/api/blogs/categories', {
            method: 'POST',
            body: JSON.stringify({ name, slug, icon_url })
        });

        if (res && res.category) {
            showToast('green', '🏷️', `Catégorie "${name}" créée avec succès !`);
            document.getElementById('blogCategoryForm').reset();
            await loadBlogCategories();
        } else {
            throw new Error(res?.error || 'Erreur inconnue');
        }
    } catch (err) {
        showToast('red', '⚠️', 'Erreur création catégorie', err.message);
    }
}

