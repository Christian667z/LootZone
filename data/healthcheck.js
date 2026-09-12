try {
    if (typeof process.loadEnvFile === 'function') {
        process.loadEnvFile();
    }
} catch (_) {}

try {
    const dotenv = await import('dotenv');
    dotenv.default?.config?.();
} catch (_) {}

console.log('══════════════════════════════════════════════════');
console.log('   🩺 LOOTZONE — Diagnostic de Santé du Système   ');
console.log('══════════════════════════════════════════════════\n');

console.log('1. Environnement système :');
console.log(`   - Node.js : ${process.version}`);
console.log(`   - Port configuré : ${process.env.PORT || 3000} (défaut : 3000)`);
console.log(`   - Mode démo forcé : ${process.env.DEMO_MODE === 'true' ? 'OUI' : 'NON'}`);

console.log('\n2. Identifiants Supabase :');
const hasUrl = Boolean(process.env.SUPABASE_URL);
const hasKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
console.log(`   - SUPABASE_URL : ${hasUrl ? '✅ Présent' : '⚠️ Absent (mode démo activé)'}`);
console.log(`   - Clé Supabase : ${hasKey ? '✅ Présente' : '⚠️ Absente (mode démo activé)'}`);

console.log('\n3. Dépendances & Base de données :');
let supabaseModule = null;
try {
    supabaseModule = await import('./supabase.js');
} catch (e) {
    console.log(`   ℹ️  Modules npm non installés localement (${e.code || e.message}).`);
    console.log('   👉 Exécutez "npm install" pour installer les paquets @supabase/supabase-js, express, etc.');
}

if (supabaseModule) {
    const { supabaseAdmin, DEMO_MODE, checkSupabaseConnection } = supabaseModule;
    if (DEMO_MODE || !supabaseAdmin) {
        console.log('   ℹ️  Application configurée en mode démo (mémoire locale).');
    } else {
        try {
            const ok = await checkSupabaseConnection();
            if (ok) {
                console.log('   ✅ Connexion Supabase établie avec succès.');
                const { count, error } = await supabaseAdmin.from('products').select('*', { count: 'exact', head: true });
                if (!error) {
                    console.log(`   📦 Produits en base : ${count ?? 0}`);
                }
            } else {
                console.log('   ⚠️ Supabase inaccessible — repli automatique en mode démo.');
            }
        } catch (e) {
            console.warn('   ⚠️ Erreur test connexion :', e.message);
        }
    }
}

console.log('\n══════════════════════════════════════════════════');
console.log('✨ Diagnostic terminé.');
console.log('══════════════════════════════════════════════════\n');
