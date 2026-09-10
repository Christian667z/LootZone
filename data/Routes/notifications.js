import express from 'express';
import { supabaseAdmin, DEMO_MODE } from '../supabase.js';
import { requireAuth, requireMinRole } from '../middleware/auth.js';

const router = express.Router();

// Stockage en mémoire pour le mode démo ou les notifications créées dynamiquement
const userReadState = new Map(); // key: user_identifier -> Set of read notification ids
const customNotifications = []; // notifications poussées dynamiquement

const GAME_NEWS = [
    {
        id: 'news-fc26-season',
        type: 'games',
        title: 'EA Sports FC 26 : Nouvelle saison et packs disponibles',
        message: 'Les nouveaux packs de crédits FC 26 sont disponibles avec des bonus exclusifs pour les membres LootZone.',
        date: new Date(Date.now() - 3600000 * 5).toISOString(),
        image: 'assets/games/fc26.jpg',
        link: 'catalog.html?category=jeux'
    },
    {
        id: 'news-freefire-bonus',
        type: 'games',
        title: 'Free Fire : Bonus +10% de Diamants immédiats',
        message: 'Rechargez vos diamants Free Fire via MonCash ou Natcash et profitez de 10% de bonus crédité directement sur votre compte joueur.',
        date: new Date(Date.now() - 3600000 * 24).toISOString(),
        image: 'assets/games/freefire.jpg',
        link: 'topup.html?game=freefire'
    },
    {
        id: 'news-codm-cp',
        type: 'games',
        title: 'Call of Duty Mobile : Season Pass & Points CP',
        message: 'Le tout nouveau Season Pass de Call of Duty Mobile est désormais disponible à prix réduit sur LootZone.',
        date: new Date(Date.now() - 3600000 * 48).toISOString(),
        image: 'assets/games/codm.jpg',
        link: 'catalog.html'
    }
];

const SYSTEM_MESSAGES = [
    {
        id: 'sys-welcome',
        type: 'system',
        title: 'Bienvenue sur LootZone',
        message: 'Bienvenue sur votre plateforme premium de recharges de jeux et cartes cadeaux en Haïti et à l\'international. Notre équipe reste à votre écoute 24/7.',
        date: new Date(Date.now() - 3600000 * 72).toISOString(),
        link: 'index.html'
    },
    {
        id: 'sys-security',
        type: 'system',
        title: 'Sécurité de votre compte & transactions',
        message: 'Ne partagez jamais vos identifiants de compte ou vos reçus de transfert avec des tiers. Toutes les transactions officielles s\'effectuent directement sur LootZone.',
        date: new Date(Date.now() - 3600000 * 96).toISOString(),
        link: 'contact.html'
    }
];

// Helper pour extraire l'utilisateur courant
async function resolveUser(req) {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const queryEmail = typeof (req.query.email || req.body?.email) === 'string'
        ? (req.query.email || req.body?.email).trim().toLowerCase()
        : '';

    if (!token && !queryEmail) return null;

    if (token && token.startsWith('demo-token')) {
        return {
            id: 'demo-user',
            email: queryEmail || 'admin@lootzone.gg',
            role: 'client'
        };
    }

    if (token && supabaseAdmin && !DEMO_MODE) {
        try {
            const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
            if (!error && user) {
                return {
                    id: user.id,
                    email: user.email?.toLowerCase(),
                    role: user.user_metadata?.role || 'client'
                };
            }
        } catch (_) {}
    }

    return null;
}

/**
 * GET /api/notifications/me
 * Renvoie les notifications groupées par catégories :
 * - trade (Message de transaction)
 * - games (Actualité du nouveau jeu)
 * - system (Message système)
 * Calcule l'unread_count uniquement sur les notifications réelles non lues.
 */
router.get('/me', async (req, res) => {
    try {
        const user = await resolveUser(req);
        const userKey = user?.email || user?.id || 'guest';
        const readSet = userReadState.get(userKey) || new Set();

        const tradeNotifications = [];

        // Si l'utilisateur est identifié, charger ses commandes
        if (user && user.email) {
            let userOrders = [];

            if (DEMO_MODE || !supabaseAdmin) {
                // Charger depuis les commandes démo si pertinent
                try {
                    const { default: ordersRouter } = await import('./orders.js');
                    // On filtre les commandes correspondantes à cet email
                    // En démo, si c'est l'admin ou le compte démo, charger les commandes associées
                    userOrders = [
                        // Ne charger de commandes que si l'email correspond
                    ];
                } catch (_) {}
            } else {
                try {
                    let orderQuery = supabaseAdmin
                        .from('commandes')
                        .select('id, produit_nom, denom_label, statut, htg, eur, code_livre, created_at, updated_at')
                        .order('created_at', { ascending: false })
                        .limit(25);

                    if (user.id && user.id !== 'demo-user' && !user.id.startsWith('email-')) {
                        orderQuery = orderQuery.or(`client_email.eq.${user.email},client_id.eq.${user.id}`);
                    } else if (user.email) {
                        orderQuery = orderQuery.eq('client_email', user.email);
                    }

                    const { data } = await orderQuery;
                    if (data) userOrders = data;
                } catch (err) {
                    console.warn('[notifications] Erreur récupération commandes:', err.message);
                }

                // Vérifier également si une table 'notifications' existe dans Supabase pour ce compte
                try {
                    let notifQuery = supabaseAdmin
                        .from('notifications')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(25);

                    if (user.id && user.id !== 'demo-user' && !user.id.startsWith('email-')) {
                        notifQuery = notifQuery.or(`client_email.eq.${user.email},user_id.eq.${user.id}`);
                    } else if (user.email) {
                        notifQuery = notifQuery.eq('client_email', user.email);
                    }

                    const { data: dbNotifs } = await notifQuery;
                    if (Array.isArray(dbNotifs) && dbNotifs.length > 0) {
                        dbNotifs.forEach(dn => {
                            const notifId = dn.id ? String(dn.id) : `db-${Date.now()}`;
                            tradeNotifications.push({
                                id: notifId,
                                type: dn.type || 'trade',
                                title: dn.title || dn.titre || 'Notification de compte',
                                message: dn.message || dn.description || '',
                                status: dn.status || dn.statut || 'info',
                                status_label: dn.status_label || 'Compte',
                                amount: dn.amount || null,
                                code_livre: dn.code_livre || null,
                                date: dn.created_at || new Date().toISOString(),
                                read: dn.read === true || readSet.has(notifId),
                                link: dn.link || 'messages.html'
                            });
                        });
                    }
                } catch (_) {
                    // Silencieux si la table notifications n'est pas encore dans le schéma
                }
            }

            // Générer les notifications de transaction à partir des commandes réelles
            userOrders.forEach(o => {
                let title = `Commande #${o.id}`;
                let desc = `${o.produit_nom || 'Produit'} (${o.denom_label || ''})`;
                let statusLabel = 'En attente';

                if (o.statut === 'livree') {
                    title = `Commande #${o.id} livrée avec succès !`;
                    statusLabel = 'Livrée';
                    if (o.code_livre) {
                        desc += ` - Code : ${o.code_livre}`;
                    }
                } else if (o.statut === 'en_cours') {
                    title = `Commande #${o.id} en cours de traitement`;
                    statusLabel = 'En cours';
                } else if (o.statut === 'annulee') {
                    title = `Commande #${o.id} annulée`;
                    statusLabel = 'Annulée';
                }

                const notifId = `order-${o.id}-${o.statut}`;
                tradeNotifications.push({
                    id: notifId,
                    type: 'trade',
                    order_id: o.id,
                    title,
                    message: desc,
                    status: o.statut,
                    status_label: statusLabel,
                    amount: o.htg ? `${o.htg} HTG` : `${o.eur || 0} $`,
                    code_livre: o.code_livre || null,
                    date: o.updated_at || o.created_at,
                    read: readSet.has(notifId),
                    link: 'profile.html#commandes'
                });
            });

            // Ajouter les notifications custom ciblées pour cet utilisateur
            customNotifications
                .filter(n => !n.target_email || n.target_email === user.email)
                .forEach(n => {
                    tradeNotifications.unshift({
                        ...n,
                        read: readSet.has(n.id)
                    });
                });
        }

        // News & System notifications
        const gamesList = GAME_NEWS.map(n => ({
            ...n,
            read: readSet.has(n.id)
        }));

        const systemList = SYSTEM_MESSAGES.map(n => ({
            ...n,
            read: readSet.has(n.id)
        }));

        // Calcul du nombre de vraies notifications non lues
        // Important: pour un visiteur ou nouvel utilisateur sans commande réelle,
        // tradeNotifications est vide et unread_count de transaction est 0 !
        // Le point rouge ne doit clignoter que lorsqu'il y a une VRAIE notification non lue (notamment transactionnelle)
        const unreadTradeCount = tradeNotifications.filter(n => !n.read).length;
        const unreadGamesCount = gamesList.filter(n => !n.read).length;
        const unreadSystemCount = systemList.filter(n => !n.read).length;

        // La pastille rouge du header doit refléter les vraies notifications (commandes, recharges, messages importants)
        // Si l'utilisateur n'a aucune commande / notification de transaction, unreadCount reste 0
        const totalUnreadCount = unreadTradeCount;

        res.json({
            success: true,
            user_key: userKey,
            has_real_notifications: tradeNotifications.length > 0,
            unread_count: totalUnreadCount,
            unread_breakdown: {
                trade: unreadTradeCount,
                games: unreadGamesCount,
                system: unreadSystemCount
            },
            data: {
                trade: tradeNotifications,
                games: gamesList,
                system: systemList
            }
        });
    } catch (err) {
        console.error('[notifications] Erreur GET /me:', err);
        res.status(500).json({ error: 'Erreur serveur lors de la récupération des notifications' });
    }
});

/**
 * POST /api/notifications/mark-read
 * Marque une ou toutes les notifications comme lues
 */
router.post('/mark-read', async (req, res) => {
    try {
        const user = await resolveUser(req);
        const userKey = user?.email || user?.id || 'guest';
        const { id, all, ids } = req.body;

        let readSet = userReadState.get(userKey);
        if (!readSet) {
            readSet = new Set();
            userReadState.set(userKey, readSet);
        }

        if (all) {
            // Marquer tous les IDs connus comme lus
            if (Array.isArray(ids)) {
                ids.forEach(i => readSet.add(i));
            }
            customNotifications.filter(r => !r.target_email || r.target_email === userKey).forEach(r => readSet.add(r.id));
            GAME_NEWS.forEach(n => readSet.add(n.id));
            SYSTEM_MESSAGES.forEach(n => readSet.add(n.id));
        } else if (id) {
            readSet.add(id);
        } else if (Array.isArray(ids)) {
            ids.forEach(i => readSet.add(i));
        }

        res.json({ success: true, marked_count: readSet.size });
    } catch (err) {
        console.error('[notifications] Erreur mark-read:', err);
        res.status(500).json({ error: 'Impossible de mettre à jour le statut' });
    }
});

/**
 * POST /api/notifications/create-real
 * Permet de déclencher une vraie notification (ex: lors d'une commande ou pour tester)
 */
router.post('/create-real', requireAuth, requireMinRole('employe'), async (req, res) => {
    try {
        const { target_email, title, message, status, amount, code_livre } = req.body;
        const newNotif = {
            id: 'real-notif-' + Date.now(),
            type: 'trade',
            target_email: (target_email || '').toLowerCase().trim(),
            title: title || 'Nouvelle notification LootZone',
            message: message || 'Mise à jour de votre transaction en cours.',
            status: status || 'livree',
            status_label: status === 'livree' ? 'Livrée' : 'En cours',
            amount: amount || '1500 HTG',
            code_livre: code_livre || null,
            date: new Date().toISOString(),
            read: false,
            link: 'profile.html#commandes'
        };

        customNotifications.unshift(newNotif);

        res.json({ success: true, notification: newNotif });
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors de la création de la notification' });
    }
});

export default router;
