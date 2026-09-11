import { supabaseAdmin } from './data/supabase.js';

async function test() {
    console.log("Testing tables...");
    const tables = ['logs_activite', 'hub_requests'];
    for (const t of tables) {
        const { error } = await supabaseAdmin.from(t).select('id').limit(1);
        if (error) console.error(`Error in table ${t}:`, error.message);
        else console.log(`Table ${t} OK`);
    }
}
test();
