/**
 * Asta-Shops Currency & Language Management Module
 * Supports HTG (Gourde), USD ($), EUR (€)
 */

(function () {
    const RATES = {
        HTG: 1,
        USD: 1 / 132,   // 1 USD = 132 HTG
        EUR: 1 / 143    // 1 EUR = 143 HTG
    };

    const SYMBOLS = {
        HTG: 'HTG',
        USD: '$',
        EUR: '€'
    };

    let currentCurrency = localStorage.getItem('as_currency') || 'USD';
    let currentLang = localStorage.getItem('as_lang') || 'FR';

    function getDisplayLang(lang) {
        if (lang === 'FR') return 'Français';
        if (lang === 'EN') return 'English';
        return lang;
    }

    function formatAmount(amountHTG, currency) {
        const targetCurr = currency || currentCurrency;
        const rate = RATES[targetCurr] || 1;
        const converted = amountHTG * rate;

        if (targetCurr === 'HTG') {
            return `${Math.round(converted).toLocaleString('fr-FR')} HTG`;
        } else if (targetCurr === 'USD') {
            return `$${converted.toFixed(2)}`;
        } else if (targetCurr === 'EUR') {
            return `${converted.toFixed(2)} €`;
        }
        return `${converted.toFixed(2)} ${targetCurr}`;
    }

    function setCurrency(newCurrency) {
        if (!RATES[newCurrency]) return;
        currentCurrency = newCurrency;
        localStorage.setItem('as_currency', newCurrency);
        updateTopBarTrigger();
        updatePagePrices();
        window.dispatchEvent(new CustomEvent('asta:currencyChange', { detail: { currency: newCurrency } }));
    }

    function setLanguage(newLang) {
        currentLang = newLang;
        localStorage.setItem('as_lang', newLang);
        updateTopBarTrigger();
        window.dispatchEvent(new CustomEvent('asta:langChange', { detail: { lang: newLang } }));
    }

    function updateTopBarTrigger() {
        const displayLabel = `${getDisplayLang(currentLang)} / ${currentCurrency}`;

        const triggers = document.querySelectorAll('.currency-lang-trigger');
        triggers.forEach(el => {
            const labelEl = el.querySelector('.header-currency-label, #headerCurrencyLabel');
            if (labelEl) {
                labelEl.textContent = displayLabel;
            } else if (el.classList.contains('header-currency-btn')) {
                el.innerHTML = `<span class="header-currency-label">${displayLabel}</span>`;
            } else {
                el.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="top-icon">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                    ${displayLabel} ▾
                `;
            }
        });
        document.querySelectorAll('#headerCurrencyLabel, .header-currency-label').forEach(el => {
            el.textContent = displayLabel;
        });
    }

    function updatePagePrices() {
        // Elements with data-price-htg
        document.querySelectorAll('[data-price-htg]').forEach(el => {
            const htgVal = parseFloat(el.getAttribute('data-price-htg'));
            if (!isNaN(htgVal)) {
                const prefix = el.getAttribute('data-price-prefix') || '';
                el.innerHTML = `${prefix}<strong>${formatAmount(htgVal, currentCurrency)}</strong>`;
            }
        });

        // Elements with key-price attribute data-usd
        document.querySelectorAll('[data-price-usd]').forEach(el => {
            const usdVal = parseFloat(el.getAttribute('data-price-usd'));
            if (!isNaN(usdVal)) {
                const htgVal = usdVal * 132;
                el.textContent = formatAmount(htgVal, currentCurrency);
            }
        });
    }

    // Modal Manager for Language & Currency (LootBar-style modal)
    let modalOverlay = null;

    function ensureCurrencyModal() {
        if (document.getElementById('currencyLangModal')) {
            modalOverlay = document.getElementById('currencyLangModal');
            return modalOverlay;
        }

        modalOverlay = document.createElement('div');
        modalOverlay.className = 'currency-lang-overlay';
        modalOverlay.id = 'currencyLangModal';
        modalOverlay.setAttribute('aria-hidden', 'true');

        modalOverlay.innerHTML = `
            <div class="currency-lang-dialog" role="dialog" aria-modal="true" aria-labelledby="currencyLangTitle">
                <div class="currency-lang-header">
                    <h2 class="currency-lang-title" id="currencyLangTitle">Langue et monnaie</h2>
                    <button type="button" class="currency-lang-close" id="currencyLangClose" aria-label="Fermer">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div class="currency-lang-group">
                    <label class="currency-lang-label" id="currencyLangLabel" for="currencyLangSelect">Langue</label>
                    <div class="currency-lang-select-wrap">
                        <select class="currency-lang-select" id="currencyLangSelect">
                            <option value="FR">Français</option>
                            <option value="EN">English</option>
                        </select>
                        <div class="currency-lang-select-icon" aria-hidden="true">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </div>
                    </div>
                </div>

                <div class="currency-lang-group">
                    <label class="currency-lang-label" id="currencyCurrLabel" for="currencyCurrSelect">Afficher la monnaie</label>
                    <div class="currency-lang-select-wrap">
                        <select class="currency-lang-select" id="currencyCurrSelect">
                            <option value="USD">$ USD</option>
                            <option value="HTG">HTG (Gourde)</option>
                            <option value="EUR">€ EUR</option>
                        </select>
                        <div class="currency-lang-select-icon" aria-hidden="true">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </div>
                    </div>
                </div>

                <button type="button" class="currency-lang-btn-confirm" id="currencyLangConfirm">Confirmer</button>
            </div>
        `;

        document.body.appendChild(modalOverlay);

        // Bind internal modal events
        const closeBtn = modalOverlay.querySelector('#currencyLangClose');
        const confirmBtn = modalOverlay.querySelector('#currencyLangConfirm');
        const langSelect = modalOverlay.querySelector('#currencyLangSelect');
        const currSelect = modalOverlay.querySelector('#currencyCurrSelect');
        const titleEl = modalOverlay.querySelector('#currencyLangTitle');
        const labelLangEl = modalOverlay.querySelector('#currencyLangLabel');
        const labelCurrEl = modalOverlay.querySelector('#currencyCurrLabel');

        function updateModalTexts(lang) {
            const isEn = lang === 'EN';
            if (titleEl) titleEl.textContent = isEn ? 'Language and currency' : 'Langue et monnaie';
            if (labelLangEl) labelLangEl.textContent = isEn ? 'Language' : 'Langue';
            if (labelCurrEl) labelCurrEl.textContent = isEn ? 'Display currency' : 'Afficher la monnaie';
            if (confirmBtn) confirmBtn.textContent = isEn ? 'Confirm' : 'Confirmer';
        }

        langSelect.addEventListener('change', () => {
            updateModalTexts(langSelect.value);
        });

        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeCurrencyModal();
        });

        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeCurrencyModal();
            }
        });

        confirmBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const chosenLang = langSelect.value;
            const chosenCurr = currSelect.value;
            setLanguage(chosenLang);
            setCurrency(chosenCurr);
            closeCurrencyModal();
        });

        return modalOverlay;
    }

    function openCurrencyModal() {
        const modal = ensureCurrencyModal();
        const langSelect = modal.querySelector('#currencyLangSelect');
        const currSelect = modal.querySelector('#currencyCurrSelect');
        const titleEl = modal.querySelector('#currencyLangTitle');
        const labelLangEl = modal.querySelector('#currencyLangLabel');
        const labelCurrEl = modal.querySelector('#currencyCurrLabel');
        const confirmBtn = modal.querySelector('#currencyLangConfirm');

        if (langSelect) langSelect.value = currentLang;
        if (currSelect) currSelect.value = currentCurrency;

        const isEn = currentLang === 'EN';
        if (titleEl) titleEl.textContent = isEn ? 'Language and currency' : 'Langue et monnaie';
        if (labelLangEl) labelLangEl.textContent = isEn ? 'Language' : 'Langue';
        if (labelCurrEl) labelCurrEl.textContent = isEn ? 'Display currency' : 'Afficher la monnaie';
        if (confirmBtn) confirmBtn.textContent = isEn ? 'Confirm' : 'Confirmer';

        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function closeCurrencyModal() {
        if (!modalOverlay) return;
        modalOverlay.classList.remove('active');
        modalOverlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    function initCurrencyTriggers() {
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
            if (e.key === 'Escape' && modalOverlay && modalOverlay.classList.contains('active')) {
                closeCurrencyModal();
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        updateTopBarTrigger();
        initCurrencyTriggers();
        updatePagePrices();
    });

    window.AstaCurrency = {
        get currency() { return currentCurrency; },
        get lang() { return currentLang; },
        setCurrency,
        setLanguage,
        formatAmount,
        updatePagePrices
    };
    window.LootZoneCurrency = window.AstaCurrency;
})();
