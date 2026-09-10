-- ═══════════════════════════════════════════════════════════════════════════════
--  LOOTZONE / ASTA-SHOPS — SCRIPT SQL DE RÉPARATION DE L'AUTHENTIFICATION & PROFILS
-- ═══════════════════════════════════════════════════════════════════════════════
--  Instructions :
--  1. Ouvrez votre tableau de bord Supabase : https://supabase.com/dashboard
--  2. Rendez-vous dans votre projet -> "SQL Editor"
--  3. Créez une nouvelle requête, collez tout le contenu de ce script et cliquez "RUN"
--  4. Tous les utilisateurs bloqués par "Email not confirmed" seront immédiatement débloqués
--     et tous les futurs comptes créés pourront se connecter instantanément !
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. AUTO-CONFIRMATION DES EMAILS (Résout définitivement "Email not confirmed")
-- ─────────────────────────────────────────────────────────────────────────────
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

-- Débloquer tous les utilisateurs actuellement inscrits dont l'email n'a pas été confirmé
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABLE PROFILES & COLONNES REQUISES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT,
  nom             TEXT,
  prenom          TEXT,
  role            TEXT NOT NULL DEFAULT 'client',
  statut_presence TEXT DEFAULT 'deconnecte',
  avatar_url      TEXT,
  affiliate_code  TEXT UNIQUE,
  user_code       TEXT UNIQUE,
  wallet_balance  NUMERIC(10,2) DEFAULT 0,
  points          INT DEFAULT 0,
  vip_niveau      TEXT DEFAULT 'membre',
  birthday        DATE,
  pseudo          TEXT,
  total_depenses  NUMERIC(12,2) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_code       TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wallet_balance  NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS points          INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vip_niveau      TEXT DEFAULT 'membre';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birthday        DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pseudo          TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_depenses  NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS statut_presence TEXT DEFAULT 'deconnecte';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url      TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS affiliate_code  TEXT;

-- Mise à jour des contraintes de rôles (inclut admin, staff, partenaires, etc.)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('client','helper','employe','administrateur','admin','manager','directeur','partenaire','alliance','recruteur','influenceur','vendeur','vip'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_statut_presence_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_statut_presence_check
  CHECK (statut_presence IN ('en_ligne','occupe','deconnecte'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. POLITIQUES DE SÉCURITÉ RLS SUR PROFILES
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tout utilisateur connecté peut lire les profils" ON public.profiles;
DROP POLICY IF EXISTS "Staff peut lire les profils" ON public.profiles;
DROP POLICY IF EXISTS "Lecture des profils" ON public.profiles;
CREATE POLICY "Lecture des profils"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Chacun modifie son propre profil" ON public.profiles;
DROP POLICY IF EXISTS "Staff peut modifier son propre profil" ON public.profiles;
DROP POLICY IF EXISTS "Modification profil" ON public.profiles;
CREATE POLICY "Modification profil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role peut insérer profils" ON public.profiles;
DROP POLICY IF EXISTS "Insertion profil" ON public.profiles;
CREATE POLICY "Insertion profil"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id OR auth.role() = 'service_role' OR auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TRIGGER SUR AUTH.USERS POUR CRÉATION AUTOMATIQUE DU PROFIL (PRENOM, NOM, ROLE)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  generated_code TEXT;
  extracted_prenom TEXT;
  extracted_nom TEXT;
  extracted_role TEXT;
BEGIN
  -- Génère un code unique de 6 caractères (ex: 8F2A9C)
  generated_code := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 6));

  -- 1. Extraction robuste du prénom
  extracted_prenom := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'prenom'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'given_name'), ''),
    NULLIF(TRIM(SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'name', ''), ' ', 1)), ''),
    NULLIF(TRIM(SPLIT_PART(NEW.email, '@', 1)), ''),
    'Membre'
  );

  -- 2. Extraction robuste du nom
  extracted_nom := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'nom'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'last_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'family_name'), ''),
    NULLIF(TRIM(SUBSTRING(COALESCE(NEW.raw_user_meta_data->>'name', '') FROM POSITION(' ' IN COALESCE(NEW.raw_user_meta_data->>'name', '')) + 1)), ''),
    ''
  );

  -- 3. Extraction robuste du rôle (défaut 'client')
  extracted_role := COALESCE(
    NULLIF(LOWER(TRIM(NEW.raw_user_meta_data->>'role')), ''),
    'client'
  );

  -- Insérer ou mettre à jour le profil
  INSERT INTO public.profiles (
    id,
    email,
    nom,
    prenom,
    user_code,
    role,
    statut_presence,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    extracted_nom,
    extracted_prenom,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'user_code'), ''), generated_code),
    extracted_role,
    'deconnecte',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    nom = CASE
      WHEN EXCLUDED.nom <> '' THEN EXCLUDED.nom
      ELSE profiles.nom
    END,
    prenom = CASE
      WHEN EXCLUDED.prenom <> '' THEN EXCLUDED.prenom
      ELSE profiles.prenom
    END,
    role = CASE
      WHEN EXCLUDED.role IS NOT NULL AND EXCLUDED.role <> 'client' THEN EXCLUDED.role
      ELSE COALESCE(profiles.role, EXCLUDED.role)
    END,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. CRÉATION & SYNCHRONISATION RÉTROACTIVE DES PROFILS MANQUANTS
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.profiles (id, email, nom, prenom, user_code, role)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'nom', u.raw_user_meta_data->>'last_name', ''),
  COALESCE(u.raw_user_meta_data->>'prenom', u.raw_user_meta_data->>'first_name', SPLIT_PART(u.email, '@', 1)),
  UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 6)),
  COALESCE(NULLIF(LOWER(TRIM(u.raw_user_meta_data->>'role')), ''), 'client')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Synchroniser nom, prénom et rôle pour les profils existants incomplets
UPDATE public.profiles p
SET
  nom = CASE 
    WHEN (p.nom IS NULL OR p.nom = '') AND (u.raw_user_meta_data->>'nom' IS NOT NULL OR u.raw_user_meta_data->>'last_name' IS NOT NULL)
    THEN COALESCE(u.raw_user_meta_data->>'nom', u.raw_user_meta_data->>'last_name', '')
    ELSE p.nom
  END,
  prenom = CASE 
    WHEN (p.prenom IS NULL OR p.prenom = '')
    THEN COALESCE(u.raw_user_meta_data->>'prenom', u.raw_user_meta_data->>'first_name', SPLIT_PART(u.email, '@', 1))
    ELSE p.prenom
  END,
  role = CASE 
    WHEN (p.role IS NULL OR p.role = 'client') AND u.raw_user_meta_data->>'role' IS NOT NULL
    THEN LOWER(TRIM(u.raw_user_meta_data->>'role'))
    ELSE COALESCE(p.role, 'client')
  END,
  user_code = CASE
    WHEN p.user_code IS NULL OR p.user_code = ''
    THEN UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 6))
    ELSE p.user_code
  END,
  updated_at = NOW()
FROM auth.users u
WHERE p.id = u.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- RÉSULTAT
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 
  (SELECT COUNT(*) FROM auth.users) as total_utilisateurs_auth,
  (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NOT NULL) as utilisateurs_confirmes,
  (SELECT COUNT(*) FROM public.profiles) as total_profils_crees;
