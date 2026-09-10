import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import dotenv from 'dotenv';
dotenv.config();

if (!globalThis.WebSocket) {
    globalThis.WebSocket = ws;
}

const supabaseUrl = process.env.SUPABASE_URL || null;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || null;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || null;

if (!supabaseUrl) {
    console.info('[Supabase] Aucune variable SUPABASE_URL détectée. Fonctionnement en mode Démo (mock en mémoire).');
} else if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.info('[Supabase] SUPABASE_SERVICE_ROLE_KEY non fournie. Fonctionnement en mode Client/Anon.');
}

export const supabaseAdmin = supabaseUrl && (supabaseServiceKey || supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        },
        db: { schema: 'public' },
        global: {
            headers: { 'x-application-name': 'lootzone-backend-admin' }
        }
    })
    : null;

export const supabaseAnon = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: false
        },
        db: { schema: 'public' },
        global: {
            headers: { 'x-application-name': 'lootzone-backend-anon' }
        }
    })
    : null;

export const supabaseClient = supabaseAdmin || supabaseAnon;
export const DEMO_MODE = !supabaseClient;

/**
 * Vérifie la connexion Supabase au démarrage.
 * Retourne true si la connexion est opérationnelle.
 */
export async function checkSupabaseConnection() {
    const client = supabaseAdmin || supabaseAnon;
    if (!client) {
        console.log('[Supabase] Mode démo actif (mock en mémoire) — aucune base externe configurée.');
        return false;
    }
    try {
        const { error } = await client.from('site_config').select('id').limit(1).single();
        if (error && error.code !== 'PGRST116') {
            console.error('[Supabase] Erreur de connexion :', error.message);
            return false;
        }
        console.log(`[Supabase] ✅ Connexion établie avec succès (${supabaseAdmin ? 'Admin Service Role' : 'Client Public'}).`);
        return true;
    } catch (err) {
        console.error('[Supabase] ❌ Impossible de joindre Supabase :', err.message);
        return false;
    }
}

/**
 * Wrapper sécurisé pour les requêtes Supabase.
 * Lance une exception avec un message clair en cas d'erreur.
 */
export async function supabaseQuery(queryFn, context = 'requête') {
    const client = supabaseAdmin || supabaseAnon;
    if (!client) throw new Error('Supabase non configuré (mode démo)');
    const { data, error, count } = await queryFn(client);
    if (error) {
        console.error(`[Supabase] Erreur lors de ${context} :`, error.message);
        throw new Error(error.message);
    }
    return { data, count };
}
