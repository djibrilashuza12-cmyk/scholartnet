import { Router } from 'express';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware';
import {
    getGestionnaireDashboard,
    listTypesFrais,
    createTypeFrais,
    updateTypeFrais,
    deleteTypeFrais,
    listFraisParPeriode,
    createFraisParPeriode,
    deleteFraisParPeriode,
    saveFraisParPeriodes,
    searchEleves,
    getDetailElevePaiement,
    createPaiement,
    listPaiements,
    annulerPaiement,
    getRecuData,
    listImpayes,
    listStocks,
    createStock,
    updateStock,
    deleteStock,
    getMouvementsStock,
    getRapportJournalier,
    getRapportMensuel,
    listPeriodes,
    createPeriode,
    updatePeriode,
    createAutorisationTemporaire,
    deletePeriode,
    listAutorisations,
    createAutorisation,
    updateAutorisation,
    getAutorisationsByEleve,
} from '../controllers/gestionnaire.controller';

const router = Router();

// Toutes les routes du gestionnaire sont protégées
router.use(authenticateToken);
router.use(requireRole(['GESTIONNAIRE', 'ADMIN']));

// Dashboard
router.get('/dashboard', getGestionnaireDashboard);

// Types de frais
router.get('/frais', listTypesFrais);
router.post('/frais', createTypeFrais);
router.put('/frais/:id', updateTypeFrais);
router.delete('/frais/:id', deleteTypeFrais);

// Frais par période
router.get('/frais-par-periode', listFraisParPeriode);
router.post('/frais-par-periode', createFraisParPeriode);
router.delete('/frais-par-periode/:id', deleteFraisParPeriode);
router.post('/frais-par-periodes/batch', saveFraisParPeriodes);

// Recherche
router.get('/search/eleves', searchEleves);

// Paiements
router.get('/paiements', listPaiements);
router.post('/paiements', createPaiement);
router.put('/paiements/:id/annuler', annulerPaiement);
router.get('/paiements/recu/:id', getRecuData);
router.get('/eleves/:eleveId/paiements', getDetailElevePaiement);

// Impayés
router.get('/impayes', listImpayes);

// Stocks
router.get('/stocks', listStocks);
router.post('/stocks', createStock);
router.put('/stocks/:id', updateStock);
router.delete('/stocks/:id', deleteStock);
router.get('/stocks/:id/mouvements', getMouvementsStock);

// Rapports
router.get('/rapports/journalier', getRapportJournalier);
router.get('/rapports/mensuel', getRapportMensuel);

// Périodes
router.get('/periodes', listPeriodes);
router.post('/periodes', createPeriode);
router.put('/periodes/:id', updatePeriode);
router.delete('/periodes/:id', deletePeriode);

// Autorisations
router.get('/autorisations', listAutorisations);
router.post('/autorisations', createAutorisation);
router.post('/autorisations/temporaire', createAutorisationTemporaire);
router.put('/autorisations/:id', updateAutorisation);
router.get('/eleves/:eleveId/autorisations', getAutorisationsByEleve);

export default router;