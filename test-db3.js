import { supabaseAdmin } from './data/supabase.js';

async function test() {
    const { error } = await supabaseAdmin.from('stock_numerique').select('id').limit(1);
    if (error) console.error(`Error in table stock_numerique:`, error.message);
    else console.log(`Table stock_numerique OK`);
}
test();
