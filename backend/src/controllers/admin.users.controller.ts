import { Response } from 'express';
import db from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { generateMatriculeFormatXxx000000Xxx00 } from '../utils/matricule';
import MailService from '../services/mail.service';
import { parseFrDateToISO } from '../utils/dates'; // ← AJOUT IMPORT

export const listUsers = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;

    const page = Math.max(1, Number(req.query?.page || 1));
    const pageSize = Math.min(50, Math.max(5, Number(req.query?.pageSize || 10)));
    const offset = (page - 1) * pageSize;

    try {
        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT 
        u.id,
        u.nom,
        u.prenom,
        u.email,
        u.matricule,
        u.role,
        u.is_active,
        u.is_verified,
        CASE WHEN u.mot_de_passe IS NULL THEN 0 ELSE 1 END as has_password,
        u.reset_expires_at,
        u.created_at,
        u.sexe as sexe,
        u.date_naissance as date_naissance,
        u.lieu_naissance as lieu_naissance,
        u.adresse as adresse,
        u.niveau_etude as niveau_etude,
        u.postnom as postnom,
        u.nom_pere as nom_pere,
        u.nom_mere as nom_mere
      FROM utilisateurs u
      WHERE u.ecole_id = ?
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?`,
            [ecoleId, pageSize, offset]
        );

        const [countRows] = await db.query<RowDataPacket[]>(
            'SELECT COUNT(*) as count FROM utilisateurs WHERE ecole_id = ?',
            [ecoleId]
        );

        res.json({
            page,
            pageSize,
            total: countRows[0]?.count || 0,
            results: rows,
        });
    } catch {
        res.status(500).json({ message: 'Erreur lors du chargement des utilisateurs.' });
    }
};

/**
 * Création d'un membre du personnel par l'administrateur
 * SANS mot de passe : l'utilisateur reçoit un lien d'activation sécurisé valable 1 mois.
 */
export const createUser = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const {
        nom,
        prenom,
        email,
        role,
        sexe,
        date_naissance,
        lieu_naissance,
        adresse,
        niveau_etude,
        postnom,
        nom_pere,
        nom_mere,
    } = req.body || {};

    try {
        if (!nom || !prenom || !email || !role) {
            res.status(400).json({ message: 'Nom, prénom, email et rôle sont obligatoires.' });
            return;
        }

        const userEmail = String(email).trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(userEmail)) {
            res.status(400).json({ message: 'Adresse email invalide.' });
            return;
        }

        // Vérifier si l'utilisateur existe déjà DANS CETTE ÉCOLE
        const [existing] = await db.query<RowDataPacket[]>(
            'SELECT id FROM utilisateurs WHERE ecole_id = ? AND LOWER(email) = ?',
            [ecoleId, userEmail]
        );
        if (existing.length > 0) {
            res.status(400).json({ message: 'Un compte avec cette adresse email existe déjà dans votre établissement.' });
            return;
        }

        let matricule = '';
        for (let i = 0; i < 15; i++) {
            const candidate = generateMatriculeFormatXxx000000Xxx00();
            const [rows] = await db.query<RowDataPacket[]>(
                'SELECT id FROM utilisateurs WHERE matricule = ? LIMIT 1',
                [candidate]
            );
            if (rows.length === 0) {
                matricule = candidate;
                break;
            }
        }

        if (!matricule) {
            matricule = `STAFF-${Date.now().toString().slice(-6)}`;
        }

        // Génération du token d'activation valable 1 MOIS (30 jours)
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours

        // Récupérer le nom de l'école pour le template d'email
        const [ecoles] = await db.query<RowDataPacket[]>('SELECT nom FROM ecoles WHERE id = ?', [ecoleId]);
        const nomEcole = ecoles[0]?.nom || 'Votre établissement';

        // 🔧 CORRECTION 1: Convertir la date de naissance au format ISO (YYYY-MM-DD)
        let dateNaissanceConvertie = null;
        if (date_naissance && date_naissance.trim() !== '') {
            try {
                dateNaissanceConvertie = parseFrDateToISO(date_naissance);
            } catch (error) {
                res.status(400).json({ 
                    message: 'Format de date de naissance invalide. Utilisez le format JJ/MM/AAAA.' 
                });
                return;
            }
        }

        await db.query<ResultSetHeader>(
            `INSERT INTO utilisateurs 
             (ecole_id, nom, prenom, email, matricule, identifiant, mot_de_passe, role, is_active, is_verified, reset_token, reset_expires_at, sexe, date_naissance, lieu_naissance, adresse, niveau_etude, postnom, nom_pere, nom_mere) 
             VALUES (?, ?, ?, ?, ?, ?, NULL, ?, TRUE, TRUE, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                ecoleId,
                nom.trim(),
                prenom.trim(),
                userEmail,
                matricule,
                userEmail,
                role,
                resetToken,
                resetExpiresAt,
                sexe ?? null,
                dateNaissanceConvertie, // ← CORRECTION: Date convertie au lieu de date_naissance direct
                lieu_naissance ?? null,
                adresse ?? null,
                niveau_etude ?? null,
                postnom ?? null,
                nom_pere ?? null,
                nom_mere ?? null,
            ]
        );

        // Construction du lien dynamique avec la variable APP_URL
        const appUrl = (process.env.APP_URL || 'http://localhost:4200').replace(/\/+$/, '');
        const resetUrl = `${appUrl}/set-password?token=${resetToken}&email=${encodeURIComponent(userEmail)}`;

        // Envoi de l'e-mail d'invitation avec mention de la validité de 1 mois
        await MailService.sendPasswordSetupEmail({
            to: userEmail,
            resetUrl,
            nomDestinataire: `${prenom} ${nom}`,
            nomEcole,
            role,
            isRenewal: false
        });

        res.status(201).json({
            message: 'Utilisateur créé avec succès. Un lien d\'activation valable 1 mois a été envoyé à son adresse email pour définir son mot de passe.',
            matricule,
            email: userEmail
        });

    } catch (err) {
        console.error('Create user error:', err);
        res.status(500).json({ message: 'Erreur lors de la création de l\'utilisateur.' });
    }
};

/**
 * Renvoyer l'e-mail d'invitation / réinitialisation de mot de passe par l'administrateur
 * Génère un nouveau token valide 1 mois et expire dès utilisation.
 */
export const resendUserInvite = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { id } = req.params;

    try {
        if (!id) {
            res.status(400).json({ message: 'ID utilisateur manquant.' });
            return;
        }

        const [users] = await db.query<RowDataPacket[]>(
            `SELECT u.*, e.nom as nom_ecole 
             FROM utilisateurs u 
             JOIN ecoles e ON u.ecole_id = e.id 
             WHERE u.id = ? AND u.ecole_id = ?`,
            [id, ecoleId]
        );

        if (users.length === 0) {
            res.status(404).json({ message: 'Utilisateur introuvable dans votre établissement.' });
            return;
        }

        const user = users[0];

        // Nouveau jeton avec expiration renouvelée à 1 MOIS
        const newResetToken = crypto.randomBytes(32).toString('hex');
        const newResetExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours

        await db.query(
            'UPDATE utilisateurs SET reset_token = ?, reset_expires_at = ? WHERE id = ?',
            [newResetToken, newResetExpiresAt, user.id]
        );

        const appUrl = (process.env.APP_URL || 'http://localhost:4200').replace(/\/+$/, '');
        const resetUrl = `${appUrl}/set-password?token=${newResetToken}&email=${encodeURIComponent(user.email)}`;

        const isRenewal = user.mot_de_passe !== null;

        await MailService.sendPasswordSetupEmail({
            to: user.email,
            resetUrl,
            nomDestinataire: `${user.prenom} ${user.nom}`,
            nomEcole: user.nom_ecole,
            role: user.role,
            isRenewal
        });

        res.json({
            message: `Lien ${isRenewal ? 'de réinitialisation' : 'd\'activation'} envoyé avec succès à ${user.email} (valable 1 mois).`
        });

    } catch (err) {
        console.error('Resend invite error:', err);
        res.status(500).json({ message: 'Erreur lors du renvoi du lien d\'activation.' });
    }
};

export const updateUser = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { id } = req.params;
    const {
        nom,
        prenom,
        email,
        role,
        is_active,
        sexe,
        date_naissance,
        lieu_naissance,
        adresse,
        niveau_etude,
        postnom,
        nom_pere,
        nom_mere,
    } = req.body || {};

    try {
        if (!id) {
            res.status(400).json({ message: 'id manquant.' });
            return;
        }

        if (email) {
            const [existing] = await db.query<RowDataPacket[]>(
                'SELECT id FROM utilisateurs WHERE ecole_id = ? AND LOWER(email) = ? AND id != ?',
                [ecoleId, String(email).trim().toLowerCase(), id]
            );
            if (existing.length > 0) {
                res.status(400).json({ message: 'Cette adresse email est déjà attribuée à un autre utilisateur dans votre établissement.' });
                return;
            }
        }

        // 🔧 CORRECTION 2: Convertir la date de naissance pour la mise à jour
        let dateNaissanceConvertie = null;
        if (date_naissance && date_naissance.trim() !== '') {
            try {
                dateNaissanceConvertie = parseFrDateToISO(date_naissance);
            } catch (error) {
                res.status(400).json({ 
                    message: 'Format de date de naissance invalide. Utilisez le format JJ/MM/AAAA.' 
                });
                return;
            }
        }

        await db.query<ResultSetHeader>(
            `UPDATE utilisateurs SET 
                nom = COALESCE(?, nom), 
                prenom = COALESCE(?, prenom), 
                email = COALESCE(?, email),
                role = COALESCE(?, role), 
                is_active = ?, 
                sexe = ?, 
                date_naissance = ?, 
                lieu_naissance = ?, 
                adresse = ?, 
                niveau_etude = ?, 
                postnom = ?, 
                nom_pere = ?, 
                nom_mere = ?,
                reset_token = NULL,
                reset_expires_at = NULL
             WHERE id = ? AND ecole_id = ?`,
            [
                nom ?? null,
                prenom ?? null,
                email ? String(email).trim().toLowerCase() : null,
                role ?? null,
                is_active === undefined ? true : Boolean(is_active),
                sexe ?? null,
                dateNaissanceConvertie, // ← CORRECTION: Date convertie au lieu de date_naissance direct
                lieu_naissance ?? null,
                adresse ?? null,
                niveau_etude ?? null,
                postnom ?? null,
                nom_pere ?? null,
                nom_mere ?? null,
                id,
                ecoleId,
            ]
        );

        res.json({ message: 'Utilisateur mis à jour.' });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour.' });
    }
};

export const deleteUser = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { id } = req.params;

    try {
        if (!id) {
            res.status(400).json({ message: 'id manquant.' });
            return;
        }

        await db.query<ResultSetHeader>(
            'DELETE FROM utilisateurs WHERE id = ? AND ecole_id = ?',
            [id, ecoleId]
        );

        res.json({ message: 'Utilisateur supprimé.' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ message: 'Erreur lors de la suppression.' });
    }
};