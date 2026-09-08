-- ═══════════════════════════════════════════════════════════════
--  ASTA-SHOPS — CONFIGURATION SUPABASE COMPLÈTE
--  Copier-coller ce fichier dans : Supabase → SQL Editor → Run
--  Idempotent — sans danger si re-exécuté
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
--  EXTENSIONS
-- ─────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════
--  1. PROFILES
-- ═══════════════════════════════════════════════════════════════
create table if not exists profiles (
  id              uuid        primary key references auth.users(id) on delete cascade,
  email           text,
  nom             text,
  prenom          text,
  role            text        not null default 'client'
    check (role in ('client','helper','employe','administrateur','manager','directeur','partenaire')),
  statut_presence text        default 'deconnecte'
    check (statut_presence in ('en_ligne','occupe','deconnecte')),
  avatar_url      text,
  affiliate_code  text        unique,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table profiles add column if not exists wallet_balance numeric(10,2) default 0;
alter table profiles add column if not exists points        int          default 0;
alter table profiles add column if not exists vip_niveau    text         default 'membre';
alter table profiles add column if not exists birthday      date;
alter table profiles add column if not exists pseudo        text;
alter table profiles add column if not exists total_depenses numeric(12,2) default 0;

alter table profiles enable row level security;

drop policy if exists "Tout utilisateur connecté peut lire les profils" on profiles;
create policy "Tout utilisateur connecté peut lire les profils"
  on profiles for select
  using (auth.uid() is not null);

drop policy if exists "Chacun modifie son propre profil" on profiles;
create policy "Chacun modifie son propre profil"
  on profiles for update
  using (auth.uid() = id);

drop policy if exists "Service role peut insérer profils" on profiles;
create policy "Service role peut insérer profils"
  on profiles for insert
  with check (auth.uid() is not null or auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────
--  TRIGGER auto-création profil
-- ─────────────────────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nom, prenom, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nom', new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'prenom', new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'client')
  )
  on conflict (id) do nothing;
  return new;
end; $$;

revoke execute on function handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─────────────────────────────────────────────────────────────
--  TRIGGER sync VIP
-- ─────────────────────────────────────────────────────────────
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
--  2. SITE_CONFIG
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
  on site_config for select using (true);

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
--  3. PRODUCTS
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
  on products for select using (true);

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

drop policy if exists "Client peut voir ses commandes" on commandes;
create policy "Client peut voir ses commandes"
  on commandes for select
  using (auth.uid() = client_id);

drop policy if exists "Staff employe+ peut voir toutes les commandes" on commandes;
create policy "Staff employe+ peut voir toutes les commandes"
  on commandes for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('directeur','manager','administrateur','employe','helper')
    )
  );

drop policy if exists "Service role gère les commandes" on commandes;
create policy "Service role gère les commandes"
  on commandes for all
  using (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════
--  5. WALLET_TRANSACTIONS
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

drop policy if exists "Client peut voir ses transactions" on wallet_transactions;
create policy "Client peut voir ses transactions"
  on wallet_transactions for select
  using (auth.uid() = user_id);

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

drop policy if exists "Service role peut insérer wallet_transactions" on wallet_transactions;
create policy "Service role peut insérer wallet_transactions"
  on wallet_transactions for insert
  with check (auth.role() = 'service_role');

drop policy if exists "Service role peut modifier wallet_transactions" on wallet_transactions;
create policy "Service role peut modifier wallet_transactions"
  on wallet_transactions for update
  using (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════
--  6. STOCK
-- ═══════════════════════════════════════════════════════════════
create table if not exists stock (
  id          serial      primary key,
  product_id  int         references products(id) on delete cascade,
  denom_label text,
  code        text        not null,
  statut      text        not null default 'disponible'
    check (statut in ('disponible','reserve','vendu')),
  commande_id text        references commandes(id),
  created_at  timestamptz default now()
);

alter table stock enable row level security;

drop policy if exists "Admin+ peut gérer le stock" on stock;
create policy "Admin+ peut gérer le stock"
  on stock for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('directeur','manager','administrateur','employe')
    )
  );

-- ═══════════════════════════════════════════════════════════════
--  7. ACTIVITY_LOGS
-- ═══════════════════════════════════════════════════════════════
create table if not exists activity_logs (
  id          uuid        primary key default uuid_generate_v4(),
  user_id     uuid        references profiles(id),
  action      text        not null,
  details     jsonb       default '{}',
  ip          text,
  created_at  timestamptz default now()
);

alter table activity_logs enable row level security;

drop policy if exists "Admin+ peut voir les logs" on activity_logs;
create policy "Admin+ peut voir les logs"
  on activity_logs for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('directeur','manager','administrateur')
    )
  );

drop policy if exists "Service role insère les logs" on activity_logs;
create policy "Service role insère les logs"
  on activity_logs for insert
  with check (true);

-- ═══════════════════════════════════════════════════════════════
--  8. STORAGE — Bucket "avatars" pour les photos de profil
-- ═══════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg','image/png','image/gif','image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg','image/png','image/gif','image/webp'];

drop policy if exists "Avatar public en lecture" on storage.objects;
create policy "Avatar public en lecture"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Utilisateur peut uploader son avatar" on storage.objects;
create policy "Utilisateur peut uploader son avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = 'avatars'
  );

drop policy if exists "Utilisateur peut mettre à jour son avatar" on storage.objects;
create policy "Utilisateur peut mettre à jour son avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid() is not null
  );

drop policy if exists "Utilisateur peut supprimer son avatar" on storage.objects;
create policy "Utilisateur peut supprimer son avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid() is not null
  );

-- ═══════════════════════════════════════════════════════════════
--  9. RESET WALLET — Remettre le solde à 0 pour tous les profils
--     (uniquement si c'est un solde de test/factice)
-- ═══════════════════════════════════════════════════════════════
-- Décommentez les lignes ci-dessous SEULEMENT si vous voulez remettre
-- tous les soldes à 0 (utile pour nettoyer des données de test) :
--
-- update profiles set wallet_balance = 0 where wallet_balance > 0;
-- delete from wallet_transactions;

-- ═══════════════════════════════════════════════════════════════
--  10. DONNER LE RÔLE DIRECTEUR À VOTRE COMPTE
--  ► Remplacez 'votre-email@gmail.com' par votre vrai email
-- ═══════════════════════════════════════════════════════════════
-- update profiles
-- set role = 'directeur'
-- where email = 'votre-email@gmail.com';

-- ═══════════════════════════════════════════════════════════════
--  FIN — Le schéma est prêt !
-- ═══════════════════════════════════════════════════════════════
