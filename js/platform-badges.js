/**
 * LOOTZONE - HELPER DE BADGES VECTORIELS DES PLATEFORMES OFFICIELLES
 * (Xbox, Steam, PlayStation, PC)
 */

function renderPlatformBadge(platformText) {
  const text = platformText || '';
  const p = text.toLowerCase();

  // 1. LOGO XBOX (Vert sphérique avec croix blanche #107C41)
  if (p.includes('xbox')) {
    return `
      <div class="inline-flex items-center gap-1.5 text-xs font-semibold text-[#107C41]">
        <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="11.5" fill="#ffffff"/>
          <path fill-rule="evenodd" clip-rule="evenodd" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2.2a9.78 9.78 0 0 1 6.8 2.731l-4.502 4.502a17.58 17.58 0 0 0-4.598-4.598L12 2.2zM4.662 2.399A11.93 11.93 0 0 0 2.36 6.009C1.04 8.766.726 11.892 1.488 15c.348 1.42 1.05 2.723 2.036 3.774l5.378-5.378A17.65 17.65 0 0 1 4.662 2.399zm14.676 0a17.65 17.65 0 0 1-4.24 10.997l5.378 5.378c.986-1.051 1.688-2.354 2.036-3.774.762-3.108.448-6.234-.872-8.991a11.93 11.93 0 0 0-2.302-3.61zM12 4.887l-3.265 3.265a19.78 19.78 0 0 0 3.265 8.163 19.78 19.78 0 0 0 3.265-8.163L12 4.887z" fill="#107C41"/>
        </svg>
        <span>${text}</span>
      </div>`;
  }

  // 2. LOGO STEAM (Cercle sombre avec bielle/piston blanche)
  if (p.includes('steam')) {
    return `
      <div class="inline-flex items-center gap-1.5 text-xs font-semibold text-[#171a21]">
        <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="11.5" fill="#ffffff"/>
          <path fill-rule="evenodd" clip-rule="evenodd" d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.029 4.524 4.524s-2.03 4.524-4.524 4.524h-.105l-4.076 2.911c.002.052.006.105.006.158 0 1.807-1.465 3.272-3.272 3.272-1.62 0-2.964-1.18-3.222-2.733L.367 15.011C1.883 20.25 6.678 24 12 24c6.627 0 12-5.373 12-12S18.627 0 11.979 0zM7.54 18.216c-.722 0-1.308-.587-1.308-1.308s.586-1.308 1.308-1.308c.72 0 1.307.587 1.307 1.308s-.586 1.308-1.307 1.308zm8.404-9.306c0-1.442-1.17-2.613-2.613-2.613-1.442 0-2.612 1.171-2.612 2.613 0 1.442 1.17 2.613 2.612 2.613 1.443 0 2.613-1.171 2.613-2.613z" fill="#171a21"/>
        </svg>
        <span>${text}</span>
      </div>`;
  }

  // 3. LOGO PLAYSTATION (Bleu #003791)
  if (p.includes('playstation') || p.includes('ps4') || p.includes('ps5')) {
    return `
      <div class="inline-flex items-center gap-1.5 text-xs font-semibold text-[#003791]">
        <svg class="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
          <path d="M23.669 17.26c-.34-.35-1.05-.62-2.12-.8-1.07-.19-2.38-.28-3.92-.28h-3.41v5.18h1.83v-3.71c.88.02 1.55.07 2.01.15.75.12 1.25.32 1.5.59.25.27.31.64.18 1.11-.13.47-.5.98-1.12 1.53l1.83 1.01c.85-.75 1.39-1.51 1.63-2.27.24-.76.12-1.49-.36-2.18-.03-.03-.04-.05-.05-.08zM11.9 2.14L5.64 4.38v12.24l6.26-2.25V2.14zm0 9.87l-3.93 1.41V6.36l3.93-1.41v7.06z"/>
        </svg>
        <span>${text}</span>
      </div>`;
  }

  // 4. LOGO PC / WINDOWS (Bleu Windows #0078D4)
  if (p.includes('pc') || p.includes('windows')) {
    return `
      <div class="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0078D4]">
        <svg class="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
          <path d="M0 3.449L9.75 2.1v9.451H0m0 1.35h9.75V22.35L0 20.999M10.8 1.95L24 0v11.25H10.8m0 1.5H24V24l-13.2-1.95"/>
        </svg>
        <span>${text}</span>
      </div>`;
  }

  // PAR DÉFAUT
  return `<span class="text-xs font-medium text-gray-700">${text}</span>`;
}

function getPlatformBadge(platformText) {
  return renderPlatformBadge(platformText);
}

function detectProductPlatformLabel(p) {
  if (!p) return '';
  const cat = (p.category || '').toLowerCase();
  const name = (p.name || '').toLowerCase();
  const desc = (p.desc || '').toLowerCase();
  const text = `${name} ${desc} ${cat}`;

  if (cat === 'game-cd-key') {
    if (text.includes('xbox')) return 'XBOX/PC Clé';
    if (text.includes('steam')) return 'Steam Clé';
    if (text.includes('playstation') || text.includes('ps4') || text.includes('ps5')) return 'PlayStation Clé';
    if (text.includes('pc')) return 'PC Clé';
    return 'Clé de jeu';
  }
  if (cat === 'gift-cards') {
    if (text.includes('playstation') || text.includes('psn')) return 'PlayStation';
    if (text.includes('xbox')) return 'Xbox';
    if (text.includes('steam')) return 'Steam';
    return p.name || 'Carte Cadeau';
  }
  if (p.platform) {
    return p.platform;
  }
  return '';
}

function detectProductPlatform(p) {
  return detectProductPlatformLabel(p);
}

if (typeof window !== 'undefined') {
  window.renderPlatformBadge = renderPlatformBadge;
  window.getPlatformBadge = getPlatformBadge;
  window.detectProductPlatformLabel = detectProductPlatformLabel;
  window.detectProductPlatform = detectProductPlatform;
}
