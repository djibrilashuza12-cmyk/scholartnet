import { Router } from 'express';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware';
import {
    getTitulaireDashboard,
    getClassesByTitulaire,
    getElevesByClasse,
    getCoursByClasse,
    createCours,
    updateCours,
    deleteCours,
    getNotesByEleve,
    createNote,
    updateNote,
    deleteNote,
    getAppreciationsByEleve,
    createAppreciation,
    updateAppreciation,
    getPresencesByEleve,
    createPresence,
    updatePresence,
    getBulletinData,
    publierBulletin,
    getResultatsPublics,
    bulkSaveNotes,
    getPeriodesByClasse,
    getClassementClasse,
    generateBulletinPDF
} from '../controllers/titulaire.controller';

const router = Router();

// ✅ ROUTES PUBLIQUES (SANS AUTHENTIFICATION) - DOIVENT ÊTRE AVANT LE MIDDLEWARE
// ============================================
router.get('/public/resultats/:matricule', getResultatsPublics);
// ============================================

// Toutes les autres routes du titulaire sont protégées
router.use(authenticateToken);
router.use(requireRole(['TITULAIRE', 'ADMIN']));

// Dashboard
router.get('/dashboard', getTitulaireDashboard);

// Classes du titulaire
router.get('/classes', getClassesByTitulaire);

// Élèves par classe
router.get('/classes/:classeId/eleves', getElevesByClasse);

// Cours par classe
router.get('/classes/:classeId/cours', getCoursByClasse);

// Gestion des cours (CRUD)
router.post('/classes/:classeId/cours', createCours);
router.put('/cours/:coursId', updateCours);
router.delete('/cours/:coursId', deleteCours);

// Périodes par classe
router.get('/classes/:classeId/periodes', getPeriodesByClasse);

// Notes
router.get('/eleves/:eleveId/notes', getNotesByEleve);
router.post('/eleves/:eleveId/notes', createNote);
router.put('/notes/:noteId', updateNote);
router.delete('/notes/:noteId', deleteNote);
router.post('/eleves/:eleveId/notes/bulk', bulkSaveNotes);

// Appréciations
router.get('/eleves/:eleveId/appreciations', getAppreciationsByEleve);
router.post('/eleves/:eleveId/appreciations', createAppreciation);
router.put('/appreciations/:appreciationId', updateAppreciation);

// Présences/Absences
router.get('/eleves/:eleveId/presences', getPresencesByEleve);
router.post('/eleves/:eleveId/presences', createPresence);
router.put('/presences/:presenceId', updatePresence);

// Bulletin
router.get('/bulletin/:eleveId', getBulletinData);
router.post('/bulletin/:eleveId/publier', publierBulletin);
router.post('/bulletin/:eleveId/pdf', generateBulletinPDF);

// Statistiques - Classement (avec pourcentage)
router.get('/classes/:classeId/classement', getClassementClasse);

export default router;