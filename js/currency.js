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
    let currentLang = localStorage.getItem('as_lang') || 'EN';

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
        const triggers = document.querySelectorAll('.currency-lang-trigger');
        triggers.forEach(el => {
            const labelEl = el.querySelector('.header-currency-label, #headerCurrencyLabel');
            if (labelEl) {
                labelEl.textContent = `${currentLang} / ${currentCurrency}`;
            } else if (el.classList.contains('header-currency-btn')) {
                el.innerHTML = `<span class="header-currency-label">${currentLang} / ${currentCurrency}</span>`;
            } else {
                el.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="top-icon">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                    ${currentLang} / ${currentCurrency} ▾
                `;
            }
        });
        document.querySelectorAll('#headerCurrencyLabel, .header-currency-label').forEach(el => {
            el.textContent = `${currentLang} / ${currentCurrency}`;
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

    // Modal / Dropdown Toggle for Currency & Language Selection
    function initCurrencyDropdown() {
        const topDropdowns = document.querySelectorAll('.top-bar-dropdown, .header-currency-dropdown');
        topDropdowns.forEach(dd => {
            dd.style.position = 'relative';

            // Ensure class on trigger
            const trigger = dd.querySelector('.dropdown-trigger, .header-currency-btn');
            if (trigger) trigger.classList.add('currency-lang-trigger');

            // Create dropdown menu if not present
            if (!dd.querySelector('.currency-menu')) {
                const menu = document.createElement('div');
                menu.className = 'currency-menu';
                menu.style.cssText = `
                    display: none;
                    position: absolute;
                    top: calc(100% + 8px);
                    right: 0;
                    background: #11141d;
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    border-radius: 10px;
                    padding: 10px;
                    box-shadow: 0 14px 35px rgba(0, 0, 0, 0.7);
                    z-index: 9999;
                    min-width: 190px;
                `;

                function renderMenu() {
                    menu.innerHTML = `
                        <div style="font-size:0.7rem;color:#9ca3af;font-weight:700;margin-bottom:6px;padding:0 6px;text-transform:uppercase;letter-spacing:0.5px;">Langue</div>
                        <div class="lang-opt ${currentLang === 'EN' ? 'active' : ''}" data-lang="EN" style="padding:7px 10px;border-radius:6px;color:#fff;font-size:0.85rem;display:flex;justify-content:space-between;align-items:center;cursor:pointer;transition:all 0.2s;margin-bottom:2px;background:${currentLang === 'EN' ? 'rgba(255, 183, 0, 0.15)' : 'transparent'};color:${currentLang === 'EN' ? '#ffb700' : '#e2e8f0'};">
                            <span>🇺🇸 English (EN)</span>
                            ${currentLang === 'EN' ? '<span style="font-size:0.8rem;">✓</span>' : ''}
                        </div>
                        <div class="lang-opt ${currentLang === 'FR' ? 'active' : ''}" data-lang="FR" style="padding:7px 10px;border-radius:6px;color:#fff;font-size:0.85rem;display:flex;justify-content:space-between;align-items:center;cursor:pointer;transition:all 0.2s;margin-bottom:8px;background:${currentLang === 'FR' ? 'rgba(255, 183, 0, 0.15)' : 'transparent'};color:${currentLang === 'FR' ? '#ffb700' : '#e2e8f0'};">
                            <span>🇫🇷 Français (FR)</span>
                            ${currentLang === 'FR' ? '<span style="font-size:0.8rem;">✓</span>' : ''}
                        </div>

                        <div style="height:1px;background:rgba(255,255,255,0.08);margin:6px 0 8px;"></div>

                        <div style="font-size:0.7rem;color:#9ca3af;font-weight:700;margin-bottom:6px;padding:0 6px;text-transform:uppercase;letter-spacing:0.5px;">Devise</div>
                        <div class="curr-opt ${currentCurrency === 'USD' ? 'active' : ''}" data-curr="USD" style="padding:7px 10px;border-radius:6px;color:#fff;font-size:0.85rem;display:flex;justify-content:space-between;align-items:center;cursor:pointer;transition:all 0.2s;margin-bottom:2px;background:${currentCurrency === 'USD' ? 'rgba(255, 183, 0, 0.15)' : 'transparent'};color:${currentCurrency === 'USD' ? '#ffb700' : '#e2e8f0'};">
                            <span>🇺🇸 USD ($)</span>
                            ${currentCurrency === 'USD' ? '<span style="font-size:0.8rem;">✓</span>' : ''}
                        </div>
                        <div class="curr-opt ${currentCurrency === 'HTG' ? 'active' : ''}" data-curr="HTG" style="padding:7px 10px;border-radius:6px;color:#fff;font-size:0.85rem;display:flex;justify-content:space-between;align-items:center;cursor:pointer;transition:all 0.2s;margin-bottom:2px;background:${currentCurrency === 'HTG' ? 'rgba(255, 183, 0, 0.15)' : 'transparent'};color:${currentCurrency === 'HTG' ? '#ffb700' : '#e2e8f0'};">
                            <span>🇭🇹 HTG (Gourde)</span>
                            ${currentCurrency === 'HTG' ? '<span style="font-size:0.8rem;">✓</span>' : ''}
                        </div>
                        <div class="curr-opt ${currentCurrency === 'EUR' ? 'active' : ''}" data-curr="EUR" style="padding:7px 10px;border-radius:6px;color:#fff;font-size:0.85rem;display:flex;justify-content:space-between;align-items:center;cursor:pointer;transition:all 0.2s;background:${currentCurrency === 'EUR' ? 'rgba(255, 183, 0, 0.15)' : 'transparent'};color:${currentCurrency === 'EUR' ? '#ffb700' : '#e2e8f0'};">
                            <span>🇪🇺 EUR (€)</span>
                            ${currentCurrency === 'EUR' ? '<span style="font-size:0.8rem;">✓</span>' : ''}
                        </div>
                    `;

                    menu.querySelectorAll('.lang-opt').forEach(opt => {
                        opt.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const selectedLang = opt.getAttribute('data-lang');
                            setLanguage(selectedLang);
                            renderMenu();
                        });
                    });

                    menu.querySelectorAll('.curr-opt').forEach(opt => {
                        opt.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const selectedCurr = opt.getAttribute('data-curr');
                            setCurrency(selectedCurr);
                            renderMenu();
                            menu.style.display = 'none';
                        });
                    });
                }

                renderMenu();
                dd.appendChild(menu);

                const toggleHandler = (e) => {
                    e.stopPropagation();
                    const isOpen = menu.style.display === 'block';
                    document.querySelectorAll('.currency-menu').forEach(m => m.style.display = 'none');
                    menu.style.display = isOpen ? 'none' : 'block';
                };

                if (trigger) {
                    trigger.addEventListener('click', toggleHandler);
                } else {
                    dd.addEventListener('click', toggleHandler);
                }
            }
        });

        document.addEventListener('click', () => {
            document.querySelectorAll('.currency-menu').forEach(m => m.style.display = 'none');
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        updateTopBarTrigger();
        initCurrencyDropdown();
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
})();
