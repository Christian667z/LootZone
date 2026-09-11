import { supabaseAdmin } from './data/supabase.js';

async function test() {
    console.log("Testing tables...");
    const tables = ['commandes', 'profiles', 'products', 'wallet_transactions', 'factures', 'site_config', 'hub_requests', 'coupons', 'blog_categories', 'blog_articles', 'logs_activite', 'partenariat_requests', 'messages_brouillons', 'partenariat_messages'];
    for (const t of tables) {
        const { error } = await supabaseAdmin.from(t).select('id').limit(1);
        if (error) console.error(`Error in table ${t}:`, error.message);
        else console.log(`Table ${t} OK`);
    }
}
test();
