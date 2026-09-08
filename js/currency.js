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

    let currentCurrency = localStorage.getItem('as_currency') || 'HTG';
    let currentLang = localStorage.getItem('as_lang') || 'FR';

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
    }

    function updateTopBarTrigger() {
        const trigger = document.querySelectorAll('.currency-lang-trigger');
        trigger.forEach(el => {
            el.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="top-icon">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                ${currentLang} | ${currentCurrency} ▾
            `;
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
        const topDropdowns = document.querySelectorAll('.top-bar-dropdown');
        topDropdowns.forEach(dd => {
            dd.style.position = 'relative';
            dd.style.cursor = 'pointer';

            // Ensure class on trigger
            const trigger = dd.querySelector('.dropdown-trigger');
            if (trigger) trigger.classList.add('currency-lang-trigger');

            // Create dropdown menu if not present
            if (!dd.querySelector('.currency-menu')) {
                const menu = document.createElement('div');
                menu.className = 'currency-menu';
                menu.style.cssText = `
                    display: none;
                    position: absolute;
                    top: 100%;
                    right: 0;
                    margin-top: 6px;
                    background: #111827;
                    border: 1px solid #374151;
                    border-radius: 8px;
                    padding: 8px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                    z-index: 9999;
                    min-width: 150px;
                `;
                menu.innerHTML = `
                    <div style="font-size:0.75rem;color:#9ca3af;font-weight:700;margin-bottom:6px;padding:0 6px;text-transform:uppercase;letter-spacing:0.5px;">Devise</div>
                    <div class="curr-opt ${currentCurrency === 'HTG' ? 'active' : ''}" data-curr="HTG" style="padding:6px 10px;border-radius:6px;color:#fff;font-size:0.85rem;display:flex;justify-content:space-between;align-items:center;cursor:pointer;transition:background 0.2s;">
                        <span>🇭🇹 HTG (Gourde)</span>
                    </div>
                    <div class="curr-opt ${currentCurrency === 'USD' ? 'active' : ''}" data-curr="USD" style="padding:6px 10px;border-radius:6px;color:#fff;font-size:0.85rem;display:flex;justify-content:space-between;align-items:center;cursor:pointer;transition:background 0.2s;">
                        <span>🇺🇸 USD ($)</span>
                    </div>
                    <div class="curr-opt ${currentCurrency === 'EUR' ? 'active' : ''}" data-curr="EUR" style="padding:6px 10px;border-radius:6px;color:#fff;font-size:0.85rem;display:flex;justify-content:space-between;align-items:center;cursor:pointer;transition:background 0.2s;">
                        <span>🇪🇺 EUR (€)</span>
                    </div>
                `;

                dd.appendChild(menu);

                dd.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isOpen = menu.style.display === 'block';
                    document.querySelectorAll('.currency-menu').forEach(m => m.style.display = 'none');
                    menu.style.display = isOpen ? 'none' : 'block';
                });

                menu.querySelectorAll('.curr-opt').forEach(opt => {
                    opt.addEventListener('mouseenter', () => opt.style.background = '#1f2937');
                    opt.addEventListener('mouseleave', () => opt.style.background = 'transparent');
                    opt.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const selectedCurr = opt.getAttribute('data-curr');
                        setCurrency(selectedCurr);
                        menu.querySelectorAll('.curr-opt').forEach(o => o.style.color = '#fff');
                        opt.style.color = '#00b67a';
                        menu.style.display = 'none';
                    });
                });
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
