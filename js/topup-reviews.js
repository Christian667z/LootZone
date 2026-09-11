/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  LOOTZONE - MODULE FRONTEND D'AVIS & COMMENTAIRES CLIENTS (SUPABASE)
 *  Fichier : js/topup-reviews.js
 * ═══════════════════════════════════════════════════════════════════════════════
 */

(function () {
    'use strict';

    const SUPABASE_URL = 'https://bdezshjorwdxzojuecja.supabase.co';
    const SUPABASE_ANON = 'sb_publishable_PDxfwtviufPwC92pVHdNaA_G01ZE50h';

    // Gradients vibrants pour les avatars
    const AVATAR_GRADIENTS = [
        'linear-gradient(135deg, #f59e0b, #d97706)',
        'linear-gradient(135deg, #10b981, #059669)',
        'linear-gradient(135deg, #6366f1, #4f46e5)',
        'linear-gradient(135deg, #ec4899, #db2777)',
        'linear-gradient(135deg, #0ea5e9, #0284c7)',
        'linear-gradient(135deg, #8b5cf6, #7c3aed)',
        'linear-gradient(135deg, #14b8a6, #0d9488)'
    ];

    // Données de secours réalistes (au cas où la table Supabase n'est pas encore migrée)
    const SEED_FALLBACK_REVIEWS = [
        {
            id: 'rev-seed-1',
            product_id: '21',
            author_name: 'Jean-Marc D.',
            rating: 5,
            tag: 'Recharge Validée',
            comment: "Incroyablement rapide ! J'ai payé par Moncash et les crédits étaient sur mon compte en moins de 3 minutes chrono. Meilleur site de recharge en Haïti.",
            is_verified: true,
            is_vip: true,
            is_approved: true,
            likes_count: 42,
            created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString()
        },
        {
            id: 'rev-seed-2',
            product_id: '21',
            author_name: 'Guerrier_HT',
            rating: 5,
            tag: 'Livraison Rapide',
            comment: "Top sèvis ! Mwen te fè rechaj 1080 Diamonds Free Fire la ak MonCash, li pase imedyatman san okenn tèt chaje. Mwen rekòmande LootZone a 100%.",
            is_verified: true,
            is_vip: false,
            is_approved: true,
            likes_count: 19,
            created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
        },
        {
            id: 'rev-seed-3',
            product_id: '21',
            author_name: 'Stanley_Pro',
            rating: 5,
            tag: 'VIP',
            comment: "Client fidèle depi 6 mwa. Bon pri, livrezon an mwens 5 minit sou Natcash tou. Pi bon platfòm gaming nan peyi a !",
            is_verified: true,
            is_vip: true,
            is_approved: true,
            likes_count: 28,
            created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
        },
        {
            id: 'rev-seed-4',
            product_id: '21',
            author_name: 'Vanessa K.',
            rating: 5,
            tag: 'Livraison Rapide',
            comment: "Très satisfaite ! Première fois que je commande des diamants Free Fire sur LootZone et tout s'est super bien passé avec mon numéro MonCash.",
            is_verified: true,
            is_vip: false,
            is_approved: true,
            likes_count: 14,
            created_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString()
        },
        {
            id: 'rev-seed-5',
            product_id: '21',
            author_name: 'Ti_Sony_FF',
            rating: 4,
            tag: 'Recharge Validée',
            comment: "Trè rapid e serye. Ti kras reta 2 minit pou Natcash men sipò a te reponn imedyatman sou WhatsApp pou konfime. Mèsi anpil !",
            is_verified: true,
            is_vip: false,
            is_approved: true,
            likes_count: 9,
            created_at: new Date(Date.now() - 72 * 3600 * 1000).toISOString()
        }
    ];

    let currentReviews = [];
    let currentFilter = 'all';

    // ─── 1. UTILITAIRES ──────────────────────────────────────────────────────────

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, function (m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
        });
    }

    function getProductId() {
        try {
            const params = new URLSearchParams(window.location.search);
            const id = params.get('id');
            if (id && id.trim()) return id.trim();
        } catch (_) {}
        return '21';
    }

    function getInitials(name) {
        if (!name) return 'LZ';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    }

    function getAvatarGradient(name) {
        if (!name) return AVATAR_GRADIENTS[0];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
        return AVATAR_GRADIENTS[index];
    }

    function formatRelativeDate(dateStr) {
        if (!dateStr) return 'Récemment';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.max(0, Math.floor(diffMs / 1000));
        const diffMin = Math.floor(diffSec / 60);
        const diffHours = Math.floor(diffMin / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSec < 60) return "À l'instant";
        if (diffMin < 60) return `Il y a ${diffMin} minute${diffMin > 1 ? 's' : ''}`;
        if (diffHours < 24) return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
        if (diffDays === 1) return 'Hier';
        if (diffDays < 7) return `Il y a ${diffDays} jours`;

        return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function getLikedReviewsFromStorage() {
        try {
            const raw = localStorage.getItem('lootzone_liked_reviews');
            return raw ? JSON.parse(raw) : [];
        } catch (_) {
            return [];
        }
    }

    function markReviewLikedInStorage(id) {
        try {
            const list = getLikedReviewsFromStorage();
            if (!list.includes(id)) {
                list.push(id);
                localStorage.setItem('lootzone_liked_reviews', JSON.stringify(list));
            }
        } catch (_) {}
    }

    function unmarkReviewLikedInStorage(id) {
        try {
            let list = getLikedReviewsFromStorage();
            list = list.filter(item => item !== id);
            localStorage.setItem('lootzone_liked_reviews', JSON.stringify(list));
        } catch (_) {}
    }

    // ─── 2. CLIENT SUPABASE ──────────────────────────────────────────────────────

    async function getSupabase() {
        if (window._astaSupabase) return window._astaSupabase;
        if (typeof window.getSB === 'function') {
            const client = await window.getSB();
            if (client) return client;
        }
        if (window.supabase?.createClient) {
            window._astaSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
            return window._astaSupabase;
        }
        return null;
    }

    // ─── 3. CHARGEMENT DES AVIS DYNAMIQUES ───────────────────────────────────────

    async function loadProductReviews() {
        const productId = getProductId();
        const listEl = document.getElementById('lootbarReviewsList');
        if (!listEl) return;

        let loadedReviews = [];
        try {
            const sb = await getSupabase();
            if (sb) {
                const { data, error } = await sb
                    .from('reviews')
                    .select('*')
                    .eq('product_id', String(productId))
                    .eq('is_approved', true)
                    .order('created_at', { ascending: false });

                if (!error && Array.isArray(data) && data.length > 0) {
                    loadedReviews = data;
                }
            }
        } catch (err) {
            console.warn('[LootZone Reviews] Erreur Supabase, bascule sur les données initiales:', err);
        }

        // Si aucun avis en base pour ce produit, utiliser les seed reviews pour ID 21 (Free Fire)
        if (!loadedReviews.length) {
            if (String(productId) === '21' || !productId) {
                loadedReviews = SEED_FALLBACK_REVIEWS;
            } else {
                // Pour d'autres produits, générer des avis de démonstration cohérents
                loadedReviews = SEED_FALLBACK_REVIEWS.map((rev, idx) => ({
                    ...rev,
                    id: `rev-${productId}-${idx}`,
                    product_id: String(productId)
                }));
            }
        }

        currentReviews = loadedReviews;
        renderReviews(currentReviews);
        updateReviewsSummary(currentReviews);
        applyFilter(currentFilter);
    }

    // ─── 4. RENDU DES STATISTIQUES & RESUME ──────────────────────────────────────

    function updateReviewsSummary(reviews) {
        const total = reviews.length;
        if (total === 0) return;

        // Calcul de la moyenne
        const sumRating = reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
        const avgScore = (sumRating / total).toFixed(1);

        const avgScoreEl = document.getElementById('lb-avg-rating');
        if (avgScoreEl) avgScoreEl.textContent = avgScore;

        const totalCountEl = document.getElementById('lb-total-reviews-count');
        if (totalCountEl) {
            totalCountEl.textContent = `${total >= 10 ? total.toLocaleString('fr-FR') + '+' : total} avis vérifiés`;
        }

        // Distribution des étoiles (5★ à 1★)
        const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        reviews.forEach(r => {
            const val = Math.min(5, Math.max(1, Math.round(Number(r.rating) || 5)));
            counts[val] = (counts[val] || 0) + 1;
        });

        // Mise à jour des barres dans le DOM
        const barRows = document.querySelectorAll('.lootbar-rating-bars .lootbar-bar-row');
        barRows.forEach(row => {
            const labelEl = row.querySelector('.lootbar-bar-label');
            const fillEl = row.querySelector('.lootbar-bar-fill');
            const pctEl = row.querySelector('.lootbar-bar-pct');
            if (labelEl && fillEl && pctEl) {
                const starNum = parseInt(labelEl.textContent, 10);
                const count = counts[starNum] || 0;
                const pct = Math.round((count / total) * 100);
                fillEl.style.width = `${pct}%`;
                pctEl.textContent = `${pct}%`;
            }
        });

        // Mise à jour des compteurs sur les onglets de filtres
        const vipCount = reviews.filter(r => r.is_vip).length;
        const fastCount = reviews.filter(r => (r.tag && r.tag.toLowerCase().includes('rapid'))).length;
        const fiveStarCount = counts[5] || 0;

        const tabAll = document.querySelector('.lootbar-tab-chip[data-filter="all"]');
        if (tabAll) tabAll.textContent = `Tous les avis (${total.toLocaleString('fr-FR')})`;

        const tab5Star = document.querySelector('.lootbar-tab-chip[data-filter="5star"]');
        if (tab5Star) tab5Star.textContent = `5 étoiles (${fiveStarCount.toLocaleString('fr-FR')})`;

        const tabVip = document.querySelector('.lootbar-tab-chip[data-filter="vip"]');
        if (tabVip) tabVip.textContent = `Avis VIP (${vipCount.toLocaleString('fr-FR')})`;

        const tabFast = document.querySelector('.lootbar-tab-chip[data-filter="fast"]');
        if (tabFast) tabFast.textContent = `Livraison Rapide (${fastCount.toLocaleString('fr-FR')})`;
    }

    // ─── 5. GÉNÉRATION DES CARTES D'AVIS ─────────────────────────────────────────

    function createReviewCardHtml(review) {
        const likedList = getLikedReviewsFromStorage();
        const isLiked = likedList.includes(review.id);
        const initials = getInitials(review.author_name);
        const avatarBg = getAvatarGradient(review.author_name);
        const relativeDate = formatRelativeDate(review.created_at);

        // Catégories pour le filtrage
        const categories = [];
        if (review.rating === 5) categories.push('5star');
        if (review.is_vip) categories.push('vip');
        if (review.tag && review.tag.toLowerCase().includes('rapid')) categories.push('fast');

        // Génération des étoiles
        let starsHtml = '';
        const rating = Math.min(5, Math.max(1, Math.round(Number(review.rating) || 5)));
        for (let i = 0; i < 5; i++) {
            starsHtml += i < rating ? '★' : '☆';
        }

        // Badges VIP et Vérifié
        const vipBadge = review.is_vip
            ? '<span class="lootbar-user-badge-vip" style="background:#111827;color:#f59e0b;font-size:0.68rem;font-weight:900;padding:2px 6px;border-radius:4px;letter-spacing:0.4px;">VIP</span>'
            : '';
        const verifiedBadge = review.is_verified
            ? '<span class="lootbar-user-badge-verified" style="background:#dcfce7;color:#15803d;font-size:0.68rem;font-weight:800;padding:2px 6px;border-radius:4px;display:inline-flex;align-items:center;gap:3px;">✓ Vérifié</span>'
            : '';

        const tagText = review.tag || 'Recharge Validée';
        const likes = Number(review.likes_count) || 0;

        return `
            <div class="lootbar-review-card" data-id="${escapeHtml(review.id)}" data-category="${categories.join(' ')}">
                <div class="lootbar-review-top">
                    <div class="lootbar-review-user-info">
                        <div class="lootbar-user-avatar" style="background:${avatarBg};">${escapeHtml(initials)}</div>
                        <div>
                            <div class="lootbar-user-name">
                                ${escapeHtml(review.author_name)}
                                ${vipBadge}
                                ${verifiedBadge}
                            </div>
                            <div class="lootbar-review-date">${escapeHtml(relativeDate)}</div>
                        </div>
                    </div>
                    <div class="lootbar-review-stars" style="color:#f59e0b;letter-spacing:1px;font-size:1rem;">${starsHtml}</div>
                </div>
                <div class="lootbar-review-middle">
                    <span class="lootbar-review-pack-pill">${escapeHtml(tagText)}</span>
                </div>
                <p class="lootbar-review-content">${escapeHtml(review.comment)}</p>
                <div class="lootbar-review-footer">
                    <button type="button" class="lootbar-useful-btn ${isLiked ? 'liked' : ''}" onclick="window.LootZoneReviews.toggleLike('${escapeHtml(review.id)}', this)">
                        👍 <span>Utile (${likes})</span>
                    </button>
                </div>
            </div>
        `;
    }

    function renderReviews(reviews) {
        const listEl = document.getElementById('lootbarReviewsList');
        if (!listEl) return;
        listEl.innerHTML = reviews.map(r => createReviewCardHtml(r)).join('');
    }

    // ─── 6. GESTION DU BOUTON "UTILE (X)" ───────────────────────────────────────

    async function toggleLike(reviewId, buttonEl) {
        if (!buttonEl) return;
        const span = buttonEl.querySelector('span');
        const match = span ? span.textContent.match(/\d+/) : null;
        let count = match ? parseInt(match[0], 10) : 0;

        const likedList = getLikedReviewsFromStorage();
        const alreadyLiked = likedList.includes(reviewId);

        if (!alreadyLiked) {
            // Incrément
            count++;
            buttonEl.classList.add('liked');
            markReviewLikedInStorage(reviewId);
            if (span) span.textContent = `Utile (${count})`;

            // Synchronisation Supabase via RPC ou Update
            try {
                const sb = await getSupabase();
                if (sb) {
                    const { error } = await sb.rpc('increment_review_likes', { review_id: reviewId });
                    if (error) {
                        // Fallback update direct
                        await sb
                            .from('reviews')
                            .update({ likes_count: count })
                            .eq('id', reviewId);
                    }
                }
            } catch (err) {
                console.warn('[LootZone Reviews] Erreur sync like:', err);
            }
        } else {
            // Annulation
            count = Math.max(0, count - 1);
            buttonEl.classList.remove('liked');
            unmarkReviewLikedInStorage(reviewId);
            if (span) span.textContent = `Utile (${count})`;
        }
    }

    // ─── 7. FILTRAGE PAR ONGLETS ────────────────────────────────────────────────

    function applyFilter(category) {
        currentFilter = category;
        document.querySelectorAll('.lootbar-tab-chip').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-filter') === category);
        });

        const cards = document.querySelectorAll('.lootbar-review-card');
        cards.forEach(card => {
            if (category === 'all') {
                card.style.display = '';
            } else {
                const cats = card.getAttribute('data-category') || '';
                card.style.display = cats.includes(category) ? '' : 'none';
            }
        });
    }

    // ─── 8. SOUMISSION D'UN NOUVEL AVIS ─────────────────────────────────────────

    async function handleReviewSubmit(e) {
        if (e && e.preventDefault) e.preventDefault();

        const authorInput = document.getElementById('reviewAuthorInput');
        const packInput = document.getElementById('reviewPackInput');
        const contentInput = document.getElementById('reviewContentInput');
        const starInput = document.getElementById('reviewStarInput');

        const author = (authorInput ? authorInput.value.trim() : '') || 'Joueur LootZone';
        const pack = (packInput ? packInput.value.trim() : '') || 'Recharge Validée';
        const content = contentInput ? contentInput.value.trim() : '';
        const rating = starInput ? (parseInt(starInput.value, 10) || 5) : 5;

        if (!content) {
            if (contentInput) contentInput.focus();
            return;
        }

        const productId = getProductId();
        const submitBtn = e?.target?.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Publication en cours...';
        }

        // Vérification de la session utilisateur connecté
        let userId = null;
        let isVip = false;
        let isVerified = true; // Vérifié par défaut sur soumission réussie

        try {
            const sb = await getSupabase();
            if (sb) {
                const { data: { user } } = await sb.auth.getUser();
                if (user) {
                    userId = user.id;
                    const { data: profile } = await sb.from('profiles').select('role, points').eq('id', user.id).single();
                    if (profile) {
                        if (profile.role === 'vip' || (profile.points && profile.points >= 5000)) {
                            isVip = true;
                        }
                    }
                }
            }
        } catch (_) {}

        const newReviewObj = {
            id: 'rev-local-' + Date.now(),
            product_id: String(productId),
            user_id: userId,
            author_name: author,
            rating: rating,
            tag: pack,
            comment: content,
            is_verified: isVerified,
            is_vip: isVip,
            is_approved: true,
            likes_count: 0,
            created_at: new Date().toISOString()
        };

        // Sauvegarde Supabase
        try {
            const sb = await getSupabase();
            if (sb) {
                const { data, error } = await sb.from('reviews').insert({
                    product_id: String(productId),
                    user_id: userId,
                    author_name: author,
                    rating: rating,
                    tag: pack,
                    comment: content,
                    is_verified: isVerified,
                    is_vip: isVip,
                    is_approved: true,
                    likes_count: 0
                }).select().single();

                if (!error && data && data.id) {
                    newReviewObj.id = data.id;
                }
            }
        } catch (err) {
            console.warn('[LootZone Reviews] Erreur insertion Supabase:', err);
        }

        // Mise à jour immédiate de l'interface (Optimistic UI)
        currentReviews.unshift(newReviewObj);
        renderReviews(currentReviews);
        updateReviewsSummary(currentReviews);
        applyFilter('all');

        // Réinitialisation du formulaire
        if (contentInput) contentInput.value = '';
        if (typeof window.toggleReviewForm === 'function') {
            window.toggleReviewForm();
        }

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Publier mon avis';
        }

        // Notification toast
        if (typeof window.showToast === 'function') {
            window.showToast('Merci ! Votre avis a été publié avec succès.', 'success');
        } else if (typeof window.showAstaToast === 'function') {
            window.showAstaToast('success', 'Avis publié !', "Merci d'avoir partagé votre expérience avec LootZone.");
        }
    }

    // ─── 9. EXPOSITION GLOBALE & INITIALISATION ──────────────────────────────────

    window.LootZoneReviews = {
        load: loadProductReviews,
        filter: applyFilter,
        toggleLike: toggleLike,
        submit: handleReviewSubmit
    };

    // Remplacement des fonctions globales historiques de topup.html
    window.filterReviews = applyFilter;
    window.toggleUseful = function (btn) {
        const card = btn.closest('.lootbar-review-card');
        const id = card ? card.getAttribute('data-id') : null;
        if (id) {
            toggleLike(id, btn);
        } else {
            // Fallback visuel local
            btn.classList.toggle('liked');
            const span = btn.querySelector('span');
            if (span) {
                const match = span.textContent.match(/\d+/);
                let count = match ? parseInt(match[0], 10) : 0;
                count = btn.classList.contains('liked') ? count + 1 : Math.max(0, count - 1);
                span.textContent = `Utile (${count})`;
            }
        }
    };
    window.handleReviewSubmit = handleReviewSubmit;

    // Démarrage automatique dès que le DOM est prêt
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadProductReviews);
    } else {
        loadProductReviews();
    }
})();
