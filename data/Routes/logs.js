import express from 'express';
import { supabaseAdmin, DEMO_MODE } from '../supabase.js';
import { requireAuth, requireRole, requireMinRole } from '../middleware/auth.js';

const router = express.Router();

const demoLogs = [];

export async function logActivite(staffId, staffRole, action, cible, ancienneValeur, nouvelleValeur) {
    if (DEMO_MODE) {
        demoLogs.unshift({ id: Date.now(), staff_id: staffId, staff_role: staffRole, action, cible, ancienne_valeur: ancienneValeur, nouvelle_valeur: nouvelleValeur, created_at: new Date().toISOString() });
        return;
    }
    await supabaseAdmin.from('logs_activite').insert({ staff_id: staffId, staff_role: staffRole, action, cible, ancienne_valeur: ancienneValeur ? String(ancienneValeur) : null, nouvelle_valeur: nouvelleValeur ? String(nouvelleValeur) : null });
}

router.get('/', requireAuth, requireMinRole('administrateur'), async (req, res) => {
    const { page = 1, limit = 50, staff_id, action } = req.query;
    const offset = (page - 1) * limit;

    if (DEMO_MODE) {
        let logs = [...demoLogs];
        if (staff_id) logs = logs.filter(l => l.staff_id === staff_id);
        if (action) logs = logs.filter(l => l.action.toLowerCase().includes(action.toLowerCase()));
        return res.json({ logs: logs.slice(offset, offset + Number(limit)), total: logs.length });
    }

    let query = supabaseAdmin.from('logs_activite')
        .select('*, profiles:staff_id(nom, prenom, role)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1);

    if (staff_id) query = query.eq('staff_id', staff_id);
    if (action) query = query.ilike('action', `%${action}%`);

    const { data, error, count } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ logs: data, total: count });
});

export default router;
