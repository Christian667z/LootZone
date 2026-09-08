import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import dotenv from 'dotenv';
dotenv.config();

if (!globalThis.WebSocket) {
    globalThis.WebSocket = ws;
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const missingVars = [];
if (!supabaseUrl) missingVars.push('SUPABASE_URL');
if (!supabaseServiceKey) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');

if (missingVars.length > 0) {
    console.warn(`[Supabase] Variables manquantes : ${missingVars.join(', ')}. Mode démo activé.`);
}

export const supabaseAdmin = supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        },
        db: { schema: 'public' },
        global: {
            headers: { 'x-application-name': 'asta-shops-backend' }
        }
    })
    : null;

export const supabaseAnon = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: false
        }
    })
    : null;

export const DEMO_MODE = !supabaseAdmin;

/**
 * Vérifie la connexion Supabase au démarrage.
 * Retourne true si la connexion est opérationnelle.
 */
export async function checkSupabaseConnection() {
    if (DEMO_MODE) return false;
    try {
        const { error } = await supabaseAdmin.from('site_config').select('id').limit(1).single();
        if (error && error.code !== 'PGRST116') {
            console.error('[Supabase] Erreur de connexion :', error.message);
            return false;
        }
        console.log('[Supabase] ✅ Connexion établie avec succès.');
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
    if (!supabaseAdmin) throw new Error('Supabase non configuré (mode démo)');
    const { data, error, count } = await queryFn(supabaseAdmin);
    if (error) {
        console.error(`[Supabase] Erreur lors de ${context} :`, error.message);
        throw new Error(error.message);
    }
    return { data, count };
}
