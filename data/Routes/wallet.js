import express from 'express';
import { supabaseAdmin, DEMO_MODE } from '../supabase.js';
import { requireAuth, requireMinRole } from '../middleware/auth.js';
import { logActivite } from './logs.js';

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

    const [profileRes, txRes] = await Promise.all([
        supabaseAdmin.from('profiles').select('wallet_balance').eq('id', userId).single(),
        supabaseAdmin.from('wallet_transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20)
    ]);

    if (profileRes.error) return res.status(500).json({ error: 'Erreur lors de la récupération du solde.' });

    res.json({
        balance: parseFloat(profileRes.data?.wallet_balance || 0),
        transactions: txRes.data || []
    });
});

// ═══════════════════════════════════════════════════════════════
//  GET /api/wallet/transactions — historique paginé
// ═══════════════════════════════════════════════════════════════
router.get('/transactions', requireAuth, async (req, res) => {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    if (DEMO_MODE) {
        const all = demoTransactions.filter(t => t.user_id === userId);
        return res.json({ transactions: all.slice(offset, offset + limit), total: all.length });
    }

    const { data, error, count } = await supabaseAdmin
        .from('wallet_transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) return res.status(500).json({ error: 'Erreur lors de la récupération des transactions.' });
    res.json({ transactions: data || [], total: count || 0 });
});

// ═══════════════════════════════════════════════════════════════
//  POST /api/wallet/recharge — demande de recharge (statut: en_attente)
// ═══════════════════════════════════════════════════════════════
router.post('/recharge', requireAuth, async (req, res) => {
    const userId = req.user.id;
    const { montant, methode } = req.body;

    if (!montant || isNaN(montant) || montant < 1) {
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
        return res.json({ success: true, new_balance: demoBalances[tx.user_id] });
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
        .select('wallet_balance')
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

    if (!produit_nom || !denom_label || !eur || isNaN(eur)) {
        return res.status(400).json({ error: 'Informations de commande manquantes.' });
    }

    const amount = parseFloat(parseFloat(eur).toFixed(2));

    if (DEMO_MODE) {
        return res.json({ success: true, order_id: 'LZ-DEMO-WALLET', new_balance: 0 });
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

    res.json({ success: true, order_id: orderId, new_balance: newBalance });
});

// ═══════════════════════════════════════════════════════════════
//  POST /api/wallet/credit-manual — staff crédite manuellement par email
// ═══════════════════════════════════════════════════════════════
router.post('/credit-manual', requireAuth, requireMinRole('employe'), async (req, res) => {
    const staffId = req.user.id;
    const { email, montant, note } = req.body;

    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Email invalide.' });
    if (!montant || isNaN(montant) || montant < 0.01) return res.status(400).json({ error: 'Montant invalide (min $0.01).' });

    const amt = parseFloat(parseFloat(montant).toFixed(2));

    if (DEMO_MODE) {
        return res.json({ success: true, new_balance: amt, message: `Démo: $${amt} crédité sur ${email}` });
    }

    // Trouver l'utilisateur par email
    const { data: profile, error: profErr } = await supabaseAdmin
        .from('profiles')
        .select('id, wallet_balance')
        .eq('email', email)
        .single();

    if (profErr || !profile) return res.status(404).json({ error: `Aucun compte trouvé pour l'email : ${email}` });

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
        `Crédit manuel wallet — $${amt} sur ${email}`,
        profile.id, null, newBalance.toFixed(2)
    );

    res.json({ success: true, new_balance: newBalance });
});

export default router;
