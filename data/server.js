import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

import authRoutes from './Routes/auth.js';
import productsRoutes from './Routes/products.js';
import ordersRoutes from './Routes/orders.js';
import staffRoutes from './Routes/staff.js';
import configRoutes from './Routes/config.js';
import partnershipsRoutes from './Routes/partnerships.js';
import logsRoutes from './Routes/logs.js';
import stockRoutes from './Routes/stock.js';
import invoicesRoutes from './Routes/invoices.js';
import walletRoutes from './Routes/wallet.js';
import couponsRoutes from './Routes/coupons.js';
import blogsRoutes from './Routes/blogs.js';
import notificationsRoutes from './Routes/notifications.js';
import { startRealtime, registerSSEClient, registerClientSSE } from './Routes/realtime.js';
import { checkSupabaseConnection, DEMO_MODE, supabaseAdmin } from './supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');

const app = express();
app.set('trust proxy', 1);
const PORT = 3000;

// ─── ORIGINES AUTORISÉES ────────────────────────────────────────────────────
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [
        `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`,
        process.env.FRONTEND_URL,
        'http://localhost:3000',
        'http://localhost:5000'
    ].filter(Boolean);

// ─── SÉCURITÉ ───────────────────────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    frameguard: false
}));

app.use(cors({
    origin: (origin, callback) => {
        // Requêtes sans origin (Postman, server-to-server, same-origin) → ok
        if (!origin) return callback(null, true);
        const allowed =
            origin.startsWith('http://localhost:') ||
            origin.startsWith('http://127.0.0.1:') ||
            origin.endsWith('.replit.dev') ||
            origin.endsWith('.repl.co') ||
            origin.endsWith('.replit.app') ||
            origin.endsWith('.run.app') ||
            ALLOWED_ORIGINS.includes(origin);
        if (allowed) return callback(null, true);
        // ⚠️ Origine non autorisée — on rejette proprement
        return callback(new Error(`CORS: Origine non autorisée — ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── RATE LIMITING ───────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Trop de requêtes, réessayez dans 15 minutes.' }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' }
});

const orderPublicLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Trop de commandes envoyées. Réessayez dans 10 minutes.' }
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Trop de tentatives d\'inscription. Réessayez dans 1 heure.' }
});

app.use('/api', apiLimiter);
app.use('/api/auth/admin-login', loginLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/orders/public', orderPublicLimiter);

// ─── ROUTES API ──────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/config', configRoutes);
app.use('/api/partnerships', partnershipsRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/coupons', couponsRoutes);
app.use('/api/blogs', blogsRoutes);
app.use('/api/notifications', notificationsRoutes);

// ─── SSE CLIENT PUBLIC (notifications commande) ───────────────────────────────
app.get('/api/events/client', async (req, res) => {
    const email = req.query.email;
    const token = req.query.token || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!email || typeof email !== 'string') return res.status(400).json({ error: 'Email manquant' });
    if (!token) return res.status(401).json({ error: 'Token manquant' });

    const normalizedEmail = email.trim().toLowerCase();
    if (DEMO_MODE) {
        if (!token.startsWith('demo-token-')) return res.status(401).json({ error: 'Token invalide' });
    } else {
        try {
            const { data, error } = await supabaseAdmin?.auth.getUser(token) || {};
            if (error || !data?.user || data.user.email?.toLowerCase() !== normalizedEmail) {
                return res.status(401).json({ error: 'Session invalide' });
            }
        } catch (_) {
            return res.status(401).json({ error: 'Session invalide' });
        }
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write(`event: connected\ndata: {"status":"ok"}\n\n`);

    const keepAlive = setInterval(() => {
        try { res.write(': ping\n\n'); } catch (_) { clearInterval(keepAlive); }
    }, 25000);
    req.on('close', () => clearInterval(keepAlive));
    registerClientSSE(normalizedEmail, res);
});

// ─── SSE (Server-Sent Events) ─────────────────────────────────────────────────
app.get('/api/events', (req, res) => {
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    if (!token || (DEMO_MODE && !token.startsWith('demo-token-'))) return res.status(401).json({ error: 'Token manquant ou invalide' });
    if (DEMO_MODE && token !== 'demo-token-lootzone-admin') {
        return res.status(403).json({ error: 'Accès réservé au staff' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(`event: connected\ndata: {"status":"ok"}\n\n`);

    const keepAlive = setInterval(() => {
        try { res.write(': ping\n\n'); }
        catch (_) { clearInterval(keepAlive); }
    }, 25000);

    req.on('close', () => clearInterval(keepAlive));
    registerSSEClient(res);
});

// ─── SANTÉ ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '2.1.0',
        mode: DEMO_MODE ? 'demo' : 'production',
        timestamp: new Date().toISOString()
    });
});

// ─── FICHIERS STATIQUES ───────────────────────────────────────────────────────
app.use(express.static(ROOT_DIR, { extensions: ['html'], maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));
app.use(express.static(path.join(ROOT_DIR, 'Dashboard'), { extensions: ['html'], maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));

app.get('/admin-login', (req, res) => res.sendFile(path.join(ROOT_DIR, 'Dashboard', 'admin-login.html')));
app.get('/admin-login.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'Dashboard', 'admin-login.html')));
app.get('/admin/admin-login.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'Dashboard', 'admin-login.html')));
app.get('/admin/login', (req, res) => res.sendFile(path.join(ROOT_DIR, 'Dashboard', 'admin-login.html')));
app.get('/login', (req, res) => res.sendFile(path.join(ROOT_DIR, 'Dashboard', 'admin-login.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'Dashboard', 'admin-login.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(ROOT_DIR, 'Dashboard', 'dashboard.html')));
app.get('/admin/dashboard', (req, res) => res.sendFile(path.join(ROOT_DIR, 'Dashboard', 'dashboard.html')));
app.get('/admin/dashboard.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'Dashboard', 'dashboard.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(ROOT_DIR, 'Dashboard', 'dashboard.html')));
app.get('/dashboard.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'Dashboard', 'dashboard.html')));
app.get('/verify/:token', (req, res) => res.sendFile(path.join(ROOT_DIR, 'verify.html')));
app.get('/topup', (req, res) => res.sendFile(path.join(ROOT_DIR, 'topup.html')));
app.get('/payment', (req, res) => res.sendFile(path.join(ROOT_DIR, 'payment.html')));
app.get('/payment.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'payment.html')));

app.get('/*splat', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Route API introuvable' });
    if (path.extname(req.path)) return res.status(404).send('Not found');
    res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

// ─── GESTION DES ERREURS ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: 'JSON invalide dans la requête' });
    }
    if (err.message?.startsWith('CORS')) {
        return res.status(403).json({ error: err.message });
    }
    console.error('[Erreur]', err.stack);
    res.status(500).json({ error: 'Erreur interne du serveur' });
});

// ─── DÉMARRAGE ────────────────────────────────────────────────────────────────
const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`\n╔══════════════════════════════════════════════════╗`);
    console.log(`║   🟢 LOOTZONE Backend v2.1 — Port ${PORT}         ║`);
        console.log(`║   Mode: ${DEMO_MODE ? 'Démo (sans Supabase)     ' : 'Production (Supabase)     '}    ║`);
    console.log(`╚══════════════════════════════════════════════════╝\n`);

    await checkSupabaseConnection();
    startRealtime();
});

server.on('error', (err) => {
    console.error(`[Serveur] Impossible de démarrer sur le port ${PORT}:`, err.message);
    process.exitCode = 1;
});

function shutdown(signal) {
    console.log(`[Serveur] Arrêt demandé (${signal})`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

export default app;
