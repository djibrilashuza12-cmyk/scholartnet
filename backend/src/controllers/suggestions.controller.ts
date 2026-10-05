// backend/controllers/suggestions.controller.ts
import { Request, Response } from 'express';
import db from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

interface SuggestionBody {
    nom: string;
    email: string;
    sujet: string;
    message: string;
}

export const createSuggestion = async (req: Request, res: Response): Promise<void> => {
    const { nom, email, sujet, message } = req.body as SuggestionBody;

    try {
        // Validation basique
        if (!nom || !nom.trim()) {
            res.status(400).json({ message: 'Le nom est obligatoire.' });
            return;
        }

        if (!email || !email.trim()) {
            res.status(400).json({ message: 'L\'email est obligatoire.' });
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            res.status(400).json({ message: 'L\'email est invalide.' });
            return;
        }

        if (!sujet || !sujet.trim()) {
            res.status(400).json({ message: 'Le sujet est obligatoire.' });
            return;
        }

        if (!message || !message.trim()) {
            res.status(400).json({ message: 'Le message est obligatoire.' });
            return;
        }

        // Limiter la taille
        if (nom.length > 150) {
            res.status(400).json({ message: 'Le nom est trop long (max 150 caractères).' });
            return;
        }

        if (email.length > 191) {
            res.status(400).json({ message: 'L\'email est trop long (max 191 caractères).' });
            return;
        }

        if (sujet.length > 255) {
            res.status(400).json({ message: 'Le sujet est trop long (max 255 caractères).' });
            return;
        }

        if (message.length > 5000) {
            res.status(400).json({ message: 'Le message est trop long (max 5000 caractères).' });
            return;
        }

        // Récupérer l'IP et user agent
        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
            || req.socket.remoteAddress
            || null;
        const userAgent = req.headers['user-agent'] || null;

        // Insertion dans la base de données
        const [result] = await db.query<ResultSetHeader>(
            `INSERT INTO suggestions (nom, email, sujet, message, ip, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?)`,
            [
                nom.trim(),
                email.trim().toLowerCase(),
                sujet.trim(),
                message.trim(),
                ip,
                userAgent
            ]
        );

        res.status(201).json({
            success: true,
            message: 'Votre suggestion a bien été enregistrée. Merci !',
            id: result.insertId
        });

    } catch (error: any) {
        console.error('Erreur lors de l\'enregistrement de la suggestion:', error);
        res.status(500).json({
            message: 'Une erreur est survenue lors de l\'enregistrement de votre suggestion.'
        });
    }
};