import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import db from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { Utilisateur } from '../models/db.schema';
import { generateMatriculeFormatXxx000000Xxx00 } from '../utils/matricule';
import MailService from '../services/mail.service';
import { AuthService } from '../services/auth.service';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_pour_scolarnet_production_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// ✅ FONCTION HELPER POUR GÉNÉRER LES TOKENS JWT
const generateToken = (payload: { id: number; ecole_id: number; role: string }) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
};

/**
 * Masque une adresse email pour préserver la sécurité et la confidentialité
 * Ex: djibrilashuza12@gmail.com -> dj********12@gmail.com
 */
function maskEmail(email: string): string {
    if (!email || !email.includes('@')) return email;
    const [name, domain] = email.split('@');
    if (name.length <= 4) {
        return `${name[0]}***@${domain}`;
    }
    const start = name.slice(0, 2);
    const end = name.slice(-2);
    const middleMask = '*'.repeat(Math.max(4, Math.min(8, name.length - 4)));
    return `${start}${middleMask}${end}@${domain}`;
}

/**
 * 1. Inscription complète École + Administrateur (Wizard Étapes 1 & 2)
 */
export const register = async (req: Request, res: Response): Promise<void> => {
    const {
        code_epst,
        nom_ecole,
        adresse,
        bp,
        telephone,
        email_ecole,
        nom,
        prenom,
        email,
        mot_de_passe
    } = req.body;

    if (!code_epst || !String(code_epst).trim()) {
        res.status(400).json({ message: 'Le Code EPST de l\'école est obligatoire.' });
        return;
    }
    if (!nom_ecole || !String(nom_ecole).trim()) {
        res.status(400).json({ message: 'Le Nom de l\'établissement est obligatoire.' });
        return;
    }
    if (!nom || !String(nom).trim()) {
        res.status(400).json({ message: 'Le Nom de l\'administrateur est obligatoire.' });
        return;
    }
    if (!prenom || !String(prenom).trim()) {
        res.status(400).json({ message: 'Le Prénom de l\'administrateur est obligatoire.' });
        return;
    }
    if (!email || !String(email).trim()) {
        res.status(400).json({ message: 'L\'adresse Email est obligatoire pour créer le compte.' });
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = String(email).trim().toLowerCase();
    if (!emailRegex.test(cleanEmail)) {
        res.status(400).json({ message: 'Veuillez saisir une adresse email valide.' });
        return;
    }

    if (!mot_de_passe || String(mot_de_passe).length < 6) {
        res.status(400).json({ message: 'Le mot de passe doit comporter au moins 6 caractères.' });
        return;
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Vérifier si le code EPST existe déjà
        const [existingSchool] = await connection.query<RowDataPacket[]>(
            'SELECT id FROM ecoles WHERE code_epst = ?',
            [String(code_epst).trim()]
        );
        if (existingSchool.length > 0) {
            await connection.rollback();
            res.status(400).json({ message: 'Ce Code EPST est déjà enregistré pour un autre établissement.' });
            return;
        }

        // 2. Création de l'établissement (SANS mot de passe école)
        const [schoolResult] = await connection.query<ResultSetHeader>(
            'INSERT INTO ecoles (code_epst, nom, adresse, bp, telephone, email) VALUES (?, ?, ?, ?, ?, ?)',
            [
                String(code_epst).trim(),
                String(nom_ecole).trim(),
                adresse ? String(adresse).trim() : null,
                bp ? String(bp).trim() : null,
                telephone ? String(telephone).trim() : null,
                email_ecole ? String(email_ecole).trim() : null
            ]
        );
        const ecoleId = schoolResult.insertId;

        // 3. Vérifier si l'utilisateur existe déjà dans CETTE école
        const [existingUsers] = await connection.query<RowDataPacket[]>(
            'SELECT id, is_verified FROM utilisateurs WHERE ecole_id = ? AND LOWER(email) = ?',
            [ecoleId, cleanEmail]
        );

        if (existingUsers.length > 0 && existingUsers[0].is_verified) {
            await connection.rollback();
            res.status(400).json({ message: 'Cet email est déjà actif pour cet établissement.' });
            return;
        }

        // 4. Générer un code OTP 6 chiffres valide 3 minutes
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const verificationExpiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes
        const hashedAdminPwd = await bcrypt.hash(mot_de_passe, 10);

        let matricule = '';
        for (let i = 0; i < 15; i++) {
            const candidate = generateMatriculeFormatXxx000000Xxx00();
            const [rows] = await connection.query<RowDataPacket[]>(
                'SELECT id FROM utilisateurs WHERE matricule = ? LIMIT 1',
                [candidate]
            );
            if (rows.length === 0) {
                matricule = candidate;
                break;
            }
        }
        if (!matricule) {
            matricule = `ADM-${Date.now().toString().slice(-6)}`;
        }

        // 5. Création du compte Administrateur
        await connection.query<ResultSetHeader>(
            `INSERT INTO utilisateurs 
                (ecole_id, nom, prenom, email, mot_de_passe, role, is_active, is_verified, verification_code, verification_expires_at, matricule, identifiant)
             VALUES (?, ?, ?, ?, ?, 'ADMIN', 1, 0, ?, ?, ?, ?)`,
            [
                ecoleId,
                nom.trim(),
                prenom.trim(),
                cleanEmail,
                hashedAdminPwd,
                verificationCode,
                verificationExpiresAt,
                matricule,
                cleanEmail
            ]
        );

        await connection.commit();

        // 6. Envoi de l'email avec le code à 6 chiffres
        await MailService.sendOtpEmail({
            to: cleanEmail,
            code: verificationCode,
            nomDestinataire: `${prenom} ${nom}`,
            nomEcole: nom_ecole
        });

        // 7. Récupérer l'utilisateur créé pour générer un token
        const [newUser] = await connection.query<RowDataPacket[]>(
            `SELECT u.id, u.nom, u.prenom, u.email, u.role, u.ecole_id, e.nom as nom_ecole 
             FROM utilisateurs u 
             JOIN ecoles e ON u.ecole_id = e.id 
             WHERE u.email = ? AND u.ecole_id = ?`,
            [cleanEmail, ecoleId]
        );

        // 8. Générer un token JWT pour l'utilisateur
        const authToken = generateToken({
            id: newUser[0].id,
            ecole_id: newUser[0].ecole_id,
            role: newUser[0].role
        });

        // 9. Retourner la réponse avec le token et les infos utilisateur
        res.status(201).json({
            message: 'Établissement et compte administrateur créés avec succès. Un code de vérification à 6 chiffres a été envoyé à votre adresse email.',
            email: cleanEmail,
            expiresInSeconds: 180,
            token: authToken,
            user: {
                id: newUser[0].id,
                nom: newUser[0].nom,
                prenom: newUser[0].prenom,
                email: newUser[0].email,
                role: newUser[0].role,
                ecole_id: newUser[0].ecole_id,
                nom_ecole: newUser[0].nom_ecole
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('[Register Error]', error);
        res.status(500).json({ message: 'Une erreur est survenue lors de l\'enregistrement.' });
    } finally {
        connection.release();
    }
};

/**
 * 2. Validation du code OTP à 6 chiffres (durée 3 min)
 */
export const verifyCode = async (req: Request, res: Response): Promise<void> => {
    const { email, code } = req.body;

    if (!email || !String(email).trim()) {
        res.status(400).json({ message: 'Adresse email requise.' });
        return;
    }
    if (!code || !String(code).trim()) {
        res.status(400).json({ message: 'Veuillez saisir le code à 6 chiffres.' });
        return;
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanCode = String(code).trim();

    try {
        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT u.*, e.nom as nom_ecole 
             FROM utilisateurs u 
             JOIN ecoles e ON u.ecole_id = e.id 
             WHERE LOWER(u.email) = ? 
             ORDER BY u.created_at DESC`,
            [cleanEmail]
        );

        if (rows.length === 0) {
            res.status(404).json({ message: 'Aucun compte trouvé avec cette adresse email.' });
            return;
        }

        const user = rows[0];

        if (user.verification_code !== cleanCode) {
            res.status(400).json({ message: 'Code de vérification incorrect. Veuillez vérifier les 6 chiffres saisis.' });
            return;
        }

        if (!user.verification_expires_at || new Date() > new Date(user.verification_expires_at)) {
            res.status(400).json({
                message: 'Le code de vérification a expiré (délai de 3 minutes dépassé). Veuillez demander un nouveau code.',
                expired: true
            });
            return;
        }

        await db.query(
            'UPDATE utilisateurs SET is_verified = TRUE, verification_code = NULL, verification_expires_at = NULL WHERE id = ?',
            [user.id]
        );

        const token = generateToken({
            id: user.id,
            ecole_id: user.ecole_id,
            role: user.role
        });

        res.json({
            message: 'Compte validé avec succès ! Redirection vers le tableau de bord...',
            token,
            user: {
                id: user.id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                role: user.role,
                ecole_id: user.ecole_id,
                nom_ecole: user.nom_ecole
            }
        });

    } catch (error) {
        console.error('[Verify Code Error]', error);
        res.status(500).json({ message: 'Erreur lors de la vérification du code.' });
    }
};

/**
 * 3. Renvoi d'un nouveau code OTP (après 3 min)
 */
export const resendCode = async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;
    if (!email || !String(email).trim()) {
        res.status(400).json({ message: 'Adresse email requise.' });
        return;
    }

    const cleanEmail = String(email).trim().toLowerCase();

    try {
        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT u.*, e.nom as nom_ecole 
             FROM utilisateurs u 
             JOIN ecoles e ON u.ecole_id = e.id 
             WHERE LOWER(u.email) = ? 
             ORDER BY u.created_at DESC`,
            [cleanEmail]
        );

        if (rows.length === 0) {
            res.status(404).json({ message: 'Aucun compte trouvé avec cette adresse email.' });
            return;
        }

        const user = rows[0];

        if (user.is_verified) {
            res.status(400).json({ message: 'Ce compte est déjà vérifié. Vous pouvez vous connecter directement.' });
            return;
        }

        const newCode = Math.floor(100000 + Math.random() * 900000).toString();
        const newExpiresAt = new Date(Date.now() + 3 * 60 * 1000);

        await db.query(
            'UPDATE utilisateurs SET verification_code = ?, verification_expires_at = ? WHERE id = ?',
            [newCode, newExpiresAt, user.id]
        );

        await MailService.sendOtpEmail({
            to: cleanEmail,
            code: newCode,
            nomDestinataire: `${user.prenom} ${user.nom}`,
            nomEcole: user.nom_ecole
        });

        res.json({
            message: 'Un nouveau code de vérification a été envoyé à votre adresse email.',
            email: cleanEmail,
            expiresInSeconds: 180
        });

    } catch (error) {
        console.error('[Resend Code Error]', error);
        res.status(500).json({ message: 'Erreur lors du renvoi du code.' });
    }
};

/**
 * 4. Vérification d'un jeton d'activation / réinitialisation de mot de passe (valable 1 mois)
 * Renvoie l'email masqué (ex: dj********12@gmail.com) pour sécuriser l'affichage
 */
export const verifyResetToken = async (req: Request, res: Response): Promise<void> => {
    const token = String(req.query?.token || '');
    const email = String(req.query?.email || '').trim().toLowerCase();

    if (!token) {
        res.status(400).json({ valid: false, message: 'Jeton manquant ou lien invalide.' });
        return;
    }

    try {
        let query = `
            SELECT u.id, u.nom, u.prenom, u.email, u.role, u.reset_expires_at, e.nom as nom_ecole 
            FROM utilisateurs u 
            JOIN ecoles e ON u.ecole_id = e.id 
            WHERE u.reset_token = ?
        `;
        const params: any[] = [token];

        if (email) {
            query += ' AND LOWER(u.email) = ?';
            params.push(email);
        }

        const [rows] = await db.query<RowDataPacket[]>(query, params);

        if (rows.length === 0) {
            res.status(404).json({
                valid: false,
                message: 'Ce lien d\'activation est invalide ou a déjà été utilisé.'
            });
            return;
        }

        const user = rows[0];

        // Vérifier si le lien a dépassé sa validité de 1 mois
        if (!user.reset_expires_at || new Date() > new Date(user.reset_expires_at)) {
            res.status(400).json({
                valid: false,
                message: 'Ce lien a expiré (validité de 1 mois dépassée). Veuillez contacter votre administrateur pour recevoir un nouveau lien.'
            });
            return;
        }

        res.json({
            valid: true,
            email: user.email,
            maskedEmail: maskEmail(user.email),
            nomComplet: `${user.prenom} ${user.nom}`,
            nomEcole: user.nom_ecole,
            role: user.role
        });

    } catch (error) {
        console.error('[Verify Reset Token Error]', error);
        res.status(500).json({ valid: false, message: 'Erreur lors de la vérification du lien.' });
    }
};

/**
 * 5. Définition / Renouvellement du mot de passe via le lien reçu par email
 * EXPIRE LE LIEN IMMÉDIATEMENT DÈS CETTE UTILISATION (reset_token = NULL)
 */
export const setPassword = async (req: Request, res: Response): Promise<void> => {
    const { token, email, mot_de_passe } = req.body;

    if (!token || !String(token).trim()) {
        res.status(400).json({ message: 'Jeton de réinitialisation manquant.' });
        return;
    }
    if (!mot_de_passe || String(mot_de_passe).length < 6) {
        res.status(400).json({ message: 'Le mot de passe doit comporter au moins 6 caractères.' });
        return;
    }

    try {
        let query = `
            SELECT u.*, e.nom as nom_ecole 
            FROM utilisateurs u 
            JOIN ecoles e ON u.ecole_id = e.id 
            WHERE u.reset_token = ?
        `;
        const params: any[] = [String(token).trim()];

        if (email) {
            query += ' AND LOWER(u.email) = ?';
            params.push(String(email).trim().toLowerCase());
        }

        const [rows] = await db.query<RowDataPacket[]>(query, params);

        if (rows.length === 0) {
            res.status(404).json({
                message: 'Ce lien est invalide ou a déjà été utilisé pour définir le mot de passe.'
            });
            return;
        }

        const user = rows[0];

        // Vérifier l'expiration de 1 mois
        if (!user.reset_expires_at || new Date() > new Date(user.reset_expires_at)) {
            res.status(400).json({
                message: 'Ce lien a expiré (validité de 1 mois dépassée). Veuillez contacter votre administrateur pour recevoir un nouveau lien.'
            });
            return;
        }

        const hashedPwd = await bcrypt.hash(mot_de_passe, 10);

        // EXPIRATION IMMÉDIATE DU LIEN : on vide reset_token et reset_expires_at
        await db.query(
            `UPDATE utilisateurs 
             SET mot_de_passe = ?, 
                 reset_token = NULL,
                 google_verified = FALSE, 
                 reset_expires_at = NULL, 
                 is_verified = TRUE, 
                 is_active = TRUE 
             WHERE id = ?`,
            [hashedPwd, user.id]
        );

        const authToken = generateToken({
            id: user.id,
            ecole_id: user.ecole_id,
            role: user.role
        });

        res.json({
            message: 'Votre mot de passe a été défini avec succès ! Connexion en cours...',
            token: authToken,
            user: {
                id: user.id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                role: user.role,
                ecole_id: user.ecole_id,
                nom_ecole: user.nom_ecole
            }
        });

    } catch (error) {
        console.error('[Set Password Error]', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour du mot de passe.' });
    }
};

/**
 * 6. Connexion utilisateur par EMAIL et MOT DE PASSE avec Support MULTI-ÉCOLES
 * Si l'email est associé à plusieurs établissements, renvoie la liste pour sélection.
 */
export const login = async (req: Request, res: Response): Promise<void> => {
    const { email, mot_de_passe, ecole_id } = req.body;

    if (!email || !String(email).trim()) {
        res.status(400).json({ message: 'L\'adresse email est obligatoire.' });
        return;
    }
    if (!mot_de_passe || !String(mot_de_passe).trim()) {
        res.status(400).json({ message: 'Le mot de passe est obligatoire.' });
        return;
    }

    const cleanEmail = String(email).trim().toLowerCase();

    try {
        const [users] = await db.query<RowDataPacket[]>(
            `SELECT u.*, e.nom as nom_ecole, e.code_epst 
             FROM utilisateurs u 
             JOIN ecoles e ON u.ecole_id = e.id 
             WHERE LOWER(TRIM(u.email)) = ?`,
            [cleanEmail]
        );

        if (users.length === 0) {
            res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
            return;
        }

        // Vérifier si le compte n'a pas encore de mot de passe configuré
        const hasAnyPassword = users.some(u => u.mot_de_passe !== null);
        if (!hasAnyPassword) {
            res.status(403).json({
                message: 'Votre mot de passe n\'a pas encore été configuré. Veuillez utiliser le lien d\'activation reçu par email.',
                requiresPasswordSetup: true
            });
            return;
        }

        // Vérification des comptes dont le mot de passe correspond
        const matchedUsers: any[] = [];
        for (const u of users) {
            if (u.mot_de_passe) {
                const isMatch = await bcrypt.compare(mot_de_passe, u.mot_de_passe);
                if (isMatch) {
                    matchedUsers.push(u);
                }
            }
        }

        if (matchedUsers.length === 0) {
            res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
            return;
        }

        // Si l'utilisateur appartient à plusieurs écoles avec le bon mot de passe
        // ET qu'il n'a pas encore spécifié sur quelle école se connecter :
        if (matchedUsers.length > 1 && !ecole_id) {
            res.json({
                requiresSchoolSelection: true,
                email: cleanEmail,
                schools: matchedUsers.map(u => ({
                    ecole_id: u.ecole_id,
                    nom_ecole: u.nom_ecole,
                    code_epst: u.code_epst,
                    role: u.role
                }))
            });
            return;
        }

        // Sélection du compte à connecter
        let selectedUser = matchedUsers[0];
        if (ecole_id) {
            const found = matchedUsers.find(u => Number(u.ecole_id) === Number(ecole_id));
            if (!found) {
                res.status(400).json({ message: 'Établissement sélectionné invalide pour ce compte.' });
                return;
            }
            selectedUser = found;
        }

        if (!selectedUser.is_active) {
            res.status(403).json({ message: 'Votre compte est désactivé dans cet établissement. Veuillez contacter la direction.' });
            return;
        }

        // Si administrateur non vérifié par email
        if (selectedUser.role === 'ADMIN' && selectedUser.is_verified === false) {
            const newCode = Math.floor(100000 + Math.random() * 900000).toString();
            const newExpiresAt = new Date(Date.now() + 3 * 60 * 1000);
            await db.query(
                'UPDATE utilisateurs SET verification_code = ?, verification_expires_at = ? WHERE id = ?',
                [newCode, newExpiresAt, selectedUser.id]
            );
            await MailService.sendOtpEmail({
                to: cleanEmail,
                code: newCode,
                nomDestinataire: `${selectedUser.prenom} ${selectedUser.nom}`,
                nomEcole: selectedUser.nom_ecole
            });

            res.status(403).json({
                message: 'Veuillez valider votre adresse email avant de vous connecter. Un nouveau code à 6 chiffres vient de vous être envoyé.',
                requiresVerification: true,
                email: selectedUser.email
            });
            return;
        }

        const token = generateToken({
            id: selectedUser.id,
            ecole_id: selectedUser.ecole_id,
            role: selectedUser.role
        });

        res.json({
            message: 'Connexion réussie',
            token,
            user: {
                id: selectedUser.id,
                nom: selectedUser.nom,
                prenom: selectedUser.prenom,
                email: selectedUser.email,
                role: selectedUser.role,
                ecole_id: selectedUser.ecole_id,
                nom_ecole: selectedUser.nom_ecole
            }
        });

    } catch (error) {
        console.error('[Login Error]', error);
        res.status(500).json({ message: 'Erreur serveur lors de la connexion.' });
    }
};

/**
 * Fonctions de compatibilité
 */
export const registerEcole = register;
export const loginEcole = async (req: Request, res: Response): Promise<void> => {
    res.json({ message: 'Le login école est désormais obsolète. Utilisez directement votre email.' });
};
export const registerAdmin = register;
export const loginUser = async (req: Request, res: Response): Promise<void> => {
    if (req.body.email) {
        return login(req, res);
    }
    const { identifiant, mot_de_passe } = req.body;
    if (identifiant && mot_de_passe) {
        try {
            const [users] = await db.query<RowDataPacket[]>(
                `SELECT u.*, e.nom as nom_ecole FROM utilisateurs u JOIN ecoles e ON u.ecole_id = e.id WHERE u.identifiant = ? OR u.matricule = ? OR u.email = ?`,
                [identifiant, identifiant, identifiant]
            );
            if (users.length > 0) {
                const user = users[0];
                if (user.mot_de_passe && await bcrypt.compare(mot_de_passe, user.mot_de_passe)) {
                    const token = generateToken({
                        id: user.id,
                        ecole_id: user.ecole_id,
                        role: user.role
                    });
                    res.json({
                        message: 'Connexion réussie',
                        token,
                        user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, role: user.role, ecole_id: user.ecole_id, nom_ecole: user.nom_ecole }
                    });
                    return;
                }
            }
        } catch (e) { }
    }
    res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
};

/**
 * Vérification du token Google pour valider l'identité
 */
export const verifyGoogleIdentity = async (req: Request, res: Response): Promise<void> => {
    const { token, email, googleIdToken } = req.body;

    if (!token || !email || !googleIdToken) {
        res.status(400).json({
            valid: false,
            message: 'Token, email et identifiant Google requis'
        });
        return;
    }

    try {
        // 1. Vérifier que le token existe en base
        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT u.id, u.email, u.nom, u.prenom, u.reset_token, u.reset_expires_at, e.nom as nom_ecole
             FROM utilisateurs u 
             JOIN ecoles e ON u.ecole_id = e.id 
             WHERE u.reset_token = ? AND LOWER(u.email) = LOWER(?)`,
            [token, email]
        );

        if (rows.length === 0) {
            res.status(404).json({
                valid: false,
                message: 'Lien invalide ou déjà utilisé'
            });
            return;
        }

        const user = rows[0];

        // Vérifier l'expiration du lien
        if (!user.reset_expires_at || new Date() > new Date(user.reset_expires_at)) {
            res.status(400).json({
                valid: false,
                message: 'Ce lien a expiré (validité de 1 mois dépassée)'
            });
            return;
        }

        // 2. Vérifier le token Google
        const googleUser = await AuthService.verifyGoogleToken(googleIdToken);
        if (!googleUser) {
            res.status(400).json({
                valid: false,
                message: 'Impossible de vérifier l\'identité Google'
            });
            return;
        }

        // 3. Comparer les emails
        if (googleUser.email.toLowerCase() !== user.email.toLowerCase()) {
            // INVALIDER LE LIEN IMMÉDIATEMENT pour sécurité
            await db.query(
                `UPDATE utilisateurs 
                 SET reset_token = NULL,
                     google_verified = FALSE, 
                     reset_expires_at = NULL 
                 WHERE id = ?`,
                [user.id]
            );

            res.status(400).json({
                valid: false,
                emailMismatch: true,
                message: 'L\'email Google ne correspond pas à celui du compte. Ce lien a été invalidé pour des raisons de sécurité.'
            });
            return;
        }

        // 4. Marquer l'email comme vérifié avec Google (NOUVELLE COLONNE)
        await db.query(
            `UPDATE utilisateurs 
             SET google_verified = TRUE,
                 google_verified_at = NOW()
             WHERE id = ?`,
            [user.id]
        );

        res.json({
            valid: true,
            verified: true,
            message: 'Identité confirmée avec succès',
            email: googleUser.email,
            name: googleUser.name,
            nomComplet: `${user.prenom} ${user.nom}`,
            nomEcole: user.nom_ecole,
            role: user.role
        });

    } catch (error) {
        console.error('[Verify Google Identity Error]', error);
        res.status(500).json({
            valid: false,
            message: 'Erreur lors de la vérification Google'
        });
    }
};

/**
 * Vérification du token pour la définition du mot de passe (après validation Google)
 */
export const verifyPasswordSetupToken = async (req: Request, res: Response): Promise<void> => {
    const { token, email } = req.query;

    if (!token || !email) {
        res.status(400).json({
            valid: false,
            message: 'Token et email requis'
        });
        return;
    }

    try {
        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT u.id, u.email, u.nom, u.prenom, u.role, u.reset_token, u.reset_expires_at, u.google_verified, e.nom as nom_ecole 
             FROM utilisateurs u 
             JOIN ecoles e ON u.ecole_id = e.id 
             WHERE u.reset_token = ? AND LOWER(u.email) = LOWER(?)`,
            [token, email]
        );

        if (rows.length === 0) {
            res.status(404).json({
                valid: false,
                message: 'Lien invalide ou déjà utilisé'
            });
            return;
        }

        const user = rows[0];

        // Vérifier si l'utilisateur a vérifié son identité avec Google (NOUVELLE COLONNE)
        if (!user.google_verified) {
            res.status(403).json({
                valid: false,
                requiresGoogleVerification: true,
                message: 'Veuillez d\'abord vérifier votre identité avec Google'
            });
            return;
        }

        // Vérifier l'expiration
        if (!user.reset_expires_at || new Date() > new Date(user.reset_expires_at)) {
            res.status(400).json({
                valid: false,
                message: 'Ce lien a expiré (validité de 1 mois dépassée)'
            });
            return;
        }

        // Réinitialiser le flag google_verified car on va passer à l'étape du mot de passe
        // Cela évite qu'on puisse réutiliser la même session
        await db.query(
            `UPDATE utilisateurs 
             SET google_verified = FALSE
             WHERE id = ?`,
            [user.id]
        );

        res.json({
            valid: true,
            email: user.email,
            nomComplet: `${user.prenom} ${user.nom}`,
            nomEcole: user.nom_ecole,
            role: user.role
        });

    } catch (error) {
        console.error('[Verify Password Setup Token Error]', error);
        res.status(500).json({
            valid: false,
            message: 'Erreur lors de la vérification'
        });
    }
};

/**
 * Récupère la configuration Google OAuth pour le frontend
 * (Ne retourne que le client_id, pas le secret)
 */
export const getGoogleConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        
        if (!clientId) {
            res.status(500).json({
                error: 'Google OAuth non configuré sur le serveur'
            });
            return;
        }

        res.json({
            clientId: clientId,
            // Optionnellement, on peut ajouter d'autres configs
            // redirectUri: process.env.GOOGLE_REDIRECT_URI,
            // apiBaseUrl: process.env.API_BASE_URL,
        });
    } catch (error) {
        console.error('[Get Google Config Error]', error);
        res.status(500).json({
            error: 'Erreur lors de la récupération de la configuration'
        });
    }
};