import { Response } from 'express';
import db from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { format } from 'date-fns';

// ============================================
// DASHBOARD TITULAIRE
// ============================================

export const getTitulaireDashboard = async (req: any, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const ecoleId = req.user?.ecole_id;

    try {
        const [classes] = await db.query<RowDataPacket[]>(
            `SELECT c.*, 
                (SELECT COUNT(*) FROM inscriptions i 
                 WHERE i.classe_id = c.id 
                 AND i.annee_scolaire_id = (
                     SELECT id FROM annees_scolaires 
                     WHERE ecole_id = ? AND statut = "OUVERTE" 
                     ORDER BY date_debut DESC LIMIT 1
                 )) as effectif
             FROM classes c
             WHERE c.titulaire_id = ?
             ORDER BY c.nom ASC`,
            [ecoleId, userId]
        );

        const [totalEleves] = await db.query<RowDataPacket[]>(
            `SELECT COUNT(DISTINCT i.eleve_id) as total
             FROM inscriptions i
             JOIN classes c ON i.classe_id = c.id
             WHERE c.titulaire_id = ?
             AND i.annee_scolaire_id = (
                 SELECT id FROM annees_scolaires 
                 WHERE ecole_id = ? AND statut = "OUVERTE" 
                 ORDER BY date_debut DESC LIMIT 1
             )`,
            [userId, ecoleId]
        );

        res.json({
            classes: classes || [],
            totalEleves: totalEleves[0]?.total || 0,
            totalClasses: classes.length
        });
    } catch (error) {
        console.error('Erreur dashboard titulaire:', error);
        res.status(500).json({ message: 'Erreur lors du chargement du dashboard.' });
    }
};

// ============================================
// CLASSES DU TITULAIRE
// ============================================

export const getClassesByTitulaire = async (req: any, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const ecoleId = req.user?.ecole_id;

    try {
        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT c.*,
                (SELECT COUNT(*) FROM inscriptions i 
                 WHERE i.classe_id = c.id 
                 AND i.annee_scolaire_id = (
                     SELECT id FROM annees_scolaires 
                     WHERE ecole_id = ? AND statut = "OUVERTE" 
                     ORDER BY date_debut DESC LIMIT 1
                 )) as effectif
             FROM classes c
             WHERE c.titulaire_id = ? AND c.ecole_id = ?
             ORDER BY c.nom ASC`,
            [ecoleId, userId, ecoleId]
        );

        res.json({ results: rows });
    } catch (error) {
        console.error('Erreur getClassesByTitulaire:', error);
        res.status(500).json({ message: 'Erreur lors du chargement des classes.' });
    }
};

// ============================================
// ÉLÈVES PAR CLASSE
// ============================================

export const getElevesByClasse = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const userId = req.user?.id;
    const { classeId } = req.params;

    try {
        const [check] = await db.query<RowDataPacket[]>(
            'SELECT id FROM classes WHERE id = ? AND titulaire_id = ? AND ecole_id = ?',
            [classeId, userId, ecoleId]
        );

        if (check.length === 0) {
            res.status(403).json({ message: 'Accès non autorisé à cette classe.' });
            return;
        }

        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT 
                e.id,
                e.matricule,
                e.nom,
                e.postnom,
                e.prenom,
                e.sexe,
                e.date_naissance,
                i.id as inscription_id,
                i.date_inscription
             FROM inscriptions i
             JOIN eleves e ON i.eleve_id = e.id
             WHERE i.classe_id = ?
             AND i.annee_scolaire_id = (
                 SELECT id FROM annees_scolaires 
                 WHERE ecole_id = ? AND statut = "OUVERTE" 
                 ORDER BY date_debut DESC LIMIT 1
             )
             ORDER BY e.nom ASC, e.prenom ASC`,
            [classeId, ecoleId]
        );

        res.json({ results: rows });
    } catch (error) {
        console.error('Erreur getElevesByClasse:', error);
        res.status(500).json({ message: 'Erreur lors du chargement des élèves.' });
    }
};

// ============================================
// COURS PAR CLASSE
// ============================================

export const getCoursByClasse = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const userId = req.user?.id;
    const { classeId } = req.params;

    try {
        const [check] = await db.query<RowDataPacket[]>(
            'SELECT id FROM classes WHERE id = ? AND titulaire_id = ? AND ecole_id = ?',
            [classeId, userId, ecoleId]
        );

        if (check.length === 0) {
            res.status(403).json({ message: 'Accès non autorisé à cette classe.' });
            return;
        }

        const [coursRows] = await db.query<RowDataPacket[]>(
            `SELECT id, nom FROM cours WHERE classe_id = ? ORDER BY nom ASC`,
            [classeId]
        );

        const results = [];
        for (const cours of coursRows) {
            const [configRows] = await db.query<RowDataPacket[]>(
                `SELECT 
                    cp.periode_id,
                    p.nom as periode_nom,
                    cp.max_points
                 FROM cours_periodes cp
                 JOIN periodes p ON cp.periode_id = p.id
                 WHERE cp.cours_id = ? AND p.est_active = 1
                 ORDER BY p.ordre ASC`,
                [cours.id]
            );

            results.push({
                id: cours.id,
                nom: cours.nom,
                periodes_config: configRows.map(row => ({
                    periode_id: row.periode_id,
                    periode_nom: row.periode_nom,
                    max_points: row.max_points
                }))
            });
        }

        res.json({ results });
    } catch (error) {
        console.error('Erreur getCoursByClasse:', error);
        res.status(500).json({ message: 'Erreur lors du chargement des cours.' });
    }
};

export const createCours = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const userId = req.user?.id;
    const { classeId } = req.params;
    const { nom, periodes_config } = req.body || {};

    try {
        if (!nom || !periodes_config || !Array.isArray(periodes_config) || periodes_config.length === 0) {
            res.status(400).json({
                message: 'nom et periodes_config (tableau avec periode_id, max_points) sont obligatoires.'
            });
            return;
        }

        const [check] = await db.query<RowDataPacket[]>(
            'SELECT id FROM classes WHERE id = ? AND titulaire_id = ? AND ecole_id = ?',
            [classeId, userId, ecoleId]
        );

        if (check.length === 0) {
            res.status(403).json({ message: 'Accès non autorisé à cette classe.' });
            return;
        }

        const [existing] = await db.query<RowDataPacket[]>(
            'SELECT id FROM cours WHERE classe_id = ? AND nom = ?',
            [classeId, nom]
        );

        if (existing.length > 0) {
            res.status(400).json({ message: 'Un cours avec ce nom existe déjà dans cette classe.' });
            return;
        }

        for (const config of periodes_config) {
            if (!config.periode_id || !config.max_points || config.max_points <= 0) {
                res.status(400).json({
                    message: `Chaque configuration doit avoir periode_id et max_points (supérieur à 0).`
                });
                return;
            }
        }

        const [result] = await db.query<ResultSetHeader>(
            `INSERT INTO cours (classe_id, nom) VALUES (?, ?)`,
            [classeId, nom]
        );

        const coursId = result.insertId;

        for (const config of periodes_config) {
            await db.query<ResultSetHeader>(
                `INSERT INTO cours_periodes (cours_id, periode_id, max_points)
                 VALUES (?, ?, ?)`,
                [coursId, config.periode_id, config.max_points]
            );
        }

        res.status(201).json({
            message: 'Cours créé avec succès.',
            id: coursId
        });
    } catch (error) {
        console.error('Erreur createCours:', error);
        res.status(500).json({ message: 'Erreur lors de la création du cours.' });
    }
};

export const updateCours = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const userId = req.user?.id;
    const { coursId } = req.params;
    const { nom, periodes_config } = req.body || {};

    try {
        if (!nom && !periodes_config) {
            res.status(400).json({ message: 'nom ou periodes_config est obligatoire.' });
            return;
        }

        const [check] = await db.query<RowDataPacket[]>(
            `SELECT c.id
             FROM cours c
             JOIN classes cl ON c.classe_id = cl.id
             WHERE c.id = ? AND cl.titulaire_id = ? AND cl.ecole_id = ?`,
            [coursId, userId, ecoleId]
        );

        if (check.length === 0) {
            res.status(403).json({ message: 'Accès non autorisé à ce cours.' });
            return;
        }

        if (nom) {
            await db.query<ResultSetHeader>(
                `UPDATE cours SET nom = ? WHERE id = ?`,
                [nom, coursId]
            );
        }

        if (periodes_config && Array.isArray(periodes_config)) {
            for (const config of periodes_config) {
                if (!config.periode_id || !config.max_points || config.max_points <= 0) {
                    res.status(400).json({
                        message: `Chaque configuration doit avoir periode_id et max_points (supérieur à 0).`
                    });
                    return;
                }

                await db.query<ResultSetHeader>(
                    `INSERT INTO cours_periodes (cours_id, periode_id, max_points)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE max_points = ?`,
                    [coursId, config.periode_id, config.max_points, config.max_points]
                );
            }
        }

        res.json({ message: 'Cours mis à jour avec succès.' });
    } catch (error) {
        console.error('Erreur updateCours:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour du cours.' });
    }
};

export const deleteCours = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const userId = req.user?.id;
    const { coursId } = req.params;

    try {
        const [check] = await db.query<RowDataPacket[]>(
            `SELECT c.id
             FROM cours c
             JOIN classes cl ON c.classe_id = cl.id
             WHERE c.id = ? AND cl.titulaire_id = ? AND cl.ecole_id = ?`,
            [coursId, userId, ecoleId]
        );

        if (check.length === 0) {
            res.status(403).json({ message: 'Accès non autorisé à ce cours.' });
            return;
        }

        const [notes] = await db.query<RowDataPacket[]>(
            'SELECT id FROM notes WHERE cours_id = ? LIMIT 1',
            [coursId]
        );

        if (notes.length > 0) {
            res.status(400).json({ message: 'Impossible de supprimer un cours qui a des notes. Supprimez d\'abord les notes.' });
            return;
        }

        await db.query<ResultSetHeader>('DELETE FROM cours WHERE id = ?', [coursId]);

        res.json({ message: 'Cours supprimé avec succès.' });
    } catch (error) {
        console.error('Erreur deleteCours:', error);
        res.status(500).json({ message: 'Erreur lors de la suppression du cours.' });
    }
};

// ============================================
// PÉRIODES PAR CLASSE
// ============================================

export const getPeriodesByClasse = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { classeId } = req.params;

    try {
        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT p.* 
             FROM periodes p
             WHERE p.ecole_id = ? AND p.est_active = 1
             ORDER BY p.ordre ASC`,
            [ecoleId]
        );

        res.json({ results: rows });
    } catch (error) {
        console.error('Erreur getPeriodesByClasse:', error);
        res.status(500).json({ message: 'Erreur lors du chargement des périodes.' });
    }
};

// ============================================
// GESTION DES NOTES - TOUS LES COURS MÊME SANS NOTE
// ============================================

export const getNotesByEleve = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const userId = req.user?.id;
    const { eleveId } = req.params;
    const periode = req.query?.periode || null;

    try {
        const [check] = await db.query<RowDataPacket[]>(
            `SELECT i.id, i.classe_id
             FROM inscriptions i
             JOIN classes c ON i.classe_id = c.id
             WHERE i.eleve_id = ? 
             AND c.titulaire_id = ?
             AND c.ecole_id = ?
             AND i.annee_scolaire_id = (
                 SELECT id FROM annees_scolaires 
                 WHERE ecole_id = ? AND statut = "OUVERTE" 
                 ORDER BY date_debut DESC LIMIT 1
             )`,
            [eleveId, userId, ecoleId, ecoleId]
        );

        if (check.length === 0) {
            res.status(403).json({ message: 'Accès non autorisé à cet élève.' });
            return;
        }

        const classeId = check[0].classe_id;

        // Récupérer TOUS les cours de la classe avec max_points
        let coursQuery = `
            SELECT c.id as cours_id, c.nom as cours_nom, cp.max_points, p.nom as periode_nom
            FROM cours c
            JOIN cours_periodes cp ON c.id = cp.cours_id
            JOIN periodes p ON cp.periode_id = p.id
            WHERE c.classe_id = ? AND p.est_active = 1
        `;
        const coursParams: any[] = [classeId];
        if (periode) {
            coursQuery += ` AND p.nom = ?`;
            coursParams.push(periode);
        }
        coursQuery += ` ORDER BY c.nom ASC, p.ordre ASC`;

        const [coursRows] = await db.query<RowDataPacket[]>(coursQuery, coursParams);

        // Récupérer les notes existantes
        let notesQuery = `
            SELECT n.id, n.note_obtenue, n.periode, n.cours_id, c.nom as cours_nom
            FROM notes n
            JOIN cours c ON n.cours_id = c.id
            WHERE n.inscription_id = (
                SELECT id FROM inscriptions 
                WHERE eleve_id = ? 
                AND annee_scolaire_id = (
                    SELECT id FROM annees_scolaires 
                    WHERE ecole_id = ? AND statut = "OUVERTE" 
                    ORDER BY date_debut DESC LIMIT 1
                )
            )
        `;
        const notesParams: any[] = [eleveId, ecoleId];
        if (periode) {
            notesQuery += ` AND n.periode = ?`;
            notesParams.push(periode);
        }

        const [notesRows] = await db.query<RowDataPacket[]>(notesQuery, notesParams);

        // Map des notes par (cours_id, periode)
        const notesMap = new Map<string, any>();
        for (const note of notesRows) {
            const key = `${note.cours_id}_${note.periode}`;
            notesMap.set(key, note);
        }

        // Fusion: tous les cours / chaque note existante ou null
        const results = coursRows.map((cours: any) => {
            const key = `${cours.cours_id}_${cours.periode_nom}`;
            const existingNote = notesMap.get(key);

            if (existingNote) {
                const maxPoints = parseFloat(cours.max_points) || 10;
                const noteObtenue = parseFloat(existingNote.note_obtenue) || 0;
                const pourcentage = maxPoints > 0 ? (noteObtenue / maxPoints) * 100 : 0;
                return {
                    id: existingNote.id,
                    note_obtenue: existingNote.note_obtenue,
                    periode: existingNote.periode,
                    date_saisie: existingNote.date_saisie,
                    cours_id: cours.cours_id,
                    cours_nom: cours.cours_nom,
                    max_points: parseFloat(cours.max_points) || 10,
                    pourcentage: Math.round(pourcentage * 100) / 100
                };
            } else {
                // Pas de note → null
                return {
                    id: null,
                    note_obtenue: null,
                    periode: cours.periode_nom,
                    date_saisie: null,
                    cours_id: cours.cours_id,
                    cours_nom: cours.cours_nom,
                    max_points: parseFloat(cours.max_points) || 10,
                    pourcentage: null
                };
            }
        });

        res.json({ results });
    } catch (error) {
        console.error('Erreur getNotesByEleve:', error);
        res.status(500).json({ message: 'Erreur lors du chargement des notes.' });
    }
};

export const createNote = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const userId = req.user?.id;
    const { eleveId } = req.params;
    const { cours_id, note_obtenue, periode } = req.body || {};

    try {
        if (!cours_id || note_obtenue === undefined || !periode) {
            res.status(400).json({ message: 'cours_id, note_obtenue et periode sont obligatoires.' });
            return;
        }

        const [inscription] = await db.query<RowDataPacket[]>(
            `SELECT i.id 
             FROM inscriptions i
             JOIN classes c ON i.classe_id = c.id
             WHERE i.eleve_id = ? 
             AND c.titulaire_id = ?
             AND c.ecole_id = ?
             AND i.annee_scolaire_id = (
                 SELECT id FROM annees_scolaires 
                 WHERE ecole_id = ? AND statut = "OUVERTE" 
                 ORDER BY date_debut DESC LIMIT 1
             )`,
            [eleveId, userId, ecoleId, ecoleId]
        );

        if (inscription.length === 0) {
            res.status(403).json({ message: 'Accès non autorisé à cet élève.' });
            return;
        }

        const inscriptionId = inscription[0].id;

        const [coursPeriode] = await db.query<RowDataPacket[]>(
            `SELECT cp.max_points
             FROM cours_periodes cp
             JOIN periodes p ON cp.periode_id = p.id
             WHERE cp.cours_id = ? AND p.nom = ?`,
            [cours_id, periode]
        );

        if (coursPeriode.length === 0) {
            res.status(404).json({
                message: 'Configuration du cours non trouvée pour cette période.'
            });
            return;
        }

        const maxPoints = parseFloat(coursPeriode[0].max_points) || 10;

        if (note_obtenue > maxPoints) {
            res.status(400).json({
                message: `La note ne peut pas dépasser ${maxPoints} pour la période ${periode}.`
            });
            return;
        }

        if (note_obtenue < 0) {
            res.status(400).json({
                message: 'La note ne peut pas être négative.'
            });
            return;
        }

        const [existing] = await db.query<RowDataPacket[]>(
            `SELECT id FROM notes 
             WHERE inscription_id = ? AND cours_id = ? AND periode = ?`,
            [inscriptionId, cours_id, periode]
        );

        if (existing.length > 0) {
            res.status(400).json({
                message: 'Une note existe déjà pour ce cours et cette période.',
                note_id: existing[0].id
            });
            return;
        }

        const [result] = await db.query<ResultSetHeader>(
            `INSERT INTO notes (inscription_id, cours_id, titulaire_id, periode, note_obtenue)
             VALUES (?, ?, ?, ?, ?)`,
            [inscriptionId, cours_id, userId, periode, note_obtenue]
        );

        res.status(201).json({
            message: 'Note enregistrée avec succès.',
            id: result.insertId
        });
    } catch (error) {
        console.error('Erreur createNote:', error);
        res.status(500).json({ message: 'Erreur lors de l\'enregistrement de la note.' });
    }
};

export const updateNote = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const userId = req.user?.id;
    const { noteId } = req.params;
    const { note_obtenue } = req.body || {};

    try {
        if (note_obtenue === undefined) {
            res.status(400).json({ message: 'note_obtenue est obligatoire.' });
            return;
        }

        const [check] = await db.query<RowDataPacket[]>(
            `SELECT n.id, cp.max_points
             FROM notes n
             JOIN inscriptions i ON n.inscription_id = i.id
             JOIN eleves e ON i.eleve_id = e.id
             JOIN cours c ON n.cours_id = c.id
             JOIN cours_periodes cp ON c.id = cp.cours_id
             JOIN periodes p ON cp.periode_id = p.id AND p.nom = n.periode
             JOIN classes cl ON i.classe_id = cl.id
             WHERE n.id = ? AND cl.titulaire_id = ? AND e.ecole_id = ?`,
            [noteId, userId, ecoleId]
        );

        if (check.length === 0) {
            res.status(403).json({ message: 'Accès non autorisé à cette note.' });
            return;
        }

        const maxPoints = parseFloat(check[0].max_points) || 10;

        if (note_obtenue > maxPoints) {
            res.status(400).json({
                message: `La note ne peut pas dépasser ${maxPoints} pour cette période.`
            });
            return;
        }

        if (note_obtenue < 0) {
            res.status(400).json({
                message: 'La note ne peut pas être négative.'
            });
            return;
        }

        await db.query<ResultSetHeader>(
            `UPDATE notes SET note_obtenue = ? WHERE id = ?`,
            [note_obtenue, noteId]
        );

        res.json({ message: 'Note mise à jour avec succès.' });
    } catch (error) {
        console.error('Erreur updateNote:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour de la note.' });
    }
};

export const deleteNote = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const userId = req.user?.id;
    const { noteId } = req.params;

    try {
        const [check] = await db.query<RowDataPacket[]>(
            `SELECT n.id
             FROM notes n
             JOIN inscriptions i ON n.inscription_id = i.id
             JOIN classes c ON i.classe_id = c.id
             WHERE n.id = ? AND c.titulaire_id = ? AND c.ecole_id = ?`,
            [noteId, userId, ecoleId]
        );

        if (check.length === 0) {
            res.status(403).json({ message: 'Accès non autorisé à cette note.' });
            return;
        }

        await db.query<ResultSetHeader>('DELETE FROM notes WHERE id = ?', [noteId]);

        res.json({ message: 'Note supprimée avec succès.' });
    } catch (error) {
        console.error('Erreur deleteNote:', error);
        res.status(500).json({ message: 'Erreur lors de la suppression de la note.' });
    }
};

// ============================================
// GESTION DES APPRÉCIATIONS
// ============================================

export const getAppreciationsByEleve = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const userId = req.user?.id;
    const { eleveId } = req.params;

    try {
        const [check] = await db.query<RowDataPacket[]>(
            `SELECT i.id 
             FROM inscriptions i
             JOIN classes c ON i.classe_id = c.id
             WHERE i.eleve_id = ? 
             AND c.titulaire_id = ?
             AND c.ecole_id = ?`,
            [eleveId, userId, ecoleId]
        );

        if (check.length === 0) {
            res.status(403).json({ message: 'Accès non autorisé à cet élève.' });
            return;
        }

        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT 
                id,
                date_jour,
                observation_discipline,
                statut
             FROM presences_disciplines
             WHERE inscription_id = (
                 SELECT id FROM inscriptions 
                 WHERE eleve_id = ? 
                 AND annee_scolaire_id = (
                     SELECT id FROM annees_scolaires 
                     WHERE ecole_id = ? AND statut = "OUVERTE" 
                     ORDER BY date_debut DESC LIMIT 1
                 )
             )
             AND observation_discipline IS NOT NULL
             ORDER BY date_jour DESC`,
            [eleveId, ecoleId]
        );

        res.json({ results: rows });
    } catch (error) {
        console.error('Erreur getAppreciationsByEleve:', error);
        res.status(500).json({ message: 'Erreur lors du chargement des appréciations.' });
    }
};

export const createAppreciation = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const userId = req.user?.id;
    const { eleveId } = req.params;
    const { date_jour, observation_discipline, statut } = req.body || {};

    try {
        if (!date_jour || !observation_discipline) {
            res.status(400).json({ message: 'date_jour et observation_discipline sont obligatoires.' });
            return;
        }

        const [inscription] = await db.query<RowDataPacket[]>(
            `SELECT i.id 
             FROM inscriptions i
             JOIN classes c ON i.classe_id = c.id
             WHERE i.eleve_id = ? 
             AND c.titulaire_id = ?
             AND c.ecole_id = ?
             AND i.annee_scolaire_id = (
                 SELECT id FROM annees_scolaires 
                 WHERE ecole_id = ? AND statut = "OUVERTE" 
                 ORDER BY date_debut DESC LIMIT 1
             )`,
            [eleveId, userId, ecoleId, ecoleId]
        );

        if (inscription.length === 0) {
            res.status(403).json({ message: 'Accès non autorisé à cet élève.' });
            return;
        }

        const [result] = await db.query<ResultSetHeader>(
            `INSERT INTO presences_disciplines (inscription_id, date_jour, observation_discipline, statut)
             VALUES (?, ?, ?, ?)`,
            [inscription[0].id, date_jour, observation_discipline, statut || 'PRESENT']
        );

        res.status(201).json({
            message: 'Appréciation enregistrée avec succès.',
            id: result.insertId
        });
    } catch (error) {
        console.error('Erreur createAppreciation:', error);
        res.status(500).json({ message: 'Erreur lors de l\'enregistrement de l\'appréciation.' });
    }
};

export const updateAppreciation = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const userId = req.user?.id;
    const { appreciationId } = req.params;
    const { observation_discipline } = req.body || {};

    try {
        if (!observation_discipline) {
            res.status(400).json({ message: 'observation_discipline est obligatoire.' });
            return;
        }

        const [check] = await db.query<RowDataPacket[]>(
            `SELECT pd.id
             FROM presences_disciplines pd
             JOIN inscriptions i ON pd.inscription_id = i.id
             JOIN classes c ON i.classe_id = c.id
             WHERE pd.id = ? AND c.titulaire_id = ? AND c.ecole_id = ?`,
            [appreciationId, userId, ecoleId]
        );

        if (check.length === 0) {
            res.status(403).json({ message: 'Accès non autorisé à cette appréciation.' });
            return;
        }

        await db.query<ResultSetHeader>(
            `UPDATE presences_disciplines SET observation_discipline = ? WHERE id = ?`,
            [observation_discipline, appreciationId]
        );

        res.json({ message: 'Appréciation mise à jour avec succès.' });
    } catch (error) {
        console.error('Erreur updateAppreciation:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour de l\'appréciation.' });
    }
};

// ============================================
// GESTION DES PRÉSENCES/ABSENCES
// ============================================

export const getPresencesByEleve = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const userId = req.user?.id;
    const { eleveId } = req.params;

    try {
        const [check] = await db.query<RowDataPacket[]>(
            `SELECT i.id 
             FROM inscriptions i
             JOIN classes c ON i.classe_id = c.id
             WHERE i.eleve_id = ? 
             AND c.titulaire_id = ?
             AND c.ecole_id = ?`,
            [eleveId, userId, ecoleId]
        );

        if (check.length === 0) {
            res.status(403).json({ message: 'Accès non autorisé à cet élève.' });
            return;
        }

        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT 
                id,
                date_jour,
                statut,
                observation_discipline
             FROM presences_disciplines
             WHERE inscription_id = (
                 SELECT id FROM inscriptions 
                 WHERE eleve_id = ? 
                 AND annee_scolaire_id = (
                     SELECT id FROM annees_scolaires 
                     WHERE ecole_id = ? AND statut = "OUVERTE" 
                     ORDER BY date_debut DESC LIMIT 1
                 )
             )
             ORDER BY date_jour DESC`,
            [eleveId, ecoleId]
        );

        res.json({ results: rows });
    } catch (error) {
        console.error('Erreur getPresencesByEleve:', error);
        res.status(500).json({ message: 'Erreur lors du chargement des présences.' });
    }
};

export const createPresence = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const userId = req.user?.id;
    const { eleveId } = req.params;
    const { date_jour, statut, observation_discipline } = req.body || {};

    try {
        if (!date_jour || !statut) {
            res.status(400).json({ message: 'date_jour et statut sont obligatoires.' });
            return;
        }

        const [inscription] = await db.query<RowDataPacket[]>(
            `SELECT i.id 
             FROM inscriptions i
             JOIN classes c ON i.classe_id = c.id
             WHERE i.eleve_id = ? 
             AND c.titulaire_id = ?
             AND c.ecole_id = ?
             AND i.annee_scolaire_id = (
                 SELECT id FROM annees_scolaires 
                 WHERE ecole_id = ? AND statut = "OUVERTE" 
                 ORDER BY date_debut DESC LIMIT 1
             )`,
            [eleveId, userId, ecoleId, ecoleId]
        );

        if (inscription.length === 0) {
            res.status(403).json({ message: 'Accès non autorisé à cet élève.' });
            return;
        }

        const [existing] = await db.query<RowDataPacket[]>(
            `SELECT id FROM presences_disciplines 
             WHERE inscription_id = ? AND date_jour = ?`,
            [inscription[0].id, date_jour]
        );

        if (existing.length > 0) {
            res.status(400).json({
                message: 'Une présence existe déjà pour cette date.',
                presence_id: existing[0].id
            });
            return;
        }

        const [result] = await db.query<ResultSetHeader>(
            `INSERT INTO presences_disciplines (inscription_id, date_jour, statut, observation_discipline)
             VALUES (?, ?, ?, ?)`,
            [inscription[0].id, date_jour, statut, observation_discipline || null]
        );

        res.status(201).json({
            message: 'Présence enregistrée avec succès.',
            id: result.insertId
        });
    } catch (error) {
        console.error('Erreur createPresence:', error);
        res.status(500).json({ message: 'Erreur lors de l\'enregistrement de la présence.' });
    }
};

export const updatePresence = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const userId = req.user?.id;
    const { presenceId } = req.params;
    const { statut, observation_discipline } = req.body || {};

    try {
        if (!statut) {
            res.status(400).json({ message: 'statut est obligatoire.' });
            return;
        }

        const [check] = await db.query<RowDataPacket[]>(
            `SELECT pd.id
             FROM presences_disciplines pd
             JOIN inscriptions i ON pd.inscription_id = i.id
             JOIN classes c ON i.classe_id = c.id
             WHERE pd.id = ? AND c.titulaire_id = ? AND c.ecole_id = ?`,
            [presenceId, userId, ecoleId]
        );

        if (check.length === 0) {
            res.status(403).json({ message: 'Accès non autorisé à cette présence.' });
            return;
        }

        await db.query<ResultSetHeader>(
            `UPDATE presences_disciplines SET statut = ?, observation_discipline = ? WHERE id = ?`,
            [statut, observation_discipline || null, presenceId]
        );

        res.json({ message: 'Présence mise à jour avec succès.' });
    } catch (error) {
        console.error('Erreur updatePresence:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour de la présence.' });
    }
};

// ============================================
// BULLETIN SCOLAIRE - NON CLASSE SI NOTE MANQUANTE
// ============================================

export const getBulletinData = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const userId = req.user?.id;
    const { eleveId } = req.params;
    const periodeId = req.query?.periode || null;

    try {
        const [check] = await db.query<RowDataPacket[]>(
            `SELECT i.id, i.classe_id
             FROM inscriptions i
             JOIN classes c ON i.classe_id = c.id
             WHERE i.eleve_id = ? 
             AND c.titulaire_id = ?
             AND c.ecole_id = ?
             AND i.annee_scolaire_id = (
                 SELECT id FROM annees_scolaires 
                 WHERE ecole_id = ? AND statut = "OUVERTE" 
                 ORDER BY date_debut DESC LIMIT 1
             )`,
            [eleveId, userId, ecoleId, ecoleId]
        );

        if (check.length === 0) {
            res.status(403).json({ message: 'Accès non autorisé à cet élève.' });
            return;
        }

        const inscriptionId = check[0].id;
        const classeId = check[0].classe_id;

        let periodeNom = null;
        if (periodeId) {
            const [periodeData] = await db.query<RowDataPacket[]>(
                `SELECT nom FROM periodes WHERE id = ? AND ecole_id = ?`,
                [periodeId, ecoleId]
            );
            if (periodeData.length > 0) {
                periodeNom = periodeData[0].nom;
            }
        }

        // Récupérer TOUS les cours configurés pour cette classe/période
        let coursTotalQuery = `
            SELECT c.id as cours_id, c.nom as cours_nom, cp.max_points
            FROM cours c
            JOIN cours_periodes cp ON c.id = cp.cours_id
            JOIN periodes p ON cp.periode_id = p.id
            WHERE c.classe_id = ? AND p.est_active = 1
        `;
        const coursTotalParams: any[] = [classeId];
        if (periodeNom) {
            coursTotalQuery += ` AND p.nom = ?`;
            coursTotalParams.push(periodeNom);
        }
        coursTotalQuery += ` ORDER BY c.nom ASC`;

        const [coursTotal] = await db.query<RowDataPacket[]>(coursTotalQuery, coursTotalParams);
        const totalCoursRequis = coursTotal.length;

        // Récupérer les notes existantes pour cet élève
        let notesQuery = `
            SELECT n.id, n.note_obtenue, n.periode, n.cours_id, c.nom as cours_nom
            FROM notes n
            JOIN cours c ON n.cours_id = c.id
            WHERE n.inscription_id = ?
        `;
        const params: any[] = [inscriptionId];
        if (periodeNom) {
            notesQuery += ` AND n.periode = ?`;
            params.push(periodeNom);
        }
        const [notes] = await db.query<RowDataPacket[]>(notesQuery, params);

        // Map des notes par cours_id
        const notesMap = new Map<number, any>();
        for (const note of notes) {
            notesMap.set(note.cours_id, note);
        }

        // Vérifier si TOUS les cours ont une note
        const coursAvecNote = new Set(notes.map((n: any) => n.cours_id));
        const tousCoursNotes = coursTotal.every((c: any) => coursAvecNote.has(c.cours_id));
        const nonClasse = !tousCoursNotes || totalCoursRequis === 0;

        // Résultats par cours (même sans note)
        let totalPointsObtenus = 0;
        let totalPointsMax = 0;
        const resultatsParCours: any[] = [];

        for (const cours of coursTotal) {
            const existingNote = notesMap.get(cours.cours_id);
            const maxPoints = parseFloat(cours.max_points) || 10;

            if (existingNote) {
                const noteObtenue = parseFloat(existingNote.note_obtenue) || 0;
                const pourcentage = maxPoints > 0 ? (noteObtenue / maxPoints) * 100 : 0;
                resultatsParCours.push({
                    cours: cours.cours_nom,
                    note_obtenue: noteObtenue,
                    max_points: maxPoints,
                    pourcentage: Math.round(pourcentage * 100) / 100
                });
                totalPointsObtenus += noteObtenue;
                totalPointsMax += maxPoints;
            } else {
                // Pas de note → null
                resultatsParCours.push({
                    cours: cours.cours_nom,
                    note_obtenue: null,
                    max_points: maxPoints,
                    pourcentage: null
                });
            }
        }

        // % global UNIQUEMENT si TOUS les cours ont des notes
        let pourcentageGlobal = null;
        if (!nonClasse && totalPointsMax > 0) {
            pourcentageGlobal = Math.round((totalPointsObtenus / totalPointsMax) * 10000) / 100;
        }

        const [eleveInfo] = await db.query<RowDataPacket[]>(
            `SELECT e.*, c.nom as classe_nom, c.section, c.option_classe,
                    a.nom as annee_scolaire_nom, ec.nom as ecole_nom,
                    ec.logo, ec.adresse, ec.telephone, ec.email
             FROM eleves e
             JOIN inscriptions i ON e.id = i.eleve_id
             JOIN classes c ON i.classe_id = c.id
             JOIN annees_scolaires a ON i.annee_scolaire_id = a.id
             JOIN ecoles ec ON e.ecole_id = ec.id
             WHERE e.id = ? AND i.id = ?`,
            [eleveId, inscriptionId]
        );

        let estAutorise = false;
        let estPublie = false;
        let rang = null;

        if (periodeId) {
            const [autorisation] = await db.query<RowDataPacket[]>(
                `SELECT statut FROM autorisations_bulletin
                 WHERE inscription_id = ? AND periode_id = ?`,
                [inscriptionId, periodeId]
            );
            estAutorise = autorisation.length > 0 && autorisation[0].statut === 'AUTORISE';
        }

        if (periodeId) {
            const [bulletinPublie] = await db.query<RowDataPacket[]>(
                `SELECT est_publie, date_publication
                 FROM bulletins_publies
                 WHERE inscription_id = ? AND periode_id = ?`,
                [inscriptionId, periodeId]
            );
            estPublie = bulletinPublie.length > 0 && bulletinPublie[0].est_publie === 1;
        }

        // Classement: uniquement les élèves qui ont TOUTES leurs notes
        if (periodeId && periodeNom && !nonClasse) {
            // Compter le nombre total de cours requis pour cette classe/période
            const [totalCoursResult] = await db.query<RowDataPacket[]>(
                `SELECT COUNT(DISTINCT c.id) as total
                 FROM cours c
                 JOIN cours_periodes cp ON c.id = cp.cours_id
                 JOIN periodes p ON cp.periode_id = p.id
                 WHERE c.classe_id = ? AND p.nom = ? AND p.est_active = 1`,
                [classeId, periodeNom]
            );
            const totalCoursRequis = totalCoursResult[0]?.total || 0;

            const [classement] = await db.query<RowDataPacket[]>(
                `SELECT 
                    i.eleve_id,
                    COALESCE(SUM(n.note_obtenue), 0) as total_points_obtenus,
                    COALESCE(SUM(cp.max_points), 0) as total_points_max,
                    COUNT(DISTINCT n.cours_id) as cours_notes_count,
                    CASE 
                        WHEN COALESCE(SUM(cp.max_points), 0) > 0 
                        THEN (COALESCE(SUM(n.note_obtenue), 0) / COALESCE(SUM(cp.max_points), 0)) * 100
                        ELSE 0
                    END as pourcentage
                 FROM inscriptions i
                 LEFT JOIN notes n ON i.id = n.inscription_id AND n.periode = ?
                 LEFT JOIN periodes p ON p.nom = n.periode AND p.est_active = 1
                 LEFT JOIN cours_periodes cp ON cp.cours_id = n.cours_id AND cp.periode_id = p.id
                 WHERE i.classe_id = ? 
                 AND i.annee_scolaire_id = (
                     SELECT id FROM annees_scolaires 
                     WHERE ecole_id = ? AND statut = "OUVERTE" 
                     ORDER BY date_debut DESC LIMIT 1
                 )
                 GROUP BY i.eleve_id
                 HAVING cours_notes_count >= ? AND total_points_max > 0
                 ORDER BY pourcentage DESC`,
                [periodeNom, classeId, ecoleId, totalCoursRequis]
            );

            const eleveIdNum = Number(eleveId);
            const position = classement.findIndex((e: any) => Number(e.eleve_id) === eleveIdNum);
            if (position !== -1) {
                rang = position + 1;
            }
        }

        const [appreciations] = await db.query<RowDataPacket[]>(
            `SELECT date_jour, observation_discipline
             FROM presences_disciplines
             WHERE inscription_id = ? 
             AND observation_discipline IS NOT NULL
             ORDER BY date_jour DESC
             LIMIT 5`,
            [inscriptionId]
        );

        const [presences] = await db.query<RowDataPacket[]>(
            `SELECT COUNT(*) as total, 
                    SUM(CASE WHEN statut = 'PRESENT' THEN 1 ELSE 0 END) as presents,
                    SUM(CASE WHEN statut = 'ABSENT' THEN 1 ELSE 0 END) as absents,
                    SUM(CASE WHEN statut = 'JUSTIFIE' THEN 1 ELSE 0 END) as justifies
             FROM presences_disciplines
             WHERE inscription_id = ?`,
            [inscriptionId]
        );

        res.json({
            eleve: {
                ...eleveInfo[0],
                ecole_nom: eleveInfo[0]?.ecole_nom || ''
            },
            classe: {
                nom: eleveInfo[0]?.classe_nom || '',
                section: eleveInfo[0]?.section || '',
                option: eleveInfo[0]?.option_classe || ''
            },
            anneeScolaire: eleveInfo[0]?.annee_scolaire_nom || '',
            ecoleNom: eleveInfo[0]?.ecole_nom || '',
            ecole: {
                logo: eleveInfo[0]?.logo || null,
                adresse: eleveInfo[0]?.adresse || '',
                telephone: eleveInfo[0]?.telephone || '',
                email: eleveInfo[0]?.email || ''
            },
            resultats: resultatsParCours,
            totalPointsObtenus: nonClasse ? 0 : Math.round(totalPointsObtenus * 100) / 100,
            totalPointsMax: totalPointsMax,
            pourcentageGlobal: pourcentageGlobal,
            rang: rang,
            nonClasse: nonClasse,
            appreciations: appreciations || [],
            presences: presences[0] || { total: 0, presents: 0, absents: 0, justifies: 0 },
            estAutorise,
            estPublie,
            periode: periodeNom || null,
            periodeId: periodeId
        });
    } catch (error) {
        console.error('Erreur getBulletinData:', error);
        res.status(500).json({ message: 'Erreur lors du chargement du bulletin.' });
    }
};

// ============================================
// GÉNÉRATION PDF DU BULLETIN
// ============================================

export const generateBulletinPDF = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const userId = req.user?.id;
    const { eleveId } = req.params;
    const { periode_id } = req.body || {};

    try {
        if (!periode_id) {
            res.status(400).json({ message: 'periode_id est obligatoire.' });
            return;
        }

        const [periodeData] = await db.query<RowDataPacket[]>(
            `SELECT nom FROM periodes WHERE id = ? AND ecole_id = ?`,
            [periode_id, ecoleId]
        );

        if (periodeData.length === 0) {
            res.status(404).json({ message: 'Période non trouvée.' });
            return;
        }

        const periodeNom = periodeData[0].nom;

        const [check] = await db.query<RowDataPacket[]>(
            `SELECT i.id, i.classe_id
             FROM inscriptions i
             JOIN classes c ON i.classe_id = c.id
             WHERE i.eleve_id = ? 
             AND c.titulaire_id = ?
             AND c.ecole_id = ?
             AND i.annee_scolaire_id = (
                 SELECT id FROM annees_scolaires 
                 WHERE ecole_id = ? AND statut = "OUVERTE" 
                 ORDER BY date_debut DESC LIMIT 1
             )`,
            [eleveId, userId, ecoleId, ecoleId]
        );

        if (check.length === 0) {
            res.status(403).json({ message: 'Accès non autorisé à cet élève.' });
            return;
        }

        const inscriptionId = check[0].id;
        const classeId = check[0].classe_id;

        // Récupérer TOUS les cours configurés pour cette classe/période
        let coursTotalQuery = `
            SELECT c.id as cours_id, c.nom as cours_nom, cp.max_points
            FROM cours c
            JOIN cours_periodes cp ON c.id = cp.cours_id
            JOIN periodes p ON cp.periode_id = p.id
            WHERE c.classe_id = ? AND p.est_active = 1 AND p.nom = ?
            ORDER BY c.nom ASC
        `;
        const [coursTotal] = await db.query<RowDataPacket[]>(coursTotalQuery, [classeId, periodeNom]);
        const totalCoursRequis = coursTotal.length;

        // Récupérer les notes existantes
        const [notes] = await db.query<RowDataPacket[]>(
            `SELECT c.nom as cours_nom, n.note_obtenue, cp.max_points,
                    ROUND((n.note_obtenue / cp.max_points) * 100, 2) as pourcentage
             FROM notes n
             JOIN cours c ON n.cours_id = c.id
             JOIN cours_periodes cp ON c.id = cp.cours_id
             JOIN periodes p ON cp.periode_id = p.id AND p.nom = n.periode
             WHERE n.inscription_id = ? AND n.periode = ?
             ORDER BY c.nom ASC`,
            [inscriptionId, periodeNom]
        );

        // Vérifier si TOUS les cours ont une note
        const coursAvecNote = new Set(notes.map((n: any) => n.cours_nom));
        const tousCoursNotes = coursTotal.every((c: any) => coursAvecNote.has(c.cours_nom));
        const nonClasse = !tousCoursNotes || totalCoursRequis === 0;

        // Construire les notes avec tous les cours
        const notesMap = new Map<string, any>();
        for (const note of notes) {
            notesMap.set(note.cours_nom, note);
        }

        const notesCompletes = coursTotal.map((c: any) => {
            const existing = notesMap.get(c.cours_nom);
            if (existing) {
                return {
                    cours: c.cours_nom,
                    note: parseFloat(existing.note_obtenue) || 0,
                    max: parseFloat(existing.max_points) || 10,
                    pourcentage: parseFloat(existing.pourcentage) || 0
                };
            } else {
                return {
                    cours: c.cours_nom,
                    note: null,
                    max: parseFloat(c.max_points) || 10,
                    pourcentage: null
                };
            }
        });

        let totalPointsObtenus = 0;
        let totalPointsMax = 0;
        for (const n of notesCompletes) {
            if (n.note !== null) {
                totalPointsObtenus += n.note;
                totalPointsMax += n.max;
            }
        }

        const pourcentageGlobal = !nonClasse && totalPointsMax > 0
            ? Math.round((totalPointsObtenus / totalPointsMax) * 10000) / 100
            : null;

        const [eleveInfo] = await db.query<RowDataPacket[]>(
            `SELECT e.nom, e.prenom, e.postnom, e.matricule, e.sexe,
                    c.nom as classe_nom, c.section, c.option_classe,
                    ec.nom as ecole_nom, ec.adresse, ec.telephone, ec.email, ec.logo,
                    a.nom as annee_scolaire_nom
             FROM inscriptions i
             JOIN eleves e ON i.eleve_id = e.id
             JOIN classes c ON i.classe_id = c.id
             JOIN ecoles ec ON e.ecole_id = ec.id
             JOIN annees_scolaires a ON i.annee_scolaire_id = a.id
             WHERE i.eleve_id = ? AND c.titulaire_id = ? AND e.ecole_id = ?`,
            [eleveId, userId, ecoleId]
        );

        if (eleveInfo.length === 0) {
            res.status(404).json({ message: 'Élève non trouvé ou non autorisé.' });
            return;
        }

        const [appreciations] = await db.query<RowDataPacket[]>(
            `SELECT date_jour, observation_discipline
             FROM presences_disciplines
             WHERE inscription_id = ? 
             AND observation_discipline IS NOT NULL
             ORDER BY date_jour DESC
             LIMIT 5`,
            [inscriptionId]
        );

        const [presences] = await db.query<RowDataPacket[]>(
            `SELECT COUNT(*) as total, 
                    SUM(CASE WHEN statut = 'PRESENT' THEN 1 ELSE 0 END) as presents,
                    SUM(CASE WHEN statut = 'ABSENT' THEN 1 ELSE 0 END) as absents,
                    SUM(CASE WHEN statut = 'JUSTIFIE' THEN 1 ELSE 0 END) as justifies
             FROM presences_disciplines
             WHERE inscription_id = ?`,
            [inscriptionId]
        );

        let rang = null;
        if (!nonClasse) {
            // Compter le nombre total de cours requis
            const [totalCoursResult] = await db.query<RowDataPacket[]>(
                `SELECT COUNT(DISTINCT c.id) as total
                 FROM cours c
                 JOIN cours_periodes cp ON c.id = cp.cours_id
                 JOIN periodes p ON cp.periode_id = p.id
                 WHERE c.classe_id = ? AND p.nom = ? AND p.est_active = 1`,
                [classeId, periodeNom]
            );
            const totalCoursRequis = totalCoursResult[0]?.total || 0;

            const [classement] = await db.query<RowDataPacket[]>(
                `SELECT i.eleve_id,
                    COALESCE(SUM(n.note_obtenue), 0) as total_points_obtenus,
                    COALESCE(SUM(cp.max_points), 0) as total_points_max,
                    COUNT(DISTINCT n.cours_id) as cours_notes_count,
                    CASE 
                        WHEN COALESCE(SUM(cp.max_points), 0) > 0 
                        THEN (COALESCE(SUM(n.note_obtenue), 0) / COALESCE(SUM(cp.max_points), 0)) * 100
                        ELSE 0
                    END as pourcentage
                 FROM inscriptions i
                 LEFT JOIN notes n ON i.id = n.inscription_id AND n.periode = ?
                 LEFT JOIN periodes p ON p.nom = n.periode AND p.est_active = 1
                 LEFT JOIN cours_periodes cp ON cp.cours_id = n.cours_id AND cp.periode_id = p.id
                 WHERE i.classe_id = ? 
                 AND i.annee_scolaire_id = (
                     SELECT id FROM annees_scolaires 
                     WHERE ecole_id = ? AND statut = "OUVERTE" 
                     ORDER BY date_debut DESC LIMIT 1
                 )
                 GROUP BY i.eleve_id
                 HAVING cours_notes_count >= ? AND total_points_max > 0
                 ORDER BY pourcentage DESC`,
                [periodeNom, classeId, ecoleId, totalCoursRequis]
            );

            const eleveIdNum = Number(eleveId);
            const position = classement.findIndex((e: any) => Number(e.eleve_id) === eleveIdNum);
            if (position !== -1) {
                rang = position + 1;
            }
        }

        const bulletinData = {
            ecole: {
                nom: eleveInfo[0].ecole_nom || '',
                adresse: eleveInfo[0].adresse || '',
                telephone: eleveInfo[0].telephone || '',
                email: eleveInfo[0].email || '',
                logo: eleveInfo[0].logo || null
            },
            eleve: {
                nom: eleveInfo[0].nom || '',
                prenom: eleveInfo[0].prenom || '',
                postnom: eleveInfo[0].postnom || '',
                matricule: eleveInfo[0].matricule || '',
                sexe: eleveInfo[0].sexe || ''
            },
            classe: {
                nom: eleveInfo[0].classe_nom || '',
                section: eleveInfo[0].section || '',
                option: eleveInfo[0].option_classe || ''
            },
            anneeScolaire: eleveInfo[0].annee_scolaire_nom || '',
            periode: periodeNom,
            notes: notesCompletes,
            totalPointsObtenus: Math.round(totalPointsObtenus * 100) / 100,
            totalPointsMax: totalPointsMax,
            pourcentageGlobal: pourcentageGlobal,
            rang: rang,
            nonClasse: nonClasse,
            appreciations: appreciations || [],
            presences: {
                total: presences[0]?.total || 0,
                presents: presences[0]?.presents || 0,
                absents: presences[0]?.absents || 0,
                justifies: presences[0]?.justifies || 0
            }
        };

        res.json({
            success: true,
            data: bulletinData
        });

    } catch (error) {
        console.error('Erreur generateBulletinPDF:', error);
        res.status(500).json({ message: 'Erreur lors de la génération du bulletin.' });
    }
};

export const publierBulletin = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const userId = req.user?.id;
    const { eleveId } = req.params;
    const { periode_id } = req.body || {};

    try {
        if (!periode_id) {
            res.status(400).json({ message: 'periode_id est obligatoire.' });
            return;
        }

        const [inscription] = await db.query<RowDataPacket[]>(
            `SELECT i.id
             FROM inscriptions i
             JOIN classes c ON i.classe_id = c.id
             WHERE i.eleve_id = ? 
             AND c.titulaire_id = ?
             AND c.ecole_id = ?
             AND i.annee_scolaire_id = (
                 SELECT id FROM annees_scolaires 
                 WHERE ecole_id = ? AND statut = "OUVERTE" 
                 ORDER BY date_debut DESC LIMIT 1
             )`,
            [eleveId, userId, ecoleId, ecoleId]
        );

        if (inscription.length === 0) {
            res.status(403).json({ message: 'Accès non autorisé à cet élève.' });
            return;
        }

        const inscriptionId = inscription[0].id;

        const [existing] = await db.query<RowDataPacket[]>(
            `SELECT id FROM bulletins_publies
             WHERE inscription_id = ? AND periode_id = ?`,
            [inscriptionId, periode_id]
        );

        if (existing.length > 0) {
            await db.query<ResultSetHeader>(
                `UPDATE bulletins_publies 
                 SET est_publie = 1, date_publication = NOW()
                 WHERE id = ?`,
                [existing[0].id]
            );
        } else {
            await db.query<ResultSetHeader>(
                `INSERT INTO bulletins_publies (inscription_id, periode_id, est_publie, date_publication)
                 VALUES (?, ?, 1, NOW())`,
                [inscriptionId, periode_id]
            );
        }

        res.json({
            message: 'Bulletin publié avec succès. Les résultats sont maintenant visibles publiquement.'
        });
    } catch (error) {
        console.error('Erreur publierBulletin:', error);
        res.status(500).json({ message: 'Erreur lors de la publication du bulletin.' });
    }
};

export const getResultatsPublics = async (req: any, res: Response): Promise<void> => {
    const { matricule } = req.params;

    try {
        if (!matricule) {
            res.status(400).json({ message: 'Matricule est requis.' });
            return;
        }

        const [eleve] = await db.query<RowDataPacket[]>(
            `SELECT e.*, ec.nom as ecole_nom
             FROM eleves e
             JOIN ecoles ec ON e.ecole_id = ec.id
             WHERE e.matricule = ?`,
            [matricule]
        );

        if (eleve.length === 0) {
            res.status(404).json({ message: 'Élève non trouvé.' });
            return;
        }

        const eleveId = eleve[0].id;
        const ecoleId = eleve[0].ecole_id;

        const [inscription] = await db.query<RowDataPacket[]>(
            `SELECT i.id, i.classe_id, a.nom as annee_scolaire_nom, c.nom as classe_nom, 
                    c.section, c.option_classe
             FROM inscriptions i
             JOIN annees_scolaires a ON i.annee_scolaire_id = a.id
             JOIN classes c ON i.classe_id = c.id
             WHERE i.eleve_id = ? 
             AND i.annee_scolaire_id = (
                 SELECT id FROM annees_scolaires 
                 WHERE ecole_id = ? AND statut = "OUVERTE" 
                 ORDER BY date_debut DESC LIMIT 1
             )`,
            [eleveId, ecoleId]
        );

        if (inscription.length === 0) {
            res.json({
                eleve: eleve[0],
                ecole: { nom: eleve[0].ecole_nom },
                message: 'Aucune inscription trouvée pour l\'année en cours.',
                resultats: [],
                estEligible: false,
                estPublie: false
            });
            return;
        }

        const inscriptionId = inscription[0].id;
        const classeId = inscription[0].classe_id;

        const [periodes] = await db.query<RowDataPacket[]>(
            `SELECT p.*, 
                    ab.statut as autorisation_statut,
                    bp.est_publie,
                    bp.date_publication
             FROM periodes p
             LEFT JOIN autorisations_bulletin ab ON ab.periode_id = p.id AND ab.inscription_id = ?
             LEFT JOIN bulletins_publies bp ON bp.periode_id = p.id AND bp.inscription_id = ?
             WHERE p.ecole_id = ? AND p.est_active = 1
             ORDER BY p.ordre ASC`,
            [inscriptionId, inscriptionId, ecoleId]
        );

        const resultatsParPeriode: any[] = [];
        let aDesResultatsEligibles = false;

        for (const periode of periodes) {
            const estPublie = periode.est_publie === 1;
            const estAutorise = periode.autorisation_statut === 'AUTORISE';
            const estEligible = estPublie && estAutorise;

            // Récupérer TOUS les cours de la classe pour cette période
            const [coursTotal] = await db.query<RowDataPacket[]>(
                `SELECT c.id as cours_id, c.nom as cours_nom, cp.max_points
                 FROM cours c
                 JOIN cours_periodes cp ON c.id = cp.cours_id
                 JOIN periodes p ON cp.periode_id = p.id
                 WHERE c.classe_id = ? AND p.est_active = 1 AND p.nom = ?
                 ORDER BY c.nom ASC`,
                [classeId, periode.nom]
            );

            // Récupérer les notes existantes
            const [notes] = await db.query<RowDataPacket[]>(
                `SELECT n.note_obtenue, c.nom as cours_nom, cp.max_points
                 FROM notes n
                 JOIN cours c ON n.cours_id = c.id
                 JOIN cours_periodes cp ON c.id = cp.cours_id
                 JOIN periodes p ON cp.periode_id = p.id AND p.nom = n.periode
                 WHERE n.inscription_id = ? AND n.periode = ?`,
                [inscriptionId, periode.nom]
            );

            // Vérifier si TOUS les cours ont des notes
            const coursAvecNote = new Set(notes.map((n: any) => n.cours_nom));
            const tousCoursNotes = coursTotal.every((c: any) => coursAvecNote.has(c.cours_nom));
            const nonClasse = !tousCoursNotes || coursTotal.length === 0;

            // Construire les notes avec tous les cours
            const notesMap = new Map<string, any>();
            for (const note of notes) {
                notesMap.set(note.cours_nom, note);
            }

            const notesAvecPourcentage: any[] = [];
            let totalPointsObtenus = 0;
            let totalPointsMax = 0;

            for (const cours of coursTotal) {
                const existing = notesMap.get(cours.cours_nom);
                const maxPoints = parseFloat(cours.max_points) || 10;

                if (existing) {
                    const noteObtenue = parseFloat(existing.note_obtenue) || 0;
                    const pourcentage = maxPoints > 0 ? (noteObtenue / maxPoints) * 100 : 0;
                    notesAvecPourcentage.push({
                        cours_nom: cours.cours_nom,
                        note_obtenue: noteObtenue,
                        max_points: maxPoints,
                        pourcentage: Math.round(pourcentage * 100) / 100
                    });
                    totalPointsObtenus += noteObtenue;
                    totalPointsMax += maxPoints;
                } else {
                    notesAvecPourcentage.push({
                        cours_nom: cours.cours_nom,
                        note_obtenue: null,
                        max_points: maxPoints,
                        pourcentage: null
                    });
                }
            }

            const pourcentageGlobal = !nonClasse && totalPointsMax > 0
                ? Math.round((totalPointsObtenus / totalPointsMax) * 10000) / 100
                : null;

            let rang = null;
            if (estEligible && !nonClasse && notes.length > 0) {
                // Compter le nombre total de cours requis
                const [totalCoursResult] = await db.query<RowDataPacket[]>(
                    `SELECT COUNT(DISTINCT c.id) as total
                     FROM cours c
                     JOIN cours_periodes cp ON c.id = cp.cours_id
                     JOIN periodes p ON cp.periode_id = p.id
                     WHERE c.classe_id = ? AND p.nom = ? AND p.est_active = 1`,
                    [classeId, periode.nom]
                );
                const totalCoursRequis = totalCoursResult[0]?.total || 0;

                const [classement] = await db.query<RowDataPacket[]>(
                    `SELECT i.eleve_id,
                        COALESCE(SUM(n.note_obtenue), 0) as total_points_obtenus,
                        COALESCE(SUM(cp.max_points), 0) as total_points_max,
                        COUNT(DISTINCT n.cours_id) as cours_notes_count,
                        CASE 
                            WHEN COALESCE(SUM(cp.max_points), 0) > 0 
                            THEN (COALESCE(SUM(n.note_obtenue), 0) / COALESCE(SUM(cp.max_points), 0)) * 100
                            ELSE 0
                        END as pourcentage
                     FROM inscriptions i
                     LEFT JOIN notes n ON i.id = n.inscription_id AND n.periode = ?
                     LEFT JOIN periodes p ON p.nom = n.periode AND p.est_active = 1
                     LEFT JOIN cours_periodes cp ON cp.cours_id = n.cours_id AND cp.periode_id = p.id
                     WHERE i.classe_id = ? 
                     AND i.annee_scolaire_id = (
                         SELECT id FROM annees_scolaires 
                         WHERE ecole_id = ? AND statut = "OUVERTE" 
                         ORDER BY date_debut DESC LIMIT 1
                     )
                     GROUP BY i.eleve_id
                     HAVING cours_notes_count >= ? AND total_points_max > 0
                     ORDER BY pourcentage DESC`,
                    [periode.nom, classeId, ecoleId, totalCoursRequis]
                );

                const position = classement.findIndex((e: any) => e.eleve_id === eleveId);
                if (position !== -1) {
                    rang = position + 1;
                }
            }

            if (!nonClasse && notes.length > 0) {
                aDesResultatsEligibles = true;
            }

            resultatsParPeriode.push({
                periode: periode.nom,
                periode_id: periode.id,
                notes: notesAvecPourcentage || [],
                totalPointsObtenus: Math.round(totalPointsObtenus * 100) / 100,
                totalPointsMax: totalPointsMax,
                pourcentageGlobal: pourcentageGlobal,
                rang: rang,
                nonClasse: nonClasse,
                estPublie: estPublie,
                estAutorise: estAutorise,
                estEligible: estEligible,
                aDesNotes: notes.length > 0,
                message: nonClasse ? 'Notes incomplètes pour cette période. L\'élève est non classé.' :
                    !estPublie ? 'Les résultats ne sont pas encore publiés pour cette période.' :
                        !estAutorise ? 'Vous n\'êtes pas autorisé à consulter les résultats de cette période.' :
                            notes.length === 0 ? 'Aucune note disponible pour cette période.' : null
            });
        }

        const estEligibleGlobal = resultatsParPeriode.some(p => p.estEligible && p.aDesNotes && !p.nonClasse);
        const estPublieGlobal = resultatsParPeriode.some(p => p.estPublie);

        res.json({
            eleve: {
                id: eleve[0].id,
                matricule: eleve[0].matricule,
                nom: eleve[0].nom,
                prenom: eleve[0].prenom,
                postnom: eleve[0].postnom
            },
            ecole: {
                nom: eleve[0].ecole_nom
            },
            classe: {
                nom: inscription[0].classe_nom,
                section: inscription[0].section || '',
                option: inscription[0].option_classe || ''
            },
            anneeScolaire: inscription[0].annee_scolaire_nom,
            resultats: resultatsParPeriode,
            estPublie: estPublieGlobal,
            estEligible: estEligibleGlobal
        });
    } catch (error) {
        console.error('Erreur getResultatsPublics:', error);
        res.status(500).json({ message: 'Erreur lors du chargement des résultats.' });
    }
};

// ============================================
// CLASSEMENT CLASSE - NON CLASSE SI NOTE MANQUANTE
// ============================================

export const getClassementClasse = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const userId = req.user?.id;
    const { classeId } = req.params;

    try {
        const [check] = await db.query<RowDataPacket[]>(
            'SELECT id FROM classes WHERE id = ? AND titulaire_id = ? AND ecole_id = ?',
            [classeId, userId, ecoleId]
        );

        if (check.length === 0) {
            res.status(403).json({ message: 'Accès non autorisé à cette classe.' });
            return;
        }

        const periode = req.query?.periode || null;

        // Récupérer le nombre total de cours configurés pour la classe (et période si spécifiée)
        let totalCoursQuery = `
            SELECT COUNT(DISTINCT c.id) as total
            FROM cours c
            JOIN cours_periodes cp ON c.id = cp.cours_id
            JOIN periodes p ON cp.periode_id = p.id
            WHERE c.classe_id = ? AND p.est_active = 1
        `;
        const totalCoursParams: any[] = [classeId];
        if (periode) {
            totalCoursQuery += ` AND p.nom = ?`;
            totalCoursParams.push(periode);
        }

        const [totalCoursResult] = await db.query<RowDataPacket[]>(totalCoursQuery, totalCoursParams);
        const totalCoursRequis = totalCoursResult[0]?.total || 0;

        // Récupérer les élèves avec leurs notes et le nombre de cours notés
        let query = `
            SELECT 
                e.id as eleve_id,
                e.matricule,
                e.nom,
                e.prenom,
                e.sexe,
                COALESCE(SUM(n.note_obtenue), 0) as total_points_obtenus,
                COALESCE(SUM(cp.max_points), 0) as total_points_max,
                COUNT(DISTINCT n.cours_id) as cours_notes_count,
                CASE 
                    WHEN COALESCE(SUM(cp.max_points), 0) > 0 
                    THEN (COALESCE(SUM(n.note_obtenue), 0) / COALESCE(SUM(cp.max_points), 0)) * 100
                    ELSE 0
                END as pourcentage
            FROM inscriptions i
            JOIN eleves e ON i.eleve_id = e.id
            LEFT JOIN notes n ON i.id = n.inscription_id
            LEFT JOIN periodes p ON p.nom = n.periode AND p.est_active = 1
            LEFT JOIN cours_periodes cp ON cp.cours_id = n.cours_id AND cp.periode_id = p.id
            WHERE i.classe_id = ?
            AND i.annee_scolaire_id = (
                SELECT id FROM annees_scolaires 
                WHERE ecole_id = ? AND statut = "OUVERTE" 
                ORDER BY date_debut DESC LIMIT 1
            )
        `;

        const params: any[] = [classeId, ecoleId];

        if (periode) {
            query += ` AND n.periode = ?`;
            params.push(periode);
        }

        query += ` GROUP BY e.id, e.matricule, e.nom, e.prenom, e.sexe
                   ORDER BY pourcentage DESC`;

        const [rows] = await db.query<RowDataPacket[]>(query, params);

        const totalEleves = rows.length;

        const classement = rows.map((row, index) => {
            // Si totalCoursRequis === 0 ou si l'élève n'a pas tous les cours notés → non classé
            const nonClasse = totalCoursRequis === 0 || row.cours_notes_count < totalCoursRequis;
            const pourcentage = nonClasse ? null : Math.round(row.pourcentage * 100) / 100;

            return {
                ...row,
                position: nonClasse ? null : index + 1,
                totalEleves: totalEleves,
                pourcentage: pourcentage,
                nonClasse: nonClasse,
                mention: nonClasse ? '-' :
                    (pourcentage !== null && pourcentage >= 80) ? 'Très Bien' :
                        (pourcentage !== null && pourcentage >= 70) ? 'Bien' :
                            (pourcentage !== null && pourcentage >= 60) ? 'Assez Bien' :
                                (pourcentage !== null && pourcentage >= 50) ? 'Passable' : 'Insuffisant'
            };
        });

        // Trier: les "non classé" à la fin
        classement.sort((a, b) => {
            if (a.nonClasse && !b.nonClasse) return 1;
            if (!a.nonClasse && b.nonClasse) return -1;
            return (a.pourcentage || 0) > (b.pourcentage || 0) ? -1 : 1;
        });

        // Recalculer les positions après le tri
        let positionReelle = 0;
        for (const item of classement) {
            if (!item.nonClasse) {
                positionReelle++;
                item.position = positionReelle;
            } else {
                item.position = null;
            }
        }

        res.json({ results: classement });
    } catch (error) {
        console.error('Erreur getClassementClasse:', error);
        res.status(500).json({ message: 'Erreur lors du calcul du classement.' });
    }
};

// ============================================
// BULK: Enregistrer TOUTES les notes d'un élève pour une période
// ============================================
export const bulkSaveNotes = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const userId = req.user?.id;
    const { eleveId } = req.params;
    const { periode, notes } = req.body || {};

    try {
        // Validations
        if (!periode) {
            res.status(400).json({ message: 'periode est obligatoire.' });
            return;
        }
        if (!notes || !Array.isArray(notes) || notes.length === 0) {
            res.status(400).json({ message: 'notes (tableau) est obligatoire.' });
            return;
        }

        // Vérifier l'inscription et l'accès
        const [inscription] = await db.query<RowDataPacket[]>(
            `SELECT i.id 
             FROM inscriptions i
             JOIN classes c ON i.classe_id = c.id
             WHERE i.eleve_id = ? 
             AND c.titulaire_id = ?
             AND c.ecole_id = ?
             AND i.annee_scolaire_id = (
                 SELECT id FROM annees_scolaires 
                 WHERE ecole_id = ? AND statut = "OUVERTE" 
                 ORDER BY date_debut DESC LIMIT 1
             )`,
            [eleveId, userId, ecoleId, ecoleId]
        );

        if (inscription.length === 0) {
            res.status(403).json({ message: 'Accès non autorisé à cet élève.' });
            return;
        }

        const inscriptionId = inscription[0].id;

        // Résultats à renvoyer
        const results = {
            created: 0,
            updated: 0,
            deleted: 0,
            skipped: 0,
            errors: [] as string[]
        };

        // Traiter chaque note
        for (const item of notes) {
            const { cours_id, note_obtenue } = item;

            // Vérifier cours_id
            if (!cours_id) {
                results.skipped++;
                continue;
            }

            // 🔥 CAS 1 : Note VIDE (null, undefined, '' ou NaN)
            // → SUPPRIMER la note existante si elle existe
            const estVide = (
                note_obtenue === null ||
                note_obtenue === undefined ||
                note_obtenue === '' ||
                (typeof note_obtenue === 'string' && note_obtenue.trim() === '')
            );

            if (estVide) {
                // Chercher si une note existe déjà
                const [existing] = await db.query<RowDataPacket[]>(
                    `SELECT id FROM notes 
                     WHERE inscription_id = ? AND cours_id = ? AND periode = ?`,
                    [inscriptionId, cours_id, periode]
                );

                if (existing.length > 0) {
                    // 🗑️ Supprimer la note
                    await db.query<ResultSetHeader>(
                        `DELETE FROM notes WHERE id = ?`,
                        [existing[0].id]
                    );
                    results.deleted++;
                } else {
                    // Rien à supprimer → skip
                    results.skipped++;
                }
                continue;
            }

            // CAS 2 : Note VALIDE → INSERT ou UPDATE
            const noteNum = parseFloat(note_obtenue);

            if (isNaN(noteNum)) {
                results.errors.push(`Note invalide pour le cours ${cours_id}`);
                continue;
            }

            if (noteNum < 0) {
                results.errors.push(`Note ${noteNum} négative pour cours ${cours_id}`);
                continue;
            }

            // Récupérer le max_points pour ce cours et cette période
            const [config] = await db.query<RowDataPacket[]>(
                `SELECT cp.max_points
                 FROM cours_periodes cp
                 JOIN periodes p ON cp.periode_id = p.id
                 WHERE cp.cours_id = ? AND p.nom = ? AND p.ecole_id = ?`,
                [cours_id, periode, ecoleId]
            );

            if (config.length === 0) {
                results.errors.push(`Configuration non trouvée pour cours ${cours_id}`);
                continue;
            }

            const maxPoints = parseFloat(config[0].max_points) || 10;

            if (noteNum > maxPoints) {
                results.errors.push(`Note ${noteNum} dépasse le max ${maxPoints} pour cours ${cours_id}`);
                continue;
            }

            // Vérifier si une note existe déjà
            const [existing] = await db.query<RowDataPacket[]>(
                `SELECT id FROM notes 
                 WHERE inscription_id = ? AND cours_id = ? AND periode = ?`,
                [inscriptionId, cours_id, periode]
            );

            if (existing.length > 0) {
                // UPDATE
                await db.query<ResultSetHeader>(
                    `UPDATE notes SET note_obtenue = ? WHERE id = ?`,
                    [noteNum, existing[0].id]
                );
                results.updated++;
            } else {
                // INSERT
                await db.query<ResultSetHeader>(
                    `INSERT INTO notes (inscription_id, cours_id, titulaire_id, periode, note_obtenue)
                     VALUES (?, ?, ?, ?, ?)`,
                    [inscriptionId, cours_id, userId, periode, noteNum]
                );
                results.created++;
            }
        }

        res.json({
            message: `Notes : ${results.created} créée(s), ${results.updated} mise(s) à jour, ${results.deleted} supprimée(s), ${results.skipped} vide(s).`,
            ...results
        });

    } catch (error) {
        console.error('Erreur bulkSaveNotes:', error);
        res.status(500).json({ message: 'Erreur lors de l\'enregistrement des notes.' });
    }
};