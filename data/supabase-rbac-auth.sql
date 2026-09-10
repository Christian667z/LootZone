-- ═══════════════════════════════════════════════════════════════════════════════
--  LOOTZONE - SYSTÈME D'AUTHENTIFICATION STAFF & ROLES SUPABASE (RBAC)
--  PostgreSQL / Supabase SQL Editor Script - Version 2.1 (Fix Contraintes Check)
-- ═══════════════════════════════════════════════════════════════════════════════
--  Correction de l'erreur PostgreSQL 23514 (violates check constraint "profiles_role_check") :
--  La contrainte originale n'autorisait pas 'staff' ni 'super_admin'.
--  Ce script met à jour la contrainte pour accepter tous les rôles administratifs !
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. MISE À JOUR IMMÉDIATE DES CONTRAINTES DE CHECK SUR PROFILES
-- ─────────────────────────────────────────────────────────────────────────────

-- A. Table profiles (création si absente)
CREATE TABLE IF NOT EXISTS public.profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email           TEXT,
    full_name       TEXT,
    nom             TEXT,
    prenom          TEXT,
    role            TEXT NOT NULL DEFAULT 'client',
    statut_presence TEXT DEFAULT 'en_ligne',
    avatar_url      TEXT,
    user_code       TEXT UNIQUE,
    wallet_balance  NUMERIC(10,2) DEFAULT 0.00,
    points          INT DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Colonnes additionnelles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'full_name') THEN
        ALTER TABLE public.profiles ADD COLUMN full_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'nom') THEN
        ALTER TABLE public.profiles ADD COLUMN nom TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'prenom') THEN
        ALTER TABLE public.profiles ADD COLUMN prenom TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'statut_presence') THEN
        ALTER TABLE public.profiles ADD COLUMN statut_presence TEXT DEFAULT 'en_ligne';
    END IF;
END $$;

-- B. CORRECTION CRITIQUE : Élargissement de la contrainte profiles_role_check
-- Inclut impérativement 'staff' et 'super_admin' pour éviter l'erreur 23514
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IN (
        'super_admin', 'admin', 'staff', 'client',
        'directeur', 'administrateur', 'manager', 'employe', 'helper',
        'partenaire', 'alliance', 'recruteur', 'influenceur', 'vendeur', 'vip'
    ));

-- C. Contrainte statut_presence
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_statut_presence_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_statut_presence_check
    CHECK (statut_presence IN ('en_ligne', 'occupe', 'deconnecte'));

ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'client';

-- Index pour requêtes rapides
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- D. Table allowed_staff_emails (Liste blanche d'autorisation du staff)
CREATE TABLE IF NOT EXISTS public.allowed_staff_emails (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL,
    assigned_role   TEXT NOT NULL DEFAULT 'staff',
    added_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_allowed_staff_emails_lower 
ON public.allowed_staff_emails (LOWER(TRIM(email)));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. FONCTIONS UTILITAIRES DE VÉRIFICATION DU RÔLE (SECURITY DEFINER)
-- ─────────────────────────────────────────────────────────────────────────────

-- Vérifie si l'utilisateur est membre du staff ou de la direction
CREATE OR REPLACE FUNCTION public.is_staff_or_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
BEGIN
    IF user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT role INTO v_role 
    FROM public.profiles 
    WHERE id = user_id;

    RETURN v_role IN ('super_admin', 'admin', 'staff', 'directeur', 'administrateur', 'manager', 'employe', 'helper');
END;
$$;

-- Vérifie si l'utilisateur est admin ou super_admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
BEGIN
    IF user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT role INTO v_role 
    FROM public.profiles 
    WHERE id = user_id;

    RETURN v_role IN ('super_admin', 'admin', 'directeur', 'administrateur');
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TRIGGERS AUTOMATIQUES
-- ─────────────────────────────────────────────────────────────────────────────

-- Auto-confirmation email
CREATE OR REPLACE FUNCTION public.auto_confirm_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF NEW.email_confirmed_at IS NULL THEN
        NEW.email_confirmed_at := NOW();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_auto_confirm
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_confirm_new_user();

-- Trigger handle_new_user() avec synchronisation de la liste blanche
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_clean_email   TEXT;
    v_assigned_role TEXT := 'client';
    v_full_name     TEXT;
    v_first_name    TEXT;
    v_last_name     TEXT;
BEGIN
    v_clean_email := LOWER(TRIM(NEW.email));

    v_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        TRIM(CONCAT_WS(' ', NEW.raw_user_meta_data->>'prenom', NEW.raw_user_meta_data->>'nom')),
        split_part(v_clean_email, '@', 1)
    );
    v_first_name := COALESCE(NEW.raw_user_meta_data->>'prenom', split_part(v_full_name, ' ', 1));
    v_last_name  := COALESCE(NEW.raw_user_meta_data->>'nom', substring(v_full_name from position(' ' in v_full_name) + 1));

    -- Recherche dans la liste blanche
    SELECT assigned_role 
    INTO v_assigned_role
    FROM public.allowed_staff_emails
    WHERE LOWER(TRIM(email)) = v_clean_email
    LIMIT 1;

    IF v_assigned_role IS NULL THEN
        v_assigned_role := 'client';
    END IF;

    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        nom,
        prenom,
        role,
        statut_presence,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        v_clean_email,
        v_full_name,
        v_last_name,
        v_first_name,
        v_assigned_role,
        'en_ligne',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
        role = CASE 
            WHEN public.profiles.role = 'client' AND v_assigned_role <> 'client' 
                THEN v_assigned_role 
            ELSE public.profiles.role 
        END,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. POLITIQUES ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role can do all" ON public.profiles;

CREATE POLICY "Staff can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_staff_or_admin(auth.uid()));

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (
    id = auth.uid() 
    AND (
        role = (SELECT role FROM public.profiles WHERE id = auth.uid())
        OR public.is_admin(auth.uid())
    )
);

CREATE POLICY "Admins can update any profile"
ON public.profiles FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- RLS sur allowed_staff_emails
ALTER TABLE public.allowed_staff_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view allowed emails" ON public.allowed_staff_emails;
DROP POLICY IF EXISTS "Admins can manage allowed staff emails" ON public.allowed_staff_emails;

CREATE POLICY "Staff can view allowed emails"
ON public.allowed_staff_emails FOR SELECT TO authenticated
USING (public.is_staff_or_admin(auth.uid()));

CREATE POLICY "Admins can manage allowed staff emails"
ON public.allowed_staff_emails FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- RLS sur site_config
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'site_config') THEN
        DROP POLICY IF EXISTS "Directeur/Admin peut modifier site_config" ON public.site_config;
        CREATE POLICY "Directeur/Admin peut modifier site_config"
        ON public.site_config FOR UPDATE
        TO authenticated
        USING (public.is_admin(auth.uid()))
        WITH CHECK (public.is_admin(auth.uid()));
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. INITIALISATION DE LA LISTE BLANCHE & SYNCHRONISATION
-- ─────────────────────────────────────────────────────────────────────────────

-- Ajout des comptes staff et direction
INSERT INTO public.allowed_staff_emails (email, assigned_role)
VALUES 
    ('aristhenesainvilusvladimiranto@gmail.com', 'directeur'),
    ('aristheneroodjerry@gmail.com', 'super_admin'),
    ('lootzone.tester.app2026@gmail.com', 'staff')
ON CONFLICT (LOWER(TRIM(email))) DO UPDATE 
SET assigned_role = EXCLUDED.assigned_role;

-- Rétro-affectation sécurisée pour les utilisateurs déjà inscrits
UPDATE public.profiles p
SET 
    role = a.assigned_role,
    updated_at = NOW()
FROM public.allowed_staff_emails a
WHERE LOWER(TRIM(p.email)) = LOWER(TRIM(a.email))
  AND p.role <> a.assigned_role;

-- Synchronise tout utilisateur auth.users sans profil correspondant
INSERT INTO public.profiles (id, email, full_name, role, statut_presence, created_at, updated_at)
SELECT 
    u.id,
    LOWER(TRIM(u.email)),
    COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
    COALESCE(a.assigned_role, 'client'),
    'en_ligne',
    COALESCE(u.created_at, NOW()),
    NOW()
FROM auth.users u
LEFT JOIN public.allowed_staff_emails a ON LOWER(TRIM(u.email)) = LOWER(TRIM(a.email))
ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    updated_at = NOW();

DO $$
BEGIN
    RAISE NOTICE '✅ Configuration RBAC LootZone terminée sans erreur !';
END $$;
