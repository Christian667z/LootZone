import express from 'express';
import { supabaseAdmin, supabaseAnon, supabaseClient, DEMO_MODE } from '../supabase.js';
import { requireAuth, ROLE_LEVEL, SIDEBAR_PERMISSIONS } from '../middleware/auth.js';
import { logActivite } from './logs.js';

const router = express.Router();

function generateUserCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

        if (DEMO_MODE) {
            const cleanEmail = (email || '').trim().toLowerCase();
            const isStaff = cleanEmail.includes('admin') || cleanEmail.includes('directeur') || cleanEmail.includes('staff') || cleanEmail.includes('manager');
            const role = isStaff ? 'directeur' : 'client';
            const demoUser = {
                id: 'demo-user-1',
                email: cleanEmail,
                nom: isStaff ? 'Admin' : 'Client',
                prenom: isStaff ? 'Directeur' : 'Demo',
                role,
                avatar: null,
                user_code: 'LOOT99',
                statut_presence: 'en_ligne'
            };
            const sidebarPerms = {};
            for (const [section, roles] of Object.entries(SIDEBAR_PERMISSIONS)) {
                sidebarPerms[section] = roles.includes(role);
            }
            return res.json({
                token: 'demo-token-lootzone-xyz',
                session: { access_token: 'demo-token-lootzone-xyz', user: demoUser },
                user: demoUser,
                profile: demoUser,
                sidebarPerms,
                roleLevel: ROLE_LEVEL[role] || 0,
                isStaff,
                redirectUrl: isStaff ? (req.headers.referer?.includes('Dashboard') ? 'dashboard.html' : 'Dashboard/dashboard.html') : 'profile.html'
            });
        }

        const client = supabaseClient;
        if (!client) {
            return res.status(500).json({ error: 'Service d\'authentification indisponible' });
        }

        const cleanEmail = email.trim().toLowerCase();
        const { data: authData, error: authErr } = await client.auth.signInWithPassword({ email: cleanEmail, password });
        if (authErr) {
            const msg = authErr.message || '';
            const msgLower = msg.toLowerCase();
            if (msgLower.includes('email not confirmed')) {
                return res.status(403).json({
                    error: 'Email non confirmé. Veuillez vérifier vos emails ou exécuter le script SQL d\'auto-confirmation.',
                    code: 'email_not_confirmed'
                });
            }
            if (msgLower.includes('invalid login credentials') || msgLower.includes('invalid_credentials') || authErr.code === 'invalid_credentials') {
                return res.status(401).json({ error: 'Identifiants incorrects. Vérifiez votre adresse e-mail et votre mot de passe.' });
            }
            return res.status(400).json({ error: msg || 'Erreur lors de la connexion' });
        }

        // Récupérer le profil
        let profile = null;
        try {
            const { data: profData } = await client
                .from('profiles')
                .select('*')
                .eq('id', authData.user.id)
                .maybeSingle();
            profile = profData;
        } catch (_) {}

        const meta = authData.user.user_metadata || {};
        const metaPrenom = meta.prenom || meta.first_name || '';
        const metaNom = meta.nom || meta.last_name || '';
        const metaRole = meta.role || 'client';

        // Si le profil n'existe pas encore, le créer automatiquement
        if (!profile) {
            profile = {
                id: authData.user.id,
                email: authData.user.email,
                nom: metaNom,
                prenom: metaPrenom || authData.user.email.split('@')[0],
                user_code: generateUserCode(),
                role: metaRole,
                statut_presence: 'en_ligne'
            };
            try {
                await client.from('profiles').upsert(profile, { onConflict: 'id' });
            } catch (_) {}
        } else {
            // Mettre à jour les champs manquants si le profil avait des champs vides
            const updates = {};
            if ((!profile.prenom || profile.prenom === '') && metaPrenom) {
                updates.prenom = metaPrenom;
                profile.prenom = metaPrenom;
            }
            if ((!profile.nom || profile.nom === '') && metaNom) {
                updates.nom = metaNom;
                profile.nom = metaNom;
            }
            if ((!profile.role || profile.role === 'client') && metaRole && metaRole !== 'client') {
                updates.role = metaRole;
                profile.role = metaRole;
            }
            if (Object.keys(updates).length > 0) {
                try {
                    await client.from('profiles').update(updates).eq('id', profile.id);
                } catch (_) {}
            }
        }

        const isStaff = profile?.role && profile.role !== 'client';
        const roleLevel = ROLE_LEVEL[profile?.role] || 0;

        const sidebarPerms = {};
        for (const [section, roles] of Object.entries(SIDEBAR_PERMISSIONS)) {
            sidebarPerms[section] = roles.includes(profile?.role);
        }

        try {
            await logActivite(profile.id, profile.role, isStaff ? 'Connexion au dashboard' : 'Connexion au site client', null, null, null);
        } catch (_) {}

        return res.json({
            token: authData.session?.access_token,
            session: authData.session,
            user: {
                id: profile.id,
                email: authData.user.email,
                role: profile.role,
                nom: profile.nom || '',
                prenom: profile.prenom || '',
                avatar: profile.avatar_url || null,
                user_code: profile.user_code || ''
            },
            profile,
            sidebarPerms,
            roleLevel,
            isStaff,
            redirectUrl: isStaff ? (req.headers.referer?.includes('Dashboard') ? 'dashboard.html' : 'Dashboard/dashboard.html') : 'profile.html'
        });
    } catch (err) {
        console.error('[auth/login] Erreur:', err);
        return res.status(500).json({ error: 'Erreur lors de la connexion. Réessayez.' });
    }
});

router.post('/admin-login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

    if (DEMO_MODE) {
        const cleanEmail = (email || '').trim().toLowerCase();
        const demoUser = {
            id: 'demo-admin-1',
            email: cleanEmail || 'admin@lootzone.gg',
            nom: 'LootZone',
            prenom: 'Directeur',
            role: 'directeur',
            avatar: null,
            user_code: 'DIR001',
            statut_presence: 'en_ligne'
        };
        const sidebarPerms = {};
        for (const [section, roles] of Object.entries(SIDEBAR_PERMISSIONS)) {
            sidebarPerms[section] = true;
        }
        return res.json({
            token: 'demo-token-lootzone-admin',
            session: { access_token: 'demo-token-lootzone-admin', user: demoUser },
            user: demoUser,
            profile: demoUser,
            sidebarPerms,
            roleLevel: 5,
            isStaff: true,
            redirectUrl: req.headers.referer?.includes('Dashboard') ? 'dashboard.html' : 'Dashboard/dashboard.html'
        });
    }

    const client = supabaseClient;
    if (!client) {
        return res.status(500).json({ error: 'Service d\'authentification indisponible' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const { data: authData, error: authErr } = await client.auth.signInWithPassword({ email: cleanEmail, password });
    if (authErr) {
        const msg = authErr.message || '';
        const msgLower = msg.toLowerCase();
        if (msgLower.includes('email not confirmed')) {
            return res.status(403).json({ error: 'Email non confirmé. Veuillez confirmer votre adresse e-mail ou exécuter le script SQL d\'auto-confirmation.', code: 'email_not_confirmed' });
        }
        return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    let profile = null;
    const { data: profData } = await client
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();
    profile = profData;

    if (!profile) {
        const meta = authData.user.user_metadata || {};
        profile = {
            id: authData.user.id,
            email: authData.user.email,
            nom: meta.nom || '',
            prenom: meta.prenom || '',
            user_code: generateUserCode(),
            role: meta.role || 'directeur',
            statut_presence: 'en_ligne'
        };
        try {
            await client.from('profiles').upsert(profile, { onConflict: 'id' });
        } catch (_) {}
    }

    const isStaff = profile.role && profile.role !== 'client';
    if (!isStaff) {
        try {
            await logActivite(profile.id, profile.role, 'Tentative d\'accès non autorisée au Dashboard Admin', null, null, null);
        } catch (_) {}
        return res.status(403).json({
            error: "Accès refusé : Vous n'avez pas les autorisations nécessaires pour accéder à l'administration."
        });
    }

    const roleLevel = ROLE_LEVEL[profile.role] || 0;

    const sidebarPerms = {};
    for (const [section, roles] of Object.entries(SIDEBAR_PERMISSIONS)) {
        sidebarPerms[section] = roles.includes(profile.role);
    }

    try {
        await logActivite(profile.id, profile.role, 'Connexion au dashboard', null, null, null);
    } catch (_) {}

    res.json({
        token: authData.session?.access_token,
        session: authData.session,
        user: { id: profile.id, email: authData.user.email, role: profile.role, nom: profile.nom || '', prenom: profile.prenom || '', avatar: profile.avatar_url || null },
        profile,
        sidebarPerms,
        roleLevel,
        isStaff: true,
        redirectUrl: req.headers.referer?.includes('Dashboard') ? 'dashboard.html' : 'Dashboard/dashboard.html'
    });
});

router.post('/logout', requireAuth, async (req, res) => {
    if (!DEMO_MODE) {
        // Les JWT Supabase sont stateless côté API. La session locale est
        // supprimée par le navigateur; admin.signOut n'est disponible qu'avec
        // une vraie clé service_role et ne doit jamais faire tomber la route.
        try {
            await logActivite(req.user.id, req.user.role, 'Déconnexion du dashboard', null, null, null);
        } catch (err) {
            console.warn('[auth/logout] Journalisation impossible:', err.message);
        }
    }
    res.json({ success: true });
});

router.get('/me', requireAuth, (req, res) => {
    const sidebarPerms = {};
    for (const [section, roles] of Object.entries(SIDEBAR_PERMISSIONS)) {
        sidebarPerms[section] = roles.includes(req.user.role);
    }
    res.json({ user: req.user, sidebarPerms, roleLevel: ROLE_LEVEL[req.user.role] || 0 });
});

router.post('/register', async (req, res) => {
    const { email, password, nom, prenom } = req.body;
    if (!email || !password || !prenom) {
        return res.status(400).json({ error: 'Prénom, e-mail et mot de passe sont requis.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }

    if (DEMO_MODE) {
        return res.json({
            success: true,
            user: {
                id: 'demo-user-' + Date.now(),
                email: email.trim().toLowerCase(),
                nom: nom || '',
                prenom,
                role: 'client'
            },
            message: 'Compte créé avec succès (mode démo).'
        });
    }

    const client = supabaseClient;
    if (!client) {
        return res.status(500).json({ error: 'Service Supabase non disponible' });
    }

    const cleanEmail = email.trim().toLowerCase();
    let createdUser = null;
    let createErr = null;

    if (supabaseAdmin?.auth?.admin?.createUser) {
        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
            email: cleanEmail,
            password,
            email_confirm: true,
            user_metadata: { nom: nom || '', prenom }
        });
        createdUser = created?.user;
        createErr = error;
    } else {
        const { data: created, error } = await client.auth.signUp({
            email: cleanEmail,
            password,
            options: {
                data: { nom: nom || '', prenom }
            }
        });
        createdUser = created?.user;
        createErr = error;
    }

    if (createErr) {
        const errMsg = createErr.message || createErr.code || createErr.name || 'Erreur inconnue lors de la création du compte.';
        console.error('[register] Erreur Supabase createUser:', JSON.stringify({ message: createErr.message, code: createErr.code, status: createErr.status, name: createErr.name }));
        const errLower = errMsg.toLowerCase();
        if (errLower.includes('already registered') || errLower.includes('already exists') || errLower.includes('email_exists') || createErr.code === 'email_exists') {
            return res.status(409).json({ error: 'Un compte existe déjà avec cet e-mail.' });
        }
        if (errLower.includes('signup') && errLower.includes('disabled')) {
            return res.status(403).json({ error: 'Les inscriptions sont temporairement désactivées.' });
        }
        if (errLower.includes('password') && (errLower.includes('weak') || errLower.includes('short'))) {
            return res.status(400).json({ error: 'Mot de passe trop faible. Utilisez au moins 6 caractères variés.' });
        }
        if (errLower.includes('invalid') && errLower.includes('email')) {
            return res.status(400).json({ error: 'Adresse email invalide.' });
        }
        return res.status(400).json({ error: errMsg });
    }

    if (createdUser?.id) {
        const { error: profErr } = await client.from('profiles').upsert({
            id: createdUser.id,
            email: cleanEmail,
            nom: nom || '',
            prenom,
            user_code: generateUserCode(),
            role: 'client',
            statut_presence: 'deconnecte'
        }, { onConflict: 'id' });

        if (profErr) {
            console.error('[register] Erreur création profil :', profErr.message);
        }
    }

    res.json({
        success: true,
        user: createdUser ? { id: createdUser.id, email: createdUser.email } : null,
        needsConfirmation: !supabaseAdmin && !createdUser?.email_confirmed_at
    });
});

router.post('/setup-profile', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Token manquant' });
    if (DEMO_MODE) return res.json({ success: true, message: 'Mode démo' });

    const client = supabaseClient;
    const { data: { user }, error: authErr } = await client.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'Token invalide' });

    const { data: existing } = await client.from('profiles').select('id').eq('id', user.id).maybeSingle();
    if (existing) return res.json({ success: true, message: 'Profil déjà existant' });

    const meta = user.user_metadata || {};
    const { error } = await client.from('profiles').insert({
        id: user.id,
        email: user.email,
        nom: meta.nom || meta.last_name || '',
        prenom: meta.prenom || meta.first_name || '',
        user_code: generateUserCode(),
        role: meta.role || 'client',
        statut_presence: 'deconnecte'
    });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, message: 'Profil créé' });
});

router.patch('/staff/:id/status', requireAuth, async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['en_ligne', 'occupe', 'deconnecte'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Statut invalide' });

    // Vérification d'appartenance — un staff ne peut modifier que son propre statut
    if (req.params.id !== req.user.id) {
        return res.status(403).json({ error: 'Non autorisé — vous ne pouvez modifier que votre propre statut' });
    }

    if (DEMO_MODE) return res.json({ success: true, status });

    const client = supabaseClient;
    const { error } = await client.from('profiles').update({ statut_presence: status }).eq('id', req.user.id);
    if (error) return res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' });
    res.json({ success: true, status });
});

export default router;
