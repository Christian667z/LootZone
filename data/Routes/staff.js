import express from 'express';
import { supabaseAdmin, DEMO_MODE } from '../supabase.js';
import { requireAuth, requireRole, requireMinRole, ROLE_LEVEL } from '../middleware/auth.js';
import { logActivite } from './logs.js';

const router = express.Router();

let demoStaff = [];

router.get('/', requireAuth, requireMinRole('administrateur'), async (req, res) => {
    if (DEMO_MODE) return res.json({ staff: demoStaff });
    const { data, error } = await supabaseAdmin.from('profiles').select('id, email, nom, prenom, role, statut_presence, created_at').neq('role', 'client').order('role');
    if (error) return res.status(500).json({ error: 'Erreur interne du serveur' });
    res.json({ staff: data });
});

router.patch('/:id/role', requireAuth, requireRole('directeur', 'administrateur'), async (req, res) => {
    const { role } = req.body;
    const validRoles = ['helper', 'employe', 'administrateur', 'manager', 'directeur'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'Rôle invalide' });

    const targetId = req.params.id;
    const reqLevel = ROLE_LEVEL[req.user.role] || 0;
    const targetLevel = ROLE_LEVEL[role] || 0;
    if (targetLevel >= reqLevel && req.user.role !== 'directeur') return res.status(403).json({ error: 'Impossible de promouvoir à un rang égal ou supérieur' });

    if (DEMO_MODE) {
        const member = demoStaff.find(s => s.id === targetId);
        if (!member) return res.status(404).json({ error: 'Membre introuvable' });
        if (member.role === 'directeur' && req.user.role !== 'directeur') return res.status(403).json({ error: 'Impossible de modifier le Directeur' });
        const old = member.role;
        member.role = role;
        await logActivite(req.user.id, req.user.role, `Modification rôle staff ${member.nom}`, `staff:${targetId}`, old, role);
        return res.json({ success: true });
    }

    const { data: target } = await supabaseAdmin.from('profiles').select('role, nom').eq('id', targetId).single();
    if (target?.role === 'directeur' && req.user.role !== 'directeur') return res.status(403).json({ error: 'Impossible de modifier le Directeur' });

    const { error } = await supabaseAdmin.from('profiles').update({ role }).eq('id', targetId);
    if (error) return res.status(500).json({ error: 'Erreur interne du serveur' });
    await logActivite(req.user.id, req.user.role, `Modification rôle staff ${target?.nom}`, `staff:${targetId}`, target?.role, role);
    res.json({ success: true });
});

router.delete('/:id', requireAuth, requireRole('directeur'), async (req, res) => {
    const targetId = req.params.id;
    if (targetId === req.user.id) return res.status(400).json({ error: 'Impossible de se supprimer soi-même' });

    if (DEMO_MODE) {
        const idx = demoStaff.findIndex(s => s.id === targetId);
        if (idx === -1) return res.status(404).json({ error: 'Membre introuvable' });
        if (demoStaff[idx].role === 'directeur') return res.status(403).json({ error: 'Impossible de supprimer le Directeur' });
        const [removed] = demoStaff.splice(idx, 1);
        await logActivite(req.user.id, req.user.role, `Révocation accès staff ${removed.nom}`, `staff:${targetId}`, removed.role, null);
        return res.json({ success: true });
    }

    const { data: target } = await supabaseAdmin.from('profiles').select('role, nom').eq('id', targetId).single();
    if (target?.role === 'directeur') return res.status(403).json({ error: 'Impossible de supprimer le Directeur' });
    await supabaseAdmin.auth.admin.deleteUser(targetId);
    const { error } = await supabaseAdmin.from('profiles').delete().eq('id', targetId);
    if (error) return res.status(500).json({ error: 'Erreur interne du serveur' });
    await logActivite(req.user.id, req.user.role, `Révocation accès staff ${target?.nom}`, `staff:${targetId}`, target?.role, null);
    res.json({ success: true });
});

router.post('/invite', requireAuth, requireMinRole('manager'), async (req, res) => {
    const { email, prenom, nom, role } = req.body;
    if (!email) return res.status(400).json({ error: 'Email obligatoire' });

    const validRoles = ['helper', 'employe', 'administrateur', 'manager', 'directeur'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'Rôle invalide' });

    const reqLevel = ROLE_LEVEL[req.user.role] || 0;
    const targetLevel = ROLE_LEVEL[role] || 0;
    if (targetLevel >= reqLevel && req.user.role !== 'directeur') {
        return res.status(403).json({ error: 'Impossible d\'inviter à un rang égal ou supérieur au vôtre' });
    }

    if (DEMO_MODE) return res.json({ success: true, message: 'Mode démo — invitation simulée' });

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { prenom: prenom || '', nom: nom || '', role: role || 'employe' }
    });
    if (error) return res.status(500).json({ error: 'Erreur interne du serveur' });

    await logActivite(req.user.id, req.user.role, `Invitation staff envoyée à ${email}`, `email:${email}`, null, role);
    res.json({ success: true, user_id: data?.user?.id });
});

router.get('/kpi', requireAuth, requireRole('directeur'), async (req, res) => {
    if (DEMO_MODE) {
        return res.json({ kpi: demoStaff.map(s => ({ ...s, commandes_ce_mois: 0, taux_satisfaction: 0, temps_moyen_min: 0 })) });
    }
    const { data, error } = await supabaseAdmin.rpc('get_staff_kpi');
    if (error) return res.status(500).json({ error: 'Erreur interne du serveur' });
    res.json({ kpi: data });
});

router.patch('/me/status', requireAuth, async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['en_ligne', 'occupe', 'deconnecte'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Statut invalide' });

    if (DEMO_MODE) {
        const member = demoStaff.find(s => s.id === req.user.id || s.role === req.user.role);
        if (member) member.statut_presence = status;
        return res.json({ success: true, status });
    }

    const { error } = await supabaseAdmin.from('profiles').update({ statut_presence: status }).eq('id', req.user.id);
    if (error) return res.status(500).json({ error: 'Erreur interne du serveur' });
    res.json({ success: true, status });
});

export default router;
