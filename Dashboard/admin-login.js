/**
 * ===================================================================
 * LootZone - Script de Connexion Dashboard Staff (admin-login.js)
 * RBAC Supabase Client Auth & Contrôle d'Accès par Rôle
 * ===================================================================
 */

(function () {
    'use strict';

    // ── 1. CONFIGURATION SUPABASE ──────────────────────────────────────
    const DEFAULT_SUPABASE_URL = 'https://bdezshjorwdxzojuecja.supabase.co';
    const DEFAULT_SUPABASE_ANON = 'sb_publishable_PDxfwtviufPwC92pVHdNaA_G01ZE50h';

    const API_BASE = (window.location.protocol === 'file:')
        ? 'http://localhost:3000'
        : window.location.origin;

    // ── 2. UTILITAIRES D'AFFICHAGE & UI ────────────────────────────────
    function showAlert(message, type = 'error') {
        const alertBox = document.getElementById('alertBox');
        if (!alertBox) return;

        alertBox.className = `alert ${type}`;
        alertBox.textContent = message;
        alertBox.style.display = 'block';
    }

    function clearAlert() {
        const alertBox = document.getElementById('alertBox');
        if (alertBox) {
            alertBox.className = 'alert';
            alertBox.textContent = '';
            alertBox.style.display = 'none';
        }
    }

    function setButtonLoading(isLoading) {
        const btn = document.getElementById('btnLogin');
        if (!btn) return;

        if (isLoading) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Connexion en cours...';
        } else {
            btn.disabled = false;
            btn.innerHTML = 'Se connecter';
        }
    }

    /**
     * Calcule l'URL de redirection sécurisée vers le Dashboard
     */
    function getDashboardRedirectUrl() {
        const path = window.location.pathname;
        if (path.includes('/Dashboard/') || path.includes('/admin/')) {
            return 'dashboard.html';
        }
        return 'Dashboard/dashboard.html';
    }

    // ── 3. VÉRIFICATION DE SESSION PRÉALABLE ───────────────────────────
    async function checkExistingSession() {
        const client = await initSupabase();
        if (!client) return;

        try {
            const { data } = await client.auth.getSession();
            const session = data?.session;
            if (session?.user) {
                // Vérifier si le profil a bien le rôle staff/admin
                const { data: profile } = await client
                    .from('profiles')
                    .select('id, email, full_name, role')
                    .eq('id', session.user.id)
                    .single();

                const role = profile?.role;
                const isStaff = ['admin', 'administrateur', 'staff', 'super_admin', 'directeur', 'manager', 'employe', 'helper'].includes(role);
                if (profile && isStaff) {
                    if (session.access_token) localStorage.setItem('as_token', session.access_token);
                    localStorage.setItem('as_user', JSON.stringify({ ...session.user, ...profile }));
                    showAlert('Session active détectée. Redirection vers l\'administration...', 'success');
                    setTimeout(() => {
                        window.location.href = getDashboardRedirectUrl();
                    }, 600);
                }
            }
        } catch (_) {
            // Ignorer les erreurs d'initialisation en arrière-plan
        }
    }

    // ── 4. LOGIQUE PRINCIPALE DE CONNEXION STAFF ───────────────────────
    async function handleLoginSubmit(event) {
        event.preventDefault();
        clearAlert();

        const emailInput = document.getElementById('email');
        const passInput = document.getElementById('password');

        const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
        const password = passInput ? passInput.value : '';

        if (!email || !password) {
            showAlert('Veuillez renseigner votre adresse email et votre mot de passe.', 'error');
            return;
        }

        setButtonLoading(true);

        try {
            // CAS 2 : Fallback vers l'API Backend Express (/api/auth/admin-login)
            // Utilisé si le client JS direct est inaccessible ou en mode serveur proxy
            const response = await fetch(`${API_BASE}/api/auth/admin-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Accès refusé ou identifiants invalides.');
            }

            if (!result.isStaff || result.user?.role === 'client') {
                throw new Error("Accès refusé : Vous n'avez pas les autorisations nécessaires pour accéder à l'administration.");
            }

            localStorage.setItem('as_token', result.token);
            localStorage.setItem('as_user', JSON.stringify(result.user));
            if (result.sidebarPerms) localStorage.setItem('as_perms', JSON.stringify(result.sidebarPerms));
            if (result.roleLevel) localStorage.setItem('as_level', result.roleLevel);

            showAlert(`Connexion réussie ! Redirection...`, 'success');
            setTimeout(() => {
                window.location.href = result.redirectUrl || getDashboardRedirectUrl();
            }, 800);

        } catch (err) {
            console.error('[AdminLogin] Erreur :', err);
            showAlert(err.message || 'Une erreur est survenue lors de la connexion.', 'error');
            setButtonLoading(false);
        }
    }

    // ── 5. INITIALISATION DES ÉVÉNEMENTS ────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('loginForm');
        if (form) {
            form.addEventListener('submit', handleLoginSubmit);
        }

        // Vérifier si un message d'expiration est passé dans l'URL
        const params = new URLSearchParams(window.location.search);
        if (params.get('expired') === '1') {
            showAlert('Votre session a expiré. Veuillez vous reconnecter.', 'error');
        } else if (params.get('unauthorized') === '1') {
            showAlert("Accès refusé : Vous n'avez pas les autorisations nécessaires pour accéder à l'administration.", 'error');
        } else {
            // Vérification de la session en arrière-plan
            checkExistingSession();
        }
    });

    // Exposer l'objet global
    window.AdminLogin = {
        initSupabase,
        handleLoginSubmit
    };
})();
