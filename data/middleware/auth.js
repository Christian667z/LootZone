import { supabaseAdmin, DEMO_MODE } from '../supabase.js';

export const ROLES = {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    STAFF: 'staff',
    CLIENT: 'client',
    HELPER: 'helper',
    EMPLOYE: 'employe',
    ADMINISTRATEUR: 'administrateur',
    MANAGER: 'manager',
    DIRECTEUR: 'directeur'
};

export const ROLE_LEVEL = {
    client: 0,
    helper: 1,
    staff: 2,
    employe: 2,
    admin: 3,
    administrateur: 3,
    manager: 4,
    directeur: 5,
    super_admin: 5
};

export const SIDEBAR_PERMISSIONS = {
    tableau_de_bord: ['super_admin', 'directeur', 'manager', 'admin', 'administrateur', 'staff'],
    catalogue_produits: ['super_admin', 'directeur', 'manager', 'admin', 'administrateur', 'staff'],
    gestion_commandes: ['super_admin', 'directeur', 'manager', 'admin', 'administrateur', 'staff', 'employe'],
    hub_partenariats: ['super_admin', 'directeur', 'manager', 'admin', 'administrateur', 'staff'],
    moderation_equipe: ['super_admin', 'directeur', 'admin', 'administrateur'],
    configuration: ['super_admin', 'directeur', 'admin', 'administrateur']
};

// Format attendu : "Bearer <jwt>" ou juste "<jwt>"
const JWT_REGEX = /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_.+/=]*$/;

/**
 * Extrait et valide le token JWT depuis les headers.
 * Retourne null si absent ou mal formé.
 */
function extractToken(req) {
    const raw = req.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
    if (!raw || !JWT_REGEX.test(raw)) return null;
    return raw;
}

export async function requireAuth(req, res, next) {
    if (DEMO_MODE) {
        const demoToken = req.headers.authorization?.replace(/^Bearer\s+/i, '');
        if (!demoToken || !demoToken.startsWith('demo-token-')) {
            return res.status(401).json({ error: 'Token manquant ou invalide' });
        }
        const isDemoStaff = demoToken === 'demo-token-lootzone-admin';
        req.user = {
            id: isDemoStaff ? 'demo-admin-1' : 'demo-user-1',
            email: isDemoStaff ? 'admin@lootzone.gg' : 'demo@lootzone.gg',
            role: isDemoStaff ? 'directeur' : 'client',
            nom: isDemoStaff ? 'LootZone' : 'Démo',
            prenom: isDemoStaff ? 'Directeur' : 'Client'
        };
        return next();
    }

    const token = extractToken(req);
    if (!token) {
        return res.status(401).json({ error: 'Token manquant ou invalide' });
    }

    let user;
    try {
        if (!supabaseAdmin) {
            return res.status(503).json({ error: 'Service d\'authentification indisponible' });
        }
        const { data, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !data?.user) {
            return res.status(401).json({ error: 'Session expirée ou invalide' });
        }
        user = data.user;
    } catch (err) {
        console.error('[Auth] Erreur getUser :', err.message);
        return res.status(401).json({ error: 'Session expirée ou invalide' });
    }

    let profile = null;
    try {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('id, email, nom, prenom, role, statut_presence, avatar_url, wallet_balance, points, user_code')
            .eq('id', user.id)
            .maybeSingle();

        if (!error && data) {
            profile = data;
        }
    } catch (err) {
        console.warn('[Auth] Erreur récupération profil :', err.message);
    }

    if (!profile) {
        const meta = user.user_metadata || {};
        profile = {
            id: user.id,
            email: user.email,
            nom: meta.nom || meta.last_name || '',
            prenom: meta.prenom || meta.first_name || user.email?.split('@')[0] || 'Client',
            role: meta.role || 'client',
            user_code: meta.user_code || ('LZ' + (user.id || '').replace(/-/g, '').slice(0, 4).toUpperCase()),
            statut_presence: 'en_ligne'
        };
        try {
            await supabaseAdmin.from('profiles').upsert(profile, { onConflict: 'id' });
        } catch (_) {}
    }

    req.user = { id: user.id, email: user.email, ...profile };
    next();
}

/**
 * Vérifie que l'utilisateur est un membre du personnel (non client).
 */
export function requireStaff(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
    if (req.user.role === 'client') {
        return res.status(403).json({ error: 'Accès réservé au staff' });
    }
    next();
}

/**
 * Vérifie que l'utilisateur a exactement l'un des rôles listés.
 */
export function requireRole(...roles) {
    const expanded = new Set(roles);
    if (expanded.has('administrateur')) { expanded.add('admin'); expanded.add('super_admin'); }
    if (expanded.has('admin')) { expanded.add('administrateur'); expanded.add('super_admin'); expanded.add('directeur'); }
    if (expanded.has('directeur')) { expanded.add('super_admin'); }
    if (expanded.has('manager')) { expanded.add('super_admin'); }
    if (expanded.has('staff')) {
        expanded.add('admin');
        expanded.add('administrateur');
        expanded.add('super_admin');
        expanded.add('directeur');
        expanded.add('manager');
        expanded.add('employe');
        expanded.add('helper');
    }

    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
        if (req.user.role === 'super_admin') return next();
        if (!expanded.has(req.user.role)) {
            return res.status(403).json({
                error: `Accès refusé — rôle requis : ${roles.join(' ou ')}`
            });
        }
        next();
    };
}

/**
 * Vérifie que l'utilisateur a au moins le niveau de rôle minimum.
 */
export function requireMinRole(minRole) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
        const userLevel = ROLE_LEVEL[req.user.role] || 0;
        const minLevel = ROLE_LEVEL[minRole] || 0;
        if (userLevel < minLevel) {
            return res.status(403).json({
                error: `Accès refusé — niveau minimum requis : ${minRole}`
            });
        }
        next();
    };
}
