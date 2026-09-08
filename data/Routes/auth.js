import express from 'express';
import { supabaseAdmin, DEMO_MODE } from '../supabase.js';
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

router.post('/admin-login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

    if (DEMO_MODE) {
        return res.json({
            token: 'demo-token-' + Date.now(),
            user: { id: 'demo-1', email, role: 'directeur', nom: 'Directeur Démo', prenom: '' },
            sidebarPerms: SIDEBAR_PERMISSIONS,
            roleLevel: 5
        });
    }

    const { data: authData, error: authErr } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    if (authErr) return res.status(401).json({ error: 'Identifiants incorrects' });

    const { data: profile, error: profErr } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

    if (profErr || !profile) {
        await supabaseAdmin.auth.admin.signOut(authData.user.id);
        return res.status(403).json({ error: 'Profil introuvable' });
    }

    const isStaff = profile.role !== 'client';
    const roleLevel = ROLE_LEVEL[profile.role] || 0;

    const sidebarPerms = {};
    for (const [section, roles] of Object.entries(SIDEBAR_PERMISSIONS)) {
        sidebarPerms[section] = roles.includes(profile.role);
    }

    await logActivite(profile.id, profile.role, isStaff ? 'Connexion au dashboard' : 'Connexion au site client', null, null, null);

    res.json({
        token: authData.session.access_token,
        user: { id: profile.id, email: authData.user.email, role: profile.role, nom: profile.nom || '', prenom: profile.prenom || '', avatar: profile.avatar_url || null },
        sidebarPerms,
        roleLevel,
        isStaff,
        redirectUrl: isStaff ? (req.headers.referer?.includes('Dashboard') ? 'dashboard.html' : 'Dashboard/dashboard.html') : 'profile.html'
    });
});

router.post('/logout', requireAuth, async (req, res) => {
    if (!DEMO_MODE) {
        await supabaseAdmin.auth.admin.signOut(req.user.id);
        await logActivite(req.user.id, req.user.role, 'Déconnexion du dashboard', null, null, null);
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
    if (password.length < 6) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
    }

    if (DEMO_MODE) {
        return res.json({ success: true, demo: true });
    }

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nom: nom || '', prenom }
    });

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
        return res.status(400).json({ error: errMsg });
    }

    const { error: profErr } = await supabaseAdmin.from('profiles').upsert({
        id: created.user.id,
        email,
        nom: nom || '',
        prenom,
        user_code: generateUserCode(),
        role: 'client',
        statut_presence: 'deconnecte'
    }, { onConflict: 'id' });

    if (profErr) {
        console.error('[register] Erreur création profil :', profErr.message);
    }

    res.json({ success: true });
});

router.post('/setup-profile', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Token manquant' });
    if (DEMO_MODE) return res.json({ success: true, message: 'Mode démo' });

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'Token invalide' });

    const { data: existing } = await supabaseAdmin.from('profiles').select('id').eq('id', user.id).maybeSingle();
    if (existing) return res.json({ success: true, message: 'Profil déjà existant' });

    const meta = user.user_metadata || {};
    const { error } = await supabaseAdmin.from('profiles').insert({
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

    const { error } = await supabaseAdmin.from('profiles').update({ statut_presence: status }).eq('id', req.user.id);
    if (error) return res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' });
    res.json({ success: true, status });
});

export default router;
