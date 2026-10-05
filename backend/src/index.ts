import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './config/db';
import secretariatRoutes from './routes/secretariat.routes';
import gestionnaireRoutes from './routes/gestionnaire.routes';
import titulaireRoutes from './routes/titulaire.routes';
import communicationRoutes from './routes/communication.routes';
import { dateFormatter } from './middlewares/dateFormatter';
import { startAutorisationsCron, rebloquerAutorisationsExpireesGlobal } from './services/autorisationsCron.service';

dotenv.config();

const app = express();
const port = process.env.PORT || 3007;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(dateFormatter);

import suggestionsRoutes from './routes/suggestions.routes';
app.use('/api/suggestions', suggestionsRoutes);
app.use('/api/secretariat', secretariatRoutes);
app.use('/api/communication', communicationRoutes);

import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/gestionnaire', gestionnaireRoutes);
app.use('/api/titulaire', titulaireRoutes);

app.get('/api/health', async (req: any, res: any) => {
    try {
        const [rows] = await db.query('SELECT 1');
        res.json({ status: 'ok', database: 'connected' });
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({ status: 'error', message: 'Database connection failed' });
    }
});

const server = app.listen(port, async () => {
    console.log(`✅ Serveur démarré sur le port ${port}`);

    // 🔥 Vérification IMMÉDIATE au démarrage (rattrapage après redémarrage)
    try {
        console.log('🔍 [BOOT] Vérification des autorisations expirées...');
        const nb = await rebloquerAutorisationsExpireesGlobal();
        console.log(`🔒 [BOOT] ${nb} autorisation(s) rebloquée(s) au démarrage.`);
    } catch (error) {
        console.error('❌ [BOOT] Erreur:', error);
    }

    // 🚀 Démarre le cron toutes les 45 min
    startAutorisationsCron(45);
});

process.on('SIGTERM', () => {
    console.log('🛑 Arrêt du serveur...');
    server.close(() => process.exit(0));
});