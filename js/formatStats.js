/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  LOOTZONE - FORMATAGE & CHARGEMENT DYNAMIQUE DES MÉTRIQUES PRODUIT SUPABASE
 *  Fichier : js/formatStats.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *  Gère :
 *  1. Le formatage des ventes ("145 Sold", "13.5k Sold", "100k+ Sold", "0 Sold" / "Vendu")
 *  2. Le formatage des étoiles ("5.0", "4.8", "Nouveau")
 *  3. La récupération par lot (batch) anti-casse via la RPC `get_product_stats_batch`
 *     ou directement la vue `public.product_stats`.
 *  4. L'injection et la mise à jour dynamique dans les cartes HTML (index.html, catalog.html, topup.html)
 */

(function () {
    'use strict';

    const SUPABASE_URL = 'https://bdezshjorwdxzojuecja.supabase.co';
    const SUPABASE_ANON = 'sb_publishable_PDxfwtviufPwC92pVHdNaA_G01ZE50h';

    // Cache local normalisé (clé en minuscules sans espaces)
    const productStatsCache = new Map();
    let isFetching = false;
    let hasLoaded = false;

    // ─────────────────────────────────────────────────────────────────────────
    // 1. FONCTIONS DE FORMATAGE
    // ─────────────────────────────────────────────────────────────────────────

    function getCurrentLang() {
        try {
            if (typeof window.getCurrentLang === 'function') {
                return window.getCurrentLang();
            }
            const stored = localStorage.getItem('lootzone_lang') || localStorage.getItem('selected_language');
            if (stored && stored.startsWith('en')) return 'en';
        } catch (_) {}
        return 'fr';
    }

    /**
     * Formate un nombre de ventes de façon compacte et élégante
     * Exemples :
     *   0       -> "0 Vendu" / "0 Sold"
     *   145     -> "145 Vendu" / "145 Sold"
     *   3000    -> "3k Vendu" / "3k Sold"
     *   13500   -> "13.5k Vendu" / "13.5k Sold"
     *   100000  -> "100k+ Vendu" / "100k+ Sold"
     *
     * @param {number|string} count Nombre de ventes
     * @param {string} [lang] Langue optionnelle ('fr' | 'en')
     * @returns {string} Chaîne formatée
     */
    function formatSales(count, lang) {
        const currentLanguage = lang || getCurrentLang();
        const suffix = currentLanguage === 'en' ? 'Sold' : 'Vendu';

        const num = Number(count);
        if (isNaN(num) || num <= 0) {
            return `0 ${suffix}`;
        }

        // Cas >= 100 000 : ex. "100k+ Sold"
        if (num >= 100000) {
            const thousands = Math.floor(num / 1000);
            return `${thousands}k+ ${suffix}`;
        }

        // Cas >= 1 000 : ex. 13500 -> "13.5k Sold", 3000 -> "3k Sold"
        if (num >= 1000) {
            const inK = num / 1000;
            const formatted = inK % 1 === 0 ? inK.toFixed(0) : inK.toFixed(1).replace(/\.0$/, '');
            return `${formatted}k ${suffix}`;
        }

        // Moins de 1000 : ex. 145 -> "145 Sold"
        return `${num} ${suffix}`;
    }

    /**
     * Formate la note moyenne d'étoiles
     * Exemples :
     *   null / undefined / 0 -> "Nouveau" (ou "New" en anglais)
     *   4.82                 -> "4.8"
     *   5.0                  -> "5.0"
     *
     * @param {number|string|null} rating Note moyenne
     * @param {string} [lang] Langue optionnelle
     * @returns {{ text: string, isNew: boolean, value: number }}
     */
    function formatRating(rating, lang) {
        const currentLanguage = lang || getCurrentLang();
        const num = Number(rating);

        if (!rating || isNaN(num) || num <= 0) {
            const newLabel = currentLanguage === 'en' ? 'New' : 'Nouveau';
            return {
                text: newLabel,
                isNew: true,
                value: 0
            };
        }

        const clamped = Math.min(5.0, Math.max(1.0, num));
        return {
            text: clamped.toFixed(1),
            isNew: false,
            value: clamped
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. CLIENT SUPABASE & RÉCUPÉRATION DES STATS
    // ─────────────────────────────────────────────────────────────────────────

    async function getSupabaseClient() {
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

    function normalizeId(id) {
        if (id === undefined || id === null) return '';
        return String(id).trim().toLowerCase();
    }

    /**
     * Collecte tous les product IDs présents sur la page actuelle
     */
    function collectPageProductIds() {
        const set = new Set();
        const cards = document.querySelectorAll('.product-card, .premium-game-card, [data-product-id]');
        cards.forEach(card => {
            const pid = extractProductId(card);
            if (pid) set.add(normalizeId(pid));
        });

        // Topup page ID
        try {
            const paramId = new URLSearchParams(window.location.search).get('id');
            if (paramId) set.add(normalizeId(paramId));
        } catch (_) {}

        return Array.from(set);
    }

    /**
     * Charge les statistiques produits depuis Supabase (Vue ou RPC batch)
     */
    async function fetchProductStats() {
        if (isFetching) return productStatsCache;
        isFetching = true;

        try {
            const sb = await getSupabaseClient();
            if (!sb) {
                isFetching = false;
                return productStatsCache;
            }

            const pageIds = collectPageProductIds();
            let data = null;
            let error = null;

            // 1. Tenter la fonction RPC batch universelle si nous avons des IDs
            if (pageIds.length > 0) {
                try {
                    const rpcRes = await sb.rpc('get_product_stats_batch', { p_ids: pageIds });
                    if (!rpcRes.error && Array.isArray(rpcRes.data)) {
                        data = rpcRes.data;
                    }
                } catch (e) {
                    console.debug('[LootZone Stats] RPC batch indisponible, fallback vue directe:', e);
                }
            }

            // 2. Fallback lecture directe sur la vue public.product_stats
            if (!data) {
                const viewRes = await sb
                    .from('product_stats')
                    .select('product_id, total_sales, avg_rating, total_reviews');
                if (!viewRes.error && Array.isArray(viewRes.data)) {
                    data = viewRes.data;
                } else {
                    error = viewRes.error;
                }
            }

            if (data && Array.isArray(data)) {
                data.forEach(item => {
                    if (item.product_id !== undefined && item.product_id !== null) {
                        const key = normalizeId(item.product_id);
                        productStatsCache.set(key, {
                            product_id: String(item.product_id),
                            total_sales: Number(item.total_sales) || 0,
                            avg_rating: item.avg_rating !== null && item.avg_rating !== undefined ? Number(item.avg_rating) : null,
                            total_reviews: Number(item.total_reviews) || 0
                        });
                    }
                });
                hasLoaded = true;
            } else if (error) {
                console.warn('[LootZone Stats] Note Supabase:', error.message || error);
            }
        } catch (err) {
            console.warn('[LootZone Stats] Erreur lors du chargement des stats Supabase:', err);
        } finally {
            isFetching = false;
        }

        return productStatsCache;
    }

    /**
     * Obtient les stats pour un produit donné (recherche insensible à la casse et trim)
     */
    function getStatsForProduct(productId) {
        if (!productId) return null;
        const key = normalizeId(productId);
        return productStatsCache.get(key) || null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. INJECTION DANS LE DOM (index.html & catalog.html)
    // ─────────────────────────────────────────────────────────────────────────

    function extractProductId(cardEl) {
        if (!cardEl) return null;

        // Attribut explicite data-product-id
        if (cardEl.dataset && cardEl.dataset.productId) {
            return cardEl.dataset.productId;
        }

        // Cas lien href="topup.html?id=21"
        const href = cardEl.getAttribute('href') || (cardEl.querySelector('a[href*="topup.html"]') || {}).href;
        if (href) {
            const match = href.match(/[?&]id=([^&#]+)/);
            if (match) return match[1];
        }

        // Cas onclick="window.location.href='topup.html?id=21'"
        const onclick = cardEl.getAttribute('onclick') || '';
        const onclickMatch = onclick.match(/id=([0-9a-zA-Z_-]+)/);
        if (onclickMatch) return onclickMatch[1];

        return null;
    }

    function updateProductCardElement(cardEl, stats) {
        if (!cardEl || !stats) return;

        const ratingInfo = formatRating(stats.avg_rating);
        const salesText = formatSales(stats.total_sales);

        // Élément note (compatibilité .product-rating-val et .card-rating)
        const ratingEl = cardEl.querySelector('.product-rating-val') || cardEl.querySelector('.card-rating');
        if (ratingEl) {
            if (ratingInfo.isNew) {
                ratingEl.innerHTML = `<span class="badge-new rating-new">Nouveau</span>`;
            } else {
                ratingEl.innerHTML = `<span class="text-amber-500">★ ${ratingInfo.text}</span>`;
            }
        }

        // Élément étoile historique
        const starEl = cardEl.querySelector('.card-star');
        if (starEl) {
            starEl.style.display = ratingInfo.isNew ? 'none' : '';
        }

        // Élément ventes (compatibilité .product-sales-val et .card-sold)
        const soldEl = cardEl.querySelector('.product-sales-val') || cardEl.querySelector('.card-sold');
        if (soldEl) {
            soldEl.textContent = salesText;
            soldEl.setAttribute('data-sales-count', stats.total_sales);
        }
    }

    let isApplyingStats = false;

    async function applyStatsToAllCards() {
        if (isApplyingStats) return;
        isApplyingStats = true;

        try {
            if (!hasLoaded) {
                await fetchProductStats();
            }

            const selector = '.product-card, .premium-game-card';
            const cards = document.querySelectorAll(selector);

            cards.forEach(card => {
                const pid = extractProductId(card);
                if (!pid) return;

                const stats = getStatsForProduct(pid);
                if (stats) {
                    updateProductCardElement(card, stats);
                } else if (hasLoaded) {
                    // Aucun achat/avis enregistré en base -> Vente 0 et Nouveau
                    updateProductCardElement(card, {
                        product_id: pid,
                        total_sales: 0,
                        avg_rating: null,
                        total_reviews: 0
                    });
                }
            });

            updateTopupPageStats();
        } finally {
            isApplyingStats = false;
        }
    }

    function updateTopupPageStats() {
        const avgScoreEl = document.getElementById('lb-avg-rating');
        const totalCountEl = document.getElementById('lb-total-reviews-count');

        if (!avgScoreEl && !totalCountEl) return;

        try {
            const params = new URLSearchParams(window.location.search);
            const pid = params.get('id') || '21';
            const stats = getStatsForProduct(pid);
            if (stats) {
                if (avgScoreEl && stats.avg_rating !== null) {
                    avgScoreEl.textContent = stats.avg_rating.toFixed(1);
                }
                if (totalCountEl) {
                    const count = stats.total_reviews;
                    totalCountEl.textContent = `${count >= 10 ? count.toLocaleString('fr-FR') + '+' : count} avis vérifiés`;
                }
            }
        } catch (_) {}
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. SYNCHRONISATION AVEC LES PRODUITS DYNAMIQUES
    // ─────────────────────────────────────────────────────────────────────────

    function hookCatalogRender() {
        if (typeof window.renderCatalogProducts === 'function' && !window._renderCatalogProductsHooked) {
            const originalRender = window.renderCatalogProducts;
            window.renderCatalogProducts = function () {
                const res = originalRender.apply(this, arguments);
                setTimeout(applyStatsToAllCards, 50);
                return res;
            };
            window._renderCatalogProductsHooked = true;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. INITIALISATION AUTOMATIQUE
    // ─────────────────────────────────────────────────────────────────────────

    async function init() {
        hookCatalogRender();
        await fetchProductStats();
        applyStatsToAllCards();

        window.addEventListener('languageChanged', () => {
            applyStatsToAllCards();
        });

        const targetObserverNode = document.getElementById('catalogGrid');
        if (targetObserverNode && window.MutationObserver) {
            let mutationTimer = null;
            const observer = new MutationObserver((mutations) => {
                const hasNewChildren = mutations.some(m => m.addedNodes && m.addedNodes.length > 0);
                if (!hasNewChildren) return;

                clearTimeout(mutationTimer);
                mutationTimer = setTimeout(() => {
                    if (!isApplyingStats) {
                        applyStatsToAllCards();
                    }
                }, 250);
            });
            observer.observe(targetObserverNode, { childList: true, subtree: false });
        }
    }

    // Exposition API globale
    window.LootZoneStats = {
        formatSales,
        formatRating,
        fetch: fetchProductStats,
        apply: applyStatsToAllCards,
        get: getStatsForProduct,
        refresh: async function () {
            await fetchProductStats();
            applyStatsToAllCards();
        }
    };

    window.formatSales = formatSales;
    window.formatRating = formatRating;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
