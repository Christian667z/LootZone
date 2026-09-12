try {
    if (typeof process.loadEnvFile === 'function') {
        process.loadEnvFile();
    }
} catch (_) {}

try {
    const dotenv = await import('dotenv');
    dotenv.default?.config?.();
} catch (_) {}

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function seed() {
    console.log('🌱 Démarrage de l\'importation des produits dans Supabase...');

    let supabaseModule;
    try {
        supabaseModule = await import('./supabase.js');
    } catch (e) {
        console.error('❌ Impossible de charger les dépendances Supabase (exécutez d\'abord "npm install").');
        process.exit(1);
    }

    const { supabaseAdmin, DEMO_MODE } = supabaseModule;

    if (DEMO_MODE || !supabaseAdmin) {
        console.error('❌ Impossible de se connecter à Supabase en écriture (vérifiez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY).');
        process.exit(1);
    }

    const raw = readFileSync(path.join(__dirname, 'products.js'), 'utf8');
    const idx = raw.indexOf('const products =');
    if (idx === -1) {
        console.error('❌ Impossible de trouver le tableau products dans data/products.js');
        process.exit(1);
    }

    const fn = new Function(raw.substring(idx) + '\nreturn products;');
    const list = fn();
    console.log(`📦 ${list.length} produits détectés dans data/products.js.`);

    let inserted = 0;
    for (const p of list) {
        const payload = {
            id: p.id,
            name: p.name,
            category: p.category,
            img: p.img,
            desc: p.desc || '',
            discount: p.discount || '',
            rating: p.rating || 5.0,
            sales: p.sales || '0',
            recommended: Boolean(p.recommended),
            date: p.date || new Date().toISOString().split('T')[0],
            price: p.price || 0,
            needs_server: Boolean(p.needsServer),
            server_options: p.serverOptions || [],
            id_label: p.idLabel || 'ID du joueur',
            id_placeholder: p.idPlaceholder || 'Ex: 123456789',
            denoms: p.denoms || [],
            discount_tiers: p.discountTiers || [],
            is_active: true
        };

        const { error } = await supabaseAdmin.from('products').upsert(payload, { onConflict: 'id' });
        if (error) {
            console.warn(`⚠️ Erreur sur produit #${p.id} (${p.name}):`, error.message);
        } else {
            inserted++;
        }
    }

    console.log(`✅ ${inserted}/${list.length} produits synchronisés dans la table "products".`);
}

seed().catch(err => {
    console.error('❌ Erreur lors du seed :', err.message);
    process.exit(1);
});
