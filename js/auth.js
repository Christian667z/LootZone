/**
 * ASTA-SHOPS — Module Auth Client (Supabase)
 * Gestion de l'authentification côté navigateur
 */

const SUPABASE_URL = 'https://bdezshjorwdxzojuecja.supabase.co';
const SUPABASE_ANON = 'sb_publishable_PDxfwtviufPwC92pVHdNaA_G01ZE50h';

// ─── Rôles utilisateur ───────────────────────────────────────────────────────
window.USER_ROLES = {
  client: { label: 'Membre', icon: '👤', color: '#6b7280', bg: 'rgba(107,114,128,.25)' },
  partenaire: { label: 'Partenaire', icon: '🤝', color: '#0ea5e9', bg: 'rgba(14,165,233,.25)' },
  alliance: { label: 'Partenaire Alliance', icon: '🔗', color: '#3b82f6', bg: 'rgba(59,130,246,.25)' },
  recruteur: { label: 'Recruteur', icon: '🎯', color: '#a855f7', bg: 'rgba(168,85,247,.25)' },
  influenceur: { label: 'Influenceur', icon: '🌟', color: '#ec4899', bg: 'rgba(236,72,153,.25)' },
  vendeur: { label: 'Vendeur', icon: '🛒', color: '#f97316', bg: 'rgba(249,115,22,.25)' },
  helper: { label: 'Staff', icon: '🛡️', color: '#14b8a6', bg: 'rgba(20,184,166,.25)' },
  employe: { label: 'LootZone Team', icon: '⭐', color: '#eab308', bg: 'rgba(234,179,8,.25)' },
  admin: { label: 'Administrateur', icon: '⭐', color: '#7c3aed', bg: 'rgba(124,58,237,.25)' },
  administrateur: { label: 'LootZone Team', icon: '⭐', color: '#eab308', bg: 'rgba(234,179,8,.25)' },
  manager: { label: 'LootZone Team', icon: '⭐', color: '#eab308', bg: 'rgba(234,179,8,.25)' },
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
let _sbPromise = null;

async function getSB() {
  if (_sb) return _sb;
  if (_sbPromise) return _sbPromise;

  _sbPromise = (async () => {
    try {
      if (typeof window !== 'undefined' && window._astaSupabase) {
        _sb = window._astaSupabase;
        return _sb;
      }

      if (!window.supabase?.createClient) {
        await new Promise((resolve) => {
          const existing = document.querySelector('script[src*="supabase-js"]');
          if (existing) {
            if (window.supabase?.createClient) return resolve();
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => resolve(), { once: true });
            setTimeout(resolve, 2000);
            return;
          }
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
          s.onload = () => resolve();
          s.onerror = () => resolve();
          document.head.appendChild(s);
          setTimeout(resolve, 3000);
        });
      }

      if (window.supabase?.createClient) {
        _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        });
        window._astaSupabase = _sb;
      }
    } catch (err) {
      console.warn('[AstaAuth] Initialisation Supabase:', err);
    }
    return _sb;
  })();

  const result = await _sbPromise;
  _sbPromise = null;
  return result;
}

// ─── Profil depuis Supabase ───────────────────────────────────────────────────
async function fetchProfile(userId) {
  if (!userId) return null;
  const sb = await getSB();
  if (!sb || typeof sb.from !== 'function') {
    try {
      const stored = localStorage.getItem('as_user') || localStorage.getItem('asta_current_user');
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    return null;
  }

  try {
    const { data } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (data) {
      // Si le profil existe mais qu'il manque nom/prénom/rôle, vérifier la session pour combler
      if (!data.prenom || !data.nom || !data.role) {
        try {
          const { data: { session } } = await sb.auth.getSession();
          if (session?.user?.id === userId && session.user.user_metadata) {
            const meta = session.user.user_metadata;
            const updates = {};
            if (!data.prenom && (meta.prenom || meta.first_name)) {
              updates.prenom = meta.prenom || meta.first_name;
              data.prenom = updates.prenom;
            }
            if (!data.nom && (meta.nom || meta.last_name)) {
              updates.nom = meta.nom || meta.last_name;
              data.nom = updates.nom;
            }
            if ((!data.role || data.role === 'client') && meta.role && meta.role !== 'client') {
              updates.role = meta.role;
              data.role = updates.role;
            }
            if (Object.keys(updates).length > 0) {
              await sb.from('profiles').update(updates).eq('id', userId);
            }
          }
        } catch (_) {}
      }
      return data;
    }
  } catch (err) {
    console.warn('[fetchProfile] Erreur lecture Supabase:', err);
  }

  // Fallback : tentative de récupération / initialisation via metadata session
  try {
    if (sb?.auth?.getSession) {
      const { data: { session } } = await sb.auth.getSession();
      if (session?.user?.id === userId) {
        const meta = session.user.user_metadata || {};
        const fallbackProf = {
          id: userId,
          email: session.user.email,
          prenom: meta.prenom || meta.first_name || session.user.email?.split('@')[0] || 'Membre',
          nom: meta.nom || meta.last_name || '',
          role: meta.role || 'client',
          user_code: meta.user_code || (window.getAstaUserCode ? window.getAstaUserCode() : 'ASTA69'),
          points: 0,
          wallet_balance: 0
        };

        // Tenter d'insérer le profil dans la table
        try {
          await sb.from('profiles').upsert({
            id: userId,
            email: session.user.email,
            prenom: fallbackProf.prenom,
            nom: fallbackProf.nom,
            role: fallbackProf.role,
            user_code: fallbackProf.user_code,
            statut_presence: 'deconnecte'
          }, { onConflict: 'id' });
        } catch (_) {}

        return fallbackProf;
      }
    }
  } catch (_) {}

  return null;
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
  t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#0f1923;border:1.5px solid #a855f7;border-radius:14px;padding:14px 18px;z-index:99999;color:#fff;font-family:Roboto,sans-serif;font-size:14px;max-width:320px;box-shadow:0 8px 32px rgba(0,0,0,.4);display:flex;flex-direction:column;gap:4px;animation:slideInToast .3s ease;';
  const titleEl = document.createElement('div');
  titleEl.style.cssText = 'font-weight:700;color:#a855f7;font-size:15px;';
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

function updateNavAccount(user, profile) {
  const btn = document.getElementById('navAccountBtn');
  if (!btn) return;
  if (user) {
    btn.href = 'profile.html';
    btn.setAttribute('aria-label', 'Mon profil');
    btn.title = 'Mon profil';
    btn.classList.remove('login-btn');
    btn.classList.add('logged-in');
    btn.classList.add('guest-only');
    btn.onclick = null;
    const avatarUrl = profile?.avatar_url || profile?.avatar;
    const displayName = ((profile?.prenom || '') + ' ' + (profile?.nom || '')).trim() || user?.email?.split('@')[0] || 'Profil';
    const initial = displayName.charAt(0).toUpperCase();
    if (avatarUrl) {
      btn.innerHTML = `<img src="${escHtml(avatarUrl)}" alt="Avatar" class="nav-avatar-img"><span class="nav-user-label">${escHtml(displayName)}</span>`;
    } else {
      btn.innerHTML = `<span class="nav-avatar-initial">${initial}</span><span class="nav-user-label">${escHtml(displayName)}</span>`;
    }
  } else {
    btn.href = '#';
    btn.setAttribute('aria-label', 'Log in / Sign up');
    btn.title = 'Log in / Sign up';
    btn.classList.add('login-btn');
    btn.classList.add('guest-only');
    btn.classList.remove('logged-in');
    btn.innerHTML = `<span class="auth-btn-label">Log in / Sign up</span>`;
    btn.onclick = (e) => {
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
    };
  }
}

// ─── Mise à jour dynamique de la visibilité du Header (Supabase Auth) ────────
function updateHeaderAuthState(isLoggedIn, user, profile) {
  const headers = document.querySelectorAll('header.navbar, header');
  headers.forEach(h => {
    if (isLoggedIn) {
      h.classList.add('user-logged-in');
    } else {
      h.classList.remove('user-logged-in');
    }
  });

  if (isLoggedIn) {
    document.body.classList.add('user-logged-in');
  } else {
    document.body.classList.remove('user-logged-in');
  }

  if (isLoggedIn && user) {
    const displayName = ((profile?.prenom || '') + ' ' + (profile?.nom || '')).trim() || user?.email?.split('@')[0] || 'Mon Compte';
    const initial = displayName.charAt(0).toUpperCase();
    const avatarUrl = profile?.avatar_url || profile?.avatar;

    const navUserNames = document.querySelectorAll('#navUserName');
    navUserNames.forEach(el => { el.textContent = displayName; });

    const navUserInitials = document.querySelectorAll('#navUserInitial');
    navUserInitials.forEach(el => { el.textContent = initial; });

    const navUserAvatars = document.querySelectorAll('#navUserAvatar');
    navUserAvatars.forEach(el => {
      if (avatarUrl) {
        el.innerHTML = `<img src="${escHtml(avatarUrl)}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
      } else {
        el.innerHTML = `<span class="user-avatar-initials">${initial}</span>`;
      }
    });

    const dropdownUserNames = document.querySelectorAll('#dropdownUserName');
    dropdownUserNames.forEach(el => { el.textContent = displayName; });

    const dropdownUserEmails = document.querySelectorAll('#dropdownUserEmail');
    dropdownUserEmails.forEach(el => { el.textContent = user.email || ''; });

    const dropdownUserAvatars = document.querySelectorAll('#dropdownUserAvatar');
    dropdownUserAvatars.forEach(el => {
      if (avatarUrl) {
        el.innerHTML = `<img src="${escHtml(avatarUrl)}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
      } else {
        el.innerHTML = `<span>${initial}</span>`;
      }
    });

    setupUserMenuEvents();
  } else {
    const dropdowns = document.querySelectorAll('.user-dropdown');
    dropdowns.forEach(d => d.classList.remove('open'));
  }
}

function setupUserMenuEvents() {
  const triggers = document.querySelectorAll('#userMenuTrigger');
  triggers.forEach((trigger) => {
    if (!trigger.dataset.menuBound) {
      trigger.dataset.menuBound = 'true';
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const wrapper = trigger.closest('.user-menu-wrapper');
        const dropdown = wrapper ? wrapper.querySelector('.user-dropdown') : document.getElementById('userDropdown');
        if (dropdown) {
          dropdown.classList.toggle('open');
        }
      });
    }
  });

  if (!document.body.dataset.userDropdownDocBound) {
    document.body.dataset.userDropdownDocBound = 'true';
    document.addEventListener('click', (e) => {
      const dropdowns = document.querySelectorAll('.user-dropdown');
      dropdowns.forEach(d => {
        if (!d.contains(e.target) && !e.target.closest('#userMenuTrigger')) {
          d.classList.remove('open');
        }
      });
    });
  }

  const logoutBtns = document.querySelectorAll('#dropdownLogoutBtn');
  logoutBtns.forEach(btn => {
    if (!btn.dataset.logoutBound) {
      btn.dataset.logoutBound = 'true';
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.AstaAuth && window.AstaAuth.logout) {
          await window.AstaAuth.logout();
        }
      });
    }
  });
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
      updateNavAccount(user, profile);
      updateHeaderAuthState(true, user, profile);
      updateMobileNav(true);
      if (user.email) startClientNotifications(user.email);
    } else {
      renderLoggedOutTopBar();
      updateNavAccount(null, null);
      updateHeaderAuthState(false, null, null);
      updateMobileNav(false);
    }

    try {
      const sb = await getSB();
      if (sb?.auth) {
        sb.auth.onAuthStateChange(async (event, session) => {
          if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session?.user) {
            const profile = await fetchProfile(session.user.id);
            if (session.access_token && profile && profile.role && profile.role !== 'client') {
              try {
                localStorage.setItem('as_token', session.access_token);
                localStorage.setItem('as_user', JSON.stringify({
                  id: profile.id,
                  email: session.user.email,
                  role: profile.role,
                  nom: profile.nom || '',
                  prenom: profile.prenom || '',
                  avatar: profile.avatar_url || null
                }));
              } catch (_) {}
            }
            updateTopBar(session.user, profile);
            updateNavAccount(session.user, profile);
            updateHeaderAuthState(true, session.user, profile);
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
            updateNavAccount(null, null);
            updateHeaderAuthState(false, null, null);
            updateMobileNav(false);
          }
        });
      }
    } catch (_) {}
  },

  async login(email, password) {
    const sb = await getSB();
    const cleanEmail = (email || '').trim().toLowerCase();
    let authData = null;
    let lastError = null;

    // 1. Tenter la connexion directe Supabase Client
    if (sb?.auth) {
      try {
        const { data, error } = await sb.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) throw error;
        authData = data;
      } catch (err) {
        lastError = err;
      }
    }

    // 2. Si le client Supabase rencontre un problème (ou en cas d'erreur réseau/session), tenter /api/auth/login
    if (!authData) {
      try {
        const resp = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password })
        });
        const json = await resp.json();
        if (resp.ok && json.session) {
          // Synchroniser la session dans le client Supabase
          if (json.session.access_token && json.session.refresh_token) {
            try {
              await sb.auth.setSession({
                access_token: json.session.access_token,
                refresh_token: json.session.refresh_token
              });
            } catch (_) {}
          }
          authData = json;
          lastError = null;
        } else if (resp.status === 403 && json.code === 'email_not_confirmed') {
          const err = new Error('Email not confirmed');
          err.code = 'email_not_confirmed';
          throw err;
        } else if (!resp.ok && !lastError) {
          throw new Error(json.error || 'Identifiants incorrects.');
        }
      } catch (backendErr) {
        if (!lastError || backendErr.message === 'Email not confirmed') {
          lastError = backendErr;
        }
      }
    }

    if (lastError && !authData) {
      throw lastError;
    }

    // Sauvegarder les données de session et rafraîchir l'interface
    if (authData?.user) {
      try {
        let profile = authData.profile || await fetchProfile(authData.user.id);
        if (!profile) {
          const meta = authData.user.user_metadata || {};
          profile = {
            id: authData.user.id,
            email: authData.user.email,
            prenom: meta.prenom || meta.first_name || authData.user.email?.split('@')[0] || 'Membre',
            nom: meta.nom || meta.last_name || '',
            role: meta.role || 'client',
            user_code: meta.user_code || (window.getAstaUserCode ? window.getAstaUserCode() : 'ASTA69'),
            points: 0,
            wallet_balance: 0
          };
        }
        authData.profile = profile;

        const sessionUser = {
          id: profile.id || authData.user.id,
          email: authData.user.email,
          role: profile.role || 'client',
          nom: profile.nom || '',
          prenom: profile.prenom || '',
          avatar: profile.avatar_url || null,
          user_code: profile.user_code || ''
        };

        const token = authData.session?.access_token || authData.token || '';
        if (token) localStorage.setItem('as_token', token);
        localStorage.setItem('as_user', JSON.stringify(sessionUser));
        localStorage.setItem('asta_current_user', JSON.stringify(sessionUser));
        try { sessionStorage.setItem('current_user_profile', JSON.stringify(profile)); } catch (_) {}

        if (profile?.user_code) {
          localStorage.setItem('asta_user_code', profile.user_code);
        }
        if (profile?.wallet_balance !== undefined) {
          localStorage.setItem('asta_wallet_balance', String(profile.wallet_balance));
        }

        updateHeaderAuthState(true, authData.user, profile);
        updateNavAccount(authData.user, profile);
        updateTopBar(authData.user, profile);

        // Notifier les autres modules de la mise à jour de session
        try {
          window.dispatchEvent(new CustomEvent('asta_auth_changed', { detail: { user: authData.user, profile } }));
        } catch (_) {}
      } catch (saveErr) {
        console.warn('[AstaAuth.login] Erreur init session:', saveErr);
      }
    }

    return authData;
  },

  async register(email, password, nom, prenom) {
    const cleanEmail = (email || '').trim().toLowerCase();
    let res;
    try {
      res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password, nom, prenom })
      });
    } catch (_networkErr) {
      // Si le backend est inaccessible, fallback sur Supabase client
      const sb = await getSB();
      if (!sb?.auth) throw new Error('Client d\'authentification indisponible');
      const { data, error } = await sb.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { nom: nom || '', prenom } }
      });
      if (error) throw error;
      return data;
    }

    let json = {};
    try {
      const text = await res.text();
      json = text ? JSON.parse(text) : {};
    } catch (_) {}

    if (!res.ok) {
      const errMsg = json.error || json.message || `Erreur serveur (${res.status}). Réessayez dans quelques instants.`;
      throw new Error(errMsg);
    }

    // Connexion automatique après l'inscription
    const sb = await getSB();
    if (!sb?.auth) return { user: json.user };
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) {
        if (error.message?.toLowerCase().includes('email not confirmed')) {
          const confErr = new Error('Email not confirmed');
          confErr.code = 'email_not_confirmed';
          throw confErr;
        }
        return { user: json.user };
      }
      return data;
    } catch (loginErr) {
      if (loginErr.code === 'email_not_confirmed' || loginErr.message?.toLowerCase().includes('email not confirmed')) {
        throw loginErr;
      }
      return { user: json.user };
    }
  },

  async resendConfirmation(email) {
    const sb = await getSB();
    if (!sb?.auth) throw new Error('Client d\'authentification indisponible');
    const { error } = await sb.auth.resend({ type: 'signup', email });
    if (error) throw error;
  },

  async resetPassword(email) {
    const sb = await getSB();
    if (!sb?.auth) throw new Error('Client d\'authentification indisponible');
    const redirectTo = window.location.origin + '/reset-password.html';
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  },

  async logout() {
    try {
      const sb = await getSB();
      if (sb?.auth) await sb.auth.signOut();
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
    updateNavAccount(null, null);
    updateHeaderAuthState(false, null, null);
    updateMobileNav(false);
    window.location.href = 'index.html';
  },

  async getSession() {
    const sb = await getSB();
    if (!sb?.auth) return null;
    const { data: { session } } = await sb.auth.getSession();
    return session;
  },

  async getProfile() {
    const sb = await getSB();
    if (!sb?.auth) return null;
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) return null;
    return fetchProfile(session.user.id);
  },

  async updateProfile(updates) {
    const sb = await getSB();
    if (!sb?.auth || !sb?.from) throw new Error('Client Supabase non initialisé');
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error('Non connecté');
    const { data, error } = await sb.from('profiles').update(updates).eq('id', session.user.id).select().single();
    if (error) throw error;
    return data;
  },

  async updatePassword(newPassword) {
    const sb = await getSB();
    if (!sb?.auth) throw new Error('Client Supabase non initialisé');
    const { error } = await sb.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  async uploadAvatar(file) {
    const sb = await getSB();
    if (!sb?.auth || !sb?.storage || typeof sb.storage.from !== 'function') throw new Error('Stockage Supabase non disponible');
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

  getClient: getSB,
  getSB: getSB,
  fetchProfile: fetchProfile,

  VIP_LEVELS: window.VIP_LEVELS,
  getVipLevel: window.getVipLevel,
  getNextVipLevel: window.getNextVipLevel
};

window.LootZoneAuth = window.AstaAuth;
window.generateLootZoneUserCode = window.generateAstaUserCode;
window.getLootZoneUserCode = window.getAstaUserCode;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.AstaAuth.init());
} else {
  window.AstaAuth.init();
}

