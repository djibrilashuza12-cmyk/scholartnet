import { Response } from 'express';
import db from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import bcrypt from 'bcrypt';

import { generateMatriculeFormatXxx000000Xxx00 } from '../utils/matricule';
import { parseFrDateToISO, validateAnnéeScolaireDatesOrThrow } from '../utils/dates';



export const getDashboardStats = async (req: any, res: Response): Promise<void> => {

    const ecoleId = req.user?.ecole_id;
    try {
        const [elevesCount] = await db.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM eleves WHERE ecole_id = ?', [ecoleId]);
        const [usersCount] = await db.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM utilisateurs WHERE ecole_id = ?', [ecoleId]);
        const [classesCount] = await db.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM classes WHERE ecole_id = ?', [ecoleId]);

        res.json({
            eleves: elevesCount[0].count,
            utilisateurs: usersCount[0].count,
            classes: classesCount[0].count
        });
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la récupération des statistiques.' });
    }
};

export const createUser = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { nom, prenom, mot_de_passe, role, eleve_id } = (req as any).body;



    try {
        if (!nom || !prenom || !mot_de_passe || !role) {
            res.status(400).json({ message: "Champs obligatoires manquants (nom, prenom, mot_de_passe, role)." });
            return;
        }

        // Générer matricule global unique
        let matricule = '';
        for (let i = 0; i < 12; i++) {
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
            res.status(500).json({ message: 'Impossible de générer un matricule unique. Réessayez.' });
            return;
        }

        const hashedPwd = await bcrypt.hash(mot_de_passe, 10);

        // Synchroniser identifiant = matricule
        await db.query<ResultSetHeader>(
            'INSERT INTO utilisateurs (ecole_id, nom, prenom, matricule, identifiant, mot_de_passe, role, eleve_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [ecoleId, nom, prenom, matricule, matricule, hashedPwd, role, eleve_id ?? null]
        );

        res.status(201).json({ message: 'Utilisateur créé avec succès.', matricule });
    } catch (error: any) {
        res.status(500).json({ message: "Erreur lors de la création de l'utilisateur." });
    }
};

export const openSchoolYear = async (req: any, res: Response): Promise<void> => {

    const ecoleId = req.user?.ecole_id;
    const { nom, date_debut, date_fin } = (req as any).body;


    try {
        if (!nom || !date_debut || !date_fin) {
            res.status(400).json({ message: 'nom, date_debut et date_fin sont obligatoires.' });
            return;
        }

        const debutISO = parseFrDateToISO(date_debut);
        const finISO = parseFrDateToISO(date_fin);

        validateAnnéeScolaireDatesOrThrow(debutISO, finISO);

        // Fermer toutes les années ouvertes existantes (pour avoir une année active)
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
        res.status(400).json({ message: error?.message || 'Erreur lors de l\'ouverture de l\'année scolaire.' });
    }
};

