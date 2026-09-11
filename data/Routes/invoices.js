import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { supabaseAdmin, DEMO_MODE } from '../supabase.js';
import { requireAuth, requireMinRole } from '../middleware/auth.js';

const router = express.Router();

let demoInvoices = [];

router.get('/:commandeId', requireAuth, requireMinRole('employe'), async (req, res) => {
    const { commandeId } = req.params;
    if (DEMO_MODE) {
        const inv = demoInvoices.find(i => i.commande_id === commandeId);
        if (!inv) return res.status(404).json({ error: 'Facture introuvable' });
        return res.json(inv);
    }
    const { data, error } = await supabaseAdmin.from('factures').select('*').eq('commande_id', commandeId).single();
    if (error) { console.warn('[Fallback]', error.message); return res.json(DEMO_MODE ? { fallbacked: true } : { error: 'Database error' }); }
    res.json(data);
});

router.post('/generate/:commandeId', requireAuth, requireMinRole('employe'), async (req, res) => {
    const { commandeId } = req.params;
    const qrToken = uuidv4();
    const siteUrl = process.env.SITE_URL || `https://${process.env.REPLIT_DEV_DOMAIN || 'lootzone.gg'}`;
    const verifyUrl = `${siteUrl}/verify/${qrToken}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 120, margin: 1 });

    if (DEMO_MODE) {
        const existing = demoInvoices.find(i => i.commande_id === commandeId);
        if (existing) return res.json({ invoice: existing, qr: qrDataUrl });
        const inv = { id: uuidv4(), numero: commandeId, commande_id: commandeId, client_nom: 'Client', client_email: '', produit_nom: '', denom_label: '', eur: 0, htg: 0, methode_paiement: '', qr_token: qrToken, created_at: new Date().toISOString() };
        demoInvoices.push(inv);
        return res.json({ invoice: inv, qr: qrDataUrl });
    }

    const { data: commande } = await supabaseAdmin.from('commandes').select('*').eq('id', commandeId).single();
    if (!commande) return res.status(404).json({ error: 'Commande introuvable' });

    const { data: existing } = await supabaseAdmin.from('factures').select('*').eq('commande_id', commandeId).maybeSingle();
    if (existing) return res.json({ invoice: existing, qr: qrDataUrl });

    const { data: invoice, error } = await supabaseAdmin.from('factures').insert({
        numero: commandeId, commande_id: commandeId, client_id: commande.client_id,
        client_nom: commande.client_nom, client_email: commande.client_email,
        produit_nom: commande.produit_nom, denom_label: commande.denom_label,
        eur: commande.eur, htg: commande.htg, methode_paiement: commande.methode_paiement,
        qr_token: qrToken
    }).select().single();
    if (error) { console.warn('[Fallback]', error.message); return res.json(DEMO_MODE ? { fallbacked: true } : { error: 'Database error' }); }
    res.json({ invoice, qr: qrDataUrl });
});

router.get('/pdf/:commandeId', requireAuth, requireMinRole('employe'), async (req, res) => {
    const { commandeId } = req.params;

    let inv;
    if (DEMO_MODE) {
        inv = demoInvoices.find(i => i.commande_id === commandeId);
        if (!inv) return res.status(404).json({ error: 'Facture introuvable. Générez-la d\'abord.' });
    } else {
        const { data } = await supabaseAdmin.from('factures').select('*').eq('commande_id', commandeId).maybeSingle();
        if (!data) return res.status(404).json({ error: 'Facture introuvable. Générez-la d\'abord.' });
        inv = data;
    }

    const siteUrl = process.env.SITE_URL || `https://${process.env.REPLIT_DEV_DOMAIN || 'lootzone.gg'}`;
    const verifyUrl = `${siteUrl}/verify/${inv.qr_token}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 100, margin: 1 });
    const qrBase64 = qrDataUrl.replace('data:image/png;base64,', '');

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, pageH = 297;

    doc.setFillColor(13, 11, 24);
    doc.rect(0, 0, W, pageH, 'F');

    doc.setFillColor(19, 17, 28);
    doc.roundedRect(14, 14, W - 28, pageH - 28, 6, 6, 'F');

    doc.setFillColor(124, 58, 237);
    doc.roundedRect(14, 14, 50, 22, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('LOOTZONE', 39, 27, { align: 'center' });

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20); doc.setFont('helvetica', 'bold');
    doc.text('FACTURE', W - 20, 27, { align: 'right' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.setTextColor(156, 163, 175);
    doc.text(`#${inv.numero}`, W - 20, 34, { align: 'right' });

    doc.setDrawColor(45, 38, 79);
    doc.setLineWidth(0.3);
    doc.line(28, 46, W - 28, 46);

    doc.setFontSize(9); doc.setTextColor(156, 163, 175);
    doc.text('DATE D\'ÉMISSION', 28, 54);
    doc.text('MÉTHODE DE PAIEMENT', 100, 54);
    doc.setFontSize(10); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
    const dateStr = new Date(inv.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.text(dateStr, 28, 60);
    doc.text(inv.methode_paiement || '—', 100, 60);

    doc.setDrawColor(45, 38, 79);
    doc.line(28, 66, W - 28, 66);

    doc.setFontSize(8); doc.setTextColor(156, 163, 175); doc.setFont('helvetica', 'normal');
    doc.text('CLIENT', 28, 74);
    doc.setFontSize(11); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
    doc.text(inv.client_nom || '—', 28, 80);
    doc.setFontSize(9); doc.setTextColor(156, 163, 175); doc.setFont('helvetica', 'normal');
    if (inv.client_email) doc.text(inv.client_email, 28, 86);

    doc.setFillColor(24, 21, 36);
    doc.roundedRect(28, 96, W - 56, 10, 2, 2, 'F');
    doc.setFontSize(8); doc.setTextColor(156, 163, 175); doc.setFont('helvetica', 'bold');
    doc.text('PRODUIT', 34, 102);
    doc.text('DÉNOMINATION', 100, 102);
    doc.text('MONTANT', W - 34, 102, { align: 'right' });

    doc.setDrawColor(45, 38, 79);
    doc.line(28, 110, W - 28, 110);
    doc.setFontSize(10); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'normal');
    doc.text(inv.produit_nom || '—', 34, 118);
    doc.text(inv.denom_label || '—', 100, 118);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(6, 182, 212);
    doc.text(`${inv.eur}€`, W - 34, 118, { align: 'right' });

    doc.setDrawColor(45, 38, 79);
    doc.line(28, 124, W - 28, 124);

    doc.setFontSize(8); doc.setTextColor(156, 163, 175); doc.setFont('helvetica', 'normal');
    doc.text('Équivalent HTG :', W - 60, 132, { align: 'right' });
    doc.setFontSize(11); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
    doc.text(`${Number(inv.htg).toLocaleString('fr-FR')} HTG`, W - 34, 132, { align: 'right' });

    doc.setFillColor(124, 58, 237);
    doc.roundedRect(28, 144, W - 56, 18, 3, 3, 'F');
    doc.setFontSize(9); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
    doc.text('TOTAL PAYÉ', 34, 151);
    doc.setFontSize(16);
    doc.text(`${inv.eur}€  /  ${Number(inv.htg).toLocaleString('fr-FR')} HTG`, W / 2, 156, { align: 'center' });

    doc.addImage(`data:image/png;base64,${qrBase64}`, 'PNG', W - 58, 174, 30, 30);
    doc.setFontSize(7); doc.setTextColor(156, 163, 175); doc.setFont('helvetica', 'normal');
    doc.text('Scanner pour vérifier', W - 43, 207, { align: 'center' });
    doc.text('l\'authenticité', W - 43, 211, { align: 'center' });

    doc.setFontSize(8); doc.setTextColor(156, 163, 175);
    doc.text('Cette facture certifie un achat effectué sur la plateforme LootZone.', 28, 178);
    doc.text('En cas de litige, contactez notre support avec ce numéro de facture.', 28, 184);

    doc.setFillColor(15, 13, 26);
    doc.rect(14, pageH - 28, W - 28, 14, 'F');
    doc.setFontSize(8); doc.setTextColor(110, 110, 130);
    doc.text('© LootZone — Plateforme de produits numériques | Haiti', W / 2, pageH - 20, { align: 'center' });
    doc.setTextColor(6, 182, 212);
    doc.text('lootzone.gg', W / 2, pageH - 15, { align: 'center' });

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="facture-${inv.numero}.pdf"`);
    res.send(pdfBuffer);
});

router.get('/verify/:token', async (req, res) => {
    const { token } = req.params;
    if (DEMO_MODE) {
        const inv = demoInvoices.find(i => i.qr_token === token);
        return res.json({ valide: !!inv, invoice: inv || null });
    }
    const { data, error } = await supabaseAdmin.from('factures').select('*').eq('qr_token', token).maybeSingle();
    res.json({ valide: !!data && !error, invoice: data });
});

export default router;
