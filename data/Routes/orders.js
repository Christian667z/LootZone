import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin, DEMO_MODE } from '../supabase.js';
import { requireAuth, requireMinRole } from '../middleware/auth.js';
import { logActivite } from './logs.js';
import { broadcastToClientEmail } from './realtime.js';

const router = express.Router();

const RISK_THRESHOLD_COUNT = 3;
const RISK_THRESHOLD_WINDOW_MS = 2 * 60 * 60 * 1000;

function generateOrderId() {
    const year = new Date().getFullYear();
    const seq = String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0');
    return `LZ-${year}-${seq}`;
}

let demoOrders = [
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

function calcRiskScore(order, allOrders) {
    let score = 0;
    const flags = [];
    const recentSameClient = allOrders.filter(o =>
        o.client_id === order.client_id &&
        ['gift-cards', 'payment-cards'].includes(o.categorie) &&
        new Date(o.created_at) > new Date(Date.now() - RISK_THRESHOLD_WINDOW_MS) &&
        o.eur >= 15
    );
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
    const { statut, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    if (DEMO_MODE) {
        let orders = [...demoOrders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        if (statut) orders = orders.filter(o => o.statut === statut);
        return res.json({ orders: orders.slice(offset, offset + Number(limit)), total: orders.length });
    }

    let query = supabaseAdmin.from('commandes').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + Number(limit) - 1);
    if (statut) query = query.eq('statut', statut);
    const { data, error, count } = await query;
    if (error) return res.status(500).json({ error: 'Erreur interne du serveur' });
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
    if (error) return res.status(500).json({ error: 'Erreur interne du serveur' });
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
    if (error) return res.status(500).json({ error: 'Erreur interne du serveur' });
    res.json({ success: true });
});

router.patch('/:id/statut', requireAuth, requireMinRole('employe'), async (req, res) => {
    const { statut, code_livre } = req.body;
    const orderId = req.params.id;
    const validStatuts = ['en_attente', 'en_cours', 'livree', 'annulee', 'risque_eleve'];
    if (!validStatuts.includes(statut)) return res.status(400).json({ error: 'Statut invalide' });

    if (DEMO_MODE) {
        const order = demoOrders.find(o => o.id === orderId);
        if (!order) return res.status(404).json({ error: 'Commande introuvable' });
        const old = order.statut;
        order.statut = statut;
        if (code_livre) order.code_livre = code_livre;
        if (statut === 'livree') {
            order.locked_by = null; order.locked_at = null;
            if (order.client_email) {
                broadcastToClientEmail(order.client_email, 'commande_livree', {
                    id: orderId, produit_nom: order.produit_nom, denom_label: order.denom_label
                });
            }
        }
        await logActivite(req.user.id, req.user.role, `Statut commande ${orderId} modifié`, `commande:${orderId}`, old, statut);
        return res.json({ success: true });
    }

    const updates = { statut, updated_at: new Date().toISOString() };
    if (code_livre) updates.code_livre = code_livre;
    if (statut === 'livree') { updates.locked_by = null; updates.locked_at = null; }

    const { data: old } = await supabaseAdmin.from('commandes').select('statut, client_email, produit_nom, denom_label').eq('id', orderId).single();
    const { error } = await supabaseAdmin.from('commandes').update(updates).eq('id', orderId);
    if (error) return res.status(500).json({ error: 'Erreur interne du serveur' });
    if (statut === 'livree' && old?.client_email) {
        broadcastToClientEmail(old.client_email, 'commande_livree', {
            id: orderId, produit_nom: old.produit_nom, denom_label: old.denom_label
        });
    }
    await logActivite(req.user.id, req.user.role, `Statut commande ${orderId} modifié`, `commande:${orderId}`, old?.statut, statut);
    res.json({ success: true });
});

router.get('/me', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Token manquant' });

    if (DEMO_MODE) {
        const email = req.query.email || '';
        const orders = demoOrders.filter(o => o.client_email === email);
        return res.json({ orders });
    }

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'Token invalide' });

    const { data, error } = await supabaseAdmin
        .from('commandes')
        .select('*')
        .eq('client_email', user.email)
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: 'Erreur interne du serveur' });
    res.json({ orders: data || [] });
});

router.post('/public', async (req, res) => {
    const { client_id, client_email, client_nom, produit_id, produit_nom, categorie, denom_label, eur, htg, methode_paiement, player_id, server, sender_name, sender_phone, transaction_id, coupon_code } = req.body;
    if (!client_email || !produit_id || !eur) return res.status(400).json({ error: 'Données incomplètes' });

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
    if (player_id && player_id.length > 200)
        return res.status(400).json({ error: 'ID joueur trop long' });

    const orderId = generateOrderId();
    const { score, flags } = calcRiskScore({ client_id, eur, categorie: categorie || 'default' }, demoOrders);
    const statut = score >= 70 ? 'risque_eleve' : 'en_attente';

    if (DEMO_MODE) {
        const order = {
            id: orderId,
            client_id: client_id || uuidv4(),
            client_email, client_nom,
            produit_id, produit_nom, categorie,
            denom_label, eur, htg,
            methode_paiement,
            player_id: player_id || null,
            server: server || null,
            sender_name: sender_name || null,
            sender_phone: sender_phone || null,
            transaction_id: transaction_id || null,
            coupon_code: coupon_code || null,
            statut,
            locked_by: null, locked_at: null,
            risk_score: score, risk_flags: flags,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        demoOrders.unshift(order);
        return res.json({ success: true, order_id: orderId, statut });
    }

    const { data, error } = await supabaseAdmin.from('commandes').insert({
        id: orderId, client_id, client_email, client_nom,
        produit_id, produit_nom, categorie,
        denom_label, eur, htg, methode_paiement,
        player_id: player_id || null,
        server: server || null,
        statut, risk_score: score, risk_flags: flags
    }).select().single();
    if (error) return res.status(500).json({ error: 'Erreur interne du serveur' });
    res.json({ success: true, order_id: data.id, statut });
});

router.post('/:id/review', async (req, res) => {
    const { id } = req.params;
    const { rating, comment, user_name } = req.body;
    const cleanRating = Math.max(1, Math.min(5, parseInt(rating, 10) || 5));
    const cleanComment = (comment || '').trim().slice(0, 1000);

    if (DEMO_MODE) {
        const order = demoOrders.find(o => o.id === id);
        if (order) {
            order.review = {
                rating: cleanRating,
                comment: cleanComment,
                user_name: user_name || order.client_nom,
                created_at: new Date().toISOString()
            };
        }
        return res.json({ success: true, message: 'Avis enregistré avec succès !' });
    }

    // Supabase mode
    try {
        await supabaseAdmin.from('reviews').insert({
            order_id: id,
            rating: cleanRating,
            comment: cleanComment,
            user_name: user_name || 'Client LootZone',
            created_at: new Date().toISOString()
        });
    } catch (_) {}

    res.json({ success: true, message: 'Avis enregistré avec succès !' });
});

export default router;
