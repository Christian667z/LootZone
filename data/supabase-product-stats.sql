-- ═══════════════════════════════════════════════════════════════════════════════
--  LOOTZONE - MÉTRIQUES DYNAMIQUES UNIVERSELLES (ANTI-CASSE)
--  Fichier : data/supabase-product-stats.sql
-- ═══════════════════════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS public.product_stats CASCADE;

CREATE OR REPLACE VIEW public.product_stats AS
WITH sales_agg AS (
    SELECT 
        LOWER(TRIM(produit_id::TEXT)) AS product_id,
        COUNT(*)::INT AS total_sales
    FROM public.commandes
    WHERE LOWER(statut) IN ('completed', 'paid', 'livree', 'paye', 'validé', 'valide')
      AND produit_id IS NOT NULL
    GROUP BY LOWER(TRIM(produit_id::TEXT))
),
reviews_agg AS (
    SELECT 
        LOWER(TRIM(product_id::TEXT)) AS product_id,
        ROUND(AVG(rating)::NUMERIC, 1)::NUMERIC(3,1) AS avg_rating,
        COUNT(*)::INT AS total_reviews
    FROM public.reviews
    WHERE is_approved = true
      AND product_id IS NOT NULL
    GROUP BY LOWER(TRIM(product_id::TEXT))
),
all_keys AS (
    SELECT LOWER(TRIM(id::TEXT)) AS product_id FROM public.products WHERE id IS NOT NULL
    UNION
    SELECT product_id FROM sales_agg
    UNION
    SELECT product_id FROM reviews_agg
)
SELECT 
    k.product_id,
    COALESCE(s.total_sales, 0)::INT AS total_sales,
    COALESCE(r.avg_rating, NULL)::NUMERIC(3,1) AS avg_rating,
    COALESCE(r.total_reviews, 0)::INT AS total_reviews
FROM all_keys k
LEFT JOIN sales_agg s ON s.product_id = k.product_id
LEFT JOIN reviews_agg r ON r.product_id = k.product_id;

GRANT SELECT ON public.product_stats TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_product_stats_batch(p_ids TEXT[])
RETURNS TABLE (
    product_id TEXT,
    total_sales INT,
    avg_rating NUMERIC(3,1),
    total_reviews INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH req_ids AS (
        SELECT UNNEST(p_ids) AS requested_id
    )
    SELECT 
        r.requested_id AS product_id,
        COALESCE(ps.total_sales, 0)::INT AS total_sales,
        ps.avg_rating,
        COALESCE(ps.total_reviews, 0)::INT AS total_reviews
    FROM req_ids r
    LEFT JOIN public.product_stats ps ON LOWER(TRIM(ps.product_id)) = LOWER(TRIM(r.requested_id));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_stats_batch(TEXT[]) TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SCRIPT DE RÉINITIALISATION À 0 (CLEAR / RESET) POUR LE LANCEMENT
-- ⚠️ À exécuter UNIQUEMENT pour remettre toutes les métriques à zéro
-- ═══════════════════════════════════════════════════════════════════════════════
/*
TRUNCATE TABLE public.commandes CASCADE;
TRUNCATE TABLE public.reviews CASCADE;

-- Vérification :
SELECT * FROM public.product_stats;
-- Résultat : "0 Vendu", note "Nouveau"
*/
