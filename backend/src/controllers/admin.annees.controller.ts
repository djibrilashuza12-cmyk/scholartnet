import { Response } from 'express';
import db from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { parseFrDateToISO, validateAnnéeScolaireDatesOrThrow } from '../utils/dates';

export const openSchoolYear = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { nom, date_debut, date_fin } = req.body || {};

    try {
        if (!nom || !date_debut || !date_fin) {
            res.status(400).json({ message: 'nom, date_debut et date_fin sont obligatoires.' });
            return;
        }

        const debutISO = parseFrDateToISO(date_debut);
        const finISO = parseFrDateToISO(date_fin);

        validateAnnéeScolaireDatesOrThrow(debutISO, finISO);

        // Fermer les années ouvertes
        await db.query<ResultSetHeader>(
            'UPDATE annees_scolaires SET statut = "CLOTUREE" WHERE ecole_id = ? AND statut = "OUVERTE"',
            [ecoleId]
        );

        await db.query<ResultSetHeader>(
            'INSERT INTO annees_scolaires (ecole_id, nom, date_debut, date_fin, statut) VALUES (?, ?, ?, ?, ?)',
            [ecoleId, nom, debutISO, finISO, 'OUVERTE']
        );

        res.status(201).json({ message: 'Année scolaire ouverte avec succès.' });
    } catch (error: any) {
        res.status(400).json({ message: error?.message || "Erreur lors de l'ouverture de l'année scolaire." });
    }
};

export const getActiveSchoolYear = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;

    try {
        const [rows] = await db.query<RowDataPacket[]>(
            'SELECT * FROM annees_scolaires WHERE ecole_id = ? AND statut = "OUVERTE" ORDER BY date_debut DESC LIMIT 1',
            [ecoleId]
        );

        res.json({ activeYear: rows[0] || null });
    } catch {
        res.status(500).json({ message: 'Erreur lors du chargement de l\'année active.' });
    }
};

