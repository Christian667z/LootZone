/**
 * LOOTZONE — HELPER DE BADGES VECTORIELS DES PLATEFORMES OFFICIELLES
 * (Xbox, Steam, PlayStation, PC)
 *
 * Usage :
 *   renderPlatformBadge("XBOX/PC Clé")       → HTML complet avec SVG + texte
 *   renderPlatformBadge("Steam Clé")          → idem
 *   applyPlatformBadgesToStaticCards()        → injecte dans tous les [data-platform]
 */

// ─── SVG DEFINITIONS ────────────────────────────────────────────────────────

const _LZ_SVG_XBOX = `<svg aria-label="Xbox" role="img" class="w-4 h-4 shrink-0" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="24" cy="24" r="24" fill="#107C41"/>
  <path fill="#FFFFFF" d="M24 6C14.059 6 6 14.059 6 24s8.059 18 18 18 18-8.059 18-18S33.941 6 24 6zm0 3.6a14.36 14.36 0 0 1 9.36 3.456L24 22.08l-9.36-9.024A14.36 14.36 0 0 1 24 9.6zM11.28 15.84A14.345 14.345 0 0 0 9.6 24c0 2.762.784 5.344 2.136 7.536L19.44 24l-8.16-8.16zm25.44 0L28.56 24l7.704 7.536A14.345 14.345 0 0 0 38.4 24a14.345 14.345 0 0 0-1.68-8.16zM24 25.92l-9.36 9.024A14.36 14.36 0 0 0 24 38.4a14.36 14.36 0 0 0 9.36-3.456L24 25.92z"/>
</svg>`;

const _LZ_SVG_STEAM = `<svg aria-label="Steam" role="img" class="w-4 h-4 shrink-0" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="lz-steam-g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1b2838"/>
      <stop offset="100%" stop-color="#2a475e"/>
    </linearGradient>
  </defs>
  <circle cx="24" cy="24" r="24" fill="url(#lz-steam-g)"/>
  <path fill="#FFFFFF" fill-rule="evenodd" clip-rule="evenodd"
    d="M24 6C14.059 6 6 14.059 6 24a17.946 17.946 0 0 0 11.657 16.754l-4.554-7.682a4.8 4.8 0 0 1-.183-.999 4.8 4.8 0 0 1 4.8-4.8c1.103 0 2.12.374 2.927.996l6.28-4.483A8.4 8.4 0 0 1 24 6zm-9.28 22.273a3 3 0 1 0 5.56 2.254 3 3 0 0 0-5.56-2.254zM29.4 14.4a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 2.4a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2z"/>
</svg>`;

const _LZ_SVG_PSN = `<svg aria-label="PlayStation" role="img" class="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
  <path d="M23.669 17.26c-.34-.35-1.05-.62-2.12-.8-1.07-.19-2.38-.28-3.92-.28h-3.41v5.18h1.83v-3.71c.88.02 1.55.07 2.01.15.75.12 1.25.32 1.5.59.25.27.31.64.18 1.11-.13.47-.5.98-1.12 1.53l1.83 1.01c.85-.75 1.39-1.51 1.63-2.27.24-.76.12-1.49-.36-2.18zM11.9 2.14L5.64 4.38v12.24l6.26-2.25V2.14zm0 9.87l-3.93 1.41V6.36l3.93-1.41v7.06z"/>
</svg>`;

const _LZ_SVG_PC = `<svg aria-label="PC Windows" role="img" class="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
  <path d="M0 3.449L9.75 2.1v9.451H0m0 1.35h9.75V22.35L0 20.999M10.8 1.95L24 0v11.25H10.8m0 1.5H24V24l-13.2-1.95"/>
</svg>`;

// ─── RENDER FUNCTION ────────────────────────────────────────────────────────

/**
 * Retourne le HTML complet d'un badge plateforme (SVG + texte).
 * Ne tronque JAMAIS le texte d'origine.
 *
 * @param {string} platformText  ex: "XBOX/PC Clé", "Steam Clé", "PlayStation"
 * @returns {string} HTML string
 */
function renderPlatformBadge(platformText) {
  const text = (platformText || '').trim();
  const p = text.toLowerCase();

  // 1. XBOX — Vert officiel #107C41
  if (p.includes('xbox')) {
    return `<div class="inline-flex items-center gap-1.5 text-xs font-semibold text-[#107C41]">${_LZ_SVG_XBOX}<span>${text}</span></div>`;
  }

  // 2. STEAM — Bleu sombre avec dégradé
  if (p.includes('steam')) {
    return `<div class="inline-flex items-center gap-1.5 text-xs font-semibold text-[#66c0f4]">${_LZ_SVG_STEAM}<span>${text}</span></div>`;
  }

  // 3. PLAYSTATION — Bleu #003791
  if (p.includes('playstation') || p.includes('ps4') || p.includes('ps5') || p.includes('psn')) {
    return `<div class="inline-flex items-center gap-1.5 text-xs font-semibold text-[#003791]">${_LZ_SVG_PSN}<span>${text}</span></div>`;
  }

  // 4. PC / WINDOWS — Bleu Windows #0078D4
  if (p.includes('windows') || (p.includes('pc') && !p.includes('xbox'))) {
    return `<div class="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0078D4]">${_LZ_SVG_PC}<span>${text}</span></div>`;
  }

  // PAR DÉFAUT — texte simple
  return `<span class="text-xs font-medium text-gray-500">${text}</span>`;
}

/**
 * Alias pour compatibilité avec l'ancien code
 */
function getPlatformBadge(platformText) {
  return renderPlatformBadge(platformText);
}

// ─── DETECT PLATFORM ────────────────────────────────────────────────────────

/**
 * Détecte le label de plateforme d'un objet produit.
 * @param {object} p  Objet produit (name, category, desc, platform)
 * @returns {string}
 */
function detectProductPlatformLabel(p) {
  if (!p) return '';
  const cat  = (p.category || '').toLowerCase();
  const text = `${p.name || ''} ${p.desc || ''} ${p.category || ''}`.toLowerCase();

  if (cat === 'game-cd-key') {
    if (text.includes('xbox'))                                                            return 'XBOX/PC Clé';
    if (text.includes('steam'))                                                           return 'Steam Clé';
    if (text.includes('playstation') || text.includes('ps4') || text.includes('ps5'))    return 'PlayStation Clé';
    if (text.includes('pc'))                                                              return 'PC Clé';
    return 'Clé de jeu';
  }
  if (cat === 'gift-cards') {
    if (text.includes('playstation') || text.includes('psn')) return 'PlayStation';
    if (text.includes('xbox'))                                return 'Xbox';
    if (text.includes('steam'))                               return 'Steam';
    return p.name || 'Carte Cadeau';
  }
  if (p.platform) return p.platform;
  return '';
}

function detectProductPlatform(p) {
  return detectProductPlatformLabel(p);
}

// ─── INJECTION AUTOMATIQUE SUR LES CARTES STATIQUES ────────────────────────

/**
 * Parcourt tous les éléments ayant l'attribut [data-platform] dans la page
 * et injecte le badge SVG correspondant via renderPlatformBadge().
 *
 * Usage dans index.html :
 *   <div class="key-platform-row" data-platform="XBOX/PC Clé"></div>
 *   <div class="card-platform-badge" data-platform="Steam Clé"></div>
 */
function applyPlatformBadgesToStaticCards() {
  const targets = document.querySelectorAll('[data-platform]:not([data-badge-applied])');
  targets.forEach(function(el) {
    const label = el.getAttribute('data-platform');
    if (!label) return;
    el.innerHTML = renderPlatformBadge(label);
    el.setAttribute('data-badge-applied', 'true');
  });
}

// ─── EXPOSITION GLOBALE ──────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.renderPlatformBadge              = renderPlatformBadge;
  window.getPlatformBadge                 = getPlatformBadge;
  window.detectProductPlatformLabel       = detectProductPlatformLabel;
  window.detectProductPlatform            = detectProductPlatform;
  window.applyPlatformBadgesToStaticCards = applyPlatformBadgesToStaticCards;

  // Injection automatique au chargement de la page
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyPlatformBadgesToStaticCards);
  } else {
    applyPlatformBadgesToStaticCards();
  }
}

