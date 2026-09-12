import express from 'express';
import { supabaseAdmin, DEMO_MODE } from '../supabase.js';
import { requireAuth, requireMinRole } from '../middleware/auth.js';
import { logActivite } from './logs.js';

const router = express.Router();

const VALID_CATEGORIES = ['jeux', 'payment-cards', 'gift-cards', 'game-console', 'game-cd-key', 'video-streaming', 'music', 'shopping', 'telco-prepaid', 'tools', 'software', 'social-app'];
const DB_FIELD_NAMES = {
    needsServer: 'needs_server',
    serverOptions: 'server_options',
    idLabel: 'id_label',
    idPlaceholder: 'id_placeholder',
    discountTiers: 'discount_tiers'
};

let demoProducts = null;

async function getProducts() {
    if (!DEMO_MODE && supabaseAdmin) {
        try {
            const { data, error } = await supabaseAdmin.from('products').select('*').order('id');
            if (!error && data && data.length > 0) return data;
        } catch (err) {
            console.warn('[products] Supabase non disponible ou vide, repli sur products.js:', err.message);
        }
    }
    if (!demoProducts) {
        try {
            const { readFileSync } = await import('fs');
            const { fileURLToPath } = await import('url');
            const path = await import('path');
            const __dirname = path.dirname(fileURLToPath(import.meta.url));
            const raw = readFileSync(path.join(__dirname, '../products.js'), 'utf8');
            const idx = raw.indexOf('const products =');
            if (idx !== -1) {
                const fn = new Function(raw.substring(idx) + '\nreturn products;');
                demoProducts = fn();
            } else {
                demoProducts = [];
            }
        } catch (err) {
            console.error('[products] Erreur chargement products.js:', err.message);
            demoProducts = [];
        }
    }
    return demoProducts;
}

async function saveProductsToFile(products) {
    try {
        const { readFileSync, writeFileSync } = await import('fs');
        const { fileURLToPath } = await import('url');
        const path = await import('path');
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '../products.js');
        const raw = readFileSync(filePath, 'utf8');
        const idx = raw.indexOf('const products');
        if (idx === -1) return;
        const header = raw.substring(0, idx);
        const newContent = header + 'const products = ' + JSON.stringify(products, null, 2) + '; // ← FIN DU TABLEAU — ne rien écrire après cette ligne\n';
        writeFileSync(filePath, newContent, 'utf8');
    } catch (e) {
        console.error('[products] Erreur sauvegarde fichier:', e.message);
    }
}

router.get('/', async (req, res) => {
    try {
        const isAll = req.query.all === 'true';
        const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
        const limit = isAll ? 1000 : Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const category = req.query.category || null;
        const search   = (req.query.search || '').trim().toLowerCase();

        let products = await getProducts();

        // Filtres optionnels
        if (category) products = products.filter(p => p.category === category);
        if (search)   products = products.filter(p =>
            (p.name || '').toLowerCase().includes(search) ||
            (p.desc || '').toLowerCase().includes(search)
        );

        const total = products.length;
        const start = (page - 1) * limit;
        const paged = isAll ? products : products.slice(start, start + limit);

        res.json({
            success: true,
            products: paged,
            data: paged,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (e) {
        console.error('[products] GET /:', e.message);
        res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
    }
});

/**
 * POST /api/products/stats
 * Corps : { ids: string[] }
 * Appelle la RPC Supabase `get_product_stats_batch` ou lit la vue `product_stats`.
 */
router.post('/stats', async (req, res) => {
    try {
        const ids = req.body?.ids;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, error: 'ids doit être un tableau non vide' });
        }
        // Limite de sécurité
        const safeIds = ids.slice(0, 200).map(String);

        if (!supabaseAdmin) {
            return res.json({ success: true, data: [] });
        }

        let data = null;

        // 1. Tentative RPC batch
        try {
            const rpc = await supabaseAdmin.rpc('get_product_stats_batch', { p_ids: safeIds });
            if (!rpc.error && Array.isArray(rpc.data)) data = rpc.data;
        } catch (_) {}

        // 2. Fallback sur la vue product_stats
        if (!data) {
            const view = await supabaseAdmin
                .from('product_stats')
                .select('product_id, total_sales, avg_rating, total_reviews')
                .in('product_id', safeIds);
            if (!view.error && Array.isArray(view.data)) data = view.data;
        }

        res.json({ success: true, data: data || [] });
    } catch (e) {
        console.error('[products] POST /stats:', e.message);
        res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
    }
});

router.post('/', requireAuth, requireMinRole('administrateur'), async (req, res) => {
    const { name, category, img, desc, discount, rating, sales, recommended, date, price, needsServer, serverOptions, idLabel, idPlaceholder, denoms, discount_tiers, is_active } = req.body;
    if (!name || !category || !VALID_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Données invalides' });

    const activeBool = is_active !== undefined ? Boolean(is_active) : true;

    if (DEMO_MODE) {
        const products = await getProducts();
        const newId = Math.max(...products.map(p => p.id), 0) + 1;
        const newProduct = { id: newId, name, category, img: img || '', desc: desc || '', discount: discount || '', rating: rating || 5.0, sales: sales || '0', recommended: !!recommended, date: date || new Date().toISOString().split('T')[0], price: price || 0, needsServer: !!needsServer, serverOptions: serverOptions || [], idLabel: idLabel || 'ID', idPlaceholder: idPlaceholder || '', denoms: denoms || [], discount_tiers: discount_tiers || [], is_active: activeBool };
        demoProducts.push(newProduct);
        await saveProductsToFile(demoProducts);
        await logActivite(req.user.id, req.user.role, `Ajout produit #${newId} — ${name}`, `produit:${newId}`, null, name);
        return res.json({ success: true, product: newProduct });
    }

    const { data, error } = await supabaseAdmin.from('products').insert({ name, category, img, desc, discount, rating, sales, recommended, date, price, needs_server: needsServer, server_options: serverOptions, id_label: idLabel, id_placeholder: idPlaceholder, denoms, discount_tiers, is_active: activeBool }).select().single();
    if (error) { console.warn('[Fallback]', error.message); return res.json(DEMO_MODE ? { fallbacked: true } : { error: 'Database error' }); }
    await logActivite(req.user.id, req.user.role, `Ajout produit #${data.id} — ${name}`, `produit:${data.id}`, null, name);
    res.json({ success: true, product: data });
});

router.put('/:id', requireAuth, requireMinRole('administrateur'), async (req, res) => {
    const id = req.params.id;
    const allowedFields = ['name', 'category', 'img', 'desc', 'discount', 'rating', 'sales', 'recommended', 'date', 'price', 'needsServer', 'serverOptions', 'idLabel', 'idPlaceholder', 'denoms', 'discount_tiers', 'is_active'];
    const updates = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowedFields.includes(key)));
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Aucune modification valide' });
    if (updates.category && !VALID_CATEGORIES.includes(updates.category)) return res.status(400).json({ error: 'Catégorie invalide' });

    if (DEMO_MODE) {
        const products = await getProducts();
        const idx = products.findIndex(p => String(p.id) === String(id));
        if (idx === -1) return res.status(404).json({ error: 'Produit introuvable' });
        const old = { ...products[idx] };
        Object.assign(products[idx], updates);
        await saveProductsToFile(products);
        await logActivite(req.user.id, req.user.role, `Modification produit #${id} — ${products[idx].name}`, `produit:${id}`, JSON.stringify(old), JSON.stringify(updates));
        return res.json({ success: true, product: products[idx] });
    }

    const { data: old } = await supabaseAdmin.from('products').select('*').eq('id', id).single();
    const dbUpdates = Object.fromEntries(Object.entries(updates).map(([key, value]) => [DB_FIELD_NAMES[key] || key, value]));
    const { data, error } = await supabaseAdmin.from('products').update(dbUpdates).eq('id', id).select().single();
    if (error) { console.warn('[Fallback]', error.message); return res.json(DEMO_MODE ? { fallbacked: true } : { error: 'Database error' }); }
    await logActivite(req.user.id, req.user.role, `Modification produit #${id} — ${data.name}`, `produit:${id}`, JSON.stringify(old), JSON.stringify(dbUpdates));
    res.json({ success: true, product: data });
});

router.delete('/:id', requireAuth, requireMinRole('manager'), async (req, res) => {
    const id = req.params.id;

    if (DEMO_MODE) {
        const products = await getProducts();
        const idx = products.findIndex(p => String(p.id) === String(id));
        if (idx === -1) return res.status(404).json({ error: 'Produit introuvable' });
        const [removed] = products.splice(idx, 1);
        await saveProductsToFile(demoProducts);
        await logActivite(req.user.id, req.user.role, `Suppression produit #${id} — ${removed.name}`, `produit:${id}`, removed.name, null);
        return res.json({ success: true });
    }

    const { data: prod } = await supabaseAdmin.from('products').select('name').eq('id', id).single();
    const { error } = await supabaseAdmin.from('products').delete().eq('id', id);
    if (error) { console.warn('[Fallback]', error.message); return res.json(DEMO_MODE ? { fallbacked: true } : { error: 'Database error' }); }
    await logActivite(req.user.id, req.user.role, `Suppression produit #${id} — ${prod?.name}`, `produit:${id}`, prod?.name, null);
    res.json({ success: true });
});

export default router;
