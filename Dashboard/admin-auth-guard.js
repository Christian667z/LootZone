/**
 * ===================================================================
 * LootZone - Guard de Navigation Dashboard Admin (admin-auth-guard.js)
 * Vérifie la session active & le rôle (admin/staff) sur chaque page
 * ===================================================================
 */

(function () {
    'use strict';

    // ── 1. CONFIGURATION & CONSTANTES ──────────────────────────────────
    const DEFAULT_SUPABASE_URL = 'https://bdezshjorwdxzojuecja.supabase.co';
    const DEFAULT_SUPABASE_ANON = 'sb_publishable_PDxfwtviufPwC92pVHdNaA_G01ZE50h';

    const API_BASE = (window.location.protocol === 'file:')
        ? 'http://localhost:3000'
        : window.location.origin;

    // ── 2. ÉCRAN DE PROTECTION ANTI-FLICKERING ─────────────────────────
    // Masque immédiatement le contenu sensible avant la validation de la session
    const guardStyle = document.createElement('style');
    guardStyle.id = 'admin-guard-style';
    guardStyle.textContent = `
        #admin-guard-overlay {
            position: fixed;
            inset: 0;
            background: #0d0b18;
            z-index: 999999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-family: 'Roboto', sans-serif;
            color: #ffffff;
            transition: opacity 0.3s ease;
        }
        .guard-spinner {
            width: 36px;
            height: 36px;
            border: 3px solid rgba(124, 58, 237, 0.2);
            border-top-color: #7c3aed;
            border-radius: 50%;
            animation: guardSpin 0.7s linear infinite;
            margin-bottom: 16px;
        }
        .guard-text {
            font-size: 13px;
            letter-spacing: 0.5px;
            color: #9ca3af;
        }
        @keyframes guardSpin {
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(guardStyle);

    let overlay = document.createElement('div');
    overlay.id = 'admin-guard-overlay';
    overlay.innerHTML = `
        <div class="guard-spinner"></div>
        <div class="guard-text">Vérification des autorisations Staff...</div>
    `;
    if (document.body) {
        document.body.appendChild(overlay);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            if (overlay && !document.getElementById('admin-guard-overlay')) {
                document.body.appendChild(overlay);
            }
        });
    }

    function removeOverlay() {
        const el = document.getElementById('admin-guard-overlay');
        if (el) {
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 250);
        }
    }

    /**
     * Calcule le chemin relatif vers admin-login.html
     */
    function getLoginPath() {
        return window.location.pathname.includes('/Dashboard/') ? 'admin-login.html' : 'Dashboard/admin-login.html';
    }

    /**
     * Calcule le chemin relatif vers la page d'accueil client
     */
    function getHomePath() {
        return window.location.pathname.includes('/Dashboard/') ? '../index.html' : 'index.html';
    }

    // ── 3. CHARGEMENT & INITIALISATION DE SUPABASE ────────────────────
    async function getSupabase() {
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            const url = window.SUPABASE_URL || DEFAULT_SUPABASE_URL;
            const key = window.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON;
            return window.supabase.createClient(url, key);
        }

        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
            script.onload = () => {
                if (window.supabase && typeof window.supabase.createClient === 'function') {
                    const url = window.SUPABASE_URL || DEFAULT_SUPABASE_URL;
                    const key = window.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON;
                    resolve(window.supabase.createClient(url, key));
                } else {
                    resolve(null);
                }
            };
            script.onerror = () => resolve(null);
            document.head.appendChild(script);
        });
    }

    // ── 4. LOGIQUE PRINCIPALE DU GUARD ────────────────────────────────
    async function checkAuthGuard() {
        try {
            const client = await getSupabase();

            // CAS 1 : Client Supabase disponible
            if (client) {
                // 1. Vérification de la session active
                const { data: sessionData, error: sessionError } = await client.auth.getSession();
                const session = sessionData?.session;

                if (sessionError || !session || !session.user) {
                    // Vérifier si un token Démo est stocké en local (fallback pour test)
                    const localToken = localStorage.getItem('as_token');
                    if (localToken && localToken.startsWith('demo-token-')) {
                        console.info('[AdminAuthGuard] Mode Démo actif via localStorage.');
                        removeOverlay();
                        return;
                    }

                    console.warn('[AdminAuthGuard] Aucune session active -> Redirection vers admin-login.html');
                    window.location.replace(getLoginPath() + '?expired=1');
                    return;
                }

                const user = session.user;

                // 2. Requête dans public.profiles pour vérifier le rôle RBAC
                const { data: profile, error: profileError } = await client
                    .from('profiles')
                    .select('id, email, full_name, role, avatar_url')
                    .eq('id', user.id)
                    .single();

                const role = profile?.role;
                const isAuthorizedStaff = role === 'admin' || role === 'staff' || role === 'super_admin';

                // 3. Contrôle d'accès strict :
                // Si l'utilisateur est un client ou n'a pas de rôle staff -> Déconnexion et redirection accueil
                if (!isAuthorizedStaff) {
                    console.warn(`[AdminAuthGuard] Accès refusé pour l'utilisateur ${user.email} avec rôle '${role}'.`);
                    await client.auth.signOut();
                    localStorage.removeItem('as_token');
                    localStorage.removeItem('as_user');
                    localStorage.removeItem('as_perms');
                    localStorage.removeItem('as_level');

                    alert("Accès refusé : Vous n'avez pas les autorisations nécessaires pour accéder à l'administration.");
                    window.location.replace(getHomePath());
                    return;
                }

                // 4. Utilisateur autorisé : Exposer les informations globalement
                window.AdminAuthGuard = {
                    user,
                    profile,
                    role,
                    token: session.access_token,
                    async logout() {
                        if (client) await client.auth.signOut();
                        localStorage.removeItem('as_token');
                        localStorage.removeItem('as_user');
                        localStorage.removeItem('as_perms');
                        localStorage.removeItem('as_level');
                        window.location.href = getLoginPath();
                    }
                };

                // Mettre à jour l'interface utilisateur (sidebar, nom, badge) si disponibles
                updateStaffUI(user, profile);

                // Tout est validé, lever l'écran de protection
                removeOverlay();
                return;
            }

            // CAS 2 : Fallback vers l'API Backend Express (/api/auth/me)
            const token = localStorage.getItem('as_token');
            if (!token) {
                window.location.replace(getLoginPath());
                return;
            }

            const response = await fetch(`${API_BASE}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                localStorage.removeItem('as_token');
                window.location.replace(getLoginPath() + '?expired=1');
                return;
            }

            const data = await response.json();
            const role = data.user?.role;
            const isAuthorizedStaff = role === 'admin' || role === 'staff' || role === 'super_admin' || role === 'directeur';

            if (!isAuthorizedStaff) {
                localStorage.removeItem('as_token');
                alert("Accès refusé : Vous n'avez pas les autorisations nécessaires pour accéder à l'administration.");
                window.location.replace(getHomePath());
                return;
            }

            window.AdminAuthGuard = {
                user: data.user,
                profile: data.user,
                role: role,
                token: token,
                async logout() {
                    localStorage.removeItem('as_token');
                    window.location.href = getLoginPath();
                }
            };

            updateStaffUI(data.user, data.user);
            removeOverlay();

        } catch (err) {
            console.error('[AdminAuthGuard] Erreur inattendue :', err);
            // En cas d'erreur réseau transitoire, laisser le chargement ou rediriger
            removeOverlay();
        }
    }

    /**
     * Met à jour les éléments de la sidebar du dashboard avec les données réelles du staff
     */
    function updateStaffUI(user, profile) {
        const nameEl = document.getElementById('sidebarName');
        const badgeEl = document.getElementById('sidebarRoleBadge');
        const avatarEl = document.getElementById('sidebarAvatar');

        const fullName = profile?.full_name || profile?.nom || user?.email?.split('@')[0] || 'Staff';
        const role = profile?.role || 'staff';

        if (nameEl) nameEl.textContent = fullName;
        if (badgeEl) {
            badgeEl.textContent = role.toUpperCase();
            badgeEl.className = `staff-role-badge badge-${role}`;
        }
        if (avatarEl) {
            avatarEl.textContent = fullName.charAt(0).toUpperCase();
        }
    }

    // ── 5. EXÉCUTION IMMÉDIATE ─────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAuthGuard);
    } else {
        checkAuthGuard();
    }

    // Exposer l'API du Guard
    window.AdminAuthGuard = {
        checkAuth: checkAuthGuard
    };
})();
