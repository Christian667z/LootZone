/**
 * LOOTZONE - HYDRATATEUR DE STATISTIQUES (VERSION SECURISEE & ROBUSTE)
 */

(function() {
  'use strict';

  const SUPABASE_URL = window.SUPABASE_URL || 'https://bdezshjorwdxzojuecja.supabase.co';
  const SUPABASE_ANON = window.SUPABASE_ANON || 'sb_publishable_PDxfwtviufPwC92pVHdNaA_G01ZE50h';

  function formatSalesText(count) {
    if (!count || count === 0) return "0 Vendu";
    if (count >= 100000) return "100k+ Vendu";
    if (count >= 1000) return (count / 1000).toFixed(1).replace('.0', '') + "k Vendu";
    return `${count} Vendu`;
  }

  function formatRatingText(rating) {
    if (!rating || rating === 0) return `<span class="badge-new">Nouveau</span>`;
    return `<span class="text-amber-500">★ ${parseFloat(rating).toFixed(1)}</span>`;
  }

  /**
   * Obtient ou initialise une instance valide du client Supabase
   */
  async function getSupabaseClient() {
    if (window._astaSupabase && typeof window._astaSupabase.from === 'function') {
      return window._astaSupabase;
    }
    if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
      return window.supabaseClient;
    }
    if (typeof window.getSB === 'function') {
      try {
        const client = await window.getSB();
        if (client && typeof client.from === 'function') return client;
      } catch (e) {}
    }
    if (window.supabase && typeof window.supabase.from === 'function') {
      return window.supabase;
    }
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
        window._astaSupabase = client;
        window.supabaseClient = client;
        return client;
      } catch (err) {
        console.warn('[StatsHydrator] Impossible d\'initialiser le client Supabase:', err);
      }
    }
    return null;
  }

  async function hydrateProductStats() {
    // Sélectionner uniquement les cartes non encore traitées
    const cards = document.querySelectorAll('[data-product-id]:not([data-stats-loaded="true"])');
    if (cards.length === 0) return;

    // Marquer immédiatement TOUTES les cartes trouvées pour bloquer toute ré-exécution
    cards.forEach(card => card.setAttribute('data-stats-loaded', 'true'));

    const productIds = Array.from(cards)
      .map(card => card.getAttribute('data-product-id'))
      .filter(Boolean);

    if (productIds.length === 0) return;

    try {
      const sb = await getSupabaseClient();
      if (!sb) {
        // Fallback gracieux si LootZoneStats a déjà mis en cache les stats
        if (window.LootZoneStats && typeof window.LootZoneStats.get === 'function') {
          cards.forEach(card => {
            const pid = card.getAttribute('data-product-id')?.toLowerCase();
            if (!pid) return;
            const stats = window.LootZoneStats.get(pid);
            if (stats) {
              const ratingEl = card.querySelector('.product-rating-val');
              const salesEl = card.querySelector('.product-sales-val');
              if (ratingEl) ratingEl.innerHTML = formatRatingText(stats.avg_rating);
              if (salesEl) salesEl.textContent = formatSalesText(stats.total_sales);
            }
          });
        }
        return;
      }

      let statsList = null;

      // 1. Tenter la procédure RPC si la méthode rpc existe sur l'instance Supabase
      if (typeof sb.rpc === 'function') {
        try {
          const { data, error } = await sb.rpc('get_product_stats_batch', {
            p_ids: productIds
          });
          if (!error && Array.isArray(data)) {
            statsList = data;
          }
        } catch (rpcErr) {
          console.debug('[StatsHydrator] RPC batch non disponible, tentative directe sur vue:', rpcErr);
        }
      }

      // 2. Fallback lecture directe sur la vue public.product_stats
      if (!statsList && typeof sb.from === 'function') {
        try {
          const { data, error } = await sb
            .from('product_stats')
            .select('product_id, total_sales, avg_rating');
          if (!error && Array.isArray(data)) {
            statsList = data;
          }
        } catch (viewErr) {
          console.debug('[StatsHydrator] Vue product_stats non accessible:', viewErr);
        }
      }

      if (statsList && Array.isArray(statsList)) {
        const statsMap = {};
        statsList.forEach(item => {
          if (item && item.product_id !== undefined && item.product_id !== null) {
            statsMap[String(item.product_id).toLowerCase()] = item;
          }
        });

        cards.forEach(card => {
          const pid = card.getAttribute('data-product-id')?.toLowerCase();
          if (!pid) return;

          const stats = statsMap[pid] || { total_sales: 0, avg_rating: null };
          const ratingEl = card.querySelector('.product-rating-val');
          const salesEl = card.querySelector('.product-sales-val');

          if (ratingEl) ratingEl.innerHTML = formatRatingText(stats.avg_rating);
          if (salesEl) salesEl.textContent = formatSalesText(stats.total_sales);
        });
      }

      // Synchronisation dynamique des informations produits depuis le Dashboard / API
      try {
        const prodRes = await fetch('/api/products?all=true');
        if (prodRes.ok) {
          const pData = await prodRes.json();
          const pList = pData.products || pData.data;
          if (Array.isArray(pList)) {
            const pMap = new Map();
            pList.forEach(p => pMap.set(String(p.id), p));
            cards.forEach(card => {
              const pid = card.getAttribute('data-product-id');
              if (!pid) return;
              const live = pMap.get(String(pid));
              if (live) {
                if (live.is_active === false) {
                  card.style.display = 'none';
                } else {
                  if (live.name) {
                    const titleEl = card.querySelector('.card-title');
                    if (titleEl) titleEl.textContent = live.name;
                  }
                  const discEl = card.querySelector('.card-discount');
                  if (live.discount) {
                    if (discEl) {
                      discEl.textContent = live.discount;
                      discEl.style.display = '';
                    }
                  } else if (discEl) {
                    discEl.style.display = 'none';
                  }
                }
              }
            });
          }
        }
      } catch (_) {}
    } catch (err) {
      console.warn("[StatsHydrator] Erreur d'hydratation des statistiques :", err);
    }
  }

  // Rendre la fonction disponible pour les scripts de filtres / catalogue
  window.hydrateProductStats = hydrateProductStats;

  // Exécution unique au chargement
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrateProductStats);
  } else {
    hydrateProductStats();
  }
})();
