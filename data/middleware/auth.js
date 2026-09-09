import { supabaseAdmin, DEMO_MODE } from '../supabase.js';

export const ROLES = {
    HELPER: 'helper',
    EMPLOYE: 'employe',
    ADMIN: 'admin',
    ADMINISTRATEUR: 'administrateur',
    MANAGER: 'manager',
    DIRECTEUR: 'directeur'
};

export const ROLE_LEVEL = {
    client: 0,
    helper: 1,
    employe: 2,
    admin: 3,
    administrateur: 3,
    manager: 4,
    directeur: 5
};

export const SIDEBAR_PERMISSIONS = {
    tableau_de_bord: ['directeur', 'manager', 'admin', 'administrateur'],
    catalogue_produits: ['directeur', 'manager', 'admin', 'administrateur'],
    gestion_commandes: ['directeur', 'manager', 'admin', 'administrateur', 'employe'],
    hub_partenariats: ['directeur', 'manager', 'admin', 'administrateur'],
    moderation_equipe: ['directeur', 'admin', 'administrateur'],
    configuration: ['directeur', 'admin', 'administrateur']
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
        req.user = {
            id: 'demo-user',
            email: 'demo@lootzone.gg',
            role: 'directeur',
            nom: 'Démo',
            prenom: 'Directeur'
        };
        return next();
    }

    const token = extractToken(req);
    if (!token) {
        return res.status(401).json({ error: 'Token manquant ou invalide' });
    }

    let user;
    try {
        const { data, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !data?.user) {
            return res.status(401).json({ error: 'Session expirée ou invalide' });
        }
        user = data.user;
    } catch (err) {
        console.error('[Auth] Erreur getUser :', err.message);
        return res.status(500).json({ error: 'Erreur d\'authentification' });
    }

    let profile;
    try {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('id, email, nom, prenom, role, statut_presence, avatar_url')
            .eq('id', user.id)
            .single();

        if (error || !data) {
            return res.status(403).json({ error: 'Profil introuvable' });
        }
        profile = data;
    } catch (err) {
        console.error('[Auth] Erreur récupération profil :', err.message);
        return res.status(500).json({ error: 'Erreur lors de la vérification du profil' });
    }

    // Bloquer les clients — espace réservé au staff uniquement
    if (profile.role === 'client') {
        return res.status(403).json({ error: 'Accès réservé au staff' });
    }

    req.user = { id: user.id, email: user.email, ...profile };
    next();
}

/**
 * Vérifie que l'utilisateur a exactement l'un des rôles listés.
 */
export function requireRole(...roles) {
    const expanded = new Set(roles);
    if (expanded.has('administrateur')) expanded.add('admin');
    if (expanded.has('admin')) expanded.add('administrateur');

    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
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
