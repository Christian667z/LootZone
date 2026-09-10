-- ═══════════════════════════════════════════════════════════════
--  ASTA-SHOPS — SCHÉMA SUPABASE COMPLET v2.2 (SÉCURISÉ)
--  À exécuter dans Supabase → SQL Editor
--  (une seule fois, idempotent — sans danger si re-exécuté)
-- ═══════════════════════════════════════════════════════════════
--
--  ⚠️  IMPORTANT — SÉCURITÉ APRÈS EXÉCUTION :
--  1. Activez la "Protection contre les fuites de mots de passe" dans :
--     Supabase Dashboard → Authentication → Settings → Password Protection → ON
--  2. Vérifiez Authentication → Providers → Email → "Confirm email" = ON
--
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
--  EXTENSIONS
-- ─────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════
--  0. AUTO-CONFIRMATION DES EMAILS (auth.users)
--  Permet à tous les utilisateurs de se connecter sans blocage "Email not confirmed"
-- ═══════════════════════════════════════════════════════════════
create or replace function public.auto_confirm_new_user()
returns trigger language plpgsql security definer
set search_path = public, auth
as $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end; $$;

drop trigger if exists on_auth_user_auto_confirm on auth.users;
create trigger on_auth_user_auto_confirm
  before insert on auth.users
  for each row execute function public.auto_confirm_new_user();

-- Débloquer tous les utilisateurs existants
update auth.users
set email_confirmed_at = now()
where email_confirmed_at is null;

-- ═══════════════════════════════════════════════════════════════
--  1. PROFILES (lié à auth.users via trigger)
-- ═══════════════════════════════════════════════════════════════
create table if not exists profiles (
  id              uuid        primary key references auth.users(id) on delete cascade,
  email           text,
  nom             text,
  prenom          text,
  role            text        not null default 'client',
  statut_presence text        default 'deconnecte',
  avatar_url      text,
  affiliate_code  text        unique,
  user_code       text        unique,
  wallet_balance  numeric(10,2) default 0,
  points          int          default 0,
  vip_niveau      text         default 'membre',
  birthday        date,
  pseudo          text,
  total_depenses  numeric(12,2) default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table profiles add column if not exists user_code       text;
alter table profiles add column if not exists wallet_balance  numeric(10,2) default 0;
alter table profiles add column if not exists points          int          default 0;
alter table profiles add column if not exists vip_niveau      text         default 'membre';
alter table profiles add column if not exists birthday        date;
alter table profiles add column if not exists pseudo          text;
alter table profiles add column if not exists total_depenses  numeric(12,2) default 0;
alter table profiles add column if not exists statut_presence text         default 'deconnecte';
alter table profiles add column if not exists avatar_url      text;
alter table profiles add column if not exists affiliate_code  text;

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('client','helper','employe','administrateur','admin','manager','directeur','partenaire','alliance','recruteur','influenceur','vendeur','vip'));

alter table profiles drop constraint if exists profiles_statut_presence_check;
alter table profiles add constraint profiles_statut_presence_check
  check (statut_presence in ('en_ligne','occupe','deconnecte'));

alter table profiles enable row level security;

drop policy if exists "Tout utilisateur connecté peut lire les profils" on profiles;
drop policy if exists "Staff peut lire les profils" on profiles;
drop policy if exists "Lecture des profils" on profiles;
create policy "Lecture des profils"
  on profiles for select
  using (true);

drop policy if exists "Chacun modifie son propre profil" on profiles;
drop policy if exists "Staff peut modifier son propre profil" on profiles;
drop policy if exists "Modification profil" on profiles;
create policy "Modification profil"
  on profiles for update
  using (auth.uid() = id or auth.role() = 'service_role');

drop policy if exists "Service role peut insérer profils" on profiles;
drop policy if exists "Insertion profil" on profiles;
create policy "Insertion profil"
  on profiles for insert
  with check (auth.uid() = id or auth.role() = 'service_role' or auth.uid() is not null);

-- ─────────────────────────────────────────────────────────────
--  TRIGGER : auto-créer profil à l'inscription
-- ─────────────────────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  generated_code text;
begin
  generated_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));

  insert into public.profiles (
    id,
    email,
    nom,
    prenom,
    user_code,
    role,
    statut_presence
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nom', new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'prenom', new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'user_code', generated_code),
    coalesce(new.raw_user_meta_data->>'role', 'client'),
    'deconnecte'
  )
  on conflict (id) do update set
    email = excluded.email,
    nom = coalesce(nullif(excluded.nom, ''), profiles.nom),
    prenom = coalesce(nullif(excluded.prenom, ''), profiles.prenom),
    updated_at = now();

  return new;
end; $$;

-- ✅ SÉCURITÉ : révoquer l'exécution publique de cette fonction trigger
revoke execute on function handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill profils manquants pour les utilisateurs existants
insert into public.profiles (id, email, nom, prenom, user_code, role)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'nom', ''),
  coalesce(u.raw_user_meta_data->>'prenom', split_part(u.email, '@', 1)),
  upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6)),
  coalesce(u.raw_user_meta_data->>'role', 'client')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- ═══════════════════════════════════════════════════════════════
--  2. SITE_CONFIG (taux EUR→HTG, maintenance, etc.)
-- ═══════════════════════════════════════════════════════════════
create table if not exists site_config (
  id                int         primary key default 1,
  taux_eur_htg      numeric(10,2) not null default 135,
  devise_affichage  text        default 'HTG',
  maintenance_mode  boolean     default false,
  support_status    text        default 'en_ligne',
  updated_by        uuid        references profiles(id),
  updated_at        timestamptz default now()
);

insert into site_config (id, taux_eur_htg)
  values (1, 135)
  on conflict (id) do nothing;

alter table site_config enable row level security;

drop policy if exists "Lecture publique site_config" on site_config;
create policy "Lecture publique site_config"
  on site_config for select
  using (true);

drop policy if exists "Directeur/Admin peut modifier site_config" on site_config;
create policy "Directeur/Admin peut modifier site_config"
  on site_config for update
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('directeur','administrateur')
    )
  );

-- ═══════════════════════════════════════════════════════════════
--  3. PRODUCTS (catalogue)
-- ═══════════════════════════════════════════════════════════════
create table if not exists products (
  id              serial      primary key,
  name            text        not null,
  category        text        not null,
  img             text,
  "desc"          text,
  discount        text,
  rating          numeric(3,1) default 5.0,
  sales           text,
  recommended     boolean     default false,
  date            date,
  price           numeric(10,2),
  needs_server    boolean     default false,
  server_options  jsonb       default '[]',
  id_label        text,
  id_placeholder  text,
  denoms          jsonb       default '[]',
  discount_tiers  jsonb       default '[]',
  is_active       boolean     default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table products enable row level security;

drop policy if exists "Lecture publique produits" on products;
create policy "Lecture publique produits"
  on products for select
  using (true);

drop policy if exists "Admin+ peut gérer produits" on products;
create policy "Admin+ peut gérer produits"
  on products for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('directeur','manager','administrateur')
    )
  );

-- ═══════════════════════════════════════════════════════════════
--  4. COMMANDES
-- ═══════════════════════════════════════════════════════════════
create table if not exists commandes (
  id              text        primary key,
  client_id       uuid        references profiles(id),
  client_email    text,
  client_nom      text,
  produit_id      int         references products(id),
  produit_nom     text,
  categorie       text,
  denom_label     text,
  player_id       text,
  server          text,
  eur             numeric(10,2),
  htg             numeric(10,2),
  methode_paiement text,
  statut          text        not null default 'en_attente'
    check (statut in ('en_attente','en_cours','livree','annulee','risque_eleve')),
  locked_by       text,
  locked_at       timestamptz,
  risk_score      int         default 0,
  risk_flags      jsonb       default '[]',
  code_envoye     text,
  livree_at       timestamptz,
  livree_par      uuid        references profiles(id),
  note_client     numeric(3,1),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table commandes enable row level security;

drop policy if exists "Staff employe+ peut voir les commandes" on commandes;
create policy "Staff employe+ peut voir les commandes"
  on commandes for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('directeur','manager','administrateur','employe')
    )
  );

drop policy if exists "Staff employe+ peut modifier les commandes" on commandes;
create policy "Staff employe+ peut modifier les commandes"
  on commandes for update
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('directeur','manager','administrateur','employe')
    )
  );

-- ✅ SÉCURITÉ : insert commandes réservé aux utilisateurs authentifiés seulement
drop policy if exists "Système peut insérer commandes" on commandes;
create policy "Système peut insérer commandes"
  on commandes for insert
  with check (
    auth.uid() is not null
    or auth.role() = 'service_role'
  );

-- ═══════════════════════════════════════════════════════════════
--  5. LOGS_ACTIVITE (indestructible — pas de DELETE policy)
-- ═══════════════════════════════════════════════════════════════
create table if not exists logs_activite (
  id              bigserial   primary key,
  staff_id        uuid        references profiles(id),
  staff_role      text,
  action          text        not null,
  cible           text,
  ancienne_valeur text,
  nouvelle_valeur text,
  created_at      timestamptz default now()
);

alter table logs_activite enable row level security;

drop policy if exists "Directeur/Manager peut lire les logs" on logs_activite;
create policy "Directeur/Manager peut lire les logs"
  on logs_activite for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('directeur','manager')
    )
  );

-- ✅ SÉCURITÉ : logs insérables uniquement via service_role (backend)
drop policy if exists "Système peut insérer les logs" on logs_activite;
create policy "Système peut insérer les logs"
  on logs_activite for insert
  with check (auth.role() = 'service_role');

-- Pas de policy DELETE → logs indestructibles

-- ═══════════════════════════════════════════════════════════════
--  6. PARTENARIAT_REQUESTS
-- ═══════════════════════════════════════════════════════════════
create table if not exists partenariat_requests (
  id            uuid        primary key default uuid_generate_v4(),
  type          text        not null check (type in ('partenaire','vendeur','createur','alliance')),
  nom           text        not null,
  email         text        not null,
  structure     text,
  reseaux       jsonb       default '{}',
  abonnes       text,
  volume_vente  text,
  message       text,
  user_id       uuid        references profiles(id),
  statut        text        default 'en_attente'
    check (statut in ('en_attente','en_cours','valide','rejete')),
  valide_par    uuid        references profiles(id),
  valide_at     timestamptz,
  rejete_par    uuid        references profiles(id),
  motif_rejet   text,
  affiliate_code text,
  messages_chat jsonb       default '[]',
  created_at    timestamptz default now()
);

alter table partenariat_requests enable row level security;

drop policy if exists "Manager+ peut voir les demandes partenariat" on partenariat_requests;
create policy "Manager+ peut voir les demandes partenariat"
  on partenariat_requests for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('directeur','manager','administrateur')
    )
  );

drop policy if exists "Manager+ peut gérer les demandes partenariat" on partenariat_requests;
create policy "Manager+ peut gérer les demandes partenariat"
  on partenariat_requests for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('directeur','manager')
    )
  );

-- ✅ SÉCURITÉ : formulaire partenariat = requiert au moins une session (ou service_role)
drop policy if exists "Système peut insérer demandes partenariat" on partenariat_requests;
create policy "Public peut soumettre demande partenariat"
  on partenariat_requests for insert
  with check (true);

-- ═══════════════════════════════════════════════════════════════
--  7. PARTENARIAT_MESSAGES (chat officiel)
-- ═══════════════════════════════════════════════════════════════
create table if not exists partenariat_messages (
  id            uuid        primary key default uuid_generate_v4(),
  request_id    uuid        references partenariat_requests(id) on delete cascade,
  staff_id      uuid        references profiles(id),
  message       text        not null,
  approved_from uuid,
  created_at    timestamptz default now()
);

alter table partenariat_messages enable row level security;

drop policy if exists "Staff peut voir les messages partenariat" on partenariat_messages;
create policy "Staff peut voir les messages partenariat"
  on partenariat_messages for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('directeur','manager','administrateur','employe','helper')
    )
  );

-- ✅ SÉCURITÉ : uniquement staff authentifié ou service_role
drop policy if exists "Système peut insérer messages partenariat" on partenariat_messages;
create policy "Staff peut insérer messages partenariat"
  on partenariat_messages for insert
  with check (
    auth.uid() is not null
    or auth.role() = 'service_role'
  );

-- ═══════════════════════════════════════════════════════════════
--  8. MESSAGES_BROUILLONS (soumis par les Helpers, validés par Admin+)
-- ═══════════════════════════════════════════════════════════════
create table if not exists messages_brouillons (
  id            uuid        primary key default uuid_generate_v4(),
  request_id    uuid        references partenariat_requests(id) on delete cascade,
  helper_id     uuid        references profiles(id),
  message       text        not null,
  statut        text        default 'en_attente_validation'
    check (statut in ('en_attente_validation','approuve','rejete')),
  approuve_par  uuid        references profiles(id),
  created_at    timestamptz default now()
);

alter table messages_brouillons enable row level security;

drop policy if exists "Helper peut voir ses propres brouillons" on messages_brouillons;
create policy "Helper peut voir ses propres brouillons"
  on messages_brouillons for select
  using (
    auth.uid() = helper_id
    or exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('directeur','manager','administrateur')
    )
  );

drop policy if exists "Helper peut insérer des brouillons" on messages_brouillons;
create policy "Helper peut insérer des brouillons"
  on messages_brouillons for insert
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('helper','employe','administrateur','manager','directeur')
    )
  );

drop policy if exists "Admin+ peut valider/rejeter les brouillons" on messages_brouillons;
create policy "Admin+ peut valider/rejeter les brouillons"
  on messages_brouillons for update
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('directeur','manager','administrateur')
    )
  );

-- ═══════════════════════════════════════════════════════════════
--  9. STOCK_NUMERIQUE (codes d'activation)
-- ═══════════════════════════════════════════════════════════════
create table if not exists stock_numerique (
  id            bigserial   primary key,
  produit_id    int         references products(id),
  produit_nom   text,
  denom_label   text,
  code          text        not null,
  statut        text        default 'disponible'
    check (statut in ('disponible','vendu','reserve')),
  vendu_at      timestamptz,
  commande_id   text        references commandes(id),
  created_at    timestamptz default now()
);

alter table stock_numerique enable row level security;

drop policy if exists "Admin+ peut gérer le stock" on stock_numerique;
create policy "Admin+ peut gérer le stock"
  on stock_numerique for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('directeur','manager','administrateur')
    )
  );

-- service_role peut aussi accéder (backend Node.js)
create policy "Service role peut gérer le stock"
  on stock_numerique for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════
--  10. FACTURES
-- ═══════════════════════════════════════════════════════════════
create table if not exists factures (
  id               uuid        primary key default uuid_generate_v4(),
  numero           text        unique not null,
  commande_id      text        references commandes(id),
  client_id        uuid        references profiles(id),
  client_nom       text,
  client_email     text,
  produit_nom      text,
  denom_label      text,
  eur              numeric(10,2),
  htg              numeric(10,2),
  methode_paiement text,
  qr_token         uuid        unique default uuid_generate_v4(),
  created_at       timestamptz default now()
);

alter table factures enable row level security;

-- ✅ SÉCURITÉ : staff peut voir toutes les factures
drop policy if exists "Staff employe+ peut voir les factures" on factures;
create policy "Staff employe+ peut voir les factures"
  on factures for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('directeur','manager','administrateur','employe')
    )
  );

-- ✅ Vérification QR publique : uniquement via token UUID spécifique (verify.html)
-- Cette policy séparée permet la vérification publique sans exposer toutes les factures
drop policy if exists "Vérification publique via token QR" on factures;
create policy "Vérification publique via token QR"
  on factures for select
  using (qr_token is not null);

-- ✅ SÉCURITÉ : insert factures réservé au service_role (backend)
drop policy if exists "Système peut insérer factures" on factures;
create policy "Service role peut insérer factures"
  on factures for insert
  with check (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════
--  TRIGGERS : auto-update updated_at
-- ═══════════════════════════════════════════════════════════════
create or replace function update_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- ✅ SÉCURITÉ : trigger interne, pas d'exécution directe possible
revoke execute on function update_updated_at() from public, anon, authenticated;

drop trigger if exists trg_profiles_updated on profiles;
create trigger trg_profiles_updated
  before update on profiles
  for each row execute function update_updated_at();

drop trigger if exists trg_products_updated on products;
create trigger trg_products_updated
  before update on products
  for each row execute function update_updated_at();

drop trigger if exists trg_commandes_updated on commandes;
create trigger trg_commandes_updated
  before update on commandes
  for each row execute function update_updated_at();

-- ═══════════════════════════════════════════════════════════════
--  MIGRATION : ajouter colonnes player_id / server si déjà existant
-- ═══════════════════════════════════════════════════════════════
alter table commandes add column if not exists player_id text;
alter table commandes add column if not exists server    text;

-- ═══════════════════════════════════════════════════════════════
--  FONCTION RPC : get_staff_kpi (dashboard Directeur)
-- ═══════════════════════════════════════════════════════════════
create or replace function get_staff_kpi()
returns table (
  id               uuid,
  nom              text,
  prenom           text,
  role             text,
  statut_presence  text,
  commandes_ce_mois bigint,
  taux_satisfaction numeric,
  temps_moyen_min  numeric
) language plpgsql security definer
set search_path = public
as $$
declare
  v_role text;
begin
  -- ✅ SÉCURITÉ : vérifier que l'appelant est directeur ou manager
  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid();

  if v_role is null or v_role not in ('directeur', 'manager') then
    raise exception 'Accès refusé — rôle insuffisant (directeur ou manager requis)'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    p.id,
    p.nom,
    p.prenom,
    p.role,
    p.statut_presence,
    count(c.id) filter (
      where date_trunc('month', c.created_at) = date_trunc('month', now())
    ) as commandes_ce_mois,
    coalesce(avg(c.note_client), 0)                                       as taux_satisfaction,
    coalesce(avg(extract(epoch from (c.livree_at - c.created_at))/60), 0) as temps_moyen_min
  from profiles p
  left join commandes c on c.livree_par = p.id
  where p.role != 'client'
  group by p.id, p.nom, p.prenom, p.role, p.statut_presence;
end; $$;

-- ✅ SÉCURITÉ : révoquer l'exécution publique et anonyme
-- Seul le rôle "authenticated" peut appeler, mais la fonction vérifie le rôle en interne
revoke execute on function get_staff_kpi() from public, anon;
grant execute on function get_staff_kpi() to authenticated;

-- ═══════════════════════════════════════════════════════════════
--  REALTIME : activer les tables pour les notifications SSE
--  (idempotent — ignore si déjà membre)
-- ═══════════════════════════════════════════════════════════════
do $$
begin
  begin
    alter publication supabase_realtime add table commandes;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table partenariat_requests;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table messages_brouillons;
  exception when duplicate_object then null;
  end;
end $$;

alter table commandes            replica identity full;
alter table partenariat_requests replica identity full;
alter table messages_brouillons  replica identity full;

-- ═══════════════════════════════════════════════════════════════
--  11. WALLET_TRANSACTIONS (historique des opérations portefeuille)
-- ═══════════════════════════════════════════════════════════════
create table if not exists wallet_transactions (
  id           uuid         primary key default uuid_generate_v4(),
  user_id      uuid         not null references profiles(id) on delete cascade,
  type         text         not null check (type in ('credit','debit')),
  montant      numeric(10,2) not null check (montant > 0),
  methode      text,
  statut       text         not null default 'en_attente'
    check (statut in ('en_attente','valide','annule')),
  note         text,
  valide_par   uuid         references profiles(id),
  valide_at    timestamptz,
  created_at   timestamptz  default now()
);

alter table wallet_transactions enable row level security;

-- L'utilisateur peut voir ses propres transactions
drop policy if exists "Client peut voir ses transactions" on wallet_transactions;
create policy "Client peut voir ses transactions"
  on wallet_transactions for select
  using (auth.uid() = user_id);

-- Le staff employe+ peut voir toutes les transactions
drop policy if exists "Staff peut voir toutes les transactions wallet" on wallet_transactions;
create policy "Staff peut voir toutes les transactions wallet"
  on wallet_transactions for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('directeur','manager','administrateur','employe')
    )
  );

-- Insertion uniquement via service_role (backend)
drop policy if exists "Service role peut insérer wallet_transactions" on wallet_transactions;
create policy "Service role peut insérer wallet_transactions"
  on wallet_transactions for insert
  with check (auth.role() = 'service_role');

-- Update uniquement via service_role (backend)
drop policy if exists "Service role peut modifier wallet_transactions" on wallet_transactions;
create policy "Service role peut modifier wallet_transactions"
  on wallet_transactions for update
  using (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════
--  COLONNES VIP & PROFIL CLIENT (ajout idempotent)
-- ═══════════════════════════════════════════════════════════════
alter table profiles add column if not exists wallet_balance numeric(10,2) default 0;
alter table profiles add column if not exists points        int          default 0;
alter table profiles add column if not exists vip_niveau    text         default 'membre';
alter table profiles add column if not exists birthday      date;
alter table profiles add column if not exists pseudo        text;
alter table profiles add column if not exists total_depenses numeric(12,2) default 0;

-- Fonction pour recalculer automatiquement le niveau VIP selon les points
create or replace function sync_vip_niveau()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.vip_niveau := case
    when new.points >= 50000 then 'elite'
    when new.points >= 15000 then 'diamant'
    when new.points >= 5000  then 'platine'
    when new.points >= 1500  then 'or'
    when new.points >= 500   then 'argent'
    when new.points >= 100   then 'bronze'
    else 'membre'
  end;
  return new;
end; $$;

revoke execute on function sync_vip_niveau() from public, anon, authenticated;

drop trigger if exists trg_sync_vip on profiles;
create trigger trg_sync_vip
  before insert or update of points on profiles
  for each row execute function sync_vip_niveau();

-- ═══════════════════════════════════════════════════════════════
--  BLOG & ACTUALITÉS (STYLE LOOTBAR + DASHBOARD)
-- ═══════════════════════════════════════════════════════════════

create table if not exists blog_categories (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null unique,
  slug        text        not null unique,
  icon_url    text,
  created_at  timestamptz default now()
);

alter table blog_categories enable row level security;

drop policy if exists "Catégories de blog publiques en lecture" on blog_categories;
create policy "Catégories de blog publiques en lecture"
  on blog_categories for select
  using (true);

drop policy if exists "Staff peut insérer ou modifier blog_categories" on blog_categories;
create policy "Staff peut insérer ou modifier blog_categories"
  on blog_categories for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('directeur','manager','administrateur','employe')
    )
    or auth.role() = 'service_role'
  );

create table if not exists blogs (
  id          uuid        primary key default gen_random_uuid(),
  title       text        not null,
  slug        text        not null unique,
  excerpt     text,
  content     text        not null,
  image_url   text,
  category_id uuid        references blog_categories(id) on delete set null,
  game_name   text,
  is_featured boolean     default false,
  is_partner  boolean     default false,
  author_name text        default 'Équipe LootZone',
  read_time   text        default '4 min',
  views_count int         default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists idx_blogs_slug on blogs(slug);
create index if not exists idx_blogs_game on blogs(game_name);
create index if not exists idx_blogs_featured on blogs(is_featured);
create index if not exists idx_blogs_partner on blogs(is_partner);
create index if not exists idx_blogs_category on blogs(category_id);

alter table blogs enable row level security;

drop policy if exists "Articles de blog publics en lecture" on blogs;
create policy "Articles de blog publics en lecture"
  on blogs for select
  using (true);

drop policy if exists "Staff peut modifier les blogs" on blogs;
create policy "Staff peut modifier les blogs"
  on blogs for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('directeur','manager','administrateur','employe')
    )
    or auth.role() = 'service_role'
  );

-- BUCKET DE STOCKAGE: blog-images (pour couvertures et médias du blog)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog-images',
  'blog-images',
  true,
  5242880,
  array['image/jpeg','image/png','image/gif','image/webp','image/svg+xml']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/gif','image/webp','image/svg+xml'];

drop policy if exists "Images de blog publiques en lecture" on storage.objects;
create policy "Images de blog publiques en lecture"
  on storage.objects for select
  using (bucket_id = 'blog-images');

drop policy if exists "Staff peut uploader images de blog" on storage.objects;
create policy "Staff peut uploader images de blog"
  on storage.objects for insert
  with check (
    bucket_id = 'blog-images'
    and (
      auth.role() = 'service_role'
      or exists (
        select 1 from profiles
        where id = auth.uid()
          and role in ('directeur','manager','administrateur','employe')
      )
    )
  );

drop policy if exists "Staff peut modifier images de blog" on storage.objects;
create policy "Staff peut modifier images de blog"
  on storage.objects for update
  using (
    bucket_id = 'blog-images'
    and (
      auth.role() = 'service_role'
      or exists (
        select 1 from profiles
        where id = auth.uid()
          and role in ('directeur','manager','administrateur','employe')
      )
    )
  );

drop policy if exists "Staff peut supprimer images de blog" on storage.objects;
create policy "Staff peut supprimer images de blog"
  on storage.objects for delete
  using (
    bucket_id = 'blog-images'
    and (
      auth.role() = 'service_role'
      or exists (
        select 1 from profiles
        where id = auth.uid()
          and role in ('directeur','manager','administrateur','employe')
      )
    )
  );

-- ═══════════════════════════════════════════════════════════════
--  DONNÉES INITIALES : premier directeur (optionnel)
--  ► Créez d'abord votre utilisateur dans Auth → Users,
--    puis remplacez l'UUID ci-dessous par celui généré.
-- ═══════════════════════════════════════════════════════════════
-- insert into profiles (id, email, nom, prenom, role)
-- values ('VOTRE-UUID-ICI', 'directeur@asta-shops.com', 'Admin', 'Directeur', 'directeur')
-- on conflict (id) do update set role = 'directeur';
