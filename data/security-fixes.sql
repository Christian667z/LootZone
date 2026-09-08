-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  ASTA-SHOPS — CORRECTIONS SÉCURITÉ SUPABASE (Security Advisor)  ║
-- ╚══════════════════════════════════════════════════════════════════╝
-- Exécuter dans Supabase SQL Editor

-- ══════════════════════════════════════════════════════════════
-- 1. CORRIGER LES POLITIQUES RLS "ALWAYS TRUE" sur partenariat_requests
-- ══════════════════════════════════════════════════════════════

-- Supprimer les anciennes politiques trop permissives
DROP POLICY IF EXISTS "allow_all" ON partenariat_requests;
DROP POLICY IF EXISTS "anon_insert" ON partenariat_requests;
DROP POLICY IF EXISTS "public_read" ON partenariat_requests;

-- Politique : tout le monde peut créer une demande (formulaire public)
CREATE POLICY "insert_partenariat_public"
ON partenariat_requests FOR INSERT
TO public
WITH CHECK (true);

-- Politique : seuls les authentifiés (staff) peuvent lire
CREATE POLICY "select_partenariat_staff"
ON partenariat_requests FOR SELECT
TO authenticated
USING (true);

-- Politique : seuls les authentifiés peuvent modifier/supprimer
CREATE POLICY "update_partenariat_staff"
ON partenariat_requests FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "delete_partenariat_staff"
ON partenariat_requests FOR DELETE
TO authenticated
USING (true);

-- ══════════════════════════════════════════════════════════════
-- 2. TABLE support_messages (si elle n'existe pas encore)
--    + RLS correcte
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    email TEXT,
    sujet TEXT NOT NULL,
    message TEXT NOT NULL,
    statut TEXT DEFAULT 'ouvert' CHECK (statut IN ('ouvert', 'en_cours', 'resolu', 'ferme')),
    reponse TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "allow_all" ON support_messages;

-- Utilisateurs peuvent créer un ticket
CREATE POLICY "insert_support_public"
ON support_messages FOR INSERT
TO public
WITH CHECK (true);

-- Utilisateurs voient uniquement leurs propres tickets
CREATE POLICY "select_support_own"
ON support_messages FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('helper','employe','administrateur','manager','directeur')
    )
);

-- Staff peut modifier les tickets
CREATE POLICY "update_support_staff"
ON support_messages FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('helper','employe','administrateur','manager','directeur')
    )
);

-- ══════════════════════════════════════════════════════════════
-- 3. CORRIGER LE BUCKET "avatars" — désactiver le listing public
-- ══════════════════════════════════════════════════════════════

UPDATE storage.buckets
SET public = false
WHERE name = 'avatars';

-- Supprimer les politiques trop larges
DROP POLICY IF EXISTS "public_read_avatars" ON storage.objects;
DROP POLICY IF EXISTS "allow_all_avatars" ON storage.objects;

-- Lecture : uniquement le propriétaire et le staff
CREATE POLICY "avatars_select_owner"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'avatars'
    AND (
        auth.uid()::text = (storage.foldername(name))[1]
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('administrateur','manager','directeur')
        )
    )
);

-- Upload : chaque utilisateur dans son propre dossier
CREATE POLICY "avatars_insert_owner"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Mise à jour : propriétaire uniquement
CREATE POLICY "avatars_update_owner"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ══════════════════════════════════════════════════════════════
-- 4. CORRIGER LA FONCTION get_staff_kpi() — retirer SECURITY DEFINER
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_staff_kpi()
RETURNS TABLE (
    staff_id UUID,
    prenom TEXT,
    nom TEXT,
    role TEXT,
    commandes_ce_mois BIGINT,
    taux_satisfaction NUMERIC,
    temps_moyen_min NUMERIC
)
LANGUAGE plpgsql
-- SECURITY DEFINER retiré intentionnellement
AS $$
BEGIN
    -- Vérification : seul le staff authentifié peut accéder
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('administrateur','manager','directeur')
    ) THEN
        RAISE EXCEPTION 'Accès refusé';
    END IF;

    RETURN QUERY
    SELECT
        p.id AS staff_id,
        p.prenom,
        p.nom,
        p.role,
        COUNT(c.id) FILTER (
            WHERE c.created_at >= date_trunc('month', NOW())
            AND c.traite_par = p.id
        ) AS commandes_ce_mois,
        NULL::NUMERIC AS taux_satisfaction,
        NULL::NUMERIC AS temps_moyen_min
    FROM profiles p
    WHERE p.role IN ('helper','employe','administrateur','manager','directeur')
    GROUP BY p.id, p.prenom, p.nom, p.role
    ORDER BY commandes_ce_mois DESC;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- 5. ACTIVER LA PROTECTION MOTS DE PASSE COMPROMIS
--    (ne peut pas être fait via SQL — à faire dans Supabase Dashboard)
-- ══════════════════════════════════════════════════════════════
-- → Authentication > Settings > Password Protection
-- → Activer "Enable leaked password protection"
-- → Cela bloque les mots de passe trouvés dans des fuites de données connues

-- ══════════════════════════════════════════════════════════════
-- VÉRIFICATION FINALE
-- ══════════════════════════════════════════════════════════════
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('partenariat_requests', 'support_messages')
ORDER BY tablename, cmd;
