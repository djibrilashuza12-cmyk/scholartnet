import { Request, Response } from 'express';
import db from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { campaignJobs, runWhatsAppCampaign } from '../services/whatsapp.service';

/**
 * Démarre une campagne d'envoi de messages WhatsApp.
 */
export const startWhatsAppCampaign = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    if (!ecoleId) {
        res.status(401).json({ message: 'Non autorisé' });
        return;
    }

    const { targetType, targetId, message } = req.body;

    if (!message || message.trim() === '') {
        res.status(400).json({ message: 'Le contenu du message est requis.' });
        return;
    }

    if (targetType !== 'classe' && targetType !== 'ecole') {
        res.status(400).json({ message: 'Type de cible invalide. Doit être "classe" ou "ecole".' });
        return;
    }

    try {
        // Compter le nombre de destinataires potentiels avant de lancer
        let totalRecipients = 0;
        if (targetType === 'classe') {
            const [rows] = await db.query<RowDataPacket[]>(
                `SELECT COUNT(DISTINCT e.id) as count
                 FROM eleves e
                 JOIN inscriptions i ON e.id = i.eleve_id
                 JOIN annees_scolaires a ON i.annee_scolaire_id = a.id
                 WHERE e.ecole_id = ?
                   AND i.classe_id = ?
                   AND a.statut = 'OUVERTE'
                   AND e.numero_parent IS NOT NULL 
                   AND e.numero_parent != ''`,
                [ecoleId, targetId]
            );
            totalRecipients = rows[0]?.count || 0;
        } else {
            const [rows] = await db.query<RowDataPacket[]>(
                `SELECT COUNT(DISTINCT e.id) as count
                 FROM eleves e
                 JOIN inscriptions i ON e.id = i.eleve_id
                 JOIN annees_scolaires a ON i.annee_scolaire_id = a.id
                 WHERE e.ecole_id = ?
                   AND a.statut = 'OUVERTE'
                   AND e.numero_parent IS NOT NULL 
                   AND e.numero_parent != ''`,
                [ecoleId]
            );
            totalRecipients = rows[0]?.count || 0;
        }

        if (totalRecipients === 0) {
            res.status(400).json({
                message: "Aucun parent d'élève avec un numéro de téléphone valide n'a été trouvé pour cette cible."
            });
            return;
        }

        // Créer un identifiant de job unique
        const jobId = `job_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        // Initialiser le statut du job
        campaignJobs.set(jobId, {
            id: jobId,
            ecoleId,
            status: 'en_cours',
            total: totalRecipients,
            sent: 0,
            failed: 0,
            errors: [],
            startedAt: new Date()
        });

        // Lancer la campagne en tâche de fond (asynchrone)
        runWhatsAppCampaign(jobId, ecoleId, targetType, targetId ? Number(targetId) : null, message);

        res.json({
            message: 'Campagne de communication WhatsApp démarrée avec succès en tâche de fond.',
            jobId,
            total: totalRecipients
        });
    } catch (error) {
        console.error('Erreur lors du démarrage de la campagne WhatsApp:', error);
        res.status(500).json({ message: 'Erreur lors du démarrage de la campagne de communication.' });
    }
};

/**
 * Récupère le statut d'une campagne WhatsApp en cours ou terminée.
 */
export const getWhatsAppCampaignStatus = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { jobId } = req.params;

    if (!ecoleId) {
        res.status(401).json({ message: 'Non autorisé' });
        return;
    }

    const job = campaignJobs.get(jobId);

    if (!job || job.ecoleId !== ecoleId) {
        res.status(404).json({ message: 'Campagne de messagerie non trouvée.' });
        return;
    }

    res.json(job);
};

/**
 * Récupère le nom de l'école pour l'affichage de l'aperçu sur le frontend.
 */
export const getSchoolInfo = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    if (!ecoleId) {
        res.status(401).json({ message: 'Non autorisé' });
        return;
    }

    try {
        const [ecoleRows] = await db.query<RowDataPacket[]>(
            'SELECT nom FROM ecoles WHERE id = ?',
            [ecoleId]
        );

        res.json({
            schoolName: ecoleRows[0]?.nom || 'Mon Établissement'
        });
    } catch (error) {
        console.error("Erreur lors de la récupération du nom de l'école:", error);
        res.status(500).json({ message: "Erreur lors du chargement des informations de l'établissement." });
    }
};