import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';

function getJsFiles(dir) {
    let files = [];
    try {
        for (const item of readdirSync(dir)) {
            const full = join(dir, item);
            if (statSync(full).isDirectory()) {
                files = files.concat(getJsFiles(full));
            } else if (item.endsWith('.js')) {
                files.push(full);
            }
        }
    } catch (_) {}
    return files;
}

const jsFiles = getJsFiles('data');
console.log(`\n🔍 Vérification de la syntaxe (${jsFiles.length} fichiers dans data/)...`);
let hasError = false;

for (const file of jsFiles) {
    try {
        execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
        console.log(`  ✅ ${file}`);
    } catch (err) {
        console.error(`  ❌ ${file} : Erreur de syntaxe`);
        if (err.stderr) console.error(err.stderr.toString());
        hasError = true;
    }
}

if (hasError) {
    console.error('\n❌ Des erreurs de syntaxe ont été détectées.');
    process.exit(1);
} else {
    console.log('\n✨ Tous les fichiers JavaScript sont valides !');
}
