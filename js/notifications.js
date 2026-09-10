/**
 * LootZone - Gestionnaire Universel des Notifications & Pastille Rouge
 * 
 * RÈGLE FONDAMENTALE :
 * - La pastille rouge (`.notif-badge-dot` / `#headerNotifDot`) n'est rendue
 *   STRICTEMENT QUE SI l'utilisateur actuel possède des messages de notification
 *   non lus dans la base de données de son compte (commandes, recharges, codes livrés, alertes compte).
 * - Si aucun utilisateur n'est connecté, ou s'il a 0 notification non lue dans sa base de données de compte,
 *   la pastille rouge est totalement masquée (display: none).
 */

(function () {
    const STORAGE_KEY_READ_PREFIX = 'lootzone_read_notifs_';
    const STORAGE_KEY_READ_LEGACY = 'lootzone_read_notifications_v1';
    let cachedNotifications = null;
    let isChecking = false;
    let previousUnreadAccountCount = null;
    let shakeTimeoutId = null;

    /**
     * Déclenche une secousse subtile de l'icône de cloche de notification (CSS keyframes)
     * pour attirer l'attention de l'utilisateur lors de la réception d'un nouveau message.
     */
    function triggerBellShake() {
        const btns = document.querySelectorAll('#headerNotifBtn, .notif-btn');
        const svgs = document.querySelectorAll('#headerNotifBtn svg, .notif-bell-icon, .notif-btn svg');

        btns.forEach(btn => {
            btn.classList.remove('shake-bell');
            btn.classList.remove('has-new-alert');
            // Force reflow pour relancer l'animation CSS keyframes
            void btn.offsetWidth;
            btn.classList.add('shake-bell');
            btn.classList.add('has-new-alert');
        });

        svgs.forEach(svg => {
            svg.classList.remove('notif-bell-shake');
            void svg.offsetWidth;
            svg.classList.add('notif-bell-shake');
        });

        if (shakeTimeoutId) clearTimeout(shakeTimeoutId);
        shakeTimeoutId = setTimeout(() => {
            btns.forEach(btn => {
                btn.classList.remove('shake-bell');
                btn.classList.remove('has-new-alert');
            });
            svgs.forEach(svg => svg.classList.remove('notif-bell-shake'));
        }, 1100);
    }

    /**
     * Récupère la clé de stockage des IDs lus pour un utilisateur donné
     */
    function getStorageKey(userEmail) {
        if (userEmail && typeof userEmail === 'string') {
            return STORAGE_KEY_READ_PREFIX + encodeURIComponent(userEmail.trim().toLowerCase());
        }
        return STORAGE_KEY_READ_LEGACY;
    }

    /**
     * Récupère la liste des IDs de notifications déjà lues par l'utilisateur
     */
    function getReadIds(userEmail) {
        try {
            const key = getStorageKey(userEmail);
            const rawUser = localStorage.getItem(key);
            const userList = rawUser ? JSON.parse(rawUser) : [];

            // Fusionner avec la clé legacy si présente pour ne pas perdre l'historique
            const rawLegacy = localStorage.getItem(STORAGE_KEY_READ_LEGACY);
            const legacyList = rawLegacy ? JSON.parse(rawLegacy) : [];

            return Array.from(new Set([...userList, ...legacyList]));
        } catch (_) {
            return [];
        }
    }

    /**
     * Marque un ID comme lu localement
     */
    function addReadId(id, userEmail) {
        if (!id) return;
        const key = getStorageKey(userEmail);
        const list = getReadIds(userEmail);
        if (!list.includes(id)) {
            list.push(id);
            try {
                localStorage.setItem(key, JSON.stringify(list));
                localStorage.setItem(STORAGE_KEY_READ_LEGACY, JSON.stringify(list));
            } catch (_) {}
        }
        updateBadgeFromLocal();
    }

    /**
     * Marque un ensemble d'IDs comme lus localement
     */
    function addAllReadIds(ids, userEmail) {
        if (!Array.isArray(ids) || ids.length === 0) return;
        const key = getStorageKey(userEmail);
        const current = new Set(getReadIds(userEmail));
        ids.forEach(i => current.add(i));
        const list = Array.from(current);
        try {
            localStorage.setItem(key, JSON.stringify(list));
            localStorage.setItem(STORAGE_KEY_READ_LEGACY, JSON.stringify(list));
        } catch (_) {}
        updateBadgeFromLocal();
    }

    /**
     * Résout de manière synchrone l'utilisateur stocké dans le cache local
     */
    function getCurrentUser() {
        try {
            const str = localStorage.getItem('as_user') || localStorage.getItem('asta_current_user');
            if (str) {
                const parsed = JSON.parse(str);
                if (parsed && (parsed.email || parsed.id)) return parsed;
            }
        } catch (_) {}
        return null;
    }

    /**
     * Résout de manière asynchrone et complète l'utilisateur actuel authentifié
     * en interrogeant Supabase et le stockage local
     */
    async function resolveCurrentUser() {
        // 1. Essai via window.AstaAuth ou window.LootZoneAuth
        try {
            const authModule = window.LootZoneAuth || window.AstaAuth;
            if (authModule && typeof authModule.getSession === 'function') {
                const session = await authModule.getSession();
                if (session?.user) {
                    return {
                        id: session.user.id,
                        email: session.user.email?.toLowerCase(),
                        token: session.access_token || localStorage.getItem('as_token')
                    };
                }
            }
        } catch (_) {}

        // 2. Essai via le client Supabase global s'il existe
        try {
            const sb = window._astaSupabase || window.supabaseClient;
            if (sb?.auth && typeof sb.auth.getSession === 'function') {
                const { data: { session } } = await sb.auth.getSession();
                if (session?.user) {
                    return {
                        id: session.user.id,
                        email: session.user.email?.toLowerCase(),
                        token: session.access_token || localStorage.getItem('as_token')
                    };
                }
            }
        } catch (_) {}

        // 3. Essai via localStorage (as_user / asta_current_user)
        try {
            const localUser = getCurrentUser();
            if (localUser) {
                return {
                    id: localUser.id || null,
                    email: (localUser.email || '').toLowerCase(),
                    token: localStorage.getItem('as_token') || null
                };
            }
        } catch (_) {}

        // 4. Essai via les tokens Supabase natifs dans localStorage (sb-*-auth-token)
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
                    const sbVal = JSON.parse(localStorage.getItem(k));
                    if (sbVal?.user?.email) {
                        return {
                            id: sbVal.user.id,
                            email: sbVal.user.email.toLowerCase(),
                            token: sbVal.access_token || null
                        };
                    }
                }
            }
        } catch (_) {}

        return null;
    }

    function getAuthToken() {
        return localStorage.getItem('as_token') || null;
    }

    /**
     * Contrôle d'affichage strict de la pastille rouge (notif-badge-dot)
     * 
     * @param {boolean} shouldRender - True si et seulement si l'utilisateur a des messages non lus en base
     * @param {number} count - Nombre de messages non lus
     */
    function renderBadgeDot(shouldRender, count = 0) {
        const dots = document.querySelectorAll('#headerNotifDot, .notif-badge-dot');
        const badges = document.querySelectorAll('.notif-badge');
        const btns = document.querySelectorAll('#headerNotifBtn, .notif-btn');
        const sideBadge = document.getElementById('sideUnreadBadge');

        if (shouldRender && count > 0) {
            // Afficher la pastille rouge
            dots.forEach(dot => {
                dot.classList.add('has-unread');
                dot.classList.remove('hidden');
                dot.style.setProperty('display', 'block', 'important');
                dot.style.visibility = 'visible';
                dot.style.opacity = '1';
            });
            badges.forEach(b => {
                b.textContent = count > 99 ? '99+' : count;
                b.classList.add('has-unread');
                b.classList.remove('hidden');
                b.style.display = 'flex';
            });
            btns.forEach(btn => {
                btn.classList.add('has-unread');
            });
            if (sideBadge) {
                sideBadge.textContent = count > 99 ? '99+' : count;
                sideBadge.style.display = 'inline-block';
            }
        } else {
            // Masquer complètement la pastille rouge
            dots.forEach(dot => {
                dot.classList.remove('has-unread');
                dot.classList.remove('active');
                dot.classList.add('hidden');
                dot.style.setProperty('display', 'none', 'important');
                dot.style.visibility = 'hidden';
                dot.style.opacity = '0';
            });
            badges.forEach(b => {
                b.classList.remove('has-unread');
                b.classList.add('hidden');
                b.style.display = 'none';
            });
            btns.forEach(btn => {
                btn.classList.remove('has-unread');
            });
            if (sideBadge) {
                sideBadge.style.display = 'none';
            }
        }
    }

    /**
     * Alias de compatibilité pour setBadgeVisibility
     */
    function setBadgeVisibility(unreadCount) {
        const count = Math.max(0, parseInt(unreadCount, 10) || 0);
        renderBadgeDot(count > 0, count);
    }

    /**
     * LOGIC CHECK PRINCIPALE :
     * Vérifie directement si l'utilisateur actuel a des messages de notification non lus
     * dans la base de données de son compte (Supabase `commandes`, `notifications`, recharges).
     * 
     * Ne rend la pastille rouge QUE si cette condition est vraie.
     */
    async function checkUserAccountUnreadNotifications() {
        if (isChecking) return cachedNotifications;
        isChecking = true;

        try {
            // 1. Vérifier si un utilisateur est connecté
            const user = await resolveCurrentUser();

            // RÈGLE : Aucun utilisateur connecté -> Aucun compte -> Pas de pastille rouge !
            if (!user || (!user.email && !user.id)) {
                cachedNotifications = { trade: [], games: [], system: [] };
                renderBadgeDot(false, 0);
                return { hasUnread: false, unreadCount: 0, trade: [] };
            }

            const readIds = new Set(getReadIds(user.email));
            let unreadAccountCount = 0;
            let accountTradeNotifications = [];
            let fetchedFromApi = false;

            // 2. Interroger l'API backend connectée à Supabase
            try {
                const headers = {};
                if (user.token) headers['Authorization'] = `Bearer ${user.token}`;

                const url = '/api/notifications/me?email=' + encodeURIComponent(user.email);
                const res = await fetch(url, { headers });

                if (res.ok) {
                    const json = await res.json();
                    const rawTrade = json.data?.trade || [];

                    // Les messages du compte en base de données sont sous la catégorie trade (commandes, recharges, messages ciblés)
                    accountTradeNotifications = rawTrade.map(n => ({
                        ...n,
                        read: n.read === true || readIds.has(n.id)
                    }));

                    // Calculer le nombre de messages non lus du compte utilisateur
                    unreadAccountCount = accountTradeNotifications.filter(n => !n.read).length;

                    cachedNotifications = {
                        trade: accountTradeNotifications,
                        games: (json.data?.games || []).map(n => ({ ...n, read: n.read === true || readIds.has(n.id) })),
                        system: (json.data?.system || []).map(n => ({ ...n, read: n.read === true || readIds.has(n.id) }))
                    };

                    fetchedFromApi = true;
                }
            } catch (apiErr) {
                console.warn('[notifications] Erreur appel API /api/notifications/me:', apiErr.message);
            }

            // 3. Fallback vérification directe Supabase côté client si l'API n'a pas répondu
            if (!fetchedFromApi && user.email) {
                try {
                    const sb = (window.AstaAuth && typeof window.AstaAuth.getSB === 'function')
                        ? await window.AstaAuth.getSB()
                        : (window._astaSupabase || window.supabaseClient);

                    if (sb && typeof sb.from === 'function') {
                        // Requête sur les commandes du compte dans Supabase
                        const { data: dbOrders } = await sb
                            .from('commandes')
                            .select('id, statut, updated_at, created_at, produit_nom, denom_label, code_livre')
                            .eq('client_email', user.email)
                            .order('created_at', { ascending: false })
                            .limit(20);

                        if (Array.isArray(dbOrders) && dbOrders.length > 0) {
                            accountTradeNotifications = dbOrders.map(o => {
                                const notifId = `order-${o.id}-${o.statut}`;
                                return {
                                    id: notifId,
                                    type: 'trade',
                                    title: `Commande #${o.id} ${o.statut === 'livree' ? 'livrée' : o.statut}`,
                                    message: `${o.produit_nom || 'Produit'} (${o.denom_label || ''})`,
                                    status: o.statut,
                                    status_label: o.statut === 'livree' ? 'Livrée' : 'En cours',
                                    code_livre: o.code_livre || null,
                                    date: o.updated_at || o.created_at,
                                    read: readIds.has(notifId),
                                    link: 'profile.html#commandes'
                                };
                            });

                            unreadAccountCount = accountTradeNotifications.filter(n => !n.read).length;
                            cachedNotifications = {
                                trade: accountTradeNotifications,
                                games: [],
                                system: []
                            };
                        }
                    }
                } catch (sbErr) {
                    console.warn('[notifications] Vérification directe Supabase échouée:', sbErr.message);
                }
            }

            // 4. RÈGLE STRICTE :
            // Rendre la pastille rouge SEULEMENT si l'utilisateur a des messages de notification
            // non lus dans la base de données de son compte
            const shouldRender = Boolean(user && unreadAccountCount > 0);
            renderBadgeDot(shouldRender, unreadAccountCount);

            // Déclencher la secousse subtile de la cloche (CSS keyframes)
            // dès qu'un nouveau message arrive ou lors de la première détection
            if (shouldRender) {
                if (previousUnreadAccountCount !== null && unreadAccountCount > previousUnreadAccountCount) {
                    triggerBellShake();
                } else if (previousUnreadAccountCount === null && unreadAccountCount > 0) {
                    setTimeout(() => triggerBellShake(), 500);
                }
            }
            previousUnreadAccountCount = unreadAccountCount;

            return {
                hasUnread: shouldRender,
                unreadCount: shouldRender ? unreadAccountCount : 0,
                trade: accountTradeNotifications,
                data: cachedNotifications
            };
        } finally {
            isChecking = false;
        }
    }

    /**
     * Récupère les notifications (délégué vers checkUserAccountUnreadNotifications)
     */
    async function fetchNotifications() {
        const result = await checkUserAccountUnreadNotifications();
        return cachedNotifications || { trade: [], games: [], system: [] };
    }

    /**
     * Met à jour l'affichage de la pastille à partir de l'état local en mémoire
     */
    function updateBadgeFromLocal() {
        const user = getCurrentUser();
        if (!user || (!user.email && !user.id)) {
            renderBadgeDot(false, 0);
            return;
        }

        if (!cachedNotifications || !cachedNotifications.trade) {
            checkUserAccountUnreadNotifications();
            return;
        }

        const readIds = new Set(getReadIds(user.email));
        const unreadTrade = (cachedNotifications.trade || []).filter(n => !readIds.has(n.id)).length;
        renderBadgeDot(unreadTrade > 0, unreadTrade);
    }

    /**
     * Marque une notification spécifique comme lue
     */
    async function markAsRead(id) {
        if (!id) return;
        const user = getCurrentUser();
        addReadId(id, user?.email);

        if (cachedNotifications && Array.isArray(cachedNotifications.trade)) {
            cachedNotifications.trade = cachedNotifications.trade.map(n => n.id === id ? { ...n, read: true } : n);
        }

        const token = getAuthToken();
        try {
            await fetch('/api/notifications/mark-read', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ id, email: user?.email })
            });
        } catch (_) {}

        updateBadgeFromLocal();
    }

    /**
     * Marque toutes les notifications du compte comme lues
     * et fait disparaître instantanément la pastille rouge
     */
    async function markAllAsRead() {
        const user = getCurrentUser();
        const allIds = [
            ...(cachedNotifications?.trade || []).map(n => n.id),
            ...(cachedNotifications?.games || []).map(n => n.id),
            ...(cachedNotifications?.system || []).map(n => n.id)
        ];

        addAllReadIds(allIds, user?.email);

        if (cachedNotifications) {
            if (Array.isArray(cachedNotifications.trade)) {
                cachedNotifications.trade.forEach(n => { n.read = true; });
            }
            if (Array.isArray(cachedNotifications.games)) {
                cachedNotifications.games.forEach(n => { n.read = true; });
            }
            if (Array.isArray(cachedNotifications.system)) {
                cachedNotifications.system.forEach(n => { n.read = true; });
            }
        }

        const token = getAuthToken();
        try {
            await fetch('/api/notifications/mark-read', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ all: true, ids: allIds, email: user?.email })
            });
        } catch (_) {}

        // Immédiatement cacher la pastille rouge
        renderBadgeDot(false, 0);
    }

    /**
     * Écoute SSE pour recevoir en temps réel les notifications de commandes livrées
     */
    let sseInitialized = false;
    function initRealtimeSSE() {
        if (sseInitialized) return;
        const user = getCurrentUser();
        if (!user || !user.email) return;

        try {
            const token = getAuthToken();
            if (!token) return;
            const evtSource = new EventSource(`/api/events/client?email=${encodeURIComponent(user.email)}&token=${encodeURIComponent(token)}`);
            evtSource.addEventListener('commande_livree', () => {
                // Secouer la cloche immédiatement pour attirer l'attention lors d'un nouveau message
                triggerBellShake();
                // Actualiser immédiatement la vérification de la base de données
                checkUserAccountUnreadNotifications();
            });
            evtSource.addEventListener('nouvelle_notification', () => {
                // Secouer la cloche immédiatement lors d'une nouvelle notification reçue
                triggerBellShake();
                checkUserAccountUnreadNotifications();
            });
            evtSource.onerror = () => {
                evtSource.close();
                sseInitialized = false;
            };
            sseInitialized = true;
        } catch (_) {}
    }

    /**
     * Initialisation globale au chargement de la page
     */
    function init() {
        // 1. Cacher IMMÉDIATEMENT la pastille rouge par défaut pour éviter tout faux clignotement
        renderBadgeDot(false, 0);

        // 2. Mettre à jour les liens d'en-tête pour pointer vers messages.html
        document.querySelectorAll('#headerNotifBtn, a[href="profile.html#messages"]').forEach(a => {
            a.href = 'messages.html';
        });

        // 3. Garantir que l'icône dans l'en-tête est la cloche de notification officielle LootZone
        const bellSVG = `<svg class="notif-bell-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>`;
        document.querySelectorAll('#headerNotifBtn, .notif-btn').forEach(btn => {
            const svg = btn.querySelector('svg');
            if (svg && !svg.classList.contains('notif-bell-icon')) {
                svg.outerHTML = bellSVG;
            }
        });

        // 4. Exécuter la vérification logique auprès de la base de données
        checkUserAccountUnreadNotifications();

        // 5. Initialiser la connexion temps réel SSE
        initRealtimeSSE();

        // 6. Réagir immédiatement aux changements d'authentification (connexion / déconnexion)
        window.addEventListener('asta_auth_changed', () => {
            checkUserAccountUnreadNotifications();
            initRealtimeSSE();
        });

        // 7. Réagir aux changements de session dans d'autres onglets
        window.addEventListener('storage', (e) => {
            if (e.key === 'as_user' || e.key === 'as_token' || e.key?.startsWith(STORAGE_KEY_READ_PREFIX)) {
                checkUserAccountUnreadNotifications();
            }
        });

        // 8. Re-vérifier quand la page redevient active
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                checkUserAccountUnreadNotifications();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Exposer l'API globale LootZone
    window.LootZoneNotifications = {
        triggerBellShake,
        checkUserAccountUnreadNotifications,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        renderBadgeDot,
        setBadgeVisibility,
        getReadIds,
        addReadId,
        updateBadgeFromLocal,
        resolveCurrentUser,
        getCurrentUser,
        hasUnreadAccountNotifications: () => {
            const user = getCurrentUser();
            if (!user || (!user.email && !user.id)) return false;
            if (!cachedNotifications || !cachedNotifications.trade) return false;
            const readIds = new Set(getReadIds(user.email));
            return cachedNotifications.trade.some(n => !readIds.has(n.id) && !n.read);
        },
        createRealTestNotification: async function () {
            const user = getCurrentUser();
            const email = user?.email || 'test@lootzone.gg';
            try {
                const res = await fetch('/api/notifications/create-real', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        target_email: email,
                        title: 'Recharge Diamants confirmée',
                        message: 'Votre recharge de 1080 Diamants a été validée avec succès sur votre ID joueur.',
                        status: 'livree',
                        amount: '1350 HTG',
                        code_livre: 'LZ-FF-9942-8812'
                    })
                });
                const data = await res.json();
                triggerBellShake();
                await checkUserAccountUnreadNotifications();
                return data;
            } catch (err) {
                console.error('Erreur createRealTestNotification:', err);
            }
        }
    };
})();
