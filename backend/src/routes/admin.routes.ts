import { Router } from 'express';
import { getDashboardStats } from '../controllers/admin.controller';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware';
import { openSchoolYear, getActiveSchoolYear } from '../controllers/admin.annees.controller';
import { listUsers, createUser, updateUser, deleteUser, resendUserInvite } from '../controllers/admin.users.controller';
import { searchUserProfile, getArchivedEleves, getArchivedBulletinData } from '../controllers/admin.search.controller';


const router = Router();

router.use(authenticateToken);
router.use(requireRole(['ADMIN']));

router.get('/stats', getDashboardStats);

router.get('/annee-scolaire/active', getActiveSchoolYear);
router.post('/annee-scolaire', openSchoolYear);

router.get('/users', listUsers);
router.post('/users', createUser);
router.post('/users/:id/resend-invite', resendUserInvite);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

router.get('/users/search', searchUserProfile);

// Archives historiques (Recherche et Bulletins)
router.get('/archives/eleves', getArchivedEleves);
router.get('/archives/bulletin/:inscriptionId', getArchivedBulletinData);

export default router;


