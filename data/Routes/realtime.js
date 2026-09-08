import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

if (!globalThis.WebSocket) {
    globalThis.WebSocket = ws;
}

const sseClients = new Set();
const clientSSEConnections = new Map(); // email → Set<res>

export function registerSSEClient(res) {
    sseClients.add(res);
    res.on('close', () => sseClients.delete(res));
}

export function registerClientSSE(email, res) {
    if (!clientSSEConnections.has(email)) {
        clientSSEConnections.set(email, new Set());
    }
    clientSSEConnections.get(email).add(res);
    res.on('close', () => {
        const set = clientSSEConnections.get(email);
        if (set) { set.delete(res); if (set.size === 0) clientSSEConnections.delete(email); }
    });
}

export function broadcastToClientEmail(email, eventName, payload) {
    const connections = clientSSEConnections.get(email);
    if (!connections || connections.size === 0) return;
    const data = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const res of connections) {
        try { res.write(data); } catch (_) { connections.delete(res); }
    }
}

function broadcast(eventName, payload) {
    const data = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of sseClients) {
        try { client.write(data); } catch (_) { sseClients.delete(client); }
    }
}

export function startRealtime() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.log('[Realtime] Mode démo — Realtime désactivé');
        return;
    }

    const client = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        realtime: {
            params: { eventsPerSecond: 10 }
        }
    });

    const channel = client
        .channel('asta-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'commandes' }, payload => {
            const order = payload.new;
            console.log(`[Realtime] 📦 Nouvelle commande: ${order.id}`);
            broadcast('nouvelle_commande', {
                id: order.id,
                client_nom: order.client_nom,
                produit_nom: order.produit_nom,
                denom_label: order.denom_label,
                eur: order.eur,
                statut: order.statut,
                methode_paiement: order.methode_paiement,
                risk_score: order.risk_score || 0,
                created_at: order.created_at
            });
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'commandes' }, payload => {
            const order = payload.new;
            if (order.statut === 'risque_eleve') {
                broadcast('commande_risque', { id: order.id, client_nom: order.client_nom, risk_score: order.risk_score, risk_flags: order.risk_flags });
            }
            if (order.statut === 'livree' && order.client_email) {
                broadcastToClientEmail(order.client_email, 'commande_livree', {
                    id: order.id,
                    produit_nom: order.produit_nom,
                    denom_label: order.denom_label
                });
            }
            broadcast('commande_update', { id: order.id, statut: order.statut, locked_by: order.locked_by });
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'partenariat_requests' }, payload => {
            const req = payload.new;
            console.log(`[Realtime] 🤝 Nouvelle demande partenariat: ${req.nom}`);
            broadcast('nouvelle_demande_partenariat', { id: req.id, nom: req.nom, type: req.type, created_at: req.created_at });
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages_brouillons' }, payload => {
            const draft = payload.new;
            broadcast('nouveau_brouillon', { id: draft.id, request_id: draft.request_id, helper_id: draft.helper_id });
        })
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                console.log('[Realtime] ✅ Connecté aux canaux Supabase Realtime');
            } else if (status === 'CHANNEL_ERROR') {
                console.warn('[Realtime] ⚠️ Erreur canal — Realtime nécessite que Replication soit activée dans Supabase');
            } else if (status === 'TIMED_OUT') {
                console.warn('[Realtime] ⏱️ Timeout — vérifiez que Realtime est activé dans Supabase');
            } else {
                if (err) console.warn('[Realtime] Status:', status, err?.message || '');
                else console.log('[Realtime] Status:', status);
            }
        });

    return channel;
}
