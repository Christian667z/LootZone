import express from 'express';
import { supabaseAdmin, DEMO_MODE } from '../supabase.js';
import { requireAuth, requireMinRole } from '../middleware/auth.js';
import { logActivite } from './logs.js';
import { broadcastToClientEmail, broadcastToStaff } from './realtime.js';

const router = express.Router();

// ─── Données démo en mémoire ──────────────────────────────────────────────────
const demoBalances = {};
const demoTransactions = [];

// ═══════════════════════════════════════════════════════════════
//  GET /api/wallet/me — solde + dernières transactions
// ═══════════════════════════════════════════════════════════════
router.get('/me', requireAuth, async (req, res) => {
    const userId = req.user.id;

    if (DEMO_MODE) {
        return res.json({
            balance: demoBalances[userId] || 0,
            transactions: demoTransactions.filter(t => t.user_id === userId).slice(0, 20)
        });
    }

    try {
        const [profileRes, txRes] = await Promise.all([
            supabaseAdmin.from('profiles').select('wallet_balance').eq('id', userId).maybeSingle(),
            supabaseAdmin.from('wallet_transactions')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(20)
        ]);

        const bal = !profileRes.error && profileRes.data?.wallet_balance !== undefined
            ? parseFloat(profileRes.data.wallet_balance || 0)
            : parseFloat(req.user?.wallet_balance || 0);

        res.json({
            balance: isNaN(bal) ? 0 : bal,
            transactions: txRes?.data || []
        });
    } catch (err) {
        console.warn('[Wallet /me] Fallback:', err.message);
        res.json({
            balance: parseFloat(req.user?.wallet_balance || 0) || 0,
            transactions: []
        });
    }
});

// ═══════════════════════════════════════════════════════════════
//  GET /api/wallet/transactions — historique paginé
// ═══════════════════════════════════════════════════════════════
router.get('/transactions', requireAuth, async (req, res) => {
    const userId = req.user.id;
    const parsedPage = Number.parseInt(req.query.page, 10);
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const page = Number.isInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 100000) : 1;
    const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 20;
    const offset = (page - 1) * limit;

    if (DEMO_MODE) {
        const all = demoTransactions.filter(t => t.user_id === userId);
        return res.json({ transactions: all.slice(offset, offset + limit), total: all.length });
    }

    try {
        const { data, error, count } = await supabaseAdmin
            .from('wallet_transactions')
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            console.warn('[Wallet /transactions] Query error:', error.message);
            return res.json({ transactions: [], total: 0 });
        }
        res.json({ transactions: data || [], total: count || 0 });
    } catch (err) {
        console.warn('[Wallet /transactions] Catch fallback:', err.message);
        res.json({ transactions: [], total: 0 });
    }
});

// ═══════════════════════════════════════════════════════════════
//  POST /api/wallet/recharge — demande de recharge (statut: en_attente)
// ═══════════════════════════════════════════════════════════════
router.post('/recharge', requireAuth, async (req, res) => {
    const userId = req.user.id;
    const { montant, methode } = req.body || {};

    if (!Number.isFinite(Number(montant)) || Number(montant) < 1 || Number(montant) > 100000) {
        return res.status(400).json({ error: 'Montant invalide (minimum $1).' });
    }
    if (!methode) {
        return res.status(400).json({ error: 'Méthode de paiement requise.' });
    }

    const amt = parseFloat(parseFloat(montant).toFixed(2));
    const methodesValides = ['moncash', 'natcash', 'card', 'crypto'];
    if (!methodesValides.includes(methode)) {
        return res.status(400).json({ error: 'Méthode de paiement invalide.' });
    }

    if (DEMO_MODE) {
        const tx = {
            id: crypto.randomUUID(),
            user_id: userId,
            type: 'credit',
            montant: amt,
            methode,
            statut: 'en_attente',
            note: `Recharge via ${methode}`,
            created_at: new Date().toISOString()
        };
        demoTransactions.unshift(tx);
        broadcastToStaff('nouvelle_recharge_wallet', { id: tx.id, user_id: userId, montant: amt, methode });
        return res.json({ success: true, transaction: tx, message: 'Demande de recharge soumise. En attente de validation.' });
    }

    const { data: tx, error } = await supabaseAdmin
        .from('wallet_transactions')
        .insert({
            user_id: userId,
            type: 'credit',
            montant: amt,
            methode,
            statut: 'en_attente',
            note: `Recharge via ${methode}`
        })
        .select()
        .single();

    if (error) return res.status(500).json({ error: 'Erreur lors de la création de la demande.' });

    broadcastToStaff('nouvelle_recharge_wallet', { id: tx.id, user_id: userId, montant: amt, methode });

    res.json({
        success: true,
        transaction: tx,
        message: 'Demande de recharge soumise. Elle sera validée après vérification du paiement.'
    });
});

// ═══════════════════════════════════════════════════════════════
//  PATCH /api/wallet/transactions/:id/validate — staff valide (crédit le solde)
// ═══════════════════════════════════════════════════════════════
router.patch('/transactions/:id/validate', requireAuth, requireMinRole('employe'), async (req, res) => {
    const txId = req.params.id;
    const staffId = req.user.id;

    if (DEMO_MODE) {
        const tx = demoTransactions.find(t => t.id === txId);
        if (!tx) return res.status(404).json({ error: 'Transaction introuvable.' });
        if (tx.statut !== 'en_attente') return res.status(409).json({ error: 'Transaction déjà traitée.' });
        tx.statut = 'valide';
        tx.valide_par = staffId;
        tx.valide_at = new Date().toISOString();
        demoBalances[tx.user_id] = (demoBalances[tx.user_id] || 0) + tx.montant;
        const newBal = demoBalances[tx.user_id];

        broadcastToStaff('recharge_wallet_validee', { id: txId, user_id: tx.user_id, new_balance: newBal });
        if (req.user?.email) {
            broadcastToClientEmail(req.user.email, 'wallet_credit', { amount: tx.montant, new_balance: newBal });
        }
        return res.json({ success: true, new_balance: newBal });
    }

    // Récupérer la transaction
    const { data: tx, error: txErr } = await supabaseAdmin
        .from('wallet_transactions')
        .select('*')
        .eq('id', txId)
        .single();

    if (txErr || !tx) return res.status(404).json({ error: 'Transaction introuvable.' });
    if (tx.statut !== 'en_attente') return res.status(409).json({ error: 'Transaction déjà traitée.' });
    if (tx.type !== 'credit') return res.status(400).json({ error: 'Seules les recharges peuvent être validées ici.' });

    // Marquer la transaction comme validée
    const { error: updateErr } = await supabaseAdmin
        .from('wallet_transactions')
        .update({ statut: 'valide', valide_par: staffId, valide_at: new Date().toISOString() })
        .eq('id', txId);
    if (updateErr) return res.status(500).json({ error: 'Erreur lors de la validation.' });

    // Créditer le solde dans profiles (incrément atomique)
    const { data: profile, error: profErr } = await supabaseAdmin
        .from('profiles')
        .select('email, wallet_balance')
        .eq('id', tx.user_id)
        .single();
    if (profErr) return res.status(500).json({ error: 'Erreur récupération profil.' });

    const newBalance = parseFloat(profile.wallet_balance || 0) + parseFloat(tx.montant);
    const { error: balErr } = await supabaseAdmin
        .from('profiles')
        .update({ wallet_balance: newBalance })
        .eq('id', tx.user_id);
    if (balErr) return res.status(500).json({ error: 'Erreur lors du crédit du solde.' });

    await logActivite(staffId, req.user.role,
        `Recharge wallet validée — $${tx.montant} via ${tx.methode}`,
        tx.user_id, null, newBalance.toFixed(2)
    );

    // Diffusion SSE instantanée au client et au staff
    if (profile?.email) {
        broadcastToClientEmail(profile.email, 'wallet_credit', { amount: tx.montant, new_balance: newBalance });
        broadcastToClientEmail(profile.email, 'nouvelle_notification', {
            title: '💰 Recharge validée !',
            message: `Votre recharge de $${tx.montant} via ${tx.methode} a été validée. Nouveau solde : $${newBalance.toFixed(2)}`
        });
    }
    broadcastToStaff('recharge_wallet_validee', { id: txId, user_id: tx.user_id, new_balance: newBalance });

    res.json({ success: true, new_balance: newBalance });
});

// ═══════════════════════════════════════════════════════════════
//  PATCH /api/wallet/transactions/:id/cancel — staff annule
// ═══════════════════════════════════════════════════════════════
router.patch('/transactions/:id/cancel', requireAuth, requireMinRole('employe'), async (req, res) => {
    const txId = req.params.id;
    const staffId = req.user.id;
    const { motif } = req.body;

    if (DEMO_MODE) {
        const tx = demoTransactions.find(t => t.id === txId);
        if (!tx) return res.status(404).json({ error: 'Transaction introuvable.' });
        if (tx.statut !== 'en_attente') return res.status(409).json({ error: 'Transaction déjà traitée.' });
        tx.statut = 'annule';
        return res.json({ success: true });
    }

    const { data: tx, error: txErr } = await supabaseAdmin
        .from('wallet_transactions')
        .select('statut, montant, methode, user_id')
        .eq('id', txId)
        .single();

    if (txErr || !tx) return res.status(404).json({ error: 'Transaction introuvable.' });
    if (tx.statut !== 'en_attente') return res.status(409).json({ error: 'Transaction déjà traitée.' });

    const { error } = await supabaseAdmin
        .from('wallet_transactions')
        .update({ statut: 'annule', note: motif ? `Annulé : ${motif}` : 'Annulé par le staff', valide_par: staffId, valide_at: new Date().toISOString() })
        .eq('id', txId);

    if (error) return res.status(500).json({ error: 'Erreur lors de l\'annulation.' });

    await logActivite(staffId, req.user.role,
        `Recharge wallet annulée — $${tx.montant} via ${tx.methode}`,
        tx.user_id, null, motif || 'sans motif'
    );

    res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
//  GET /api/wallet/all — staff voit toutes les demandes en attente
// ═══════════════════════════════════════════════════════════════
router.get('/all', requireAuth, requireMinRole('employe'), async (req, res) => {
    const { statut = 'en_attente', page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;

    if (DEMO_MODE) {
        let txs = [...demoTransactions];
        if (statut !== 'all') txs = txs.filter(t => t.statut === statut);
        return res.json({ transactions: txs.slice(offset, offset + Number(limit)), total: txs.length });
    }

    let query = supabaseAdmin
        .from('wallet_transactions')
        .select('*, profiles(prenom, nom, email)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1);

    if (statut !== 'all') query = query.eq('statut', statut);

    const { data, error, count } = await query;
    if (error) return res.status(500).json({ error: 'Erreur serveur.' });
    res.json({ transactions: data || [], total: count || 0 });
});

// ═══════════════════════════════════════════════════════════════
//  POST /api/wallet/pay-order — payer une commande avec le wallet
// ═══════════════════════════════════════════════════════════════
router.post('/pay-order', requireAuth, async (req, res) => {
    const userId = req.user.id;
    const { produit_id, produit_nom, categorie, denom_label, eur, htg, player_id, server, client_nom } = req.body;

    if (!produit_nom || !denom_label || !Number.isFinite(Number(eur)) || Number(eur) <= 0 || Number(eur) > 10000) {
        return res.status(400).json({ error: 'Informations de commande manquantes.' });
    }

    const amount = parseFloat(parseFloat(eur).toFixed(2));

    if (DEMO_MODE) {
        const currentBalance = Number(demoBalances[userId] || 0);
        if (currentBalance < amount) {
            return res.status(402).json({
                error: `Solde insuffisant. Votre solde : $${currentBalance.toFixed(2)}, requis : $${amount.toFixed(2)}.`,
                balance: currentBalance
            });
        }
        const orderId = `LZ-DEMO-WALLET-${Date.now()}`;
        const newBalance = Number((currentBalance - amount).toFixed(2));
        demoBalances[userId] = newBalance;
        demoTransactions.unshift({
            id: crypto.randomUUID(),
            user_id: userId,
            type: 'debit',
            montant: amount,
            methode: 'wallet',
            statut: 'valide',
            note: `Paiement commande ${orderId} — ${produit_nom} (${denom_label})`,
            created_at: new Date().toISOString()
        });
        return res.json({ success: true, order_id: orderId, new_balance: newBalance });
    }

    // Vérifier le solde du client
    const { data: profile, error: profErr } = await supabaseAdmin
        .from('profiles')
        .select('wallet_balance, email, prenom, nom')
        .eq('id', userId)
        .single();

    if (profErr || !profile) return res.status(404).json({ error: 'Profil introuvable.' });

    const currentBalance = parseFloat(profile.wallet_balance || 0);
    if (currentBalance < amount) {
        return res.status(402).json({
            error: `Solde insuffisant. Votre solde : $${currentBalance.toFixed(2)}, requis : $${amount.toFixed(2)}.`,
            balance: currentBalance
        });
    }

    // Générer un ID de commande
    const year = new Date().getFullYear();
    const seq = String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0');
    const orderId = `LZ-${year}-${seq}W`;

    // Créer la commande
    const { error: orderErr } = await supabaseAdmin
        .from('commandes')
        .insert({
            id: orderId,
            client_id: userId,
            client_email: profile.email,
            client_nom: client_nom || `${profile.prenom || ''} ${profile.nom || ''}`.trim(),
            produit_id: produit_id || null,
            produit_nom,
            categorie: categorie || null,
            denom_label,
            eur: amount,
            htg: htg || null,
            methode_paiement: 'wallet',
            statut: 'en_attente'
        });
    if (orderErr) return res.status(500).json({ error: 'Erreur création commande.' });

    // Débiter le wallet
    const newBalance = currentBalance - amount;

    const [txResult, balResult] = await Promise.all([
        supabaseAdmin.from('wallet_transactions').insert({
            user_id: userId,
            type: 'debit',
            montant: amount,
            methode: 'wallet',
            statut: 'valide',
            note: `Paiement commande ${orderId} — ${produit_nom} (${denom_label})`,
            valide_at: new Date().toISOString()
        }),
        supabaseAdmin.from('profiles').update({ wallet_balance: newBalance }).eq('id', userId)
    ]);

    if (txResult.error || balResult.error) {
        // Rollback : annuler la commande
        await supabaseAdmin.from('commandes').update({ statut: 'annulee' }).eq('id', orderId);
        return res.status(500).json({ error: 'Erreur lors du débit du wallet. Commande annulée.' });
    }

    broadcastToStaff('nouvelle_commande', {
        id: orderId,
        client_nom: client_nom || `${profile.prenom || ''} ${profile.nom || ''}`.trim() || 'Client',
        produit_nom,
        denom_label,
        eur: amount,
        statut: 'en_attente',
        methode_paiement: 'wallet',
        risk_score: 0,
        created_at: new Date().toISOString()
    });

    res.json({ success: true, order_id: orderId, new_balance: newBalance });
});

// ═══════════════════════════════════════════════════════════════
//  POST /api/wallet/credit-manual — staff crédite manuellement par email
// ═══════════════════════════════════════════════════════════════
router.post('/credit-manual', requireAuth, requireMinRole('employe'), async (req, res) => {
    const staffId = req.user.id;
    const { email, montant, note } = req.body;

    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return res.status(400).json({ error: 'Email invalide.' });
    if (!Number.isFinite(Number(montant)) || Number(montant) < 0.01 || Number(montant) > 100000) return res.status(400).json({ error: 'Montant invalide (entre $0.01 et $100000).' });

    const amt = parseFloat(parseFloat(montant).toFixed(2));

    if (DEMO_MODE) {
        broadcastToClientEmail(cleanEmail, 'wallet_credit', { amount: amt, new_balance: amt });
        broadcastToClientEmail(cleanEmail, 'nouvelle_notification', {
            title: '💰 Portefeuille crédité !',
            message: `Votre portefeuille a été crédité de $${amt}.`
        });
        return res.json({ success: true, new_balance: amt, message: `Démo: $${amt} crédité sur ${cleanEmail}` });
    }

    // Trouver l'utilisateur par email
    const { data: profile, error: profErr } = await supabaseAdmin
        .from('profiles')
        .select('id, wallet_balance')
        .eq('email', cleanEmail)
        .single();

    if (profErr || !profile) return res.status(404).json({ error: `Aucun compte trouvé pour l'email : ${cleanEmail}` });

    const newBalance = parseFloat(profile.wallet_balance || 0) + amt;

    // Créer la transaction créditée directement (statut: valide)
    const { error: txErr } = await supabaseAdmin
        .from('wallet_transactions')
        .insert({
            user_id: profile.id,
            type: 'credit',
            montant: amt,
            methode: 'manuel',
            statut: 'valide',
            note: note || 'Crédit manuel staff',
            valide_par: staffId,
            valide_at: new Date().toISOString()
        });
    if (txErr) return res.status(500).json({ error: 'Erreur création transaction.' });

    // Mettre à jour le solde
    const { error: balErr } = await supabaseAdmin
        .from('profiles')
        .update({ wallet_balance: newBalance })
        .eq('id', profile.id);
    if (balErr) return res.status(500).json({ error: 'Erreur mise à jour solde.' });

    await logActivite(staffId, req.user.role,
        `Crédit manuel wallet — $${amt} sur ${cleanEmail}`,
        profile.id, null, newBalance.toFixed(2)
    );

    broadcastToClientEmail(cleanEmail, 'wallet_credit', { amount: amt, new_balance: newBalance });
    broadcastToClientEmail(cleanEmail, 'nouvelle_notification', {
        title: '💰 Portefeuille crédité !',
        message: `Votre portefeuille a été crédité de $${amt}. Nouveau solde : $${newBalance.toFixed(2)}`
    });

    res.json({ success: true, new_balance: newBalance });
});

export default router;
