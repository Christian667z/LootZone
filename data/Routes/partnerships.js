import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin, DEMO_MODE } from '../supabase.js';
import { requireAuth, requireMinRole, requireRole } from '../middleware/auth.js';
import { logActivite } from './logs.js';

const router = express.Router();

const BADGE_TYPES = {
    'partenaire': { label: 'Devenir Partenaire', color: '#10b981', bg: '#d1fae5' },
    'vendeur': { label: 'Vendre sur Asta Shops', color: '#3b82f6', bg: '#dbeafe' },
    'createur': { label: 'Programme Créateurs', color: '#8b5cf6', bg: '#ede9fe' },
    'alliance': { label: "Demande d'Alliance", color: '#f59e0b', bg: '#fef3c7' }
};

let demoRequests = [];
let demoDraftMessages = [];

router.get('/', requireAuth, requireMinRole('manager'), async (req, res) => {
    if (DEMO_MODE) return res.json({ requests: demoRequests, badge_types: BADGE_TYPES });
    const { data, error } = await supabaseAdmin.from('partenariat_requests').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'Erreur interne du serveur' });
    res.json({ requests: data, badge_types: BADGE_TYPES });
});

router.post('/:id/message', requireAuth, requireMinRole('helper'), async (req, res) => {
    const reqId = req.params.id;
    const { message, is_draft } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message vide' });

    const isHelper = req.user.role === 'helper';

    if (DEMO_MODE) {
        const request = demoRequests.find(r => r.id === reqId);
        if (!request) return res.status(404).json({ error: 'Demande introuvable' });

        if (isHelper || is_draft) {
            const draft = { id: uuidv4(), request_id: reqId, helper_id: req.user.id, helper_nom: `${req.user.prenom} ${req.user.nom}`.trim() || req.user.email, message, statut: 'en_attente_validation', created_at: new Date().toISOString() };
            demoDraftMessages.push(draft);
            return res.json({ success: true, mode: 'brouillon', draft });
        }

        request.messages_chat.push({ id: uuidv4(), from: 'staff', auteur: `${req.user.prenom} ${req.user.nom}`.trim() || req.user.email, role: req.user.role, message, created_at: new Date().toISOString() });
        await logActivite(req.user.id, req.user.role, `Message envoyé — Hub Partenariats ${reqId}`, `partenariat:${reqId}`, null, message.slice(0, 100));
        return res.json({ success: true, mode: 'envoye' });
    }

    if (isHelper || is_draft) {
        const { data, error } = await supabaseAdmin.from('messages_brouillons').insert({ request_id: reqId, helper_id: req.user.id, message, statut: 'en_attente_validation' }).select().single();
        if (error) return res.status(500).json({ error: 'Erreur interne du serveur' });
        return res.json({ success: true, mode: 'brouillon', draft: data });
    }

    const { error } = await supabaseAdmin.from('partenariat_messages').insert({ request_id: reqId, staff_id: req.user.id, message });
    if (error) return res.status(500).json({ error: 'Erreur interne du serveur' });
    await logActivite(req.user.id, req.user.role, `Message Hub Partenariats ${reqId}`, `partenariat:${reqId}`, null, message.slice(0, 100));
    res.json({ success: true, mode: 'envoye' });
});

router.post('/drafts/:id/approve', requireAuth, requireMinRole('administrateur'), async (req, res) => {
    const draftId = req.params.id;

    if (DEMO_MODE) {
        const draftIdx = demoDraftMessages.findIndex(d => d.id === draftId);
        if (draftIdx === -1) return res.status(404).json({ error: 'Brouillon introuvable' });
        const draft = demoDraftMessages[draftIdx];
        const request = demoRequests.find(r => r.id === draft.request_id);
        if (request) request.messages_chat.push({ id: uuidv4(), from: 'staff', auteur: `${req.user.prenom} ${req.user.nom}`.trim(), role: req.user.role, message: draft.message, approved_from_draft: true, created_at: new Date().toISOString() });
        demoDraftMessages[draftIdx].statut = 'approuve';
        await logActivite(req.user.id, req.user.role, `Brouillon approuvé et envoyé — ${draft.helper_nom}`, `partenariat:${draft.request_id}`, 'brouillon', 'envoye');
        return res.json({ success: true });
    }

    const { data: draft } = await supabaseAdmin.from('messages_brouillons').select('*').eq('id', draftId).single();
    await supabaseAdmin.from('partenariat_messages').insert({ request_id: draft.request_id, staff_id: req.user.id, message: draft.message, approved_from: draftId });
    await supabaseAdmin.from('messages_brouillons').update({ statut: 'approuve', approuve_par: req.user.id }).eq('id', draftId);
    res.json({ success: true });
});

router.get('/drafts', requireAuth, requireMinRole('administrateur'), async (req, res) => {
    if (DEMO_MODE) return res.json({ drafts: demoDraftMessages.filter(d => d.statut === 'en_attente_validation') });
    const { data, error } = await supabaseAdmin.from('messages_brouillons').select('*, profiles:helper_id(nom, prenom)').eq('statut', 'en_attente_validation').order('created_at');
    if (error) return res.status(500).json({ error: 'Erreur interne du serveur' });
    res.json({ drafts: data });
});

router.post('/:id/valider', requireAuth, requireMinRole('manager'), async (req, res) => {
    const reqId = req.params.id;

    if (DEMO_MODE) {
        const request = demoRequests.find(r => r.id === reqId);
        if (!request) return res.status(404).json({ error: 'Demande introuvable' });
        request.statut = 'valide';
        request.valide_par = req.user.id;
        request.valide_at = new Date().toISOString();
        const affiliateCode = request.nom.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        request.affiliate_code = affiliateCode;
        await logActivite(req.user.id, req.user.role, `Partenariat validé — ${request.nom}`, `partenariat:${reqId}`, 'en_attente', 'valide');
        return res.json({ success: true, affiliate_code: affiliateCode, profile_url: `/p/${affiliateCode}` });
    }

    const { data: request } = await supabaseAdmin.from('partenariat_requests').select('*').eq('id', reqId).single();
    const affiliateCode = request.nom.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await supabaseAdmin.from('partenariat_requests').update({ statut: 'valide', valide_par: req.user.id, valide_at: new Date().toISOString(), affiliate_code: affiliateCode }).eq('id', reqId);
    if (request.user_id) await supabaseAdmin.from('profiles').update({ role: 'partenaire', affiliate_code: affiliateCode }).eq('id', request.user_id);
    await logActivite(req.user.id, req.user.role, `Partenariat validé — ${request.nom}`, `partenariat:${reqId}`, 'en_attente', 'valide');
    res.json({ success: true, affiliate_code: affiliateCode, profile_url: `/p/${affiliateCode}` });
});

router.post('/:id/rejeter', requireAuth, requireMinRole('manager'), async (req, res) => {
    const reqId = req.params.id;
    const { motif } = req.body;

    if (DEMO_MODE) {
        const request = demoRequests.find(r => r.id === reqId);
        if (!request) return res.status(404).json({ error: 'Demande introuvable' });
        request.statut = 'rejete';
        request.motif_rejet = motif;
        await logActivite(req.user.id, req.user.role, `Partenariat rejeté — ${request.nom}`, `partenariat:${reqId}`, 'en_attente', 'rejete');
        return res.json({ success: true });
    }

    await supabaseAdmin.from('partenariat_requests').update({ statut: 'rejete', motif_rejet: motif, rejete_par: req.user.id }).eq('id', reqId);
    await logActivite(req.user.id, req.user.role, `Partenariat rejeté — demande ${reqId}`, `partenariat:${reqId}`, 'en_attente', 'rejete');
    res.json({ success: true });
});

export default router;
