import { Router } from 'express';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware';
import {
    startWhatsAppCampaign,
    getWhatsAppCampaignStatus,
    getSchoolInfo
} from '../controllers/communication.controller';

const router = Router();

// Toutes les routes de communication sont protégées pour Secrétariat et Administration
router.use(authenticateToken);
router.use(requireRole(['SECRETAIRE', 'ADMIN']));

// Envoi de campagnes WhatsApp
router.post('/whatsapp/campaign', startWhatsAppCampaign);
router.get('/whatsapp/campaign/:jobId', getWhatsAppCampaignStatus);

// Informations de l'école pour l'aperçu du message
router.get('/school-info', getSchoolInfo);

export default router;
