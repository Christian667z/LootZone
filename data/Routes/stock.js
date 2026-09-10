import express from 'express';
import { supabaseAdmin, DEMO_MODE } from '../supabase.js';
import { requireAuth, requireMinRole } from '../middleware/auth.js';
import { logActivite } from './logs.js';

const router = express.Router();

let demoStock = [
    { id: 1, produit_id: 21, produit_nom: 'FC 26 Coins', denom_label: '500k Coins', code: 'FC26-500K-XYZ9-ABCD', statut: 'disponible', vendu_at: null, commande_id: null, created_at: new Date().toISOString() },
    { id: 2, produit_id: 1, produit_nom: 'Free Fire Diamants', denom_label: '1080 Diamants', code: 'FF-1080-DIAM-9876', statut: 'disponible', vendu_at: null, commande_id: null, created_at: new Date().toISOString() },
    { id: 3, produit_id: 2, produit_nom: 'PUBG Mobile UC', denom_label: '660 UC', code: 'PUBG-660-UC-5432', statut: 'disponible', vendu_at: null, commande_id: null, created_at: new Date().toISOString() }
];

router.get('/', requireAuth, requireMinRole('administrateur'), async (req, res) => {
    const { produit_id } = req.query;
    if (DEMO_MODE) {
        let stock = [...demoStock];
        if (produit_id) stock = stock.filter(s => s.produit_id === Number(produit_id));
        const par_produit = {};
        stock.filter(s => s.statut === 'disponible').forEach(s => {
            if (!par_produit[s.produit_id]) par_produit[s.produit_id] = { produit_nom: s.produit_nom, disponible: 0 };
            par_produit[s.produit_id].disponible++;
        });
        return res.json({ stock, par_produit });
    }
    let query = supabaseAdmin.from('stock_numerique').select('*').order('created_at', { ascending: false });
    if (produit_id) query = query.eq('produit_id', produit_id);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'Erreur interne du serveur' });
    res.json({ stock: data });
});

router.post('/', requireAuth, requireMinRole('administrateur'), async (req, res) => {
    const { produit_id, produit_nom, denom_label, codes } = req.body;
    if (!produit_id || !codes?.length) return res.status(400).json({ error: 'Données incomplètes' });

    if (DEMO_MODE) {
        const added = codes.map((code, i) => ({ id: Date.now() + i, produit_id, produit_nom: produit_nom || '', denom_label: denom_label || '', code, statut: 'disponible', vendu_at: null, commande_id: null }));
        demoStock.push(...added);
        await logActivite(req.user.id, req.user.role, `Ajout ${codes.length} codes stock — produit #${produit_id}`, `stock:${produit_id}`, null, `${codes.length} codes`);
        return res.json({ success: true, added: added.length });
    }

    const rows = codes.map(code => ({ produit_id, produit_nom, denom_label, code, statut: 'disponible' }));
    const { error } = await supabaseAdmin.from('stock_numerique').insert(rows);
    if (error) return res.status(500).json({ error: 'Erreur interne du serveur' });
    await logActivite(req.user.id, req.user.role, `Ajout ${codes.length} codes stock — produit #${produit_id}`, `stock:${produit_id}`, null, `${codes.length} codes`);
    res.json({ success: true, added: codes.length });
});

export async function autoDeliverCode(produitId, denomLabel, commandeId) {
    if (DEMO_MODE) {
        const idx = demoStock.findIndex(s => s.produit_id === produitId && s.statut === 'disponible' && s.denom_label === denomLabel);
        if (idx === -1) return null;
        demoStock[idx].statut = 'vendu';
        demoStock[idx].vendu_at = new Date().toISOString();
        demoStock[idx].commande_id = commandeId;
        return demoStock[idx].code;
    }
    const { data, error } = await supabaseAdmin.from('stock_numerique').select('*').eq('produit_id', produitId).eq('denom_label', denomLabel).eq('statut', 'disponible').limit(1).single();
    if (error || !data) return null;
    await supabaseAdmin.from('stock_numerique').update({ statut: 'vendu', vendu_at: new Date().toISOString(), commande_id: commandeId }).eq('id', data.id);
    return data.code;
}

export default router;
