import { Response } from 'express';
import db from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { parseFrDateToISO } from '../utils/dates';
import { format } from 'date-fns';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
// ============================================
// STATISTIQUES DU SECRÉTARIAT AVEC GRAPHIQUES
// ============================================
export const getSecretariatStats = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;

    try {
        const [totalEleves] = await db.query<RowDataPacket[]>(
            'SELECT COUNT(*) as count FROM eleves WHERE ecole_id = ?',
            [ecoleId]
        );

        const [totalClasses] = await db.query<RowDataPacket[]>(
            'SELECT COUNT(*) as count FROM classes WHERE ecole_id = ?',
            [ecoleId]
        );

        const [totalInscriptions] = await db.query<RowDataPacket[]>(
            `SELECT COUNT(*) as count FROM inscriptions i
             JOIN eleves e ON i.eleve_id = e.id
             WHERE e.ecole_id = ?`,
            [ecoleId]
        );

        const [activeYear] = await db.query<RowDataPacket[]>(
            'SELECT id, nom FROM annees_scolaires WHERE ecole_id = ? AND statut = "OUVERTE" ORDER BY date_debut DESC LIMIT 1',
            [ecoleId]
        );

        const [repartition] = await db.query<RowDataPacket[]>(
            'SELECT sexe, COUNT(*) as count FROM eleves WHERE ecole_id = ? GROUP BY sexe',
            [ecoleId]
        );

        const [classesEffectifs] = await db.query<RowDataPacket[]>(
            `SELECT c.nom, c.section, c.option_classe, COUNT(i.id) as effectif
             FROM classes c
             LEFT JOIN inscriptions i ON c.id = i.classe_id
             AND i.annee_scolaire_id = (
                 SELECT id FROM annees_scolaires 
                 WHERE ecole_id = ? AND statut = "OUVERTE" 
                 ORDER BY date_debut DESC LIMIT 1
             )
             WHERE c.ecole_id = ?
             GROUP BY c.id, c.nom, c.section, c.option_classe
             ORDER BY c.nom ASC`,
            [ecoleId, ecoleId]
        );

        const [recentInscriptions] = await db.query<RowDataPacket[]>(
            `SELECT 
                e.nom as eleve_nom, 
                e.prenom as eleve_prenom,
                c.nom as classe_nom,
                c.section as classe_section,
                c.option_classe as classe_option,
                i.date_inscription
            FROM inscriptions i
            JOIN eleves e ON i.eleve_id = e.id
            JOIN classes c ON i.classe_id = c.id
            WHERE e.ecole_id = ?
            AND i.date_inscription >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            ORDER BY i.date_inscription DESC
            LIMIT 10`,
            [ecoleId]
        );

        const [evolution] = await db.query<RowDataPacket[]>(
            `SELECT 
                DATE_FORMAT(i.date_inscription, '%Y-%m') as mois,
                COUNT(*) as count
            FROM inscriptions i
            JOIN eleves e ON i.eleve_id = e.id
            WHERE e.ecole_id = ?
            AND i.date_inscription >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
            GROUP BY DATE_FORMAT(i.date_inscription, '%Y-%m')
            ORDER BY mois ASC`,
            [ecoleId]
        );

        res.json({
            totalEleves: totalEleves[0]?.count || 0,
            totalClasses: totalClasses[0]?.count || 0,
            totalInscriptions: totalInscriptions[0]?.count || 0,
            activeYear: activeYear[0] || null,
            repartition: repartition || [],
            classesEffectifs: classesEffectifs || [],
            recentInscriptions: recentInscriptions || [],
            evolution: evolution || []
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors du chargement des statistiques.' });
    }
};

// ============================================
// GESTION DES ÉLÈVES (CRUD COMPLET)
// ============================================

export const listEleves = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const page = Math.max(1, Number(req.query?.page || 1));
    const pageSize = Math.min(50, Math.max(5, Number(req.query?.pageSize || 10)));
    const offset = (page - 1) * pageSize;
    const search = String(req.query?.search || '').trim();
    const classeId = req.query?.classe_id ? Number(req.query.classe_id) : null;
    const sexe = req.query?.sexe ? String(req.query.sexe) : null;

    try {
        let query = `
            SELECT 
                e.id,
                e.matricule,
                e.nom,
                e.postnom,
                e.prenom,
                e.sexe,
                DATE_FORMAT(e.date_naissance, '%Y-%m-%d') as date_naissance,
                e.lieu_naissance,
                e.nom_pere,
                e.nom_mere,
                e.numero_parent,
                e.adresse,
                e.niveau_etude,
                e.created_at,
                c.nom as classe_nom,
                c.section as classe_section,
                c.option_classe as classe_option,
                c.id as classe_id,
                i.id as inscription_id,
                i.annee_scolaire_id,
                i.date_inscription
            FROM eleves e
            LEFT JOIN inscriptions i ON e.id = i.eleve_id 
            AND i.annee_scolaire_id = (
                SELECT id FROM annees_scolaires 
                WHERE ecole_id = ? AND statut = "OUVERTE" 
                ORDER BY date_debut DESC LIMIT 1
            )
            LEFT JOIN classes c ON i.classe_id = c.id
            WHERE e.ecole_id = ?
        `;

        const params: any[] = [ecoleId, ecoleId];

        if (search) {
            query += ` AND (e.matricule LIKE ? OR e.nom LIKE ? OR e.prenom LIKE ? OR e.postnom LIKE ?)`;
            const like = `%${search}%`;
            params.push(like, like, like, like);
        }

        if (classeId) {
            query += ` AND c.id = ?`;
            params.push(classeId);
        }

        if (sexe) {
            query += ` AND e.sexe = ?`;
            params.push(sexe);
        }

        query += ` ORDER BY e.created_at DESC LIMIT ? OFFSET ?`;
        params.push(pageSize, offset);

        const [rows] = await db.query<RowDataPacket[]>(query, params);

        let countQuery = 'SELECT COUNT(*) as count FROM eleves e WHERE e.ecole_id = ?';
        const countParams: any[] = [ecoleId];

        if (search) {
            countQuery += ` AND (e.matricule LIKE ? OR e.nom LIKE ? OR e.prenom LIKE ? OR e.postnom LIKE ?)`;
            const like = `%${search}%`;
            countParams.push(like, like, like, like);
        }

        if (classeId) {
            countQuery += ` AND e.id IN (SELECT eleve_id FROM inscriptions i 
                WHERE i.classe_id = ? 
                AND i.annee_scolaire_id = (
                    SELECT id FROM annees_scolaires 
                    WHERE ecole_id = ? AND statut = "OUVERTE" 
                    ORDER BY date_debut DESC LIMIT 1
                )
            )`;
            countParams.push(classeId, ecoleId);
        }

        if (sexe) {
            countQuery += ` AND e.sexe = ?`;
            countParams.push(sexe);
        }

        const [countRows] = await db.query<RowDataPacket[]>(countQuery, countParams);

        res.json({
            page,
            pageSize,
            total: countRows[0]?.count || 0,
            results: rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors du chargement des élèves.' });
    }
};

export const createEleve = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const {
        nom,
        postnom,
        prenom,
        sexe,
        date_naissance,
        lieu_naissance,
        nom_pere,
        nom_mere,
        numero_parent,
        adresse,
        niveau_etude,
        classe_id
    } = req.body || {};

    try {
        if (!nom || !prenom || !sexe) {
            res.status(400).json({ message: 'Nom, prénom et sexe sont obligatoires.' });
            return;
        }

        const year = new Date().getFullYear();
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let matricule = '';

        // Génération du matricule avec 3 lettres aléatoires à la fin
        for (let i = 0; i < 100; i++) {
            const randomPart1 = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
            const randomPart2 = String(Math.floor(Math.random() * 1000)).padStart(3, '0');

            // Générer 3 lettres aléatoires
            const letter1 = letters[Math.floor(Math.random() * letters.length)];
            const letter2 = letters[Math.floor(Math.random() * letters.length)];
            const letter3 = letters[Math.floor(Math.random() * letters.length)];
            const randomLetters = `${letter1}${letter2}${letter3}`;

            const candidate = `${year}-${randomPart1}-${randomPart2}-${randomLetters}`;

            const [rows] = await db.query<RowDataPacket[]>(
                'SELECT id FROM eleves WHERE matricule = ? AND ecole_id = ? LIMIT 1',
                [candidate, ecoleId]
            );
            if (rows.length === 0) {
                matricule = candidate;
                break;
            }
        }

        if (!matricule) {
            res.status(500).json({ message: 'Impossible de générer un matricule unique.' });
            return;
        }

        let dateNaissanceISO = null;
        if (date_naissance) {
            try {
                // Si la date est au format YYYY-MM-DD (input HTML5)
                if (date_naissance.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    dateNaissanceISO = date_naissance;
                }
                // Si la date est au format DD/MM/YYYY
                else if (date_naissance.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                    const parts = date_naissance.split('/');
                    dateNaissanceISO = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
                // Si la date est au format DD-MM-YYYY
                else if (date_naissance.match(/^\d{2}-\d{2}-\d{4}$/)) {
                    const parts = date_naissance.split('-');
                    dateNaissanceISO = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
                // Sinon, essayer de parser avec parseFrDateToISO
                else {
                    dateNaissanceISO = parseFrDateToISO(date_naissance);
                }
            } catch (e) {
                res.status(400).json({
                    message: 'Format de date de naissance invalide. Utilisez JJ/MM/AAAA ou YYYY-MM-DD.'
                });
                return;
            }
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [result] = await connection.query<ResultSetHeader>(
                `INSERT INTO eleves 
                (ecole_id, matricule, nom, postnom, prenom, sexe, date_naissance, lieu_naissance, nom_pere, nom_mere, numero_parent, adresse, niveau_etude)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    ecoleId,
                    matricule,
                    nom,
                    postnom || null,
                    prenom,
                    sexe,
                    dateNaissanceISO,
                    lieu_naissance || null,
                    nom_pere || null,
                    nom_mere || null,
                    numero_parent || null,
                    adresse || null,
                    niveau_etude || null
                ]
            );

            const eleveId = result.insertId;

            let inscriptionId = null;
            if (classe_id) {
                const [activeYear] = await connection.query<RowDataPacket[]>(
                    'SELECT id FROM annees_scolaires WHERE ecole_id = ? AND statut = "OUVERTE" ORDER BY date_debut DESC LIMIT 1',
                    [ecoleId]
                );

                if (activeYear.length > 0) {
                    const [insResult] = await connection.query<ResultSetHeader>(
                        'INSERT INTO inscriptions (eleve_id, classe_id, annee_scolaire_id, date_inscription) VALUES (?, ?, ?, CURDATE())',
                        [eleveId, classe_id, activeYear[0].id]
                    );
                    inscriptionId = insResult.insertId;
                }
            }

            await connection.commit();

            res.status(201).json({
                message: 'Élève créé avec succès.',
                eleve: { id: eleveId, matricule, nom, prenom },
                inscriptionId
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de la création de l\'élève.' });
    }
};

export const updateEleve = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { id } = req.params;
    const {
        nom,
        postnom,
        prenom,
        sexe,
        date_naissance,
        lieu_naissance,
        nom_pere,
        nom_mere,
        numero_parent,
        adresse,
        niveau_etude
    } = req.body || {};

    try {
        if (!id) {
            res.status(400).json({ message: 'ID de l\'élève manquant.' });
            return;
        }

        const [check] = await db.query<RowDataPacket[]>(
            'SELECT id FROM eleves WHERE id = ? AND ecole_id = ?',
            [id, ecoleId]
        );
        if (check.length === 0) {
            res.status(404).json({ message: 'Élève non trouvé.' });
            return;
        }

        let dateNaissanceISO = null;
        if (date_naissance) {
            try {
                // Si la date est au format YYYY-MM-DD (input HTML5)
                if (date_naissance.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    dateNaissanceISO = date_naissance;
                }
                // Si la date est au format DD/MM/YYYY
                else if (date_naissance.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                    const parts = date_naissance.split('/');
                    dateNaissanceISO = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
                // Si la date est au format DD-MM-YYYY
                else if (date_naissance.match(/^\d{2}-\d{2}-\d{4}$/)) {
                    const parts = date_naissance.split('-');
                    dateNaissanceISO = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
                // Sinon, essayer de parser avec parseFrDateToISO
                else {
                    dateNaissanceISO = parseFrDateToISO(date_naissance);
                }
            } catch (e) {
                res.status(400).json({
                    message: 'Format de date de naissance invalide. Utilisez JJ/MM/AAAA ou YYYY-MM-DD.'
                });
                return;
            }
        }

        await db.query<ResultSetHeader>(
            `UPDATE eleves SET 
                nom = ?, postnom = ?, prenom = ?, sexe = ?, 
                date_naissance = ?, lieu_naissance = ?, 
                nom_pere = ?, nom_mere = ?, numero_parent = ?, adresse = ?, niveau_etude = ?
            WHERE id = ? AND ecole_id = ?`,
            [
                nom || null,
                postnom || null,
                prenom || null,
                sexe || null,
                dateNaissanceISO,
                lieu_naissance || null,
                nom_pere || null,
                nom_mere || null,
                numero_parent || null,
                adresse || null,
                niveau_etude || null,
                id,
                ecoleId
            ]
        );

        res.json({ message: 'Élève mis à jour avec succès.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour de l\'élève.' });
    }
};

export const deleteEleve = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { id } = req.params;

    try {
        if (!id) {
            res.status(400).json({ message: 'ID de l\'élève manquant.' });
            return;
        }

        const [result] = await db.query<ResultSetHeader>(
            'DELETE FROM eleves WHERE id = ? AND ecole_id = ?',
            [id, ecoleId]
        );

        if (result.affectedRows === 0) {
            res.status(404).json({ message: 'Élève non trouvé.' });
            return;
        }

        res.json({ message: 'Élève supprimé avec succès.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de la suppression de l\'élève.' });
    }
};

// ============================================
// GESTION DES CLASSES
// ============================================

export const listClasses = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;

    try {
        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT 
                c.id,
                c.nom,
                c.section,
                c.option_classe,
                c.titulaire_id,
                u.nom as titulaire_nom,
                u.prenom as titulaire_prenom,
                (SELECT COUNT(*) FROM inscriptions i 
                 WHERE i.classe_id = c.id 
                 AND i.annee_scolaire_id = (
                     SELECT id FROM annees_scolaires 
                     WHERE ecole_id = ? AND statut = "OUVERTE" 
                     ORDER BY date_debut DESC LIMIT 1
                 )
                ) as effectif
            FROM classes c
            LEFT JOIN utilisateurs u ON c.titulaire_id = u.id
            WHERE c.ecole_id = ?
            ORDER BY c.nom ASC`,
            [ecoleId, ecoleId]
        );

        res.json({ results: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors du chargement des classes.' });
    }
};

export const getClasseDetails = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { id } = req.params;

    try {
        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT 
                c.*,
                u.nom as titulaire_nom,
                u.prenom as titulaire_prenom,
                (SELECT COUNT(*) FROM inscriptions i 
                 WHERE i.classe_id = c.id 
                 AND i.annee_scolaire_id = (
                     SELECT id FROM annees_scolaires 
                     WHERE ecole_id = ? AND statut = "OUVERTE" 
                     ORDER BY date_debut DESC LIMIT 1
                 )
                ) as effectif
            FROM classes c
            LEFT JOIN utilisateurs u ON c.titulaire_id = u.id
            WHERE c.id = ? AND c.ecole_id = ?`,
            [ecoleId, id, ecoleId]
        );

        if (rows.length === 0) {
            res.status(404).json({ message: 'Classe non trouvée.' });
            return;
        }

        res.json({ classe: rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors du chargement de la classe.' });
    }
};

export const createClasse = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { nom, section, option_classe, titulaire_id } = req.body || {};

    try {
        if (!nom) {
            res.status(400).json({ message: 'Le nom de la classe est obligatoire.' });
            return;
        }

        await db.query<ResultSetHeader>(
            'INSERT INTO classes (ecole_id, nom, section, option_classe, titulaire_id) VALUES (?, ?, ?, ?, ?)',
            [ecoleId, nom, section || null, option_classe || null, titulaire_id || null]
        );

        res.status(201).json({ message: 'Classe créée avec succès.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de la création de la classe.' });
    }
};

export const updateClasse = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { id } = req.params;
    const { nom, section, option_classe, titulaire_id } = req.body || {};

    try {
        if (!id) {
            res.status(400).json({ message: 'ID de la classe manquant.' });
            return;
        }

        await db.query<ResultSetHeader>(
            'UPDATE classes SET nom = ?, section = ?, option_classe = ?, titulaire_id = ? WHERE id = ? AND ecole_id = ?',
            [nom || null, section || null, option_classe || null, titulaire_id || null, id, ecoleId]
        );

        res.json({ message: 'Classe mise à jour avec succès.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour de la classe.' });
    }
};

export const deleteClasse = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { id } = req.params;

    try {
        if (!id) {
            res.status(400).json({ message: 'ID de la classe manquant.' });
            return;
        }

        const [result] = await db.query<ResultSetHeader>(
            'DELETE FROM classes WHERE id = ? AND ecole_id = ?',
            [id, ecoleId]
        );

        if (result.affectedRows === 0) {
            res.status(404).json({ message: 'Classe non trouvée.' });
            return;
        }

        res.json({ message: 'Classe supprimée avec succès.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de la suppression de la classe.' });
    }
};

// ============================================
// GESTION DES INSCRIPTIONS
// ============================================

export const inscrireEleve = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { eleve_id, classe_id } = req.body || {};

    try {
        if (!eleve_id || !classe_id) {
            res.status(400).json({ message: 'eleve_id et classe_id sont obligatoires.' });
            return;
        }

        const [eleveCheck] = await db.query<RowDataPacket[]>(
            'SELECT id, nom, prenom FROM eleves WHERE id = ? AND ecole_id = ?',
            [eleve_id, ecoleId]
        );
        if (eleveCheck.length === 0) {
            res.status(404).json({ message: 'Élève non trouvé.' });
            return;
        }

        const [classeCheck] = await db.query<RowDataPacket[]>(
            'SELECT id, nom FROM classes WHERE id = ? AND ecole_id = ?',
            [classe_id, ecoleId]
        );
        if (classeCheck.length === 0) {
            res.status(404).json({ message: 'Classe non trouvée.' });
            return;
        }

        const [activeYear] = await db.query<RowDataPacket[]>(
            'SELECT id, nom FROM annees_scolaires WHERE ecole_id = ? AND statut = "OUVERTE" ORDER BY date_debut DESC LIMIT 1',
            [ecoleId]
        );
        if (activeYear.length === 0) {
            res.status(400).json({ message: 'Aucune année scolaire ouverte.' });
            return;
        }

        const [existing] = await db.query<RowDataPacket[]>(
            'SELECT id FROM inscriptions WHERE eleve_id = ? AND annee_scolaire_id = ?',
            [eleve_id, activeYear[0].id]
        );
        if (existing.length > 0) {
            const [currentInscription] = await db.query<RowDataPacket[]>(
                `SELECT c.nom as classe_nom FROM inscriptions i
                 JOIN classes c ON i.classe_id = c.id
                 WHERE i.eleve_id = ? AND i.annee_scolaire_id = ?`,
                [eleve_id, activeYear[0].id]
            );
            res.status(400).json({
                message: `Cet élève est déjà inscrit en ${currentInscription[0]?.classe_nom || 'une classe'} pour cette année.`,
                alreadyInscribed: true
            });
            return;
        }

        await db.query<ResultSetHeader>(
            'INSERT INTO inscriptions (eleve_id, classe_id, annee_scolaire_id, date_inscription) VALUES (?, ?, ?, CURDATE())',
            [eleve_id, classe_id, activeYear[0].id]
        );

        const eleve = eleveCheck[0];
        const classe = classeCheck[0];

        res.status(201).json({
            message: `Inscription effectuée avec succès. ${eleve.nom} ${eleve.prenom} inscrit en ${classe.nom}.`,
            eleve: { id: eleve.id, nom: eleve.nom, prenom: eleve.prenom },
            classe: { id: classe.id, nom: classe.nom }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de l\'inscription.' });
    }
};

export const listInscriptions = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const anneeScolaireId = req.query?.annee_scolaire_id || null;

    try {
        let query = `
            SELECT 
                i.id,
                i.date_inscription,
                e.id as eleve_id,
                e.matricule as eleve_matricule,
                e.nom as eleve_nom,
                e.postnom as eleve_postnom,
                e.prenom as eleve_prenom,
                e.sexe as eleve_sexe,
                c.id as classe_id,
                c.nom as classe_nom,
                c.section as classe_section,
                c.option_classe as classe_option,
                a.id as annee_scolaire_id,
                a.nom as annee_scolaire_nom
            FROM inscriptions i
            JOIN eleves e ON i.eleve_id = e.id
            JOIN classes c ON i.classe_id = c.id
            JOIN annees_scolaires a ON i.annee_scolaire_id = a.id
            WHERE e.ecole_id = ?
        `;

        const params: any[] = [ecoleId];

        if (anneeScolaireId) {
            query += ` AND i.annee_scolaire_id = ?`;
            params.push(anneeScolaireId);
        } else {
            query += ` AND i.annee_scolaire_id = (SELECT id FROM annees_scolaires WHERE ecole_id = ? AND statut = "OUVERTE" ORDER BY date_debut DESC LIMIT 1)`;
            params.push(ecoleId);
        }

        query += ` ORDER BY i.date_inscription DESC`;

        const [rows] = await db.query<RowDataPacket[]>(query, params);
        res.json({ results: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors du chargement des inscriptions.' });
    }
};

export const deleteInscription = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { id } = req.params;

    try {
        if (!id) {
            res.status(400).json({ message: 'ID de l\'inscription manquant.' });
            return;
        }

        const [result] = await db.query<ResultSetHeader>(
            'DELETE FROM inscriptions WHERE id = ? AND eleve_id IN (SELECT id FROM eleves WHERE ecole_id = ?)',
            [id, ecoleId]
        );

        if (result.affectedRows === 0) {
            res.status(404).json({ message: 'Inscription non trouvée.' });
            return;
        }

        res.json({ message: 'Inscription supprimée avec succès.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de la suppression de l\'inscription.' });
    }
};

// ============================================
// ARCHIVAGE - GESTION DES ANNÉES SCOLAIRES
// ============================================

export const listAnneesScolaires = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;

    try {
        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT 
                a.*,
                (SELECT COUNT(*) FROM inscriptions i 
                 WHERE i.annee_scolaire_id = a.id) as total_inscriptions
            FROM annees_scolaires a
            WHERE a.ecole_id = ?
            ORDER BY a.date_debut DESC`,
            [ecoleId]
        );

        res.json({ results: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors du chargement des années scolaires.' });
    }
};

export const archiverAnnee = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { id } = req.params;

    try {
        if (!id) {
            res.status(400).json({ message: 'ID de l\'année scolaire manquant.' });
            return;
        }

        await db.query<ResultSetHeader>(
            'UPDATE annees_scolaires SET statut = "CLOTUREE" WHERE id = ? AND ecole_id = ?',
            [id, ecoleId]
        );

        res.json({ message: 'Année scolaire archivée avec succès.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de l\'archivage.' });
    }
};

// ============================================
// GÉNÉRATION DE LISTES ET EXPORTS
// ============================================

export const listElevesByClasse = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const classeId = req.params?.classeId;

    try {
        if (!classeId) {
            res.status(400).json({ message: 'classeId est requis.' });
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
                DATE_FORMAT(e.date_naissance, '%Y-%m-%d') as date_naissance,
                e.lieu_naissance,
                e.nom_pere,
                e.nom_mere,
                e.numero_parent,
                e.adresse,
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

        const [classeInfo] = await db.query<RowDataPacket[]>(
            'SELECT nom, section, option_classe FROM classes WHERE id = ? AND ecole_id = ?',
            [classeId, ecoleId]
        );

        res.json({
            classe: classeInfo[0] || null,
            results: rows,
            total: rows.length
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors du chargement de la liste.' });
    }
};

// EXPORT CSV
export const exportElevesCSV = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const classeId = req.params?.classeId;

    try {
        if (!classeId) {
            res.status(400).json({ message: 'classeId est requis.' });
            return;
        }

        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT 
                e.matricule,
                e.nom,
                e.postnom,
                e.prenom,
                e.sexe,
                DATE_FORMAT(e.date_naissance, '%Y-%m-%d') as date_naissance,
                e.lieu_naissance,
                e.nom_pere,
                e.nom_mere,
                e.numero_parent,
                e.adresse
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

        const [classeInfo] = await db.query<RowDataPacket[]>(
            'SELECT nom FROM classes WHERE id = ? AND ecole_id = ?',
            [classeId, ecoleId]
        );

        const classeNom = classeInfo[0]?.nom || 'classe';

        let csv = 'Matricule,Nom,Postnom,Prénom,Sexe,Date naissance,Lieu naissance,Père,Mère,Numéro Parent,Adresse\n';
        for (const row of rows) {
            const dateNaiss = row.date_naissance ? format(new Date(row.date_naissance), 'dd/MM/yyyy') : '';
            csv += `${row.matricule},${row.nom},${row.postnom || ''},${row.prenom},${row.sexe},${dateNaiss},${row.lieu_naissance || ''},${row.nom_pere || ''},${row.nom_mere || ''},${row.numero_parent || ''},${row.adresse || ''}\n`;
        }

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=eleves_${classeNom}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        res.send('\uFEFF' + csv);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de l\'export CSV.' });
    }
};

// EXPORT EXCEL
export const exportElevesExcel = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const classeId = req.params?.classeId;

    try {
        if (!classeId) {
            res.status(400).json({ message: 'classeId est requis.' });
            return;
        }

        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT 
                e.matricule,
                e.nom,
                e.postnom,
                e.prenom,
                e.sexe,
                DATE_FORMAT(e.date_naissance, '%Y-%m-%d') as date_naissance,
                e.lieu_naissance,
                e.nom_pere,
                e.nom_mere,
                e.numero_parent,
                e.adresse
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

        const [classeInfo] = await db.query<RowDataPacket[]>(
            'SELECT nom FROM classes WHERE id = ? AND ecole_id = ?',
            [classeId, ecoleId]
        );

        const classeNom = classeInfo[0]?.nom || 'classe';

        const ExcelJS = await import('exceljs');

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Élèves');

        worksheet.addRow(['Matricule', 'Nom', 'Postnom', 'Prénom', 'Sexe', 'Date naissance', 'Lieu naissance', 'Père', 'Mère', 'Numéro Parent', 'Adresse']);

        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        headerRow.alignment = { horizontal: 'center' };

        for (const row of rows) {
            worksheet.addRow([
                row.matricule,
                row.nom,
                row.postnom || '',
                row.prenom,
                row.sexe,
                row.date_naissance ? format(new Date(row.date_naissance), 'dd/MM/yyyy') : '',
                row.lieu_naissance || '',
                row.nom_pere || '',
                row.nom_mere || '',
                row.numero_parent || '',
                row.adresse || ''
            ]);
        }

        worksheet.columns.forEach(col => {
            col.width = 18;
        });

        const buffer = await workbook.xlsx.writeBuffer();

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=eleves_${classeNom}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
        res.send(buffer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de l\'export Excel.' });
    }
};

// ============================================
// GÉNÉRATION D'ATTESTATIONS PDF avec pdf-lib
// ============================================

export const generateAttestation = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { eleveId } = req.params;

    console.log('🟢 [PDF-lib] Début génération pour eleveId:', eleveId);

    try {
        if (!eleveId) {
            res.status(400).json({ message: 'eleveId est requis.' });
            return;
        }

        // 1. Récupération des données
        console.log('🟡 [PDF-lib] Récupération des données...');
        const [eleveRows] = await db.query<RowDataPacket[]>(
            `SELECT 
                e.*,
                c.nom as classe_nom,
                c.section,
                c.option_classe,
                a.nom as annee_scolaire_nom,
                ecole.nom as ecole_nom,
                ecole.adresse as ecole_adresse,
                ecole.bp as ecole_bp,
                ecole.telephone as ecole_telephone,
                ecole.email as ecole_email
            FROM eleves e
            LEFT JOIN inscriptions i ON e.id = i.eleve_id 
                AND i.annee_scolaire_id = (
                    SELECT id FROM annees_scolaires 
                    WHERE ecole_id = ? AND statut = "OUVERTE" 
                    ORDER BY date_debut DESC LIMIT 1
                )
            LEFT JOIN classes c ON i.classe_id = c.id
            LEFT JOIN annees_scolaires a ON i.annee_scolaire_id = a.id
            LEFT JOIN ecoles ecole ON ecole.id = ?
            WHERE e.id = ? AND e.ecole_id = ?`,
            [ecoleId, ecoleId, eleveId, ecoleId]
        );

        if (eleveRows.length === 0) {
            console.log('🔴 [PDF-lib] Élève non trouvé');
            res.status(404).json({ message: 'Élève non trouvé.' });
            return;
        }

        const eleve = eleveRows[0];
        console.log('🟢 [PDF-lib] Élève trouvé:', eleve.matricule);

        // 2. Construction du nom de la classe
        let classeDisplay = eleve.classe_nom || 'Non inscrit';
        if (eleve.section) {
            classeDisplay += ` ${eleve.section}`;
        }
        if (eleve.option_classe) {
            if (eleve.section) {
                classeDisplay += `/${eleve.option_classe}`;
            } else {
                classeDisplay += ` ${eleve.option_classe}`;
            }
        }

        // 3. Création du PDF avec pdf-lib
        console.log('🟡 [PDF-lib] Création du PDF...');
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595.28, 841.89]); // A4
        const { width, height } = page.getSize();

        // 4. Chargement des polices
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // 5. Variables pour le positionnement
        let y = height - 50;
        const marginX = 72;
        const lineHeight = 20;
        const fontSize = 11;
        const fontSizeTitle = 16;
        const fontSizeHeader = 14;

        // 6. En-tête de l'école
        page.drawText((eleve.ecole_nom || 'ÉCOLE').toUpperCase(), {
            x: marginX,
            y: y,
            size: 20,
            font: fontBold,
            color: rgb(0, 0, 0),
        });
        y -= 10;

        // Adresse
        if (eleve.ecole_adresse) {
            page.drawText(eleve.ecole_adresse, {
                x: marginX,
                y: y,
                size: fontSize,
                font: font,
                color: rgb(0, 0, 0),
            });
            y -= 5;
        }

        // BP et Téléphone
        let contactLine = '';
        if (eleve.ecole_bp) contactLine += `BP: ${eleve.ecole_bp}`;
        if (eleve.ecole_telephone) {
            if (contactLine) contactLine += '  ';
            contactLine += `Tél: ${eleve.ecole_telephone}`;
        }
        if (contactLine) {
            page.drawText(contactLine, {
                x: marginX,
                y: y,
                size: fontSize,
                font: font,
                color: rgb(0, 0, 0),
            });
            y -= 25;
        } else {
            y -= 15;
        }

        // 7. Titre de l'attestation
        page.drawText('ATTESTATION DE FRÉQUENTATION SCOLAIRE', {
            x: width / 2 - 150,
            y: y,
            size: fontSizeTitle,
            font: fontBold,
            color: rgb(0, 0, 0),
        });
        y -= 25;

        // 8. Introduction
        const introText = `Je soussigné(e), Chef d'Établissement de ${eleve.ecole_nom || 'l\'école'}, certifie que l'élève :`;
        page.drawText(introText, {
            x: marginX,
            y: y,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0),
        });
        y -= 15;

        // 9. Tableau des informations
        const tableData = [
            ['Matricule :', eleve.matricule],
            ['Nom :', eleve.nom],
            ['Postnom :', eleve.postnom || '-'],
            ['Prénom :', eleve.prenom],
            ['Sexe :', eleve.sexe === 'M' ? 'Masculin' : 'Féminin'],
            ['Date de naissance :', eleve.date_naissance ? format(new Date(eleve.date_naissance), 'dd/MM/yyyy') : '-'],
            ['Lieu de naissance :', eleve.lieu_naissance || '-'],
            ['Numéro Parent :', eleve.numero_parent || '-'],
            ['Classe :', classeDisplay],
            ['Année scolaire :', eleve.annee_scolaire_nom || 'Année en cours']
        ];

        const col1Width = 120;
        const col2Width = 300;

        for (const row of tableData) {
            // Colonne 1 (labels) - Gras
            page.drawText(row[0], {
                x: marginX,
                y: y,
                size: fontSize,
                font: fontBold,
                color: rgb(0, 0, 0),
            });

            // Colonne 2 (valeurs)
            page.drawText(row[1], {
                x: marginX + col1Width,
                y: y,
                size: fontSize,
                font: font,
                color: rgb(0, 0, 0),
            });

            y -= lineHeight;
        }

        y -= 10;

        // 10. Texte de confirmation
        const confirmText = 'est régulièrement inscrit(e) et fréquente assidûment les cours dans notre établissement.';
        page.drawText(confirmText, {
            x: marginX,
            y: y,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0),
        });
        y -= 15;

        const legalText = 'La présente attestation est délivrée pour servir et valoir ce que de droit.';
        page.drawText(legalText, {
            x: marginX,
            y: y,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0),
        });
        y -= 40;

        // 11. Date
        const dateStr = format(new Date(), 'dd/MM/yyyy');
        const dateText = `Fait à ${eleve.ecole_adresse || '...'}, le ${dateStr}`;
        page.drawText(dateText, {
            x: marginX,
            y: y,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0),
        });
        y -= 50;

        // 12. Signature
        page.drawText('Le Chef d\'Établissement', {
            x: width - marginX - 180,
            y: y,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0),
        });
        y -= 30;

        page.drawText('_________________________', {
            x: width - marginX - 180,
            y: y,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0),
        });
        y -= 10;

        page.drawText('Cachet et signature', {
            x: width - marginX - 180,
            y: y,
            size: 9,
            font: font,
            color: rgb(0.4, 0.4, 0.4),
        });

        // 13. Génération du PDF
        console.log('🟡 [PDF-lib] Sauvegarde du PDF...');
        const pdfBytes = await pdfDoc.save();
        const pdfBuffer = Buffer.from(pdfBytes);

        console.log('🟢 [PDF-lib] PDF généré, taille:', pdfBuffer.length, 'bytes');

        // 14. Envoi du PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=attestation_${eleve.matricule}.pdf`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);

        console.log('🟢 [PDF-lib] PDF envoyé avec succès');

    } catch (error) {
        console.error('🔴 [PDF-lib] Erreur génération attestation:', error);
        res.status(500).json({
            message: 'Erreur lors de la génération de l\'attestation.',
            error: error instanceof Error ? error.message : 'Erreur inconnue'
        });
    }
};

export const getTitulaires = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;

    try {
        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT id, nom, prenom, matricule 
             FROM utilisateurs 
             WHERE ecole_id = ? AND role = 'TITULAIRE' AND is_active = 1
             ORDER BY nom ASC, prenom ASC`,
            [ecoleId]
        );

        res.json({ results: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors du chargement des titulaires.' });
    }
};

export const getElevesNonInscrits = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const q = String(req.query?.q || '').trim();

    try {
        let query = `
            SELECT 
                e.id,
                e.matricule,
                e.nom,
                e.postnom,
                e.prenom,
                e.sexe,
                (
                    SELECT c.nom 
                    FROM inscriptions i2
                    JOIN classes c ON i2.classe_id = c.id
                    WHERE i2.eleve_id = e.id
                    ORDER BY i2.annee_scolaire_id DESC
                    LIMIT 1
                ) as derniere_classe_nom,
                (
                    SELECT c.section 
                    FROM inscriptions i2
                    JOIN classes c ON i2.classe_id = c.id
                    WHERE i2.eleve_id = e.id
                    ORDER BY i2.annee_scolaire_id DESC
                    LIMIT 1
                ) as derniere_classe_section,
                (
                    SELECT c.option_classe 
                    FROM inscriptions i2
                    JOIN classes c ON i2.classe_id = c.id
                    WHERE i2.eleve_id = e.id
                    ORDER BY i2.annee_scolaire_id DESC
                    LIMIT 1
                ) as derniere_classe_option,
                (
                    SELECT a.nom 
                    FROM inscriptions i2
                    JOIN annees_scolaires a ON i2.annee_scolaire_id = a.id
                    WHERE i2.eleve_id = e.id
                    ORDER BY i2.annee_scolaire_id DESC
                    LIMIT 1
                ) as derniere_annee_nom
            FROM eleves e
            WHERE e.ecole_id = ?
            AND e.id NOT IN (
                SELECT i.eleve_id 
                FROM inscriptions i
                WHERE i.annee_scolaire_id = (
                    SELECT id FROM annees_scolaires 
                    WHERE ecole_id = ? AND statut = "OUVERTE" 
                    ORDER BY date_debut DESC LIMIT 1
                )
            )
        `;

        const params: any[] = [ecoleId, ecoleId];

        if (q) {
            query += ` AND (e.matricule LIKE ? OR e.nom LIKE ? OR e.postnom LIKE ? OR e.prenom LIKE ?)`;
            const like = `%${q}%`;
            params.push(like, like, like, like);
        }

        query += ` ORDER BY e.nom ASC, e.prenom ASC LIMIT 30`;

        const [rows] = await db.query<RowDataPacket[]>(query, params);
        res.json({ results: rows });
    } catch (error) {
        console.error('Erreur getElevesNonInscrits:', error);
        res.status(500).json({ message: 'Erreur lors du chargement des élèves non inscrits.' });
    }
};