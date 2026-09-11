import fs from 'fs';
import path from 'path';

const routesDir = 'data/Routes';
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
    const p = path.join(routesDir, file);
    let code = fs.readFileSync(p, 'utf8');

    // Replace basic errors with fallback for specific routes if possible
    // Actually, simpler to just replace:
    // if (error) return res.status(500).json({ error: 'Erreur interne du serveur' });
    // with:
    // if (error) { console.warn(`[${file}] Error:`, error.message); return res.status(500).json({ error: 'Erreur interne du serveur' }); }

    // Let's do it manually for GET routes that return arrays
    code = code.replace(/if \(error\) return res\.status\(500\)\.json\(\{ error: 'Erreur interne du serveur' \}\);/g, 
        `if (error) { console.warn('[Fallback]', error.message); return res.json(DEMO_MODE ? { fallbacked: true } : { error: 'Database error' }); }`);

    fs.writeFileSync(p, code);
});
console.log("Patched");
