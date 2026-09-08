/**
 * ═══════════════════════════════════════════════════════════════
 *  ASTA-SHOPS — Script d'initialisation Supabase
 *  Usage : node data/setup.js
 *
 *  Ce script :
 *  1. Vérifie la connexion Supabase
 *  2. Vérifie que les tables existent (rappel si schéma non appliqué)
 *  3. Crée le premier compte Directeur dans Supabase Auth
 *  4. Insère son profil avec le rôle 'directeur'
 *  5. Initialise la config site (taux EUR→HTG)
 * ═══════════════════════════════════════════════════════════════
 */

import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

if (!globalThis.WebSocket) globalThis.WebSocket = ws;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('\n❌  Variables manquantes : SUPABASE_URL et/ou SUPABASE_SERVICE_ROLE_KEY');
    console.error('    Ajoutez-les dans les Secrets Replit puis relancez.\n');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

// ─── Couleurs console ─────────────────────────────────────────
const G = '\x1b[32m'; // vert
const R = '\x1b[31m'; // rouge
const Y = '\x1b[33m'; // jaune
const C = '\x1b[36m'; // cyan
const B = '\x1b[1m';  // bold
const X = '\x1b[0m';  // reset

function ok(msg)   { console.log(`  ${G}✅${X}  ${msg}`); }
function err(msg)  { console.log(`  ${R}❌${X}  ${msg}`); }
function warn(msg) { console.log(`  ${Y}⚠️ ${X}  ${msg}`); }
function info(msg) { console.log(`  ${C}ℹ️ ${X}  ${msg}`); }

// ─── Vérification des tables ──────────────────────────────────
const TABLES_REQUISES = [
    'profiles', 'site_config', 'products',
    'commandes', 'logs_activite', 'partenariat_requests',
    'partenariat_messages', 'messages_brouillons',
    'stock_numerique', 'factures'
];

async function verifierTables() {
    const manquantes = [];
    for (const table of TABLES_REQUISES) {
        const { error } = await supabase.from(table).select('count').limit(1);
        if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
            manquantes.push(table);
        }
    }
    return manquantes;
}

// ─── Initialiser site_config ──────────────────────────────────
async function initConfig() {
    const { error } = await supabase
        .from('site_config')
        .upsert({ id: 1, taux_eur_htg: 135, devise_affichage: 'HTG', maintenance_mode: false, support_status: 'en_ligne' }, { onConflict: 'id' });
    return !error;
}

// ─── Créer le directeur ───────────────────────────────────────
async function creerDirecteur(email, password, nom, prenom) {
    // Créer dans Supabase Auth
    const { data: created, error: authErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nom, prenom, role: 'directeur' }
    });

    if (authErr) {
        if (authErr.message?.toLowerCase().includes('already') || authErr.code === 'email_exists') {
            warn('Un compte existe déjà avec cet e-mail.');
            // Chercher le profil existant
            const { data: existing } = await supabase
                .from('profiles')
                .select('id, email, role')
                .eq('email', email)
                .single();
            if (existing) {
                if (existing.role !== 'directeur') {
                    await supabase.from('profiles').update({ role: 'directeur', nom, prenom }).eq('id', existing.id);
                    ok(`Rôle mis à jour → directeur pour ${email}`);
                } else {
                    ok(`Le compte directeur ${email} est déjà configuré.`);
                }
            }
            return true;
        }
        err(`Erreur Auth : ${authErr.message}`);
        return false;
    }

    // Insérer / mettre à jour le profil
    const { error: profErr } = await supabase
        .from('profiles')
        .upsert({
            id: created.user.id,
            email,
            nom,
            prenom,
            role: 'directeur',
            statut_presence: 'deconnecte'
        }, { onConflict: 'id' });

    if (profErr) {
        err(`Profil non créé : ${profErr.message}`);
        return false;
    }

    return true;
}

// ─── MAIN ─────────────────────────────────────────────────────
async function main() {
    console.log(`\n${B}${C}╔════════════════════════════════════════════════╗${X}`);
    console.log(`${B}${C}║   ASTA-SHOPS — Initialisation Supabase        ║${X}`);
    console.log(`${B}${C}╚════════════════════════════════════════════════╝${X}\n`);

    // 1. Connexion
    console.log(`${B}Étape 1 — Connexion Supabase${X}`);
    const { error: connErr } = await supabase.from('site_config').select('id').limit(1);
    if (connErr && connErr.code !== 'PGRST116') {
        // Vérifier si c'est une erreur de table manquante (schéma non appliqué)
        if (connErr.code === '42P01' || connErr.message?.includes('does not exist')) {
            err('Tables introuvables — le schéma SQL n\'a pas encore été appliqué.\n');
            console.log(`${Y}  ► Action requise :${X}`);
            console.log(`    1. Ouvrez votre projet Supabase → SQL Editor`);
            console.log(`    2. Copiez le contenu de ${B}data/schema.sql${X}`);
            console.log(`    3. Exécutez-le (bouton "Run")`);
            console.log(`    4. Relancez ce script : ${B}node data/setup.js${X}\n`);
            rl.close();
            process.exit(1);
        }
        err(`Connexion échouée : ${connErr.message}`);
        rl.close();
        process.exit(1);
    }
    ok(`Connecté à ${SUPABASE_URL}`);

    // 2. Vérification des tables
    console.log(`\n${B}Étape 2 — Vérification des tables${X}`);
    const manquantes = await verifierTables();
    if (manquantes.length > 0) {
        err(`Tables manquantes : ${manquantes.join(', ')}\n`);
        console.log(`${Y}  ► Action requise :${X}`);
        console.log(`    1. Ouvrez votre projet Supabase → SQL Editor`);
        console.log(`    2. Copiez le contenu de ${B}data/schema.sql${X}`);
        console.log(`    3. Exécutez-le (bouton "Run")`);
        console.log(`    4. Relancez ce script : ${B}node data/setup.js${X}\n`);
        rl.close();
        process.exit(1);
    }
    ok(`Toutes les tables sont présentes (${TABLES_REQUISES.length}/${TABLES_REQUISES.length})`);

    // 3. Config site
    console.log(`\n${B}Étape 3 — Configuration du site${X}`);
    const configOk = await initConfig();
    if (configOk) ok('site_config initialisé (taux EUR→HTG : 135)');
    else warn('site_config déjà configuré ou erreur mineure.');

    // 4. Vérifier si un directeur existe déjà
    console.log(`\n${B}Étape 4 — Compte Directeur${X}`);
    const { data: existingDir } = await supabase
        .from('profiles')
        .select('id, email, nom, prenom')
        .eq('role', 'directeur')
        .limit(1);

    if (existingDir && existingDir.length > 0) {
        ok(`Directeur déjà configuré : ${existingDir[0].email}`);
        console.log(`\n${G}${B}══════════════════════════════════════════════${X}`);
        console.log(`${G}${B}  ✅ Initialisation terminée — tout est prêt !${X}`);
        console.log(`${G}${B}══════════════════════════════════════════════${X}\n`);
        info(`Dashboard : /admin-login`);
        info(`Email     : ${existingDir[0].email}`);
        console.log();
        rl.close();
        return;
    }

    // Aucun directeur → en créer un
    info('Aucun directeur trouvé. Création du premier compte administrateur.\n');
    console.log(`${Y}  Renseignez les informations du Directeur :${X}`);

    const email    = await ask('  Email     : ');
    const password = await ask('  Mot de passe (min. 8 caractères) : ');
    const prenom   = await ask('  Prénom    : ');
    const nom      = await ask('  Nom       : ');

    if (!email || !password || password.length < 8) {
        err('Email et mot de passe (min. 8 caractères) requis.');
        rl.close();
        process.exit(1);
    }

    const success = await creerDirecteur(email.trim(), password, nom.trim(), prenom.trim());

    if (success) {
        console.log(`\n${G}${B}══════════════════════════════════════════════${X}`);
        console.log(`${G}${B}  ✅ Initialisation terminée avec succès !     ${X}`);
        console.log(`${G}${B}══════════════════════════════════════════════${X}\n`);
        ok(`Compte Directeur créé : ${email}`);
        info(`Dashboard : /admin-login`);
        info(`Connectez-vous avec l'email et le mot de passe saisis.`);
        console.log();
    } else {
        err('Échec de la création du directeur. Vérifiez les logs ci-dessus.');
        process.exit(1);
    }

    rl.close();
}

main().catch(e => {
    err(`Erreur inattendue : ${e.message}`);
    rl.close();
    process.exit(1);
});
