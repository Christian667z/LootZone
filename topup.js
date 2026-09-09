/**
 * LootZone - Product Top-up & Recharge Controller (topup.js)
 * Standalone root entrypoint - delegates to js/topup.js if loaded or executes
 */
(function() {
    if (typeof window.LootZoneTopup === 'undefined') {
        const script = document.createElement('script');
        script.src = 'js/topup.js';
        script.async = false;
        document.head.appendChild(script);
    }
})();
