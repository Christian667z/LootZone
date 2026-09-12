import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { randomInt } from 'crypto';
import { supabaseAdmin, DEMO_MODE } from '../supabase.js';
import { requireAuth, requireMinRole } from '../middleware/auth.js';
import { logActivite } from './logs.js';
import { broadcastToClientEmail, broadcastToStaff } from './realtime.js';
import { autoDeliverCode } from './stock.js';

const router = express.Router();

const RISK_THRESHOLD_COUNT = 3;
const RISK_THRESHOLD_WINDOW_MS = 2 * 60 * 60 * 1000;

function generateOrderId() {
    const year = new Date().getFullYear();
    const seq = String(randomInt(1000, 10000)).padStart(4, '0');
    return `LZ-${year}-${seq}`;
}

function parsePage(value, fallback, max) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function cleanText(value, maxLength = 200) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : value;
}

export let demoOrders = [
    {
        id: 'LZ-2026-1001',
        client_id: 'client-1',
        client_email: 'joueur1@gmail.com',
        client_nom: 'Alexandre M.',
        produit_id: 21,
        produit_nom: 'FC 26 Coins',
        categorie: 'jeux',
        denom_label: '500k Coins',
        eur: 19.99,
        htg: 2699,
        methode_paiement: 'moncash',
        player_id: 'AlexFut26',
        server: 'Europe',
        statut: 'livree',
        locked_by: null,
        locked_at: null,
        risk_score: 10,
        risk_flags: [],
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        updated_at: new Date(Date.now() - 3600000).toISOString()
    },
    {
        id: 'LZ-2026-1002',
        client_id: 'client-2',
        client_email: 'sarah.k@yahoo.fr',
        client_nom: 'Sarah K.',
        produit_id: 1,
        produit_nom: 'Free Fire Diamants',
        categorie: 'jeux',
        denom_label: '1080 Diamants',
        eur: 9.99,
        htg: 1350,
        methode_paiement: 'natcash',
        player_id: 'SarahFF_99',
        server: null,
        statut: 'en_cours',
        locked_by: 'demo-1',
        locked_at: new Date().toISOString(),
        risk_score: 15,
        risk_flags: [],
        created_at: new Date(Date.now() - 1800000).toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: 'LZ-2026-1003',
        client_id: 'client-3',
        client_email: 'gamer77@outlook.com',
        client_nom: 'David T.',
        produit_id: 2,
        produit_nom: 'PUBG Mobile UC',
        categorie: 'jeux',
        denom_label: '660 UC',
        eur: 10.99,
        htg: 1485,
        methode_paiement: 'carte_bancaire',
        player_id: '5129481023',
        server: 'Global',
        statut: 'en_attente',
        locked_by: null,
        locked_at: null,
        risk_score: 20,
        risk_flags: [],
        created_at: new Date(Date.now() - 600000).toISOString(),
        updated_at: new Date().toISOString()
    }
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(id) {
    return typeof id === 'string' && UUID_REGEX.test(id);
}

function calcRiskScore(order, allOrders) {
    let score = 0;
    const flags = [];
    const recentSameClient = (allOrders || []).filter(o => {
        const matchesClient = (order.client_id && o.client_id === order.client_id) ||
            (order.client_email && o.client_email && o.client_email.toLowerCase() === order.client_email.toLowerCase());
        return matchesClient &&
            ['gift-cards', 'payment-cards'].includes(o.categorie) &&
            new Date(o.created_at) > new Date(Date.now() - RISK_THRESHOLD_WINDOW_MS) &&
            Number(o.eur) >= 15;
    });
    if (recentSameClient.length >= RISK_THRESHOLD_COUNT) {
        score += 70;
        flags.push(`${recentSameClient.length}+ cartes cadeaux en 2h`);
    }
    if (order.eur >= 50) { score += 15; flags.push('Montant élevé'); }
    return { score: Math.min(score, 100), flags };
}

router.get('/stats', requireAuth, requireMinRole('employe'), async (req, res) => {
    if (DEMO_MODE) {
        const total = demoOrders.length;
        const livrees = demoOrders.filter(o => o.statut === 'livree').length;
        const en_attente = demoOrders.filter(o => o.statut === 'en_attente').length;
        const risque = demoOrders.filter(o => o.statut === 'risque_eleve').length;
        const ca_eur = demoOrders.filter(o => o.statut === 'livree').reduce((sum, o) => sum + Number(o.eur || 0), 0);
        return res.json({ total, livrees, en_attente, risque, ca_eur: parseFloat(ca_eur.toFixed(2)) });
    }

    try {
        const { data: all, error } = await supabaseAdmin.from('commandes').select('statut, eur');
        if (error) throw error;
        const orders = all || [];
        const total = orders.length;
        const livrees = orders.filter(o => o.statut === 'livree').length;
        const en_attente = orders.filter(o => o.statut === 'en_attente').length;
        const risque = orders.filter(o => o.statut === 'risque_eleve').length;
        const ca_eur = orders.filter(o => o.statut === 'livree').reduce((sum, o) => sum + Number(o.eur || 0), 0);
        res.json({ total, livrees, en_attente, risque, ca_eur: parseFloat(ca_eur.toFixed(2)) });
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors du calcul des statistiques' });
    }
});

router.get('/', requireAuth, requireMinRole('employe'), async (req, res) => {
    const { statut } = req.query;
    const page = parsePage(req.query.page, 1, 100000);
    const limit = parsePage(req.query.limit, 20, 2000);
    const offset = (page - 1) * limit;

    if (DEMO_MODE) {
        let orders = [...demoOrders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        if (statut) orders = orders.filter(o => o.statut === statut);
        return res.json({ orders: orders.slice(offset, offset + Number(limit)), total: orders.length });
    }

    let query = supabaseAdmin.from('commandes').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + Number(limit) - 1);
    if (statut) query = query.eq('statut', statut);
    const { data, error, count } = await query;
    if (error) { console.warn('[Fallback]', error.message); return res.json(DEMO_MODE ? { fallbacked: true } : { error: 'Database error' }); }
    res.json({ orders: data, total: count });
});

router.post('/:id/lock', requireAuth, requireMinRole('employe'), async (req, res) => {
    const orderId = req.params.id;

    if (DEMO_MODE) {
        const order = demoOrders.find(o => o.id === orderId);
        if (!order) return res.status(404).json({ error: 'Commande introuvable' });
        if (order.locked_by && order.locked_by !== req.user.id) return res.status(409).json({ error: `Commande déjà prise en charge par ${order.locked_by}` });
        order.locked_by = req.user.id;
        order.locked_at = new Date().toISOString();
        order.statut = 'en_cours';
        return res.json({ success: true });
    }

    const { data: existing } = await supabaseAdmin.from('commandes').select('locked_by, statut').eq('id', orderId).single();
    if (existing?.locked_by && existing.locked_by !== req.user.id) return res.status(409).json({ error: 'Commande déjà prise en charge' });
    const { error } = await supabaseAdmin.from('commandes').update({ locked_by: req.user.id, locked_at: new Date().toISOString(), statut: 'en_cours' }).eq('id', orderId);
    if (error) { console.warn('[Fallback]', error.message); return res.json(DEMO_MODE ? { fallbacked: true } : { error: 'Database error' }); }
    res.json({ success: true });
});

router.post('/:id/unlock', requireAuth, requireMinRole('employe'), async (req, res) => {
    const orderId = req.params.id;

    if (DEMO_MODE) {
        const order = demoOrders.find(o => o.id === orderId);
        if (!order) return res.status(404).json({ error: 'Commande introuvable' });
        order.locked_by = null;
        order.locked_at = null;
        order.statut = 'en_attente';
        return res.json({ success: true });
    }

    const { error } = await supabaseAdmin.from('commandes').update({ locked_by: null, locked_at: null, statut: 'en_attente' }).eq('id', orderId).eq('locked_by', req.user.id);
    if (error) { console.warn('[Fallback]', error.message); return res.json(DEMO_MODE ? { fallbacked: true } : { error: 'Database error' }); }
    res.json({ success: true });
});

router.patch('/:id/statut', requireAuth, requireMinRole('employe'), async (req, res) => {
    const { statut, code_livre, code_envoye } = req.body;
    let deliveredCode = cleanText(code_envoye || code_livre || '', 500) || null;
    const orderId = req.params.id;
    const validStatuts = ['en_attente', 'en_cours', 'livree', 'annulee', 'risque_eleve'];
    if (!validStatuts.includes(statut)) return res.status(400).json({ error: 'Statut invalide' });

    if (DEMO_MODE) {
        const order = demoOrders.find(o => o.id === orderId);
        if (!order) return res.status(404).json({ error: 'Commande introuvable' });
        const old = order.statut;
        order.statut = statut;
        if (statut === 'livree' && !deliveredCode && order.produit_id) {
            try {
                const auto = await autoDeliverCode(order.produit_id, order.denom_label, orderId);
                if (auto) deliveredCode = auto;
            } catch (_) {}
        }
        if (deliveredCode) {
            order.code_envoye = deliveredCode;
            order.code_livre = deliveredCode;
        }
        if (statut === 'livree') {
            order.locked_by = null; order.locked_at = null;
            order.livree_at = new Date().toISOString();
            order.livree_par = req.user.id;
            if (order.client_email) {
                broadcastToClientEmail(order.client_email, 'commande_livree', {
                    id: orderId, produit_nom: order.produit_nom, denom_label: order.denom_label, code_envoye: deliveredCode
                });
            }
        }
        broadcastToStaff('commande_update', { id: orderId, statut, locked_by: null });
        if (order.client_email) {
            broadcastToClientEmail(order.client_email, 'commande_statut_change', {
                id: orderId, statut, produit_nom: order.produit_nom, denom_label: order.denom_label, code_envoye: deliveredCode
            });
        }
        await logActivite(req.user.id, req.user.role, `Statut commande ${orderId} modifié (${statut})`, `commande:${orderId}`, old, statut);
        return res.json({ success: true, order });
    }

    const { data: old } = await supabaseAdmin.from('commandes').select('*').eq('id', orderId).single();
    if (statut === 'livree' && !deliveredCode && old?.produit_id) {
        try {
            const auto = await autoDeliverCode(old.produit_id, old.denom_label, orderId);
            if (auto) deliveredCode = auto;
        } catch (_) {}
    }

    const updates = { statut, updated_at: new Date().toISOString() };
    if (deliveredCode) {
        updates.code_envoye = deliveredCode;
        updates.code_livre = deliveredCode;
    }
    if (statut === 'livree') {
        updates.locked_by = null;
        updates.locked_at = null;
        updates.livree_at = new Date().toISOString();
        updates.livree_par = req.user.id;
    }

    const { error } = await supabaseAdmin.from('commandes').update(updates).eq('id', orderId);
    if (error) { console.warn('[Fallback]', error.message); return res.json(DEMO_MODE ? { fallbacked: true } : { error: 'Database error' }); }

    broadcastToStaff('commande_update', { id: orderId, statut, locked_by: null });
    if (old?.client_email) {
        if (statut === 'livree') {
            broadcastToClientEmail(old.client_email, 'commande_livree', {
                id: orderId, produit_nom: old.produit_nom, denom_label: old.denom_label, code_envoye: deliveredCode
            });
        }
        broadcastToClientEmail(old.client_email, 'commande_statut_change', {
            id: orderId, statut, produit_nom: old.produit_nom, denom_label: old.denom_label, code_envoye: deliveredCode
        });
    }

    await logActivite(req.user.id, req.user.role, `Statut commande ${orderId} modifié (${statut})`, `commande:${orderId}`, old?.statut, statut);
    res.json({ success: true });
});

router.get('/me', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Token manquant' });

    if (DEMO_MODE) {
        const email = (req.query.email || '').trim().toLowerCase();
        let orders;
        if (email) {
            orders = demoOrders.filter(o => (o.client_email || '').toLowerCase() === email);
        } else {
            orders = demoOrders.slice(0, 25);
        }
        return res.json({ orders });
    }

    const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);
    const user = authData?.user;
    if (authErr || !user) return res.status(401).json({ error: 'Token invalide' });

    const safeEmail = user.email ? user.email.toLowerCase() : '';
    let query = supabaseAdmin
        .from('commandes')
        .select('*')
        .order('created_at', { ascending: false });

    if (user.id && safeEmail) {
        query = query.or(`client_email.eq.${safeEmail},client_id.eq.${user.id}`);
    } else if (safeEmail) {
        query = query.eq('client_email', safeEmail);
    } else if (user.id) {
        query = query.eq('client_id', user.id);
    }

    const { data, error } = await query;

    if (error) { console.warn('[Fallback]', error.message); return res.json(DEMO_MODE ? { fallbacked: true } : { error: 'Database error' }); }
    res.json({ orders: data || [] });
});

router.post('/public', async (req, res) => {
    const { client_id, client_email, client_nom, produit_id, produit_nom, categorie, denom_label, eur, htg, methode_paiement, player_id, server, sender_name, sender_phone, transaction_id, coupon_code } = req.body;
    if (!client_email || !produit_id || eur === undefined || eur === null) return res.status(400).json({ error: 'Données incomplètes' });

    // Validation sécurité — format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(client_email)) return res.status(400).json({ error: 'Adresse e-mail invalide' });

    // Validation sécurité — montants positifs et raisonnables
    const eurNum = Number(eur);
    const htgNum = Number(htg);
    if (!Number.isFinite(eurNum) || eurNum <= 0 || eurNum > 10000)
        return res.status(400).json({ error: 'Montant EUR invalide' });
    if (htg !== undefined && (!Number.isFinite(htgNum) || htgNum <= 0 || htgNum > 5000000))
        return res.status(400).json({ error: 'Montant HTG invalide' });

    // Validation sécurité — méthode de paiement
    const validMethods = ['moncash', 'natcash', 'carte_bancaire', 'wallet', 'moncash_pay'];
    if (methode_paiement && !validMethods.includes(methode_paiement))
        return res.status(400).json({ error: 'Méthode de paiement invalide' });

    // Validation player_id — pas de HTML ni injection
    if (player_id && (typeof player_id !== 'string' || player_id.length > 200))
        return res.status(400).json({ error: 'ID joueur trop long' });

    if (server && (typeof server !== 'string' || server.length > 100))
        return res.status(400).json({ error: 'Serveur invalide' });

    const safeEmail = client_email.trim().toLowerCase();
    const safeProductName = cleanText(produit_nom, 200);
    const safeCategory = cleanText(categorie, 80);
    const safeDenom = cleanText(denom_label, 120);
    if (!safeProductName || !safeDenom) return res.status(400).json({ error: 'Produit incomplet' });

    const orderId = generateOrderId();
    const effectiveClientId = isValidUuid(client_id) ? client_id : null;

    let ordersForRisk = demoOrders;
    if (!DEMO_MODE && supabaseAdmin) {
        try {
            const twoHoursAgo = new Date(Date.now() - RISK_THRESHOLD_WINDOW_MS).toISOString();
            let query = supabaseAdmin
                .from('commandes')
                .select('client_id, client_email, categorie, eur, created_at')
                .gte('created_at', twoHoursAgo);

            if (effectiveClientId) {
                query = query.or(`client_id.eq.${effectiveClientId},client_email.eq.${safeEmail}`);
            } else {
                query = query.eq('client_email', safeEmail);
            }
            const { data: dbOrders, error: dbErr } = await query;
            if (!dbErr && dbOrders) {
                ordersForRisk = dbOrders;
            }
        } catch (err) {
            console.warn('[Risk score query warning]', err.message);
        }
    }

    const { score, flags } = calcRiskScore(
        { client_id: effectiveClientId, client_email: safeEmail, eur: eurNum, categorie: safeCategory || 'default' },
        ordersForRisk
    );
    const statut = score >= 70 ? 'risque_eleve' : 'en_attente';

    if (DEMO_MODE) {
        const order = {
            id: orderId,
            client_id: effectiveClientId || uuidv4(),
            client_email: safeEmail, client_nom: cleanText(client_nom, 160),
            produit_id, produit_nom: safeProductName, categorie: safeCategory,
            denom_label: safeDenom, eur: eurNum, htg: htg === undefined ? null : htgNum,
            methode_paiement,
            player_id: cleanText(player_id, 200) || null,
            server: cleanText(server, 100) || null,
            sender_name: cleanText(sender_name, 160) || null,
            sender_phone: cleanText(sender_phone, 40) || null,
            transaction_id: cleanText(transaction_id, 120) || null,
            coupon_code: cleanText(coupon_code, 80) || null,
            statut,
            locked_by: null, locked_at: null,
            risk_score: score, risk_flags: flags,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        demoOrders.unshift(order);

        // Notifier immédiatement le dashboard staff et le client via SSE
        broadcastToStaff('nouvelle_commande', {
            id: orderId,
            client_nom: order.client_nom || sender_name || 'Client',
            produit_nom: safeProductName,
            denom_label: safeDenom,
            eur: eurNum,
            statut,
            methode_paiement,
            risk_score: score,
            created_at: order.created_at
        });
        broadcastToClientEmail(safeEmail, 'nouvelle_notification', {
            title: '🎮 Commande transmise !',
            message: `Votre commande #${orderId} (${safeProductName}) a bien été enregistrée et est en attente.`
        });

        return res.json({ success: true, order_id: orderId, statut });
    }

    const { data, error } = await supabaseAdmin.from('commandes').insert({
        id: orderId, client_id: effectiveClientId, client_email: safeEmail, client_nom: cleanText(client_nom, 160),
        produit_id, produit_nom: safeProductName, categorie: safeCategory,
        denom_label: safeDenom, eur: eurNum, htg: htg === undefined ? null : htgNum, methode_paiement,
        player_id: cleanText(player_id, 200) || null,
        server: cleanText(server, 100) || null,
        sender_name: cleanText(sender_name, 160) || null,
        sender_phone: cleanText(sender_phone, 40) || null,
        transaction_id: cleanText(transaction_id, 120) || null,
        coupon_code: cleanText(coupon_code, 80) || null,
        statut, risk_score: score, risk_flags: flags
    }).select().single();
    if (error) { console.warn('[Fallback]', error.message); return res.json(DEMO_MODE ? { fallbacked: true } : { error: 'Database error' }); }

    // Notifier immédiatement le dashboard staff et le client via SSE
    broadcastToStaff('nouvelle_commande', {
        id: data.id,
        client_nom: data.client_nom || cleanText(client_nom, 160) || 'Client',
        produit_nom: data.produit_nom || safeProductName,
        denom_label: data.denom_label || safeDenom,
        eur: data.eur || eurNum,
        statut: data.statut || statut,
        methode_paiement: data.methode_paiement || methode_paiement,
        risk_score: data.risk_score || score,
        created_at: data.created_at || new Date().toISOString()
    });
    broadcastToClientEmail(safeEmail, 'nouvelle_notification', {
        title: '🎮 Commande transmise !',
        message: `Votre commande #${data.id} (${safeProductName}) a bien été enregistrée et est en cours de traitement.`
    });

    res.json({ success: true, order_id: data.id, statut });
});

router.post('/:id/review', async (req, res) => {
    const { id } = req.params;
    const { rating, comment, user_name } = req.body;
    const cleanRating = Math.max(1, Math.min(5, parseInt(rating, 10) || 5));
    const cleanComment = typeof comment === 'string' ? comment.trim().slice(0, 1000) : '';
    const cleanUserName = typeof user_name === 'string' ? user_name.trim().slice(0, 120) : '';

    if (DEMO_MODE) {
        const order = demoOrders.find(o => o.id === id);
        if (!order) return res.status(404).json({ error: 'Commande introuvable' });
        if (order.statut !== 'livree') return res.status(409).json({ error: 'Un avis est possible après la livraison.' });
        if (order.review) return res.status(409).json({ error: 'Un avis existe déjà pour cette commande.' });
        if (order) {
            order.review = {
                rating: cleanRating,
                comment: cleanComment,
                user_name: cleanUserName || order.client_nom,
                created_at: new Date().toISOString()
            };
        }
        return res.json({ success: true, message: 'Avis enregistré avec succès !' });
    }

    // Supabase mode: only delivered orders may be reviewed, once.
    const { data: order, error: orderError } = await supabaseAdmin
        .from('commandes')
        .select('id, statut, client_nom')
        .eq('id', id)
        .maybeSingle();
    if (orderError) return res.status(500).json({ error: 'Impossible de vérifier la commande.' });
    if (!order) return res.status(404).json({ error: 'Commande introuvable' });
    if (order.statut !== 'livree') return res.status(409).json({ error: 'Un avis est possible après la livraison.' });

    const { data: existingReview, error: reviewLookupError } = await supabaseAdmin
        .from('reviews')
        .select('id')
        .eq('order_id', id)
        .maybeSingle();
    if (reviewLookupError) return res.status(500).json({ error: 'Impossible de vérifier l\'avis.' });
    if (existingReview) return res.status(409).json({ error: 'Un avis existe déjà pour cette commande.' });

    const { error: reviewError } = await supabaseAdmin.from('reviews').insert({
            order_id: id,
            rating: cleanRating,
            comment: cleanComment,
            user_name: cleanUserName || order.client_nom || 'Client LootZone',
            created_at: new Date().toISOString()
        });
    if (reviewError) return res.status(500).json({ error: 'Impossible d\'enregistrer l\'avis.' });

    res.json({ success: true, message: 'Avis enregistré avec succès !' });
});

export default router;
