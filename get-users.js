import { supabaseAdmin } from './data/supabase.js';

async function test() {
    const { data } = await supabaseAdmin.from('profiles').select('*');
    console.log(data);
}
test();
