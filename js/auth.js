/**
 * ASTA-SHOPS — Module Auth Client (Supabase)
 * Gestion de l'authentification côté navigateur
 */

const SUPABASE_URL = 'https://ukgqtyyywakgvbfxsfac.supabase.co';
const SUPABASE_ANON = 'sb_publishable_N7fWHUmetq4bj5MaFMB9XA_yUi1Q3iv';

// ─── Rôles utilisateur ───────────────────────────────────────────────────────
window.USER_ROLES = {
  client: { label: 'Membre', icon: '👤', color: '#6b7280', bg: 'rgba(107,114,128,.25)' },
  partenaire: { label: 'Partenaire', icon: '🤝', color: '#0ea5e9', bg: 'rgba(14,165,233,.25)' },
  alliance: { label: 'Partenaire Alliance', icon: '🔗', color: '#3b82f6', bg: 'rgba(59,130,246,.25)' },
  recruteur: { label: 'Recruteur', icon: '🎯', color: '#a855f7', bg: 'rgba(168,85,247,.25)' },
  influenceur: { label: 'Influenceur', icon: '🌟', color: '#ec4899', bg: 'rgba(236,72,153,.25)' },
  vendeur: { label: 'Vendeur', icon: '🛒', color: '#f97316', bg: 'rgba(249,115,22,.25)' },
  helper: { label: 'Staff', icon: '🛡️', color: '#14b8a6', bg: 'rgba(20,184,166,.25)' },
  employe: { label: 'Asta Team', icon: '⭐', color: '#eab308', bg: 'rgba(234,179,8,.25)' },
  administrateur: { label: 'Asta Team', icon: '⭐', color: '#eab308', bg: 'rgba(234,179,8,.25)' },
  manager: { label: 'Asta Team', icon: '⭐', color: '#eab308', bg: 'rgba(234,179,8,.25)' },
  directeur: { label: 'Directeur', icon: '👑', color: '#f59e0b', bg: 'rgba(245,158,11,.18)' },
  vip: { label: 'VIP', icon: '💎', color: '#d4a017', bg: 'rgba(212,160,23,.25)' },
};

window.getRoleInfo = (role) => window.USER_ROLES[role] || window.USER_ROLES['client'];

// ─── Niveaux VIP ────────────────────────────────────────────────────────────
window.VIP_LEVELS = [
  { id: 'membre', label: 'Membre', pts: 0, color: '#6b7280', grad: 'linear-gradient(135deg,#6b7280,#9ca3af)', icon: '⭕', discount: 0, badge: '' },
  { id: 'bronze', label: 'Bronze', pts: 100, color: '#cd7f32', grad: 'linear-gradient(135deg,#8B5E2B,#e8a24a)', icon: '🥉', discount: 2, badge: 'V1' },
  { id: 'argent', label: 'Argent', pts: 500, color: '#94a3b8', grad: 'linear-gradient(135deg,#64748b,#cbd5e1)', icon: '🥈', discount: 5, badge: 'V2' },
  { id: 'or', label: 'Or', pts: 1500, color: '#f59e0b', grad: 'linear-gradient(135deg,#b45309,#fcd34d)', icon: '🥇', discount: 8, badge: 'V3' },
  { id: 'platine', label: 'Platine', pts: 5000, color: '#06b6d4', grad: 'linear-gradient(135deg,#0284c7,#67e8f9)', icon: '💎', discount: 12, badge: 'V4' },
  { id: 'diamant', label: 'Diamant', pts: 15000, color: '#8b5cf6', grad: 'linear-gradient(135deg,#6d28d9,#c4b5fd)', icon: '💠', discount: 18, badge: 'V5' },
  { id: 'elite', label: 'Élite', pts: 50000, color: '#f59e0b', grad: 'linear-gradient(135deg,#7c3aed,#f59e0b)', icon: '👑', discount: 25, badge: 'VIP' }
];

window.getVipLevel = (pts = 0) => {
  const levels = [...window.VIP_LEVELS].reverse();
  return levels.find(l => pts >= l.pts) || window.VIP_LEVELS[0];
};

window.getNextVipLevel = (pts = 0) => {
  return window.VIP_LEVELS.find(l => pts < l.pts) || null;
};

// ─── Générateur d'ID Utilisateur Unique (6 caractères alphanumériques) ─────────
window.generateAstaUserCode = function() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

window.getAstaUserCode = function(userObj) {
  if (userObj && userObj.user_code) return userObj.user_code;
  try {
    let saved = localStorage.getItem('asta_user_code');
    if (!saved) {
      saved = window.generateAstaUserCode();
      localStorage.setItem('asta_user_code', saved);
    }
    return saved;
  } catch (_) {
    return 'ASTA69';
  }
};

// ─── Échappement HTML (protection XSS) ──────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Client Supabase ─────────────────────────────────────────────────────────
let _sb = null;
async function getSB() {
  if (_sb) return _sb;
  if (!window.supabase?.createClient) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  return _sb;
}

// ─── Profil depuis Supabase ───────────────────────────────────────────────────
async function fetchProfile(userId) {
  const sb = await getSB();
  const { data } = await sb.from('profiles').select('*').eq('id', userId).single();
  return data;
}

// ─── Mise à jour de la top-bar ────────────────────────────────────────────────
function updateTopBar(user, profile) {
  const authDiv = document.querySelector('.top-bar-auth');
  if (!authDiv) return;

  const legacyUser = document.getElementById('topBarUser');
  if (legacyUser) legacyUser.style.display = 'none';
  authDiv.style.display = '';

  const vip = window.getVipLevel(profile?.points || 0);
  const roleInfo = window.getRoleInfo(profile?.role || 'client');
  const isStaff = ['helper', 'employe', 'administrateur', 'manager', 'directeur'].includes(profile?.role);
  const fullName = ((profile?.prenom || '') + ' ' + (profile?.nom || '')).trim();
  const nom = escHtml(fullName || profile?.prenom || profile?.nom || user?.email?.split('@')[0] || 'Utilisateur');
  const shortNom = nom.length > 16 ? nom.substring(0, 14) + '…' : nom;
  const avatarUrl = profile?.avatar_url || profile?.avatar;
  const avatar = avatarUrl
    ? `<img src="${escHtml(avatarUrl)}" alt="avatar" style="width:26px;height:26px;border-radius:50%;object-fit:cover;">`
    : `<span class="user-avatar-initials">${nom.charAt(0).toUpperCase()}</span>`;

  // Badge top-bar : rôle pour le staff, VIP pour les membres normaux
  const topBadgeText = isStaff ? roleInfo.label : (vip.badge || vip.label);
  const topBadgeColor = isStaff ? roleInfo.color : vip.color;
  const topBadgeBg = isStaff ? roleInfo.bg : (vip.bg || 'rgba(255,255,255,.12)');

  authDiv.innerHTML = `
    <div class="user-menu-wrapper">
      <button class="user-menu-trigger" id="userMenuTrigger" type="button">
        <div class="user-avatar-small">${avatar}</div>
        <span class="user-menu-name">${shortNom}</span>
        <span class="vip-badge-mini" style="background:${topBadgeBg};color:${topBadgeColor};border:1px solid ${topBadgeColor}55;">${topBadgeText}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="user-dropdown" id="userDropdown">
        <div class="user-dropdown-header">
          <div class="user-dropdown-avatar">${avatar}</div>
          <div>
            <div class="user-dropdown-name">${nom}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap;">
              <span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:12px;font-size:.7rem;font-weight:700;background:${roleInfo.bg};color:${roleInfo.color};border:1px solid ${roleInfo.color}44;">
                ${roleInfo.icon} ${roleInfo.label}
              </span>
              ${!isStaff ? `<a href="profile.html" class="user-dropdown-vip" style="color:${vip.color}">${vip.icon} ${vip.label} →</a>` : ''}
            </div>
          </div>
        </div>
        <div class="user-dropdown-stats">
          <div class="stat-item">
            <span class="stat-value" id="dropdownPointsStat">${profile?.points || 0}</span>
            <span class="stat-label">🪙 Points</span>
          </div>
          <div class="stat-item" style="cursor:pointer;" onclick="window.location.href='profile.html#wallet'">
            <span class="stat-value" id="dropdownWalletStat">$${(()=>{try{return parseFloat(localStorage.getItem('asta_wallet_balance')||'0').toFixed(2)}catch(_){return'0.00'}})()} </span>
            <span class="stat-label">💰 Portefeuille</span>
          </div>
        </div>
        <div class="user-dropdown-menu">
          ${isStaff ? `
          <a href="Dashboard/admin-login.html" class="user-dropdown-item" style="color:#f59e0b;font-weight:700;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Dashboard Admin
          </a>` : ''}
          <a href="profile.html" class="user-dropdown-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Mon profil
          </a>
          <a href="profile.html#commandes" class="user-dropdown-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            Historique des achats
          </a>
          <a href="profile.html#vip" class="user-dropdown-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Niveau VIP
          </a>
          <a href="profile.html#coupons" class="user-dropdown-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
            Mes coupons
          </a>
          <a href="contact.html" class="user-dropdown-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Centre d'aide
          </a>
        </div>
        <button class="user-dropdown-logout" id="dropdownLogoutBtn" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Déconnexion
        </button>
      </div>
    </div>`;

  // Toggle dropdown
  const trigger = document.getElementById('userMenuTrigger');
  const dropdown = document.getElementById('userDropdown');
  if (trigger && dropdown) {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });
    document.addEventListener('click', () => dropdown.classList.remove('open'));
  }

  // Logout
  document.getElementById('dropdownLogoutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.AstaAuth.logout();
  });
}

function renderLoggedOutTopBar() {
  const authDiv = document.querySelector('.top-bar-auth');
  if (!authDiv) return;

  const legacyUser = document.getElementById('topBarUser');
  if (legacyUser) legacyUser.style.display = 'none';
  authDiv.style.display = '';

  authDiv.innerHTML = `
    <a href="#" class="auth-link login-btn">Connexion</a>
    <a href="#" class="auth-link register-btn">S'inscrire</a>
  `;

  authDiv.querySelector('.login-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (window.openAuth) {
      window.openAuth('login');
    } else {
      const modal = document.getElementById('authModal');
      if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    }
  });

  authDiv.querySelector('.register-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (window.openAuth) {
      window.openAuth('register');
    } else {
      const modal = document.getElementById('authModal');
      if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    }
  });
}

// Global fallback for openAuth
if (!window.openAuth) {
  window.openAuth = function(tab = 'login') {
    const modal = document.getElementById('authModal');
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      const targetTab = tab || 'login';
      modal.querySelectorAll('.auth-tab-btn')?.forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === targetTab));
      modal.querySelectorAll('.auth-column')?.forEach(c => c.classList.toggle('active', c.id === 'tab-' + targetTab));
    } else {
      window.location.href = 'index.html?auth=1';
    }
  };
}

// ─── Mise à jour du solde wallet dans le dropdown ────────────────────────────
async function refreshDropdownWallet(token) {
  if (!token) return;
  try {
    const res = await fetch('/api/wallet/me', { headers: { 'Authorization': 'Bearer ' + token } });
    if (!res.ok) return;
    const data = await res.json();
    if (data?.balance !== undefined) {
      const v = parseFloat(data.balance || 0).toFixed(2);
      localStorage.setItem('asta_wallet_balance', v);
      const el = document.getElementById('dropdownWalletStat');
      if (el) el.textContent = '$' + v;
    }
  } catch (_) {}
}

// ─── Notifications commande temps réel ───────────────────────────────────────
let _clientSSE = null;
function startClientNotifications(email) {
  if (_clientSSE) { _clientSSE.close(); _clientSSE = null; }
  if (!email) return;

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  const url = `/api/events/client?email=${encodeURIComponent(email)}`;
  _clientSSE = new EventSource(url);

  _clientSSE.addEventListener('commande_livree', (e) => {
    try {
      const data = JSON.parse(e.data);
      const title = '🎮 Commande livrée !';
      const body = `${data.produit_nom || 'Votre produit'} — ${data.denom_label || ''} est prêt !`;
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.svg', tag: 'order-' + data.id });
      }
      showClientToast(title, body);
    } catch (_) {}
  });
}

function showClientToast(title, body) {
  const existing = document.getElementById('asta-client-toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.id = 'asta-client-toast';
  t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#0f1923;border:1.5px solid #00b67a;border-radius:14px;padding:14px 18px;z-index:99999;color:#fff;font-family:Roboto,sans-serif;font-size:14px;max-width:320px;box-shadow:0 8px 32px rgba(0,0,0,.4);display:flex;flex-direction:column;gap:4px;animation:slideInToast .3s ease;';
  const titleEl = document.createElement('div');
  titleEl.style.cssText = 'font-weight:700;color:#00b67a;font-size:15px;';
  titleEl.textContent = title;
  const bodyEl = document.createElement('div');
  bodyEl.style.cssText = 'color:#b0b8c8;font-size:13px;';
  bodyEl.textContent = body;
  t.appendChild(titleEl);
  t.appendChild(bodyEl);
  if (!document.querySelector('#asta-toast-css')) {
    const s = document.createElement('style');
    s.id = 'asta-toast-css';
    s.textContent = '@keyframes slideInToast{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}';
    document.head.appendChild(s);
  }
  document.body.appendChild(t);
  setTimeout(() => { t.style.animation = 'slideInToast .3s ease reverse'; setTimeout(() => t.remove(), 300); }, 5000);
}

// ─── Mise à jour boutons mobile nav ──────────────────────────────────────────
function updateMobileNav(isLoggedIn) {
  const mobileLogin = document.querySelector('.nav-links .login-btn')?.parentElement;
  if (!mobileLogin) return;
  if (isLoggedIn) {
    mobileLogin.innerHTML = `<a href="profile.html">Mon Compte</a>`;
  }
}

// ─── API publique ─────────────────────────────────────────────────────────────
window.AstaAuth = {

  async init() {
    let user = null;
    let profile = null;

    try {
      const sb = await getSB();
      const { data: { session } } = await sb.auth.getSession();
      if (session?.user) {
        user = session.user;
        profile = await fetchProfile(session.user.id);
        if (session.access_token) refreshDropdownWallet(session.access_token);
      }
    } catch (e) {
      console.warn('Supabase session check error:', e);
    }

    if (!user) {
      try {
        const token = localStorage.getItem('as_token');
        const userStr = localStorage.getItem('as_user');
        if (token && userStr) {
          const u = JSON.parse(userStr);
          user = { id: u.id || 'admin', email: u.email || 'admin@asta.com' };
          profile = {
            nom: u.nom || '',
            prenom: u.prenom || '',
            avatar: u.avatar || '',
            role: u.role || 'administrateur',
            points: u.points || 0
          };
        }
      } catch (_) {}
    }

    if (user && profile) {
      updateTopBar(user, profile);
      updateMobileNav(true);
      if (user.email) startClientNotifications(user.email);
    } else {
      renderLoggedOutTopBar();
      updateMobileNav(false);
    }

    try {
      const sb = await getSB();
      sb.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const profile = await fetchProfile(session.user.id);
          updateTopBar(session.user, profile);
          updateMobileNav(true);
          startClientNotifications(session.user.email);
          if (session.access_token) refreshDropdownWallet(session.access_token);
        } else if (event === 'SIGNED_OUT') {
          try {
            localStorage.removeItem('as_token');
            localStorage.removeItem('as_user');
            localStorage.removeItem('as_perms');
            localStorage.removeItem('as_level');
            localStorage.removeItem('asta_wallet_balance');
          } catch (_) {}
          renderLoggedOutTopBar();
          updateMobileNav(false);
        }
      });
    } catch (_) {}
  },

  async login(email, password) {
    const sb = await getSB();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async register(email, password, nom, prenom) {
    let res;
    try {
      res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nom, prenom })
      });
    } catch (_networkErr) {
      throw new Error('Problème de connexion réseau. Vérifiez votre connexion internet.');
    }
    let json;
    try {
      const text = await res.text();
      json = text ? JSON.parse(text) : {};
    } catch (_) {
      throw new Error(res.ok
        ? 'Erreur de communication avec le serveur. Réessayez.'
        : `Erreur serveur (${res.status}). Réessayez dans quelques instants.`);
    }
    if (!res.ok) {
      const errMsg = json.error || json.message || `Erreur serveur (${res.status}). Réessayez dans quelques instants.`;
      throw new Error(errMsg);
    }
    const sb = await getSB();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      window.location.href = 'index.html?registered=1';
      return null;
    }
    return data;
  },

  async resendConfirmation(email) {
    const sb = await getSB();
    const { error } = await sb.auth.resend({ type: 'signup', email });
    if (error) throw error;
  },

  async resetPassword(email) {
    const sb = await getSB();
    const redirectTo = window.location.origin + '/reset-password.html';
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  },

  async logout() {
    try {
      const sb = await getSB();
      await sb.auth.signOut();
    } catch (e) {
      console.warn('SignOut error:', e);
    }

    try {
      localStorage.removeItem('as_token');
      localStorage.removeItem('as_user');
      localStorage.removeItem('as_perms');
      localStorage.removeItem('as_level');
      localStorage.removeItem('asta_wallet_balance');
      localStorage.removeItem('asta_cart');
      localStorage.removeItem('asta_user_code');
    } catch (_) {}

    renderLoggedOutTopBar();
    updateMobileNav(false);
    window.location.href = 'index.html';
  },

  async getSession() {
    const sb = await getSB();
    const { data: { session } } = await sb.auth.getSession();
    return session;
  },

  async getProfile() {
    const sb = await getSB();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    return fetchProfile(session.user.id);
  },

  async updateProfile(updates) {
    const sb = await getSB();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error('Non connecté');
    const { data, error } = await sb.from('profiles').update(updates).eq('id', session.user.id).select().single();
    if (error) throw error;
    return data;
  },

  async updatePassword(newPassword) {
    const sb = await getSB();
    const { error } = await sb.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  async uploadAvatar(file) {
    const sb = await getSB();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error('Non connecté');
    const ext = file.name.split('.').pop();
    const path = `avatars/${session.user.id}.${ext}`;
    const { error: upErr } = await sb.storage.from('avatars').upload(path, file, { upsert: true });
    if (upErr) throw upErr;
    const { data: { publicUrl } } = sb.storage.from('avatars').getPublicUrl(path);
    await this.updateProfile({ avatar_url: publicUrl });
    return publicUrl;
  },

  VIP_LEVELS: window.VIP_LEVELS,
  getVipLevel: window.getVipLevel,
  getNextVipLevel: window.getNextVipLevel
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.AstaAuth.init());
} else {
  window.AstaAuth.init();
}

