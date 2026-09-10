import express from 'express';
import { supabaseAdmin, DEMO_MODE } from '../supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logActivite } from './logs.js';

const router = express.Router();

export let demoCoupons = [
    {
        id: '1',
        code: 'ASTA30',
        title: 'Super Réduction Asta 30%',
        description: '30% de réduction immédiate sans minimum d\'achat.',
        discount_type: 'percent',
        discount_value: 30,
        min_order_amount: 0,
        usage_limit: 100,
        usage_count: 14,
        is_active: true,
        expires_at: null,
        created_at: new Date().toISOString()
    },
    {
        id: '2',
        code: 'WELCOME10',
        title: 'Coupon de Bienvenue 10%',
        description: '10% de réduction pour toute recharge dès $10.',
        discount_type: 'percent',
        discount_value: 10,
        min_order_amount: 10,
        usage_limit: 500,
        usage_count: 82,
        is_active: true,
        expires_at: null,
        created_at: new Date().toISOString()
    },
    {
        id: '3',
        code: 'LERICHE20',
        title: 'Promo Partenaire Leriche',
        description: '20% de remise spéciale sur les paiements Moncash/Natcash.',
        discount_type: 'percent',
        discount_value: 20,
        min_order_amount: 5,
        usage_limit: 200,
        usage_count: 31,
        is_active: true,
        expires_at: null,
        created_at: new Date().toISOString()
    },
    {
        id: '4',
        code: 'LOOT5',
        title: 'Bon Réduction $5',
        description: '$5.00 offerts sur votre recharge.',
        discount_type: 'fixed',
        discount_value: 5,
        min_order_amount: 15,
        usage_limit: 150,
        usage_count: 42,
        is_active: true,
        expires_at: null,
        created_at: new Date().toISOString()
    }
];

// Public GET /api/coupons/public - Liste des coupons actifs disponibles pour les clients
router.get('/public', (req, res) => {
    const active = demoCoupons.filter(c => c.is_active);
    res.json(active);
});

// 1. GET /api/coupons - List all coupons (Staff auth required)
router.get('/', requireAuth, async (req, res) => {
    if (DEMO_MODE) return res.json(demoCoupons);
    const { data, error } = await supabaseAdmin.from('coupons').select('*').order('created_at', { ascending: false });
    if (error || !data) {
        return res.json(demoCoupons);
    }
    res.json(data);
});

// 2. POST /api/coupons/validate - Public endpoint to validate a coupon code
router.post('/validate', async (req, res) => {
    const { code, amount } = req.body;
    if (!code || typeof code !== 'string') {
        return res.status(400).json({ valid: false, error: 'Veuillez saisir un code promo.' });
    }

    const cleanCode = code.trim().toUpperCase();
    const orderAmount = Number(amount);
    if (!Number.isFinite(orderAmount) || orderAmount < 0 || orderAmount > 100000) {
        return res.status(400).json({ valid: false, error: 'Montant de commande invalide.' });
    }

    let coupon = null;

    if (DEMO_MODE) {
        coupon = demoCoupons.find(c => c.code === cleanCode);
    } else {
        const { data, error } = await supabaseAdmin
            .from('coupons')
            .select('*')
            .eq('code', cleanCode)
            .single();
        if (!error && data) coupon = data;
        else coupon = demoCoupons.find(c => c.code === cleanCode);
    }

    if (!coupon) {
        return res.status(404).json({ valid: false, error: 'Code promo invalide.' });
    }

    if (!coupon.is_active) {
        return res.status(400).json({ valid: false, error: 'Ce code promo n\'est plus actif.' });
    }

    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        return res.status(400).json({ valid: false, error: 'Ce code promo a expiré.' });
    }

    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
        return res.status(400).json({ valid: false, error: 'Ce code promo a atteint sa limite d\'utilisations.' });
    }

    if (coupon.min_order_amount && orderAmount < coupon.min_order_amount) {
        return res.status(400).json({
            valid: false,
            error: `Ce code nécessite un montant minimum de $${coupon.min_order_amount.toFixed(2)}.`
        });
    }

    // Calculate reduction
    let discountAmount = 0;
    if (coupon.discount_type === 'percent') {
        discountAmount = Math.min(orderAmount, (orderAmount * Number(coupon.discount_value)) / 100);
    } else {
        discountAmount = Math.min(orderAmount, Number(coupon.discount_value));
    }
    discountAmount = Number(discountAmount.toFixed(2));

    res.json({
        valid: true,
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        discount_amount: discountAmount,
        message: coupon.discount_type === 'percent'
            ? `Code ${coupon.code} appliqué (-${coupon.discount_value}%)`
            : `Code ${coupon.code} appliqué (-$${coupon.discount_value})`
    });
});

// 3. POST /api/coupons - Create a new coupon (Staff auth)
router.post('/', requireAuth, requireRole('directeur', 'manager', 'administrateur'), async (req, res) => {
    const { code, discount_type, discount_value, min_order_amount, usage_limit, expires_at } = req.body;

    if (!code || typeof code !== 'string' || !Number.isFinite(Number(discount_value)) || Number(discount_value) <= 0) {
        return res.status(400).json({ error: 'Code et valeur de réduction valides requis.' });
    }

    const cleanCode = code.trim().toUpperCase();
    const type = discount_type === 'fixed' ? 'fixed' : 'percent';
    if (type === 'percent' && Number(discount_value) > 100) {
        return res.status(400).json({ error: 'Une réduction en pourcentage ne peut pas dépasser 100%.' });
    }

    const newCoupon = {
        id: String(Date.now()),
        code: cleanCode,
        discount_type: type,
        discount_value: Number(discount_value),
        min_order_amount: Number(min_order_amount) || 0,
        usage_limit: usage_limit ? Number(usage_limit) : null,
        usage_count: 0,
        is_active: true,
        expires_at: expires_at || null,
        created_at: new Date().toISOString()
    };

    if (DEMO_MODE) {
        demoCoupons.unshift(newCoupon);
        await logActivite(req.user.id, req.user.role, `Création coupon ${cleanCode}`, 'coupons', null, cleanCode);
        return res.status(201).json({ success: true, coupon: newCoupon });
    }

    const { data, error } = await supabaseAdmin.from('coupons').insert([newCoupon]).select().single();
    if (error) {
        demoCoupons.unshift(newCoupon);
        return res.status(201).json({ success: true, coupon: newCoupon });
    }

    await logActivite(req.user.id, req.user.role, `Création coupon ${cleanCode}`, 'coupons', null, cleanCode);
    res.status(201).json({ success: true, coupon: data });
});

// 4. PATCH /api/coupons/:id - Toggle active status or update coupon
router.patch('/:id', requireAuth, requireRole('directeur', 'manager', 'administrateur'), async (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body;

    if (DEMO_MODE) {
        const item = demoCoupons.find(c => c.id === String(id));
        if (!item) return res.status(404).json({ error: 'Coupon introuvable' });
        if (typeof is_active === 'boolean') item.is_active = is_active;
        await logActivite(req.user.id, req.user.role, `Modification statut coupon ${item.code}`, 'coupons', !is_active, is_active);
        return res.json({ success: true, coupon: item });
    }

    const { data, error } = await supabaseAdmin.from('coupons').update({ is_active }).eq('id', id).select().single();
    if (error) {
        const item = demoCoupons.find(c => c.id === String(id));
        if (item) {
            item.is_active = is_active;
            return res.json({ success: true, coupon: item });
        }
        return res.status(500).json({ error: 'Erreur mise à jour coupon' });
    }

    res.json({ success: true, coupon: data });
});

// 5. DELETE /api/coupons/:id - Delete a coupon
router.delete('/:id', requireAuth, requireRole('directeur'), async (req, res) => {
    const { id } = req.params;

    if (DEMO_MODE) {
        const idx = demoCoupons.findIndex(c => c.id === String(id));
        if (idx !== -1) {
            const removed = demoCoupons.splice(idx, 1);
            await logActivite(req.user.id, req.user.role, `Suppression coupon ${removed[0]?.code}`, 'coupons', removed[0]?.code, null);
        }
        return res.json({ success: true });
    }

    const { error } = await supabaseAdmin.from('coupons').delete().eq('id', id);
    if (error) {
        const idx = demoCoupons.findIndex(c => c.id === String(id));
        if (idx !== -1) demoCoupons.splice(idx, 1);
    }
    res.json({ success: true });
});

export default router;
