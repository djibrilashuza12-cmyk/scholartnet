import { Router } from 'express';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware';
import {
    getSecretariatStats,
    listEleves,
    createEleve,
    updateEleve,
    deleteEleve,
    listClasses,
    getClasseDetails,
    createClasse,
    updateClasse,
    deleteClasse,
    inscrireEleve,
    listInscriptions,
    deleteInscription,
    listAnneesScolaires,
    archiverAnnee,
    listElevesByClasse,
    exportElevesCSV,
    exportElevesExcel,
    generateAttestation,
    getTitulaires,
    getElevesNonInscrits
} from '../controllers/secretariat.controller';

const router = Router();

// Toutes les routes du secrétariat sont protégées
router.use(authenticateToken);
router.use(requireRole(['SECRETAIRE', 'ADMIN']));

// Statistiques et dashboard
router.get('/stats', getSecretariatStats);

// Élèves - CRUD
router.get('/eleves', listEleves);
router.post('/eleves', createEleve);
router.put('/eleves/:id', updateEleve);
router.delete('/eleves/:id', deleteEleve);

// Classes - CRUD
router.get('/classes', listClasses);
router.get('/classes/:id', getClasseDetails);
router.post('/classes', createClasse);
router.put('/classes/:id', updateClasse);
router.delete('/classes/:id', deleteClasse);

// Inscriptions
router.post('/inscriptions', inscrireEleve);
router.get('/inscriptions', listInscriptions);
router.delete('/inscriptions/:id', deleteInscription);
router.get('/eleves-non-inscrits', getElevesNonInscrits);

// Années scolaires et archivage
router.get('/annees', listAnneesScolaires);
router.put('/annees/:id/archiver', archiverAnnee);

// Listes et exports
router.get('/classes/:classeId/eleves', listElevesByClasse);
router.get('/classes/:classeId/export/csv', exportElevesCSV);
router.get('/classes/:classeId/export/excel', exportElevesExcel);

// Attestations PDF
router.get('/eleves/:eleveId/attestation', generateAttestation);

// Titulaires
router.get('/titulaires', getTitulaires);

export default router;