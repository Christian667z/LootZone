/**
 * ===================================================================
 * LootZone - Universal i18n & Currency Engine v3.0
 * Multi-language (FR / EN / Extensible) & Real-time Live Exchange Rates
 * Base Currency: USD (Backend & DB reference)
 * ===================================================================
 */

(function () {
    'use strict';

    // ---------------------------------------------------------------
    // 1. CONFIGURATION & CONSTANTS
    // ---------------------------------------------------------------
    const API_EXCHANGE_URL = 'https://open.er-api.com/v6/latest/USD';
    const CACHE_KEY_RATES = 'lootzone_currency_rates_cache';
    const CACHE_TTL_MS = 60 * 60 * 1000; // 1 heure de cache pour les taux
    const STORAGE_KEY_LANG = 'lootzone_lang';
    const STORAGE_KEY_CURR = 'lootzone_currency';

    // Taux de secours (fallbacks) stricts si l'API est indisponible
    const FALLBACK_RATES = {
        USD: 1.00,
        EUR: 0.92,
        HTG: 131.50
    };

    // Configuration extensible des devises (facile d'ajouter GBP, CAD, DOP, etc.)
    const CURRENCIES_CONFIG = {
        USD: {
            code: 'USD',
            symbol: '$',
            name: 'US Dollar',
            position: 'before', // "$19.99"
            decimals: 2,
            label: '$ USD'
        },
        EUR: {
            code: 'EUR',
            symbol: '€',
            name: 'Euro',
            position: 'after',  // "18.39 €"
            decimals: 2,
            label: '€ EUR'
        },
        HTG: {
            code: 'HTG',
            symbol: 'HTG',
            name: 'Gourde Haïtienne',
            position: 'after',  // "2,628.69 HTG"
            decimals: 2,
            label: 'HTG (Gourde)'
        }
    };

    // Langues supportées (extensible pour ES, etc.)
    const SUPPORTED_LANGS = {
        fr: { code: 'fr', label: 'Français', tag: 'FR' },
        en: { code: 'en', label: 'English', tag: 'EN' }
    };

    // ---------------------------------------------------------------
    // 2. DICTIONNAIRE I18N (FR / EN & FUTURES LANGUES)
    // ---------------------------------------------------------------
    const TRANSLATIONS = {
        // Navigation & En-tête
        'nav.home': { fr: 'Accueil', en: 'Home' },
        'nav.games': { fr: 'Jeux', en: 'Games' },
        'nav.blog': { fr: 'Blog', en: 'Blog' },
        'nav.help': { fr: 'Centre d\'aide', en: 'Help Center' },
        'nav.login': { fr: 'Connexion / Inscription', en: 'Log in / Sign up' },
        'nav.my_account': { fr: 'Mon Compte', en: 'My Account' },
        'nav.profile': { fr: 'Mon Profil', en: 'My Profile' },
        'nav.orders': { fr: 'Historique des achats', en: 'Order History' },
        'nav.notifications': { fr: 'Messages & Notifications', en: 'Messages & Notifications' },
        'nav.favorites': { fr: 'Mes Favoris', en: 'My Favorites' },
        'nav.cart': { fr: 'Panier', en: 'Cart' },
        'nav.search_placeholder': { fr: 'Rechercher des jeux, cartes-cadeaux...', en: 'Search games, gift cards...' },

        // Quick Navigation
        'quicknav.recharge': { fr: 'Recharge de jeu', en: 'Game Top-Up' },
        'quicknav.coins': { fr: 'Pièces de jeu', en: 'Game Coins' },
        'quicknav.giftcards': { fr: 'Carte Cadeau', en: 'Gift Cards' },
        'quicknav.gamekeys': { fr: 'Clé de jeu', en: 'Game Keys' },
        'quicknav.lootshop': { fr: 'Loot Shop', en: 'Loot Shop' },

        // Modale Paramètres (Language & Currency)
        'modal.title': { fr: 'Langue et monnaie', en: 'Language and currency' },
        'modal.lang_label': { fr: 'Langue', en: 'Language' },
        'modal.currency_label': { fr: 'Afficher la monnaie', en: 'Display currency' },
        'modal.confirm': { fr: 'Confirmer', en: 'Confirm' },
        'modal.close': { fr: 'Fermer', en: 'Close' },

        // Boutons & Actions
        'btn.buy': { fr: 'Acheter', en: 'Buy now' },
        'btn.buy_now': { fr: 'Acheter maintenant', en: 'Buy now' },
        'btn.add_cart': { fr: 'Ajouter au panier', en: 'Add to cart' },
        'btn.view': { fr: 'Voir l\'offre', en: 'View offer' },
        'btn.view_all': { fr: 'Voir tout', en: 'View all' },
        'btn.read_review': { fr: 'Lire le test', en: 'Read review' },
        'btn.join': { fr: 'Rejoindre', en: 'Join' },
        'btn.topup': { fr: 'Recharger', en: 'Top Up' },
        'btn.checkout': { fr: 'Passer la commande', en: 'Proceed to checkout' },
        'btn.save': { fr: 'Sauvegarder', en: 'Save' },
        'btn.cancel': { fr: 'Annuler', en: 'Cancel' },

        // Badges & Labels de produits
        'badge.instant': { fr: 'Livraison instantanée', en: 'Instant delivery' },
        'badge.popular': { fr: 'Populaire', en: 'Popular' },
        'badge.bestseller': { fr: 'Meilleure vente', en: 'Best seller' },
        'badge.global': { fr: 'Global', en: 'Global' },
        'badge.in_stock': { fr: 'En stock', en: 'In stock' },
        'badge.out_of_stock': { fr: 'Rupture', en: 'Out of stock' },

        // Page Produit & Recharge (Style LootBar)
        'product.game_topup': { fr: 'Recharge de jeu', en: 'Game Top-Up' },
        'product.fast': { fr: 'Rapide', en: 'Fast' },
        'product.secure': { fr: 'Sécurisé', en: 'Secure' },
        'product.support_247': { fr: '24/7', en: '24/7' },
        'product.sold': { fr: 'Vendu', en: 'Sold' },
        'product.reviews': { fr: 'avis', en: 'reviews' },
        'product.invite_promo': { fr: 'Invitez des amis pour 3*10% de réduction', en: 'Invite friends for 3*10% off' },
        'product.invite_btn': { fr: 'Allez Inviter', en: 'Go Invite' },
        'product.notice_text': { fr: 'Les achats utilisent par défaut votre solde de Gold Bar. Il est préférable d\'échanger d\'abord le même niveau dans le Gold Bar Store pour un achat fluide.', en: 'Purchases default to your Gold Bar balance. It is best to exchange the same tier in the Gold Bar Store first for smooth purchasing.' },
        'product.player_info': { fr: 'Informations du joueur', en: 'Player Information' },
        'product.uid_label': { fr: 'ID Joueur', en: 'Player ID' },
        'product.uid_placeholder': { fr: 'Entrez votre ID de joueur', en: 'Enter your Player ID' },
        'product.select_server': { fr: 'Sélectionner un Serveur', en: 'Select a Server' },
        'product.choose_server': { fr: '-- Choisir un serveur --', en: '-- Choose a server --' },
        'product.select_pack': { fr: 'Sélectionner un Pack', en: 'Select a Pack' },
        'product.order_info': { fr: 'Informations de commande', en: 'Order Details' },
        'product.label_product': { fr: 'Produit', en: 'Product' },
        'product.label_quantity': { fr: 'Quantité', en: 'Quantity' },
        'product.label_price': { fr: 'Prix', en: 'Price' },
        'product.savings': { fr: 'Économies', en: 'Savings' },
        'product.recharge_now': { fr: 'Recharger', en: 'Top Up' },
        'product.how_to_buy': { fr: 'Comment acheter ?', en: 'How to buy?' },
        'product.payment_method': { fr: 'Méthode de Paiement', en: 'Payment Method' },
        'product.no_packs': { fr: 'Aucun pack disponible.', en: 'No packs available.' },
        'product.instant_delivery': { fr: 'Livraison instantanée', en: 'Instant delivery' },
        'product.secure_payment': { fr: 'Paiement sécurisé', en: 'Secure payment' },
        'product.about_title': { fr: 'À propos', en: 'About' },
        'product.platform': { fr: 'Plateforme', en: 'Platform' },
        'product.delivery_time': { fr: 'Délai de livraison', en: 'Delivery Time' },
        'product.delivery_5min': { fr: 'Dans les 5 minutes', en: 'Within 5 minutes' },
        'product.order_confirmed': { fr: 'Commande confirmée !', en: 'Order confirmed!' },
        'product.close': { fr: 'Fermer', en: 'Close' },
        'product.confirm_wa': { fr: 'Confirmer sur WhatsApp', en: 'Confirm on WhatsApp' },

        // Features / Garanties (Pourquoi nous choisir)
        'features.why_title': { fr: 'Pourquoi nous choisir?', en: 'Why Choose Us?' },
        'features.security_title': { fr: '100% de sécurité de transaction', en: '100% Transaction Security' },
        'features.security_desc': { fr: 'LootZone garantit des transactions efficaces, professionnelles et sécurisées, protégeant entièrement vos données, 100% sécurisées.', en: 'LootZone ensures efficient, professional, and secure transactions, fully protecting your data, 100% secured.' },
        'features.support_title': { fr: 'Service Client 24/7', en: '24/7 Customer Support' },
        'features.support_desc': { fr: 'L\'équipe de Service Client fiable de LootZone est disponible 24h/24 et 7j/7 pour vous offrir une aide rapide et pratique, que ce soit avant, pendant ou après l\'achat.', en: 'LootZone\'s reliable Customer Service team is available 24/7 to provide prompt, convenient assistance before, during, or after your purchase.' },
        'features.refund_title': { fr: 'Remboursement intégral si non expédié', en: 'Full Refund If Not Delivered' },
        'features.refund_desc': { fr: 'LootZone offre les prix les plus compétitifs et un service de livraison efficace. Si l\'article n\'est pas livré ou ne peut pas être utilisé, nous promettons un remboursement à 100% et garantissons la sécurité financière.', en: 'LootZone offers the most competitive prices and efficient delivery. If an item is not delivered or cannot be used, we promise a 100% refund and guarantee financial security.' },

        // Footer & Liens légaux
        'footer.about_text': { fr: 'La plateforme de recharge de référence. Obtenez vos crédits de jeux, cartes cadeaux et abonnements instantanément au meilleur prix.', en: 'The leading digital top-up platform. Get game credits, gift cards, and subscriptions instantly at the best prices.' },
        'footer.col_nav': { fr: 'Navigation', en: 'Navigation' },
        'footer.col_support': { fr: 'Support & Légal', en: 'Support & Legal' },
        'footer.col_partner': { fr: 'Partenariat', en: 'Partnership' },
        'footer.game_credits': { fr: 'Jeux de Crédit', en: 'Game Credits' },
        'footer.gift_cards': { fr: 'Cartes Cadeaux', en: 'Gift Cards' },
        'footer.game_cd_keys': { fr: 'Clés de jeux (CD-Keys)', en: 'Game CD-Keys' },
        'footer.payment_cards': { fr: 'Cartes de Paiement', en: 'Payment Cards' },
        'footer.about_us': { fr: 'À propos de nous', en: 'About Us' },
        'footer.terms': { fr: 'Conditions d\'utilisation', en: 'Terms of Service' },
        'footer.privacy': { fr: 'Politique de confidentialité', en: 'Privacy Policy' },
        'footer.help_faq': { fr: 'FAQ / Centre d\'aide', en: 'FAQ / Help Center' },
        'footer.contact': { fr: 'Contactez-nous', en: 'Contact Us' },
        'footer.refunds_returns': { fr: 'Recharges et Retours', en: 'Refunds & Returns' },
        'footer.become_partner': { fr: 'Devenir Partenaire', en: 'Become a Partner' },
        'footer.sell_on_lootzone': { fr: 'Vendre sur LootZone', en: 'Sell on LootZone' },
        'footer.creator_program': { fr: 'Programme Créateurs', en: 'Creator Program' },
        'footer.alliance_request': { fr: 'Demande d\'Alliance', en: 'Alliance Request' },
        'footer.recruitment': { fr: 'Recrutement', en: 'Careers / Recruitment' },
        'footer.copyright': { fr: '© 2026 LootZone Inc. Tous droits réservés.', en: '© 2026 LootZone Inc. All rights reserved.' },
        'footer.rights': { fr: 'Tous droits réservés.', en: 'All rights reserved.' },
        'footer.about': { fr: 'À propos de nous', en: 'About us' },
        'footer.legal': { fr: 'Mentions Légales', en: 'Legal Notice' },

        // Notifications & Feedback
        'notify.copied': { fr: 'Copié dans le presse-papier !', en: 'Copied to clipboard!' },
        'notify.cart_added': { fr: 'Produit ajouté au panier avec succès !', en: 'Item successfully added to cart!' },
        'notify.pref_saved': { fr: 'Préférences mises à jour !', en: 'Preferences updated!' }
    };

    // ---------------------------------------------------------------
    // 3. ÉTAT LOCAL (STATE)
    // ---------------------------------------------------------------
    let currentRates = Object.assign({}, FALLBACK_RATES);
    let currentCurrency = normalizeCurrency(localStorage.getItem(STORAGE_KEY_CURR) || localStorage.getItem('as_currency') || 'USD');
    let currentLang = normalizeLang(localStorage.getItem(STORAGE_KEY_LANG) || localStorage.getItem('as_lang') || 'fr');

    function normalizeLang(lang) {
        if (!lang) return 'fr';
        const l = String(lang).toLowerCase().trim();
        return l === 'en' || l === 'us' ? 'en' : 'fr';
    }

    function normalizeCurrency(curr) {
        if (!curr) return 'USD';
        const c = String(curr).toUpperCase().trim();
        return CURRENCIES_CONFIG[c] ? c : 'USD';
    }

    // ---------------------------------------------------------------
    // 4. MOTEUR DE TAUX DE CHANGE (CURRENCY ENGINE)
    // ---------------------------------------------------------------
    function loadCachedRates() {
        try {
            const raw = localStorage.getItem(CACHE_KEY_RATES);
            if (!raw) return false;
            const data = JSON.parse(raw);
            const now = Date.now();
            if (data && data.timestamp && (now - data.timestamp < CACHE_TTL_MS) && data.rates) {
                currentRates = Object.assign({}, FALLBACK_RATES, data.rates);
                return true;
            }
        } catch (e) {
            console.warn('[LootZone Currency] Erreur lecture cache taux:', e);
        }
        return false;
    }

    async function fetchLiveRates() {
        try {
            const res = await fetch(API_EXCHANGE_URL, { cache: 'no-cache' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data && data.result === 'success' && data.rates) {
                currentRates = Object.assign({}, FALLBACK_RATES, data.rates);
                localStorage.setItem(CACHE_KEY_RATES, JSON.stringify({
                    rates: currentRates,
                    timestamp: Date.now()
                }));
                // Rafraîchir les prix une fois les taux du jour reçus
                updateAllPrices();
            }
        } catch (err) {
            console.warn('[LootZone Currency] API live inaccessible, utilisation des taux de secours:', err.message);
        }
    }

    /**
     * Convertit dynamiquement un prix USD vers la devise sélectionnée et applique le format/symbole.
     * @param {number|string} amountInUSD Prix de base en USD
     * @param {string} [targetCurrency] Devise cible optionnelle (USD, EUR, HTG, etc.)
     * @returns {string} Prix formaté (ex: "$19.99", "18.39 €", "2,628.69 HTG")
     */
    function formatPrice(amountInUSD, targetCurrency) {
        const curr = normalizeCurrency(targetCurrency || currentCurrency);
        const usdVal = parseFloat(amountInUSD);
        if (isNaN(usdVal)) return '';

        const rate = (currentRates && currentRates[curr]) ? currentRates[curr] : (FALLBACK_RATES[curr] || 1);
        const converted = usdVal * rate;

        const config = CURRENCIES_CONFIG[curr] || {
            symbol: curr,
            position: 'after',
            decimals: 2
        };

        let locale = 'fr-FR';
        if (curr === 'USD' || curr === 'HTG' || currentLang === 'en') {
            locale = 'en-US';
        }
        const formattedNum = converted.toLocaleString(locale, {
            minimumFractionDigits: config.decimals,
            maximumFractionDigits: config.decimals
        });

        if (config.position === 'before') {
            return `${config.symbol}${formattedNum}`;
        } else {
            return `${formattedNum} ${config.symbol}`;
        }
    }

    /**
     * Met à jour tous les prix du document marqués ou identifiables.
     * Scanne les éléments [data-price-usd] et convertit.
     */
    function updateAllPrices(newCurrency) {
        if (newCurrency) {
            currentCurrency = normalizeCurrency(newCurrency);
        }

        // 1. Éléments standards avec data-price-usd
        document.querySelectorAll('[data-price-usd]').forEach(el => {
            const usd = parseFloat(el.getAttribute('data-price-usd'));
            if (!isNaN(usd)) {
                const prefix = el.getAttribute('data-price-prefix') || '';
                const formatted = formatPrice(usd, currentCurrency);
                // Si l'élément contient un conteneur enfant dédié au montant
                const valSlot = el.querySelector('.price-val, .key-price-val');
                if (valSlot) {
                    valSlot.textContent = formatted;
                } else if (prefix) {
                    el.innerHTML = `${prefix}<strong>${formatted}</strong>`;
                } else {
                    el.textContent = formatted;
                }
            }
        });

        // 2. Rétrocompatibilité pour d'anciens marquages [data-price-htg]
        document.querySelectorAll('[data-price-htg]:not([data-price-usd])').forEach(el => {
            const htg = parseFloat(el.getAttribute('data-price-htg'));
            if (!isNaN(htg)) {
                // Conversion HTG vers base USD
                const usdEquivalent = htg / (FALLBACK_RATES.HTG || 131.50);
                el.setAttribute('data-price-usd', usdEquivalent.toFixed(4));
                const prefix = el.getAttribute('data-price-prefix') || '';
                const formatted = formatPrice(usdEquivalent, currentCurrency);
                el.innerHTML = `${prefix}<strong>${formatted}</strong>`;
            }
        });

        // 3. Auto-détection intelligente pour les cartes de clés existantes (ex: .key-price avec $XX.XX)
        document.querySelectorAll('.key-price, .item-price, .game-price').forEach(el => {
            if (!el.hasAttribute('data-price-usd')) {
                const raw = el.textContent.trim();
                const match = raw.match(/[\$€]?\s*([0-9]+[.,][0-9]{2})/);
                if (match && match[1]) {
                    const parsedUSD = parseFloat(match[1].replace(',', '.'));
                    if (!isNaN(parsedUSD)) {
                        el.setAttribute('data-price-usd', parsedUSD.toFixed(2));
                        el.textContent = formatPrice(parsedUSD, currentCurrency);
                    }
                }
            }
        });

        // Déclencher les événements de mise à jour pour les scripts tiers
        window.dispatchEvent(new CustomEvent('lootzone:currencyChange', {
            detail: { currency: currentCurrency, rate: currentRates[currentCurrency] || 1 }
        }));
        window.dispatchEvent(new CustomEvent('asta:currencyChange', {
            detail: { currency: currentCurrency }
        }));
    }

    // ---------------------------------------------------------------
    // 5. MOTEUR I18N (TRADUCTION MULTILINGUE)
    // ---------------------------------------------------------------
    /**
     * Traduit une clé du dictionnaire dans la langue courante.
     * @param {string} key Clé de traduction (ex: 'nav.home')
     * @param {string} [lang] Langue optionnelle ('fr' ou 'en')
     * @returns {string} Texte traduit ou la clé si non trouvée
     */
    function t(key, lang) {
        const target = normalizeLang(lang || currentLang);
        if (TRANSLATIONS[key] && TRANSLATIONS[key][target] !== undefined) {
            return TRANSLATIONS[key][target];
        }
        // Fallback en français si la clé existe
        if (TRANSLATIONS[key] && TRANSLATIONS[key].fr !== undefined) {
            return TRANSLATIONS[key].fr;
        }
        return key;
    }

    /**
     * Parcourt tous les éléments avec [data-i18n] et applique la traduction.
     * @param {string} lang Code de langue ('fr' ou 'en')
     */
    function updateLanguage(lang) {
        currentLang = normalizeLang(lang || currentLang);
        document.documentElement.lang = currentLang;

        // Éléments textuels avec data-i18n
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = t(key, currentLang);
            if (translation && translation !== key) {
                el.textContent = translation;
            }
        });

        // Placeholders d'inputs avec data-i18n-placeholder
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const translation = t(key, currentLang);
            if (translation && translation !== key) {
                el.setAttribute('placeholder', translation);
            }
        });

        // Infobulles avec data-i18n-title
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            const translation = t(key, currentLang);
            if (translation && translation !== key) {
                el.setAttribute('title', translation);
            }
        });

        // Attributs d'accessibilité avec data-i18n-aria
        document.querySelectorAll('[data-i18n-aria]').forEach(el => {
            const key = el.getAttribute('data-i18n-aria');
            const translation = t(key, currentLang);
            if (translation && translation !== key) {
                el.setAttribute('aria-label', translation);
            }
        });

        // Déclencher les événements personnalisés
        window.dispatchEvent(new CustomEvent('lootzone:langChange', {
            detail: { lang: currentLang }
        }));
        window.dispatchEvent(new CustomEvent('asta:langChange', {
            detail: { lang: currentLang.toUpperCase() }
        }));
    }

    // ---------------------------------------------------------------
    // 6. EN-TÊTE DU SITE (BOUTON DE DÉCLENCHEMENT)
    // ---------------------------------------------------------------
    function getDisplayLabel() {
        const langTag = (currentLang === 'en') ? 'English' : 'Français';
        return `${langTag} / ${currentCurrency}`;
    }

    function updateTopBarTrigger() {
        const labelText = getDisplayLabel();

        // Sélecteurs de déclencheur dans la navbar
        document.querySelectorAll('.currency-lang-trigger').forEach(btn => {
            const labelSpan = btn.querySelector('.header-currency-label, #headerCurrencyLabel');
            if (labelSpan) {
                labelSpan.textContent = labelText;
            } else {
                btn.innerHTML = `<span class="header-currency-label">${labelText}</span>`;
            }
        });

        document.querySelectorAll('#headerCurrencyLabel, .header-currency-label').forEach(el => {
            el.textContent = labelText;
        });
    }

    // ---------------------------------------------------------------
    // 7. MODALE MODERNE "LANGUAGE AND CURRENCY" (STYLE LOOTBAR)
    // ---------------------------------------------------------------
    let modalElement = null;

    function ensureCurrencyModal() {
        if (document.getElementById('currencyLangModal')) {
            modalElement = document.getElementById('currencyLangModal');
            return modalElement;
        }

        modalElement = document.createElement('div');
        modalElement.className = 'currency-lang-overlay';
        modalElement.id = 'currencyLangModal';
        modalElement.setAttribute('aria-hidden', 'true');

        modalElement.innerHTML = `
            <div class="currency-lang-dialog" role="dialog" aria-modal="true" aria-labelledby="currencyLangTitle">
                <div class="currency-lang-header">
                    <h2 class="currency-lang-title" id="currencyLangTitle">${t('modal.title', currentLang)}</h2>
                    <button type="button" class="currency-lang-close" id="currencyLangClose" aria-label="${t('modal.close', currentLang)}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div class="currency-lang-group">
                    <label class="currency-lang-label" id="currencyLangLabel" for="currencyLangSelect">${t('modal.lang_label', currentLang)}</label>
                    <div class="currency-lang-select-wrap">
                        <select class="currency-lang-select" id="currencyLangSelect">
                            <option value="fr">Français</option>
                            <option value="en">English</option>
                        </select>
                        <div class="currency-lang-select-icon" aria-hidden="true">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </div>
                    </div>
                </div>

                <div class="currency-lang-group">
                    <label class="currency-lang-label" id="currencyCurrLabel" for="currencyCurrSelect">${t('modal.currency_label', currentLang)}</label>
                    <div class="currency-lang-select-wrap">
                        <select class="currency-lang-select" id="currencyCurrSelect">
                            <option value="USD">$ USD</option>
                            <option value="EUR">€ EUR</option>
                            <option value="HTG">HTG (Gourde)</option>
                        </select>
                        <div class="currency-lang-select-icon" aria-hidden="true">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </div>
                    </div>
                </div>

                <button type="button" class="currency-lang-btn-confirm" id="currencyLangConfirm">${t('modal.confirm', currentLang)}</button>
            </div>
        `;

        document.body.appendChild(modalElement);

        // Liaison des écouteurs de la modale
        const closeBtn = modalElement.querySelector('#currencyLangClose');
        const confirmBtn = modalElement.querySelector('#currencyLangConfirm');
        const langSelect = modalElement.querySelector('#currencyLangSelect');
        const currSelect = modalElement.querySelector('#currencyCurrSelect');

        // Dynamisation au changement de select dans la modale
        langSelect.addEventListener('change', () => {
            syncModalLabels(langSelect.value);
        });

        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeCurrencyModal();
        });

        modalElement.addEventListener('click', (e) => {
            if (e.target === modalElement) {
                closeCurrencyModal();
            }
        });

        // ACTION CLÉ : Clic sur le bouton "Confirm"
        confirmBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // 1. Récupération des choix
            const selectedLang = normalizeLang(langSelect.value);
            const selectedCurrency = normalizeCurrency(currSelect.value);

            // 2. Enregistrement dans localStorage
            currentLang = selectedLang;
            currentCurrency = selectedCurrency;
            localStorage.setItem(STORAGE_KEY_LANG, selectedLang);
            localStorage.setItem(STORAGE_KEY_CURR, selectedCurrency);
            // Synchro pour rétrocompatibilité
            localStorage.setItem('as_lang', selectedLang.toUpperCase());
            localStorage.setItem('as_currency', selectedCurrency);

            // 3. Application immédiate de la langue et des devises
            updateLanguage(selectedLang);
            updateAllPrices(selectedCurrency);

            // 4. Mise à jour de l'en-tête
            updateTopBarTrigger();

            // 5. Fermeture fluide de la modale
            closeCurrencyModal();
        });

        return modalElement;
    }

    function syncModalLabels(tempLang) {
        if (!modalElement) return;
        const l = normalizeLang(tempLang || currentLang);
        const titleEl = modalElement.querySelector('#currencyLangTitle');
        const langLbl = modalElement.querySelector('#currencyLangLabel');
        const currLbl = modalElement.querySelector('#currencyCurrLabel');
        const confirmBtn = modalElement.querySelector('#currencyLangConfirm');
        const closeBtn = modalElement.querySelector('#currencyLangClose');

        if (titleEl) titleEl.textContent = t('modal.title', l);
        if (langLbl) langLbl.textContent = t('modal.lang_label', l);
        if (currLbl) currLbl.textContent = t('modal.currency_label', l);
        if (confirmBtn) confirmBtn.textContent = t('modal.confirm', l);
        if (closeBtn) closeBtn.setAttribute('aria-label', t('modal.close', l));
    }

    function openCurrencyModal() {
        const modal = ensureCurrencyModal();
        const langSelect = modal.querySelector('#currencyLangSelect');
        const currSelect = modal.querySelector('#currencyCurrSelect');

        if (langSelect) langSelect.value = currentLang;
        if (currSelect) currSelect.value = currentCurrency;

        syncModalLabels(currentLang);

        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function closeCurrencyModal() {
        if (!modalElement) return;
        modalElement.classList.remove('active');
        modalElement.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    function initTriggers() {
        ensureCurrencyModal();

        const triggers = document.querySelectorAll('.currency-lang-trigger, .header-currency-btn, #headerCurrencyBtn');
        triggers.forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openCurrencyModal();
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modalElement && modalElement.classList.contains('active')) {
                closeCurrencyModal();
            }
        });
    }

    // ---------------------------------------------------------------
    // 8. INITIALISATION AU CHARGEMENT (DOMContentLoaded)
    // ---------------------------------------------------------------
    function init() {
        // A. Chargement immédiat depuis le cache local pour un rendu sans latence
        loadCachedRates();

        // B. Application immédiate de la langue et devise enregistrées
        updateLanguage(currentLang);
        updateTopBarTrigger();
        updateAllPrices(currentCurrency);

        // C. Initialisation des boutons et de la modale
        initTriggers();

        // D. Récupération asynchrone des taux du jour via l'API ouverte
        fetchLiveRates();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ---------------------------------------------------------------
    // 9. EXPOSITION GLOBALE (API LootZone)
    // ---------------------------------------------------------------
    const LootZoneI18n = {
        // Getters
        get currentCurrency() { return currentCurrency; },
        get currentLang() { return currentLang; },
        get rates() { return Object.assign({}, currentRates); },
        get currencies() { return CURRENCIES_CONFIG; },

        // Méthodes
        formatPrice,
        formatAmount: (amt, curr) => formatPrice(amt, curr),
        updateAllPrices,
        updateLanguage,
        t,
        openModal: openCurrencyModal,
        closeModal: closeCurrencyModal,
        setCurrency: (c) => {
            currentCurrency = normalizeCurrency(c);
            localStorage.setItem(STORAGE_KEY_CURR, currentCurrency);
            localStorage.setItem('as_currency', currentCurrency);
            updateAllPrices(currentCurrency);
            updateTopBarTrigger();
        },
        setLanguage: (l) => {
            currentLang = normalizeLang(l);
            localStorage.setItem(STORAGE_KEY_LANG, currentLang);
            localStorage.setItem('as_lang', currentLang.toUpperCase());
            updateLanguage(currentLang);
            updateTopBarTrigger();
        }
    };

    // Export global propre
    window.LootZoneI18n = LootZoneI18n;
    window.formatPrice = formatPrice;
    window.updateAllPrices = updateAllPrices;
    window.updateLanguage = updateLanguage;
    window.t = t;

    // Rétrocompatibilité totale pour le code existant
    window.AstaCurrency = LootZoneI18n;
    window.LootZoneCurrency = LootZoneI18n;

})();
