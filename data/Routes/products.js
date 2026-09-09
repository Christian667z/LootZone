import express from 'express';
import { supabaseAdmin, DEMO_MODE } from '../supabase.js';
import { requireAuth, requireMinRole } from '../middleware/auth.js';
import { logActivite } from './logs.js';

const router = express.Router();

const VALID_CATEGORIES = ['jeux', 'payment-cards', 'gift-cards', 'game-console', 'game-cd-key', 'video-streaming', 'music', 'shopping', 'telco-prepaid', 'tools', 'software', 'social-app'];

let demoProducts = null;

async function getProducts() {
    if (DEMO_MODE) {
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
    const { data, error } = await supabaseAdmin.from('products').select('*').order('id');
    if (error) throw error;
    return data;
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
        const products = await getProducts();
        res.json({ products, total: products.length });
    } catch (e) {
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

router.post('/', requireAuth, requireMinRole('administrateur'), async (req, res) => {
    const { name, category, img, desc, discount, rating, sales, recommended, date, price, needsServer, serverOptions, idLabel, idPlaceholder, denoms, discount_tiers } = req.body;
    if (!name || !category || !VALID_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Données invalides' });

    if (DEMO_MODE) {
        const products = await getProducts();
        const newId = Math.max(...products.map(p => p.id), 0) + 1;
        const newProduct = { id: newId, name, category, img: img || '', desc: desc || '', discount: discount || '', rating: rating || 5.0, sales: sales || '0', recommended: !!recommended, date: date || new Date().toISOString().split('T')[0], price: price || 0, needsServer: !!needsServer, serverOptions: serverOptions || [], idLabel: idLabel || 'ID', idPlaceholder: idPlaceholder || '', denoms: denoms || [], discount_tiers: discount_tiers || [] };
        demoProducts.push(newProduct);
        await saveProductsToFile(demoProducts);
        await logActivite(req.user.id, req.user.role, `Ajout produit #${newId} — ${name}`, `produit:${newId}`, null, name);
        return res.json({ success: true, product: newProduct });
    }

    const { data, error } = await supabaseAdmin.from('products').insert({ name, category, img, desc, discount, rating, sales, recommended, date, price, needs_server: needsServer, server_options: serverOptions, id_label: idLabel, id_placeholder: idPlaceholder, denoms, discount_tiers }).select().single();
    if (error) return res.status(500).json({ error: 'Erreur interne du serveur' });
    await logActivite(req.user.id, req.user.role, `Ajout produit #${data.id} — ${name}`, `produit:${data.id}`, null, name);
    res.json({ success: true, product: data });
});

router.put('/:id', requireAuth, requireMinRole('administrateur'), async (req, res) => {
    const id = req.params.id;
    const updates = req.body;

    if (DEMO_MODE) {
        const products = await getProducts();
        const idx = products.findIndex(p => String(p.id) === String(id));
        if (idx === -1) return res.status(404).json({ error: 'Produit introuvable' });
        const old = { ...products[idx] };
        Object.assign(products[idx], updates);
        await saveProductsToFile(demoProducts);
        await logActivite(req.user.id, req.user.role, `Modification produit #${id} — ${products[idx].name}`, `produit:${id}`, JSON.stringify(old), JSON.stringify(updates));
        return res.json({ success: true, product: products[idx] });
    }

    const { data: old } = await supabaseAdmin.from('products').select('*').eq('id', id).single();
    const { data, error } = await supabaseAdmin.from('products').update(updates).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: 'Erreur interne du serveur' });
    await logActivite(req.user.id, req.user.role, `Modification produit #${id} — ${data.name}`, `produit:${id}`, JSON.stringify(old), JSON.stringify(updates));
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
    if (error) return res.status(500).json({ error: 'Erreur interne du serveur' });
    await logActivite(req.user.id, req.user.role, `Suppression produit #${id} — ${prod?.name}`, `produit:${id}`, prod?.name, null);
    res.json({ success: true });
});

export default router;
