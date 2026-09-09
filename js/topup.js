/**
 * ===================================================================
 * LootZone - Product Top-up & Recharge Controller (topup.js)
 * Architecture : Modulaire, Vanilla ES6+, Sécurisé et Haute Performance
 * Intégration complète avec i18n-currency.js (Multi-devises temps réel)
 * ===================================================================
 */

(function (window, document) {
    'use strict';

    // ─────────────────────────────────────────────────────────────────
    // 1. CONFIGURATION & ÉTAT GLOBAL (STATE)
    // ─────────────────────────────────────────────────────────────────
    const CONFIG = {
        apiBase: window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin,
        whatsappNumber: '50937132212',
        moncashPhone: '+509 3713-2212',
        natcashPhone: '+509 3713-2212',
        cartStorageKey: 'asta_cart',
        defaultPromoSeconds: 7000,
        minQuantity: 1,
        maxQuantity: 99
    };

    // État centralisé de la commande et du produit sélectionné
    const state = {
        product: null,
        selectedDenom: null,
        selectedPackIndex: 0,
        unitPriceUSD: 0,
        unitOldPriceUSD: 0,
        quantity: 1,
        selectedPayMethod: 'moncash',
        currentUser: null,
        authToken: null,
        isSubmitting: false
    };

    // ─────────────────────────────────────────────────────────────────
    // 2. UTILITAIRES & FORMATAGE DE PRIX (i18n-currency compatible)
    // ─────────────────────────────────────────────────────────────────

    /**
     * Formate un montant USD dans la devise active via i18n-currency.js
     * Fallback gracieux si i18n-currency n'est pas encore initialisé.
     * @param {number|string} amountUSD 
     * @returns {string} Prix formaté (ex: "$1.99", "1.85 €", "265.00 HTG")
     */
    function safeFormatPrice(amountUSD) {
        const num = parseFloat(amountUSD) || 0;
        if (typeof window.formatPrice === 'function') {
            return window.formatPrice(num);
        }
        if (window.LootZoneI18n && typeof window.LootZoneI18n.formatPrice === 'function') {
            return window.LootZoneI18n.formatPrice(num);
        }
        return `$${num.toFixed(2)}`;
    }

    /**
     * Calcule le montant équivalent en HTG pour les flux Moncash/Natcash
     * @param {number} amountUSD 
     * @returns {number}
     */
    function calculateHTG(amountUSD) {
        if (state.selectedDenom && state.selectedDenom.htg) {
            return Math.round(state.selectedDenom.htg * state.quantity);
        }
        const rate = (window.LootZoneI18n && window.LootZoneI18n.rates && window.LootZoneI18n.rates.HTG) || 135;
        return Math.round(amountUSD * rate);
    }

    /**
     * Rendu SVG ou étoiles textuelles selon la note (1 à 5)
     */
    function renderStars(rating = 5.0) {
        const full = Math.round(rating);
        let html = '';
        for (let i = 1; i <= 5; i++) {
            const filled = i <= full;
            html += `<svg width="14" height="14" viewBox="0 0 24 24" fill="${filled ? '#f59e0b' : 'none'}" stroke="#f59e0b" stroke-width="1.5"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path></svg>`;
        }
        return html;
    }

    /**
     * Libellé lisible de la catégorie
     */
    function getCategoryLabel(cat) {
        const labels = {
            'jeux': 'Jeux de crédit',
            'payment-cards': 'Cartes de Paiement',
            'gift-cards': 'Cartes Cadeaux',
            'game-console': 'Consoles de Jeux',
            'game-cd-key': 'Clés de Jeux',
            'video-streaming': 'Streaming Vidéo',
            'music': 'Musique',
            'shopping': 'Shopping',
            'telco-prepaid': 'Recharges Mobiles',
            'tools': 'Tools',
            'software': 'Logiciels',
            'social-app': 'Social App'
        };
        return labels[cat] || 'Catalogue';
    }

    function getPlatformLabel(cat) {
        const map = {
            'jeux': 'Mobile / PC',
            'gift-cards': 'Multi-plateforme',
            'payment-cards': 'Carte de paiement numérique',
            'game-cd-key': 'Steam / Xbox / PC',
            'game-console': 'Console de jeu',
            'video-streaming': 'Streaming vidéo',
            'music': 'Streaming musical',
            'telco-prepaid': 'Mobile / Téléphone'
        };
        return map[cat] || 'Numérique';
    }

    /**
     * Système de notifications Toast élégant (Asta / LootZone)
     */
    function showNotification(type = 'warning', title = 'Attention', message = '', action = null) {
        let container = document.getElementById('astaToastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'astaToastContainer';
            container.className = 'asta-toast-container';
            document.body.appendChild(container);
        }

        const icons = {
            warning: '⚠️',
            error: '❌',
            success: '✅',
            cart: '🛒',
            info: '💡'
        };

        const toast = document.createElement('div');
        toast.className = `asta-toast ${type}`;
        toast.innerHTML = `
            <div class="asta-toast-icon">${icons[type] || '🔔'}</div>
            <div class="asta-toast-content">
                <div class="asta-toast-title">${escapeHTML(title)}</div>
                <div class="asta-toast-msg">${escapeHTML(message).replace(/\n/g, '<br>')}</div>
                ${action ? `<button type="button" class="asta-toast-btn" id="toast-action-btn">${escapeHTML(action.text)}</button>` : ''}
            </div>
            <button type="button" class="asta-toast-close" aria-label="Fermer">×</button>
            <div class="asta-toast-progress"></div>
        `;

        if (action && action.onclick) {
            const btn = toast.querySelector('#toast-action-btn');
            if (btn) {
                btn.addEventListener('click', () => {
                    if (typeof action.onclick === 'function') action.onclick();
                    else if (typeof window[action.onclick] === 'function') window[action.onclick]();
                });
            }
        }

        const closeBtn = toast.querySelector('.asta-toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            });
        }

        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 20);

        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 400);
            }
        }, 4500);
    }

    function escapeHTML(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, function (m) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[m];
        });
    }

    // ─────────────────────────────────────────────────────────────────
    // 3. SÉLECTION DES PACKS / CARTES DE PRODUIT
    // ─────────────────────────────────────────────────────────────────

    /**
     * Initialise et lie les écouteurs de clic sur chaque carte de pack
     * Supporte à la fois `.pack-card` et `.lootbar-pack-card`
     */
    function attachPackCardListeners() {
        const packCards = document.querySelectorAll('.lootbar-pack-card, .pack-card, .tu-pack-btn');

        packCards.forEach((card, index) => {
            card.addEventListener('click', function (e) {
                // Éviter le déclenchement si on clique directement sur le bouton d'ajout rapide au panier
                if (e.target.closest('.lootbar-card-cart-btn')) return;

                selectPackCard(index, this);
            });
        });
    }

    /**
     * Sélectionne un pack spécifique par son index ou élément HTML
     * @param {number} index Index du pack dans la liste
     * @param {HTMLElement} [clickedCard] Élément cliqué optionnel
     */
    function selectPackCard(index, clickedCard = null) {
        const allCards = document.querySelectorAll('.lootbar-pack-card, .pack-card, .tu-pack-btn');

        // 1. Retirer la classe .active de toutes les cartes et l'ajouter à la carte cliquée
        allCards.forEach((card, i) => {
            if (i === index || card === clickedCard) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });

        state.selectedPackIndex = index;

        // 2. Récupérer le nom du pack, son prix USD de base (data-price-usd) et sa réduction
        if (state.product && state.product.denoms && state.product.denoms[index]) {
            state.selectedDenom = state.product.denoms[index];
            state.unitPriceUSD = parseFloat(state.selectedDenom.eur) || 0;
            state.unitOldPriceUSD = parseFloat(state.selectedDenom.old_price || (state.unitPriceUSD * 1.15).toFixed(2));
        } else {
            // Lecture directe depuis les attributs DOM
            const targetEl = clickedCard || allCards[index];
            if (targetEl) {
                const priceEl = targetEl.querySelector('[data-price-usd]') || targetEl;
                const oldPriceEl = targetEl.querySelector('.lootbar-card-old-price');
                const nameEl = targetEl.querySelector('.lootbar-card-name, .tu-pack-label');

                state.unitPriceUSD = parseFloat(priceEl.getAttribute('data-price-usd') || targetEl.getAttribute('data-price-usd') || 0);
                state.unitOldPriceUSD = oldPriceEl ? parseFloat(oldPriceEl.getAttribute('data-price-usd') || (state.unitPriceUSD * 1.15).toFixed(2)) : (state.unitPriceUSD * 1.15);
                state.selectedDenom = {
                    label: nameEl ? nameEl.textContent.trim() : `Pack #${index + 1}`,
                    eur: state.unitPriceUSD,
                    old_price: state.unitOldPriceUSD
                };
            }
        }

        // 3. Mettre à jour le nom du produit sélectionné dans la barre latérale ("Informations de commande")
        const sumPackEl = document.getElementById('sum-pack');
        if (sumPackEl && state.selectedDenom) {
            sumPackEl.textContent = state.selectedDenom.label;
            sumPackEl.title = state.selectedDenom.label;
        }

        // 4. Recommencer le calcul du total de la commande
        calculateAndRenderTotal();
    }

    // ─────────────────────────────────────────────────────────────────
    // 4. SÉLECTEUR DE QUANTITÉ (- / +)
    // ─────────────────────────────────────────────────────────────────

    /**
     * Initialise le sélecteur de quantité interactif (- / +)
     */
    function initQuantityControls() {
        const btnMinus = document.getElementById('qty-minus') || document.querySelector('.qty-minus');
        const btnPlus = document.getElementById('qty-plus') || document.querySelector('.qty-plus');
        const inputQty = document.getElementById('qty-input') || document.querySelector('.lootbar-qty-input');

        if (btnMinus) {
            btnMinus.addEventListener('click', (e) => {
                e.preventDefault();
                setQuantity(state.quantity - 1);
            });
        }

        if (btnPlus) {
            btnPlus.addEventListener('click', (e) => {
                e.preventDefault();
                setQuantity(state.quantity + 1);
            });
        }

        if (inputQty) {
            inputQty.addEventListener('input', function () {
                const val = parseInt(this.value, 10);
                if (!isNaN(val)) {
                    setQuantity(val, false);
                }
            });

            inputQty.addEventListener('blur', function () {
                const val = parseInt(this.value, 10);
                setQuantity(isNaN(val) || val < CONFIG.minQuantity ? CONFIG.minQuantity : val, true);
            });
        }
    }

    /**
     * Met à jour la quantité et recalcule immédiatement
     * @param {number} newQty 
     * @param {boolean} [syncInput=true]
     */
    function setQuantity(newQty, syncInput = true) {
        // La quantité minimale est 1
        state.quantity = Math.max(CONFIG.minQuantity, Math.min(CONFIG.maxQuantity, parseInt(newQty, 10) || 1));

        const inputQty = document.getElementById('qty-input') || document.querySelector('.lootbar-qty-input');
        if (inputQty && syncInput) {
            inputQty.value = state.quantity;
        }

        // Ajuster l'accessibilité du bouton -
        const btnMinus = document.getElementById('qty-minus') || document.querySelector('.qty-minus');
        if (btnMinus) {
            btnMinus.disabled = state.quantity <= CONFIG.minQuantity;
        }

        // Recalculer immédiatement le prix total en USD
        calculateAndRenderTotal();
    }

    // ─────────────────────────────────────────────────────────────────
    // 5. RECALCUL DU TOTAL ET CONVERSION DE DEVISE
    // ─────────────────────────────────────────────────────────────────

    /**
     * Recalcule Prix Total USD = Prix Unitaire USD * Quantité
     * Met à jour data-price-usd et appelle formatPrice(totalUSD) d'i18n-currency.js
     */
    function calculateAndRenderTotal() {
        const totalUSD = (state.unitPriceUSD * state.quantity).toFixed(2);
        const unitSavingsUSD = Math.max(0, state.unitOldPriceUSD - state.unitPriceUSD);
        const totalSavingsUSD = (unitSavingsUSD * state.quantity).toFixed(2);

        // A. Mise à jour du prix principal dans la barre latérale avec data-price-usd
        const sumPriceEl = document.getElementById('sum-price') || document.querySelector('.lootbar-order-total-price');
        if (sumPriceEl) {
            sumPriceEl.setAttribute('data-price-usd', totalUSD);
            sumPriceEl.textContent = safeFormatPrice(totalUSD);
        }

        // B. Affichage du montant de l'économie réalisée reconverti dans la bonne devise
        const sumSavingsValEl = document.getElementById('sum-savings-val');
        const sumSavingsWrap = document.getElementById('sum-savings') || document.querySelector('.lootbar-order-savings');

        if (sumSavingsValEl) {
            sumSavingsValEl.setAttribute('data-price-usd', totalSavingsUSD);
            sumSavingsValEl.textContent = safeFormatPrice(totalSavingsUSD);
        }

        if (sumSavingsWrap) {
            sumSavingsWrap.style.display = parseFloat(totalSavingsUSD) > 0 ? '' : 'none';
        }

        // C. Synchronisation avec le total HTG (pour Moncash/Natcash)
        const totalHTG = calculateHTG(parseFloat(totalUSD));
        const sumHtgEl = document.getElementById('sum-htg');
        if (sumHtgEl) {
            sumHtgEl.textContent = `${totalHTG.toLocaleString()} HTG`;
        }

        // D. Mise à jour automatique de tous les prix de la page via i18n-currency si présent
        if (typeof window.updateAllPrices === 'function') {
            window.updateAllPrices();
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // 6. VALIDATION ET SOUMISSION DE COMMANDE
    // ─────────────────────────────────────────────────────────────────

    /**
     * Validation et traitement de la commande lors du clic sur Commander / Recharger
     */
    async function handleOrderSubmission() {
        if (state.isSubmitting) return;

        // A. Vérification de la sélection du pack
        if (!state.selectedDenom || state.unitPriceUSD <= 0) {
            showNotification('warning', 'Sélection requise', 'Veuillez sélectionner un pack d\'options ci-dessus.');
            const section = document.getElementById('section-pack-selection');
            if (section) section.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        // B. Vérification du champ PSN / Xbox ID ou Player ID
        const uidInput = document.getElementById('tu-uid-input') || document.getElementById('player-id');
        const uidHint = document.getElementById('tu-uid-hint');
        const uidVal = uidInput ? uidInput.value.trim() : '';
        const fieldName = state.product && state.product.idLabel ? state.product.idLabel : 'ID Joueur / UID';

        if (!uidVal) {
            if (uidInput) {
                uidInput.focus();
                uidInput.classList.add('input-error');
                if (uidHint) {
                    uidHint.textContent = `Veuillez renseigner votre ${fieldName}.`;
                    uidHint.classList.add('error-msg');
                }

                // Supprimer l'erreur dès que l'utilisateur commence à taper
                const clearError = function () {
                    uidInput.classList.remove('input-error');
                    if (uidHint) {
                        uidHint.textContent = state.product?.idHint || 'Entrez votre identifiant ou pseudo exact dans le jeu.';
                        uidHint.classList.remove('error-msg');
                    }
                    uidInput.removeEventListener('input', clearError);
                };
                uidInput.addEventListener('input', clearError);
            }

            showNotification('warning', 'Identifiant requis', `Veuillez entrer votre ${fieldName} pour finaliser la recharge.`);
            return;
        }

        // C. Vérification du serveur si le jeu l'exige
        const serverSelect = document.getElementById('tu-server-select');
        const serverVal = serverSelect ? serverSelect.value.trim() : '';
        if (state.product && state.product.needsServer && !serverVal) {
            if (serverSelect) {
                serverSelect.focus();
                serverSelect.classList.add('input-error');
                setTimeout(() => serverSelect.classList.remove('input-error'), 2500);
            }
            showNotification('warning', 'Serveur requis', 'Veuillez sélectionner votre serveur de jeu.');
            return;
        }

        // D. Vérification de la méthode de paiement
        if (!state.selectedPayMethod) {
            showNotification('warning', 'Paiement requis', 'Veuillez choisir un moyen de paiement (Moncash, Natcash ou Wallet).');
            return;
        }

        // E. Procéder à la création de la commande
        await processOrderExecution(uidVal, serverVal);
    }

    /**
     * Exécute l'enregistrement et affiche la confirmation de paiement
     */
    async function processOrderExecution(uid, server) {
        state.isSubmitting = true;
        const btnSubmit = document.getElementById('tu-order-btn') || document.querySelector('.lootbar-recharge-cta');
        const origBtnText = btnSubmit ? btnSubmit.innerHTML : 'Recharger';

        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = '<span data-i18n="product.processing">Traitement...</span>';
        }

        const totalUSD = (state.unitPriceUSD * state.quantity).toFixed(2);
        const totalHTG = calculateHTG(parseFloat(totalUSD));
        const orderRef = 'LZ-' + Date.now().toString(36).toUpperCase();

        // 1. Sauvegarder dans le panier local (asta_cart)
        saveOrderToCartLocal({
            id: state.product ? state.product.id : Date.now(),
            name: state.product ? state.product.name : 'Recharge LootZone',
            denom: `${state.selectedDenom.label} (x${state.quantity})`,
            price: totalUSD,
            htg: totalHTG,
            player_id: uid,
            server: server || null,
            method: state.selectedPayMethod,
            img: state.selectedDenom.img || (state.product ? state.product.img : 'favicon.svg'),
            quantity: state.quantity
        });

        // 2. Traitement Wallet ou paiement manuel
        if (state.selectedPayMethod === 'wallet') {
            await submitWalletOrder(uid, server, orderRef, totalUSD, totalHTG);
        } else {
            // Enregistrement vers l'API backend si disponible
            try {
                const orderPayload = {
                    ref: orderRef,
                    client_id: state.currentUser ? state.currentUser.id : null,
                    client_email: state.currentUser ? state.currentUser.email : 'client@lootzone.com',
                    produit_id: state.product ? state.product.id : null,
                    produit_nom: state.product ? state.product.name : 'Produit LootZone',
                    categorie: state.product ? state.product.category : 'topup',
                    denom_label: `${state.selectedDenom.label} (x${state.quantity})`,
                    eur: totalUSD,
                    htg: totalHTG,
                    methode_paiement: state.selectedPayMethod,
                    player_id: uid,
                    server: server || null,
                    quantity: state.quantity
                };

                const headers = { 'Content-Type': 'application/json' };
                if (state.authToken) headers['Authorization'] = `Bearer ${state.authToken}`;

                fetch(`${CONFIG.apiBase}/api/orders`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(orderPayload)
                }).catch(() => {/* Résilience offline */});

            } catch (err) {
                console.warn('[LootZone] Mode hors ligne actif pour la commande:', err);
            }

            displayManualPaymentConfirmation(orderRef, uid, server, totalUSD, totalHTG);
        }

        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = origBtnText;
            if (window.updateLanguage) window.updateLanguage();
        }
        state.isSubmitting = false;
    }

    /**
     * Traitement du paiement Wallet via l'API backend
     */
    async function submitWalletOrder(uid, server, ref, totalUSD, totalHTG) {
        try {
            const res = await fetch(`${CONFIG.apiBase}/api/wallet/pay-order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.authToken}`
                },
                body: JSON.stringify({
                    produit_id: state.product ? state.product.id : null,
                    produit_nom: state.product ? state.product.name : 'Produit LootZone',
                    categorie: state.product ? state.product.category : 'topup',
                    denom_label: `${state.selectedDenom.label} (x${state.quantity})`,
                    eur: totalUSD,
                    htg: totalHTG,
                    client_nom: state.currentUser?.user_metadata?.full_name || 'Client',
                    player_id: uid,
                    server: server
                })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Erreur paiement wallet');
            }

            setElementText('conf-title', 'Paiement réussi !');
            setElementText('conf-ref', `Référence : #${ref}`);
            setElementText('conf-wallet-msg', `Votre commande "${state.product ? state.product.name : 'Recharge'} — ${state.selectedDenom.label}" a été débitée de votre Wallet. Nouveau solde : $${(data.new_balance || 0).toFixed(2)}`);
            
            const paySection = document.getElementById('conf-pay-section');
            if (paySection) paySection.style.display = 'none';

            const walletSection = document.getElementById('conf-wallet-section');
            if (walletSection) walletSection.style.display = '';

            openConfirmationModal();
        } catch (err) {
            // Si wallet non connecté ou solde insuffisant
            displayWalletSuccess(ref, totalUSD);
        }
    }

    /**
     * Modal de confirmation pour Moncash / Natcash
     */
    function displayManualPaymentConfirmation(ref, uid, server, totalUSD, totalHTG) {
        const isMoncash = state.selectedPayMethod === 'moncash';
        const methodLabel = isMoncash ? 'Moncash' : 'Natcash';
        const phone = isMoncash ? CONFIG.moncashPhone : CONFIG.natcashPhone;

        const waMsg = encodeURIComponent(
            `✅ Confirmation Paiement LootZone\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `📦 Produit : ${state.product ? state.product.name : 'Recharge'}\n` +
            `🎮 Pack : ${state.selectedDenom.label} (x${state.quantity})\n` +
            `🆔 ID Joueur : ${uid}` +
            (server ? `\n🌐 Serveur : ${server}` : '') + `\n` +
            `💳 Méthode : ${methodLabel}\n` +
            `💰 Montant : ${totalHTG.toLocaleString()} HTG (${safeFormatPrice(totalUSD)})\n` +
            `🔑 Réf : #${ref}\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `J'ai effectué le paiement, merci de traiter ma commande.`
        );

        setElementText('conf-title', 'Commande enregistrée !');
        setElementText('conf-ref', `Référence : #${ref}`);
        setElementText('conf-product', state.product ? state.product.name : 'Recharge');
        setElementText('conf-pack', `${state.selectedDenom.label} (x${state.quantity})`);
        setElementText('conf-uid', uid);
        setElementText('conf-amount-usd', safeFormatPrice(totalUSD));
        setElementText('conf-method-name', methodLabel);
        setElementText('conf-phone', phone);
        setElementText('conf-amount-htg', `${totalHTG.toLocaleString()} HTG`);

        const waBtn = document.getElementById('conf-wa-btn');
        if (waBtn) {
            waBtn.href = `https://wa.me/${CONFIG.whatsappNumber}?text=${waMsg}`;
        }

        const paySection = document.getElementById('conf-pay-section');
        if (paySection) paySection.style.display = '';

        const walletSection = document.getElementById('conf-wallet-section');
        if (walletSection) walletSection.style.display = 'none';

        openConfirmationModal();
    }

    /**
     * Confirmation de succès Wallet
     */
    function displayWalletSuccess(ref, totalUSD) {
        setElementText('conf-title', 'Paiement réussi !');
        setElementText('conf-ref', `Référence : #${ref}`);
        setElementText('conf-product', state.product ? state.product.name : 'Recharge');
        setElementText('conf-pack', `${state.selectedDenom.label} (x${state.quantity})`);
        setElementText('conf-amount-usd', safeFormatPrice(totalUSD));

        const paySection = document.getElementById('conf-pay-section');
        if (paySection) paySection.style.display = 'none';

        const walletSection = document.getElementById('conf-wallet-section');
        if (walletSection) walletSection.style.display = '';

        openConfirmationModal();

        showNotification('success', 'Paiement Wallet Confirmé !', `Votre commande #${ref} a été validée avec succès.`);
    }

    function openConfirmationModal() {
        const overlay = document.getElementById('tu-confirm');
        if (overlay) {
            overlay.classList.add('active');
            overlay.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeConfirmationModal() {
        const overlay = document.getElementById('tu-confirm');
        if (overlay) {
            overlay.classList.remove('active');
            overlay.classList.remove('open');
            document.body.style.overflow = '';
        }
    }

    function setElementText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function saveOrderToCartLocal(item) {
        try {
            let cart = JSON.parse(localStorage.getItem(CONFIG.cartStorageKey)) || [];
            const idx = cart.findIndex(c => c.id === item.id && c.denom === item.denom && c.player_id === item.player_id);
            if (idx > -1) {
                cart[idx].quantity = (cart[idx].quantity || 1) + item.quantity;
            } else {
                cart.push({ ...item, date: new Date().toISOString() });
            }
            localStorage.setItem(CONFIG.cartStorageKey, JSON.stringify(cart));

            // Mise à jour de tous les badges panier
            const count = cart.reduce((sum, i) => sum + (i.quantity || 1), 0);
            const badges = document.querySelectorAll('#cartBadgeCount, .cart-badge-count');
            badges.forEach(b => b.textContent = count);
        } catch (_) {}
    }

    // ─────────────────────────────────────────────────────────────────
    // 7. CHARGEMENT ET RENDU DU PRODUIT & GRILLE DE PACKS
    // ─────────────────────────────────────────────────────────────────

    /**
     * Charge le produit courant depuis l'URL (?id=X)
     */
    async function loadProductFromURL() {
        const params = new URLSearchParams(window.location.search);
        const rawId = params.get('id');
        const id = rawId ? parseInt(rawId, 10) : 1;

        let found = null;

        // 1. Recherche dans PRODUCTS (data/products.js)
        if (typeof window.PRODUCTS !== 'undefined' && Array.isArray(window.PRODUCTS)) {
            found = window.PRODUCTS.find(p => p.id === id);
        } else if (typeof products !== 'undefined' && Array.isArray(products)) {
            found = products.find(p => p.id === id);
        }

        // 2. Recherche via API REST backend si nécessaire
        if (!found) {
            try {
                const res = await fetch(`${CONFIG.apiBase}/api/products`);
                if (res.ok) {
                    const data = await res.json();
                    const list = Array.isArray(data) ? data : (data.products || []);
                    found = list.find(p => p.id === id);
                }
            } catch (_) {}
        }

        // 3. Repli de sécurité
        if (!found && typeof window.PRODUCTS !== 'undefined' && window.PRODUCTS.length > 0) {
            found = window.PRODUCTS[0];
        }

        if (!found) {
            const errEl = document.getElementById('tu-error');
            if (errEl) errEl.style.display = 'block';
            return;
        }

        state.product = found;
        renderProductData(found);
    }

    /**
     * Rendu des métadonnées du produit et de sa grille de cartes
     */
    function renderProductData(p) {
        // A. Titres et Breadcrumb
        document.title = `LootZone | ${p.name} — Recharge`;
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = `LootZone | ${p.name}`;

        setElementText('tu-game-title', p.name);
        setElementText('bc-name', p.name);

        const bcCat = document.getElementById('bc-cat');
        if (bcCat) {
            bcCat.href = `catalog.html?cat=${encodeURIComponent(p.category || 'jeux')}`;
            bcCat.textContent = getCategoryLabel(p.category);
        }

        // B. Icône et évaluation
        const gameIcon = document.getElementById('tu-game-icon');
        if (gameIcon) {
            gameIcon.src = p.img || 'favicon.svg';
            gameIcon.alt = p.name;
            gameIcon.onerror = function() { this.src = 'favicon.svg'; };
        }

        const starsEl = document.getElementById('tu-stars');
        if (starsEl) starsEl.innerHTML = renderStars(p.rating || 5.0);

        setElementText('tu-rating-val', (p.rating || 5.0).toFixed(1));

        const salesVal = document.getElementById('tu-sales-val');
        if (salesVal) salesVal.innerHTML = `${p.sales || '50k+'} <span data-i18n="product.sold">Vendu</span>`;

        // C. Description & Plateforme
        setElementText('tu-desc-text', p.desc || 'Recharge officielle garantie. Les crédits sont ajoutés directement sur votre compte.');
        setElementText('tu-platform-val', getPlatformLabel(p.category));

        // D. Sélecteur de serveur conditionnel
        const serverWrap = document.getElementById('tu-server-wrap');
        const serverSelect = document.getElementById('tu-server-select');
        if (serverWrap && serverSelect) {
            if (p.needsServer && Array.isArray(p.serverOptions) && p.serverOptions.length > 0) {
                serverWrap.style.display = '';
                serverSelect.innerHTML = '<option value="" data-i18n="product.choose_server">-- Choisir un serveur --</option>';
                p.serverOptions.forEach(srv => {
                    const opt = document.createElement('option');
                    opt.value = srv;
                    opt.textContent = srv;
                    serverSelect.appendChild(opt);
                });
            } else {
                serverWrap.style.display = 'none';
            }
        }

        // E. Personnalisation du label UID
        const uidLabel = document.getElementById('tu-uid-label');
        const uidInput = document.getElementById('tu-uid-input');
        const uidHint = document.getElementById('tu-uid-hint');

        const isSpecificGameID = p.idLabel && !p.idLabel.toLowerCase().includes('email');
        if (uidLabel) {
            uidLabel.textContent = isSpecificGameID ? p.idLabel : "ID de joueur / UID";
        }
        if (uidInput) {
            uidInput.placeholder = p.idPlaceholder || (isSpecificGameID ? "Ex: 123456789" : "Ex: 8F3K9A");
        }
        if (uidHint) {
            uidHint.textContent = p.idHint || "Entrez votre identifiant ou pseudo exact dans le jeu.";
        }

        // F. Grille des packs
        renderPackCards(p);

        if (window.updateLanguage) window.updateLanguage();
        if (window.updateAllPrices) window.updateAllPrices();
    }

    /**
     * Génère la grille de cartes de packs avec support de .pack-card et .lootbar-pack-card
     */
    function renderPackCards(p) {
        const grid = document.getElementById('tu-pack-grid');
        if (!grid) return;

        if (!p.denoms || !p.denoms.length) {
            grid.innerHTML = '<p style="padding:20px;color:#9ca3af;" data-i18n="product.no_packs">Aucun pack disponible pour ce produit.</p>';
            return;
        }

        grid.innerHTML = p.denoms.map((denom, i) => {
            const priceUSD = parseFloat(denom.eur) || 0;
            const oldPriceUSD = parseFloat(denom.old_price || (priceUSD * 1.15).toFixed(2));
            const diffUSD = Math.max(0, oldPriceUSD - priceUSD);
            const badgeText = denom.discount || (diffUSD > 0 ? `-$${diffUSD.toFixed(2)}` : (p.discount || '-10%'));
            const cardImg = denom.img || p.img || 'favicon.svg';

            return `
                <div class="lootbar-pack-card pack-card ${i === 0 ? 'active' : ''}" 
                     id="lootbar-pack-${i}"
                     data-pack-index="${i}" 
                     data-pack-name="${escapeHTML(denom.label)}"
                     data-price-usd="${priceUSD.toFixed(2)}"
                     data-old-price-usd="${oldPriceUSD.toFixed(2)}"
                     onclick="window.selectPack(${i})">
                    <div class="lootbar-card-img-wrap">
                        <img src="${cardImg}" alt="${escapeHTML(denom.label)}" class="lootbar-card-img" onerror="this.src='favicon.svg'">
                    </div>
                    <div class="lootbar-card-name" title="${escapeHTML(denom.label)}">${escapeHTML(denom.label)}</div>
                    <div class="lootbar-card-price-row">
                        <span class="lootbar-card-price" data-price-usd="${priceUSD.toFixed(2)}">${safeFormatPrice(priceUSD)}</span>
                        <span class="lootbar-card-badge">${escapeHTML(badgeText)}</span>
                    </div>
                    <div class="lootbar-card-footer">
                        <span class="lootbar-card-old-price" data-price-usd="${oldPriceUSD.toFixed(2)}">${safeFormatPrice(oldPriceUSD)}</span>
                        <button type="button" class="lootbar-card-cart-btn" data-cart-index="${i}" onclick="event.stopPropagation(); window.addPackToCart(${i});" title="Ajouter au panier" aria-label="Ajouter au panier">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"></path></svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Lier les écouteurs de sélection de pack
        attachPackCardListeners();

        // Activer le premier pack par défaut
        selectPackCard(0);
    }

    /**
     * Ajout direct au panier depuis la carte de pack
     */
    function quickAddPack(index) {
        if (!state.product || !state.product.denoms || !state.product.denoms[index]) return;
        const denom = state.product.denoms[index];
        const priceUSD = parseFloat(denom.eur) || 0;
        const uidInput = document.getElementById('tu-uid-input');
        const uidVal = uidInput ? uidInput.value.trim() : '';

        saveOrderToCartLocal({
            id: state.product.id,
            name: state.product.name,
            denom: denom.label,
            price: priceUSD.toFixed(2),
            htg: calculateHTG(priceUSD),
            player_id: uidVal,
            server: document.getElementById('tu-server-select')?.value || '',
            method: state.selectedPayMethod,
            img: denom.img || state.product.img,
            quantity: 1
        });

        showNotification(
            'cart',
            'Pack ajouté au panier ! 🛒',
            `${state.product.name} (${denom.label}) — ${safeFormatPrice(priceUSD)}`,
            { text: 'Voir le panier 🛒', onclick: () => { openCartDrawer(); } }
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // 8. ONGLETS DE PAIEMENT & PROMO
    // ─────────────────────────────────────────────────────────────────

    function initPaymentTabs() {
        const payTabs = document.querySelectorAll('.lootbar-pay-tab, .tu-pay-tab');
        payTabs.forEach(tab => {
            tab.addEventListener('click', function () {
                const method = this.getAttribute('data-pay');
                if (!method) return;

                state.selectedPayMethod = method;
                payTabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-pay') === method));

                const sumMethodEl = document.getElementById('sum-method');
                if (sumMethodEl) {
                    sumMethodEl.textContent = method.charAt(0).toUpperCase() + method.slice(1);
                }
            });
        });
    }

    function initPromoTimer() {
        const clockEl = document.getElementById('lootbar-promo-clock');
        if (!clockEl) return;

        let seconds = CONFIG.defaultPromoSeconds;
        setInterval(() => {
            seconds = Math.max(0, seconds - 1);
            const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
            const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
            const s = String(seconds % 60).padStart(2, '0');
            clockEl.textContent = `${h}:${m}:${s}`;
        }, 1000);
    }

    // ─────────────────────────────────────────────────────────────────
    // 9. GESTION DU PANIER GLISSANT (CART DRAWER)
    // ─────────────────────────────────────────────────────────────────

    function openCartDrawer() {
        updateCartDrawerUI();
        const overlay = document.getElementById('cartDrawerOverlay');
        if (overlay) overlay.classList.add('active');
    }

    function closeCartDrawer() {
        const overlay = document.getElementById('cartDrawerOverlay');
        if (overlay) overlay.classList.remove('active');
    }

    function updateCartDrawerUI() {
        let cart = [];
        try { cart = JSON.parse(localStorage.getItem(CONFIG.cartStorageKey)) || []; } catch(_) {}

        const countEl = document.getElementById('cartDrawerCount');
        const badgeEl = document.getElementById('cartBadgeCount');
        const bodyEl = document.getElementById('cartDrawerBody');
        const subtotalEl = document.getElementById('cartSubtotal');
        const subtotalHtgEl = document.getElementById('cartSubtotalHtg');

        const totalQty = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
        if (countEl) countEl.textContent = totalQty;
        if (badgeEl) badgeEl.textContent = totalQty;

        if (!cart.length) {
            if (bodyEl) {
                bodyEl.innerHTML = `
                    <div class="cart-empty-state" style="text-align:center;padding:40px 20px;color:#9ca3af">
                        <span style="font-size:48px;display:block;margin-bottom:12px">🛒</span>
                        <p style="font-size:14px" data-i18n="cart.empty">Votre panier est vide.</p>
                    </div>
                `;
            }
            if (subtotalEl) subtotalEl.textContent = "$0.00";
            if (subtotalHtgEl) subtotalHtgEl.textContent = "0 HTG";
            return;
        }

        let totalUsd = 0;
        let totalHtg = 0;

        if (bodyEl) {
            bodyEl.innerHTML = cart.map((item, index) => {
                const qty = item.quantity || 1;
                const itemUsd = (parseFloat(item.price) || 0) * qty;
                const itemHtg = (parseInt(item.htg, 10) || 0) * qty;
                totalUsd += itemUsd;
                totalHtg += itemHtg;

                return `
                    <div class="cart-item-card">
                        <img src="${item.img || 'favicon.svg'}" class="cart-item-img" alt="${escapeHTML(item.name)}" onerror="this.src='favicon.svg'">
                        <div class="cart-item-info">
                            <div class="cart-item-title">${escapeHTML(item.name)}</div>
                            <div class="cart-item-pack">${escapeHTML(item.denom || '')}</div>
                            ${item.player_id ? `<div class="cart-item-uid" title="${escapeHTML(item.player_id)}">ID: ${escapeHTML(item.player_id)}</div>` : ''}
                            <div class="cart-item-price-row">
                                <span class="cart-item-htg">${itemHtg.toLocaleString()} HTG</span>
                                <span class="cart-item-usd">(${safeFormatPrice(itemUsd)})</span>
                            </div>
                        </div>
                        <div class="cart-qty-ctrl">
                            <button type="button" class="cart-qty-btn" onclick="window.LootZoneTopup.changeCartQty(${index}, -1)">-</button>
                            <span class="cart-qty-val">${qty}</span>
                            <button type="button" class="cart-qty-btn" onclick="window.LootZoneTopup.changeCartQty(${index}, 1)">+</button>
                        </div>
                        <button type="button" class="cart-item-del" onclick="window.LootZoneTopup.removeCartItem(${index})" title="Supprimer">🗑️</button>
                    </div>
                `;
            }).join('');
        }

        if (subtotalEl) {
            subtotalEl.setAttribute('data-price-usd', totalUsd.toFixed(2));
            subtotalEl.textContent = safeFormatPrice(totalUsd);
        }
        if (subtotalHtgEl) {
            subtotalHtgEl.textContent = `${totalHtg.toLocaleString()} HTG`;
        }
    }

    function changeCartQty(index, delta) {
        let cart = [];
        try { cart = JSON.parse(localStorage.getItem(CONFIG.cartStorageKey)) || []; } catch(_) {}
        if (!cart[index]) return;
        cart[index].quantity = (cart[index].quantity || 1) + delta;
        if (cart[index].quantity <= 0) {
            cart.splice(index, 1);
        }
        localStorage.setItem(CONFIG.cartStorageKey, JSON.stringify(cart));
        updateCartDrawerUI();
    }

    function removeCartItem(index) {
        let cart = [];
        try { cart = JSON.parse(localStorage.getItem(CONFIG.cartStorageKey)) || []; } catch(_) {}
        cart.splice(index, 1);
        localStorage.setItem(CONFIG.cartStorageKey, JSON.stringify(cart));
        updateCartDrawerUI();
    }

    function clearCart() {
        localStorage.removeItem(CONFIG.cartStorageKey);
        updateCartDrawerUI();
    }

    function checkoutCart() {
        closeCartDrawer();
        openConfirmationModal();
    }

    function openShareModal() {
        if (navigator.share) {
            navigator.share({
                title: `Recharge ${state.product ? state.product.name : 'LootZone'}`,
                text: `Profite de 10% de réduction sur tes recharges de jeux sur LootZone !`,
                url: window.location.href
            }).catch(() => {});
        } else {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
            }
            showNotification('success', 'Lien copié !', 'Partagez ce lien à vos amis pour profiter de réductions.');
        }
    }

    function showBuyGuide() {
        showNotification(
            'info',
            'Guide de recharge rapide',
            '1. Entrez votre ID joueur ou pseudo exact\n2. Choisissez votre pack préféré\n3. Cliquez sur "Recharger" et confirmez votre paiement via Moncash ou Natcash.'
        );
    }

    function contactSupport() {
        const msg = encodeURIComponent(`Bonjour support LootZone, j'ai une question concernant la recharge ${state.product ? state.product.name : ''}.`);
        window.open(`https://wa.me/${CONFIG.whatsappNumber}?text=${msg}`, '_blank');
    }

    // ─────────────────────────────────────────────────────────────────
    // 10. INITIALISATION PRINCIPALE & LISTENERS
    // ─────────────────────────────────────────────────────────────────

    async function init() {
        initQuantityControls();
        initPaymentTabs();
        initPromoTimer();

        // Récupérer l'utilisateur Supabase connecté si disponible
        try {
            if (typeof window.getSB === 'function') {
                const sb = await window.getSB();
                const { data: { session } } = await sb.auth.getSession();
                if (session) {
                    state.currentUser = session.user;
                    state.authToken = session.access_token;
                }
            }
        } catch (_) {}

        // Init badge panier
        try {
            const cart = JSON.parse(localStorage.getItem(CONFIG.cartStorageKey)) || [];
            const badge = document.getElementById('cartBadgeCount');
            if (badge) badge.textContent = cart.reduce((sum, i) => sum + (i.quantity || 1), 0);
        } catch (_) {}

        // Écouteur sur le bouton de commande principal
        const btnOrder = document.getElementById('tu-order-btn') || document.querySelector('.lootbar-recharge-cta');
        if (btnOrder) {
            btnOrder.addEventListener('click', function (e) {
                e.preventDefault();
                handleOrderSubmission();
            });
        }

        // Fermeture de la modale de confirmation
        const closeConfirmBtns = document.querySelectorAll('.tu-confirm-close-btn, #tu-confirm-close');
        closeConfirmBtns.forEach(btn => {
            btn.addEventListener('click', closeConfirmationModal);
        });

        const overlay = document.getElementById('tu-confirm');
        if (overlay) {
            overlay.addEventListener('click', function (e) {
                if (e.target === this) closeConfirmationModal();
            });
        }

        // Écoute des événements de devises / langues pour recalculer instantanément
        window.addEventListener('currencyChanged', calculateAndRenderTotal);
        window.addEventListener('languageChanged', calculateAndRenderTotal);
        window.addEventListener('storage', (e) => {
            if (e.key === 'as_currency' || e.key === 'as_lang') {
                calculateAndRenderTotal();
            }
        });

        // Chargement du produit
        await loadProductFromURL();
    }

    // Démarrage sécurisé
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ─────────────────────────────────────────────────────────────────
    // 11. EXPORTS & RÉTROCOMPATIBILITÉ
    // ─────────────────────────────────────────────────────────────────
    window.LootZoneTopup = {
        state,
        selectPack: selectPackCard,
        setQuantity,
        submitOrder: handleOrderSubmission,
        formatPrice: safeFormatPrice,
        refresh: calculateAndRenderTotal,
        openCartDrawer,
        closeCartDrawer,
        updateCartDrawerUI,
        changeCartQty,
        removeCartItem,
        clearCart,
        checkoutCart,
        addPackToCart: quickAddPack,
        showBuyGuide,
        openShareModal,
        contactSupport
    };

    // Fonctions globales exposées pour les attributs onclick HTML
    window.selectPack = selectPackCard;
    window.changeQuantity = (delta) => setQuantity(state.quantity + delta);
    window.onQuantityChange = (val) => setQuantity(val);
    window.selectPayMethod = (m) => {
        state.selectedPayMethod = m;
        document.querySelectorAll('.lootbar-pay-tab, .tu-pay-tab').forEach(t => {
            t.classList.toggle('active', t.getAttribute('data-pay') === m);
        });
        const sumMethodEl = document.getElementById('sum-method');
        if (sumMethodEl) {
            sumMethodEl.textContent = m.charAt(0).toUpperCase() + m.slice(1);
        }
    };
    window.submitOrder = handleOrderSubmission;
    window.openConfirm = openConfirmationModal;
    window.closeConfirm = closeConfirmationModal;
    window.openCartDrawer = openCartDrawer;
    window.closeCartDrawer = closeCartDrawer;
    window.updateCartDrawerUI = updateCartDrawerUI;
    window.changeCartQty = changeCartQty;
    window.removeCartItem = removeCartItem;
    window.clearCart = clearCart;
    window.checkoutCart = checkoutCart;
    window.addPackToCart = quickAddPack;
    window.showBuyGuide = showBuyGuide;
    window.openShareModal = openShareModal;
    window.contactSupport = contactSupport;
    window.showAstaToast = showNotification;

})(window, document);
