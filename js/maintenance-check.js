(function () {
    const API = (window.location.protocol === 'file:' || window.location.port !== '5000')
        ? 'http://localhost:5000'
        : window.location.origin;

    async function checkMaintenance() {
        // Skip maintenance check on admin dashboard & admin login
        const path = window.location.pathname.toLowerCase();
        if (path.includes('dashboard.html') || path.includes('admin-login.html')) return;

        try {
            const res = await fetch(`${API}/api/config/public`);
            if (!res.ok) return;
            const data = await res.json();

            const isStaff = !!localStorage.getItem('as_token');

            if (data.maintenance_mode) {
                if (isStaff) {
                    showAdminBanner();
                } else {
                    showMaintenanceOverlay();
                }
            } else {
                removeMaintenanceUI();
            }
        } catch (e) {
            console.warn('[Maintenance] Impossible de vérifier le statut :', e);
        }
    }

    function showAdminBanner() {
        if (document.getElementById('asta-admin-maintenance-banner')) return;
        const banner = document.createElement('div');
        banner.id = 'asta-admin-maintenance-banner';
        banner.innerHTML = `
            <div style="position:fixed;top:0;left:0;right:0;z-index:9999999;background:linear-gradient(90deg, #d97706, #dc2626);color:#fff;text-align:center;padding:8px 15px;font-size:13px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;gap:10px;">
                <span>🛠️ MODE MAINTENANCE ACTIF — Le site est masqué pour le grand public. (Accès Admin Autorisé)</span>
                <a href="/Dashboard/dashboard.html" style="background:#fff;color:#0f172a;padding:3px 10px;border-radius:6px;text-decoration:none;font-size:11px;font-weight:800;">⚙️ Dashboard</a>
            </div>
        `;
        document.body.prepend(banner);
        document.body.style.paddingTop = '38px';
    }

    function showMaintenanceOverlay() {
        if (document.getElementById('asta-maintenance-overlay')) return;

        // Block interactions on background
        document.body.style.overflow = 'hidden';

        const overlay = document.createElement('div');
        overlay.id = 'asta-maintenance-overlay';
        overlay.innerHTML = `
            <div style="position:fixed;inset:0;z-index:9999999;background:rgba(10, 15, 30, 0.96);backdrop-filter:blur(20px);display:flex;align-items:center;justify-content:center;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#fff;text-align:center;">
                <div style="max-width:520px;width:100%;background:linear-gradient(135deg,rgba(30,41,59,0.85),rgba(15,23,42,0.95));border:1px solid rgba(255,255,255,0.12);padding:45px 30px;border-radius:24px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.7);animation:fadeIn 0.4s ease-out;">
                    <div style="font-size:64px;margin-bottom:18px;display:inline-block;filter:drop-shadow(0 0 15px rgba(234,179,8,0.4));">🛠️</div>
                    <h1 style="font-size:26px;font-weight:800;margin-bottom:14px;background:linear-gradient(135deg,#00c882,#0284c7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:-0.5px;">Plateforme en Maintenance</h1>
                    <p style="font-size:14px;color:#94a3b8;line-height:1.6;margin-bottom:30px;">
                        Asta-Shops effectue actuellement une mise à jour technique programmée afin d'améliorer la rapidité et la sécurité de vos recharges. Nous serons de retour très rapidement !
                    </p>
                    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
                        <button onclick="window.location.reload()" style="background:#00c882;color:#0b1329;font-weight:700;padding:12px 24px;border-radius:12px;border:none;cursor:pointer;font-size:14px;transition:transform 0.2s;">🔄 Rafraîchir la page</button>
                        <a href="/Dashboard/admin-login.html" style="background:rgba(255,255,255,0.08);color:#e2e8f0;font-weight:600;padding:12px 24px;border-radius:12px;text-decoration:none;font-size:14px;border:1px solid rgba(255,255,255,0.15);">🔑 Espace Administrateur</a>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    function removeMaintenanceUI() {
        const overlay = document.getElementById('asta-maintenance-overlay');
        if (overlay) {
            overlay.remove();
            document.body.style.overflow = '';
        }
        const banner = document.getElementById('asta-admin-maintenance-banner');
        if (banner) {
            banner.remove();
            document.body.style.paddingTop = '';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkMaintenance);
    } else {
        checkMaintenance();
    }
})();
