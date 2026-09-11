-- ═══════════════════════════════════════════════════════════════════════════════
--  LOOTZONE - SYSTÈME DE COMMENTAIRES & AVIS CLIENTS DYNAMIQUE (SUPABASE)
--  PostgreSQL / Supabase SQL Editor Script
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABLE PUBLIC.REVIEWS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    product_id      TEXT NOT NULL,
    author_name     TEXT NOT NULL,
    rating          INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    tag             TEXT DEFAULT 'Recharge Validée',
    comment         TEXT NOT NULL,
    is_verified     BOOLEAN DEFAULT false,
    is_vip          BOOLEAN DEFAULT false,
    is_approved     BOOLEAN DEFAULT true,
    likes_count     INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour requêtes performantes par produit et statut de modération
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_approved_created ON public.reviews(is_approved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. POLITIQUES DE SÉCURITÉ ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Nettoyage des anciennes politiques
DROP POLICY IF EXISTS "Public can read approved reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can insert reviews" ON public.reviews;
DROP POLICY IF EXISTS "Staff can update reviews" ON public.reviews;
DROP POLICY IF EXISTS "Staff can delete reviews" ON public.reviews;

-- A. Lecture : Tout le monde (y compris les visiteurs anonymes 'anon') peut lire les avis approuvés
CREATE POLICY "Public can read approved reviews"
ON public.reviews
FOR SELECT
TO anon, authenticated
USING (
    is_approved = true 
    OR (auth.uid() IS NOT NULL AND public.is_staff_or_admin(auth.uid()))
);

-- B. Insertion : Les utilisateurs connectés ou visiteurs peuvent ajouter un avis
CREATE POLICY "Users can insert reviews"
ON public.reviews
FOR INSERT
TO anon, authenticated
WITH CHECK (
    author_name IS NOT NULL 
    AND LENGTH(TRIM(author_name)) >= 2
    AND comment IS NOT NULL 
    AND LENGTH(TRIM(comment)) >= 5
    AND rating BETWEEN 1 AND 5
);

-- C. Modification & Modération : Seuls les membres du staff / admins
CREATE POLICY "Staff can update reviews"
ON public.reviews
FOR UPDATE
TO authenticated
USING (public.is_staff_or_admin(auth.uid()))
WITH CHECK (public.is_staff_or_admin(auth.uid()));

-- D. Suppression : Seuls les membres du staff / admins
CREATE POLICY "Staff can delete reviews"
ON public.reviews
FOR DELETE
TO authenticated
USING (public.is_staff_or_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. FONCTION RPC POUR L'INCRÉMENTATION DES LIKES "UTILE (X)"
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_review_likes(review_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_likes INT;
BEGIN
    UPDATE public.reviews
    SET likes_count = COALESCE(likes_count, 0) + 1
    WHERE id = review_id
    RETURNING likes_count INTO v_new_likes;

    RETURN v_new_likes;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_review_likes(UUID) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. DONNÉES DE TEST INITIALES POUR LE PRODUIT ID "21" (FREE FIRE / MONCASH)
-- ─────────────────────────────────────────────────────────────────────────────

-- Nettoyer les avis précédents du produit 21 pour éviter les doublons lors de réexécutions
DELETE FROM public.reviews WHERE product_id = '21';

INSERT INTO public.reviews (
    product_id, author_name, rating, tag, comment, is_verified, is_vip, is_approved, likes_count, created_at
) VALUES 
(
    '21',
    'Jean-Marc D.',
    5,
    'Recharge Validée',
    'Incroyablement rapide ! J''ai payé par Moncash et les crédits étaient sur mon compte en moins de 3 minutes chrono. Meilleur site de recharge en Haïti.',
    true,
    true,
    true,
    42,
    NOW() - INTERVAL '20 minutes'
),
(
    '21',
    'Guerrier_HT',
    5,
    'Livraison Rapide',
    'Top sèvis ! Mwen te fè rechaj 1080 Diamonds Free Fire la ak MonCash, li pase imedyatman san okenn tèt chaje. Mwen rekòmande LootZone a 100%.',
    true,
    false,
    true,
    19,
    NOW() - INTERVAL '2 hours'
),
(
    '21',
    'Stanley_Pro',
    5,
    'VIP',
    'Client fidèle depi 6 mwa. Bon pri, livrezon an mwens 5 minit sou Natcash tou. Pi bon platfòm gaming nan peyi a !',
    true,
    true,
    true,
    28,
    NOW() - INTERVAL '1 day'
),
(
    '21',
    'Vanessa K.',
    5,
    'Livraison Rapide',
    'Très satisfaite ! Première fois que je commande des diamants Free Fire sur LootZone et tout s''est super bien passé avec mon numéro MonCash.',
    true,
    false,
    true,
    14,
    NOW() - INTERVAL '2 days'
),
(
    '21',
    'Ti_Sony_FF',
    4,
    'Recharge Validée',
    'Trè rapid e serye. Ti kras reta 2 minit pou Natcash men sipò a te reponn imedyatman sou WhatsApp pou konfime. Mèsi anpil !',
    true,
    false,
    true,
    9,
    NOW() - INTERVAL '3 days'
);

DO $$
BEGIN
    RAISE NOTICE '✅ Table reviews et avis clients initialisés avec succès !';
END $$;
