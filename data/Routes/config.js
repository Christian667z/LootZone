import express from 'express';
import { supabaseAdmin, DEMO_MODE } from '../supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logActivite } from './logs.js';

const router = express.Router();

export let demoConfig = { taux_eur_htg: 135, devise_affichage: 'HTG', maintenance_mode: false, support_status: 'en_ligne', updated_at: new Date().toISOString(), updated_by: null };

router.get('/public', async (req, res) => {
    if (DEMO_MODE) {
        return res.json({
            maintenance_mode: !!demoConfig.maintenance_mode,
            taux_eur_htg: demoConfig.taux_eur_htg || 135,
            devise_affichage: demoConfig.devise_affichage || 'HTG'
        });
    }
    const { data, error } = await supabaseAdmin.from('site_config').select('maintenance_mode, taux_eur_htg, devise_affichage').limit(1).single();
    if (error || !data) {
        return res.json({ maintenance_mode: false, taux_eur_htg: 135, devise_affichage: 'HTG' });
    }
    res.json(data);
});

router.get('/', requireAuth, async (req, res) => {
    if (DEMO_MODE) return res.json(demoConfig);
    const { data, error } = await supabaseAdmin.from('site_config').select('*').limit(1).single();
    if (error) { console.warn('[Fallback]', error.message); return res.json(DEMO_MODE ? { fallbacked: true } : { error: 'Database error' }); }
    res.json(data);
});

router.patch('/taux', requireAuth, requireRole('directeur', 'administrateur'), async (req, res) => {
    const { taux_eur_htg } = req.body;
    if (!taux_eur_htg || isNaN(taux_eur_htg) || taux_eur_htg < 1) return res.status(400).json({ error: 'Taux invalide' });

    const ancienTaux = demoConfig.taux_eur_htg;

    if (DEMO_MODE) {
        demoConfig.taux_eur_htg = Number(taux_eur_htg);
        demoConfig.updated_at = new Date().toISOString();
        await logActivite(req.user.id, req.user.role, 'Modification taux EUR→HTG', 'site_config', ancienTaux, taux_eur_htg);
        return res.json({ success: true, taux_eur_htg: demoConfig.taux_eur_htg });
    }

    const { data: current } = await supabaseAdmin.from('site_config').select('taux_eur_htg').limit(1).single();
    const { error } = await supabaseAdmin.from('site_config').update({ taux_eur_htg: Number(taux_eur_htg), updated_by: req.user.id, updated_at: new Date().toISOString() }).eq('id', 1);
    if (error) { console.warn('[Fallback]', error.message); return res.json(DEMO_MODE ? { fallbacked: true } : { error: 'Database error' }); }

    await logActivite(req.user.id, req.user.role, 'Modification taux EUR→HTG', 'site_config', current?.taux_eur_htg, taux_eur_htg);
    res.json({ success: true, taux_eur_htg: Number(taux_eur_htg) });
});

router.patch('/maintenance', requireAuth, requireRole('directeur'), async (req, res) => {
    const { maintenance_mode } = req.body;
    if (DEMO_MODE) {
        demoConfig.maintenance_mode = !!maintenance_mode;
        return res.json({ success: true, maintenance_mode: demoConfig.maintenance_mode });
    }
    const { data: row } = await supabaseAdmin.from('site_config').select('id').limit(1).single();
    let query = supabaseAdmin.from('site_config').update({ maintenance_mode: !!maintenance_mode });
    if (row && row.id) {
        query = query.eq('id', row.id);
    } else {
        query = query.neq('maintenance_mode', null);
    }
    const { error } = await query;
    if (error) {
        console.error('[Config] Erreur MAJ maintenance :', error);
        return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
    res.json({ success: true, maintenance_mode: !!maintenance_mode });
});

export default router;
