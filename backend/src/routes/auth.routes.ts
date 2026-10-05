import { Router } from 'express';
import {
    register,
    verifyCode,
    resendCode,
    login,
    verifyResetToken,
    setPassword,
    registerEcole,
    loginEcole,
    registerAdmin,
    loginUser,
    verifyGoogleIdentity,
    verifyPasswordSetupToken,
    getGoogleConfig  
} from '../controllers/auth.controller';

const router = Router();

// ==========================================
// NOUVEAU SYSTÈME D'AUTHENTIFICATION & ONBOARDING
// ==========================================

// 1. Inscription École + Admin (Étapes 1 et 2 du Wizard)
router.post('/register', register);

// 2. Validation du Code de vérification à 6 chiffres (Étape 3 du Wizard)
router.post('/verify-code', verifyCode);

// 3. Renvoi d'un nouveau code de vérification (après expiration 3 min)
router.post('/resend-code', resendCode);

// 4. Vérification du jeton d'activation / réinitialisation de mot de passe (1 mois)
router.get('/verify-reset-token', verifyResetToken);

// 5. Définition / Renouvellement du mot de passe (expiration immédiate du lien)
router.post('/set-password', setPassword);

// 6. Connexion standard via Email + Mot de passe (Support Multi-Écoles & Token 7 jours)
router.post('/login', login);

router.post('/verify-google-identity', verifyGoogleIdentity);
router.get('/verify-password-token', verifyPasswordSetupToken);
router.get('/google-config', getGoogleConfig);

// ==========================================
// ROUTES DE COMPATIBILITÉ
// ==========================================
router.post('/ecole/register', registerEcole);
router.post('/ecole/login', loginEcole);
router.post('/admin/register', registerAdmin);
router.post('/user/login', loginUser);

export default router;
