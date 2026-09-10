import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import dotenv from 'dotenv';
dotenv.config();

if (!globalThis.WebSocket) {
    globalThis.WebSocket = ws;
}

const DEFAULT_SUPABASE_URL = 'https://bdezshjorwdxzojuecja.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_PDxfwtviufPwC92pVHdNaA_G01ZE50h';

const supabaseUrl = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
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
    if (!client) return false;
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
