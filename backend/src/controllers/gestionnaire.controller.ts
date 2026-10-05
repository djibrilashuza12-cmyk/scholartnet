// gestionnaire.controller.ts
import { Response } from 'express';
import db from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { format } from 'date-fns';
import { rebloquerAutorisationsExpireesParEcole } from '../services/autorisationsCron.service';

// ============================================
// FONCTION UTILITAIRE: Récupérer l'année active
// ============================================

async function getActiveYearId(ecoleId: number): Promise<number | null> {
    const [activeYear] = await db.query<RowDataPacket[]>(
        `SELECT id FROM annees_scolaires 
         WHERE ecole_id = ? AND statut = "OUVERTE" 
         ORDER BY date_debut DESC LIMIT 1`,
        [ecoleId]
    );
    return activeYear.length > 0 ? activeYear[0].id : null;
}

// ============================================
// CRÉER UNE DÉROGATION TEMPORAIRE (avec durée en jours)
// ============================================
export const createAutorisationTemporaire = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const gestionnaireId = req.user?.id;
    const { eleve_id, periode_id, duree_jours, motif } = req.body || {};

    try {
        if (!eleve_id || !periode_id) {
            res.status(400).json({ message: 'eleve_id et periode_id sont obligatoires.' });
            return;
        }
        if (!duree_jours || duree_jours < 1 || duree_jours > 365) {
            res.status(400).json({ message: 'La durée doit être entre 1 et 365 jours.' });
            return;
        }

        const activeYearId = await getActiveYearId(ecoleId);
        if (!activeYearId) {
            res.status(400).json({ message: 'Aucune année scolaire ouverte.' });
            return;
        }

        // Vérifier élève
        const [eleve] = await db.query<RowDataPacket[]>(
            `SELECT id FROM eleves WHERE id = ? AND ecole_id = ?`,
            [eleve_id, ecoleId]
        );
        if (eleve.length === 0) {
            res.status(404).json({ message: 'Élève non trouvé.' });
            return;
        }

        // Vérifier période
        const [periode] = await db.query<RowDataPacket[]>(
            `SELECT id FROM periodes WHERE id = ? AND ecole_id = ? AND est_active = 1`,
            [periode_id, ecoleId]
        );
        if (periode.length === 0) {
            res.status(404).json({ message: 'Période non trouvée.' });
            return;
        }

        // Inscription
        const [inscription] = await db.query<RowDataPacket[]>(
            `SELECT id FROM inscriptions WHERE eleve_id = ? AND annee_scolaire_id = ?`,
            [eleve_id, activeYearId]
        );
        if (inscription.length === 0) {
            res.status(404).json({ message: 'Élève non inscrit pour cette année.' });
            return;
        }
        const inscriptionId = inscription[0].id;

        // 🔥 INSERT avec calcul de la date d'expiration côté SQL
        const [result] = await db.query<ResultSetHeader>(
            `INSERT INTO autorisations_bulletin 
             (inscription_id, periode_id, statut, gestionnaire_id, 
              date_autorisation, autorisation_auto, duree_jours, 
              date_expiration, motif_autorisation)
             VALUES (?, ?, 'AUTORISE', ?, NOW(), FALSE, ?, 
                     DATE_ADD(NOW(), INTERVAL ? DAY), ?)
             ON DUPLICATE KEY UPDATE 
                statut = 'AUTORISE',
                gestionnaire_id = VALUES(gestionnaire_id),
                date_autorisation = NOW(),
                autorisation_auto = FALSE,
                duree_jours = VALUES(duree_jours),
                date_expiration = DATE_ADD(NOW(), INTERVAL ? DAY),
                motif_autorisation = VALUES(motif_autorisation)`,
            [
                inscriptionId, periode_id, gestionnaireId,
                duree_jours, duree_jours, motif || null,
                duree_jours
            ]
        );

        let autorisationId = result.insertId;
        if (!autorisationId) {
            const [existing] = await db.query<RowDataPacket[]>(
                `SELECT id FROM autorisations_bulletin 
                 WHERE inscription_id = ? AND periode_id = ?`,
                [inscriptionId, periode_id]
            );
            if (existing.length > 0) autorisationId = existing[0].id;
        }

        // Historiser
        await db.query<ResultSetHeader>(
            `INSERT INTO autorisations_historique 
             (autorisation_id, ancien_statut, nouveau_statut, raison, gestionnaire_id)
             VALUES (?, 'BLOQUE', 'AUTORISE', ?, ?)`,
            [autorisationId, `Dérogation ${duree_jours}j : ${motif || 'sans motif'}`, gestionnaireId]
        );

        const [exp] = await db.query<RowDataPacket[]>(
            `SELECT date_expiration FROM autorisations_bulletin WHERE id = ?`,
            [autorisationId]
        );

        res.status(201).json({
            message: `Dérogation de ${duree_jours} jour(s) créée.`,
            autorisation_id: autorisationId,
            duree_jours,
            date_expiration: exp[0]?.date_expiration
        });

    } catch (error) {
        console.error('Erreur createAutorisationTemporaire:', error);
        res.status(500).json({ message: 'Erreur lors de la création.' });
    }
};

// ============================================
// 1. DASHBOARD FINANCIER
// ============================================

export const getGestionnaireDashboard = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;

    try {
        // Récupérer l'année active
        const activeYearId = await getActiveYearId(ecoleId);

        // Année active
        const [activeYear] = await db.query<RowDataPacket[]>(
            `SELECT id, nom FROM annees_scolaires WHERE id = ?`,
            [activeYearId]
        );

        // Total encaissé (filtré par année active)
        const [totalEncaissement] = await db.query<RowDataPacket[]>(
            `SELECT COALESCE(SUM(p.montant_paye), 0) as total
             FROM paiements p
             JOIN inscriptions i ON p.inscription_id = i.id
             JOIN eleves e ON i.eleve_id = e.id
             WHERE e.ecole_id = ? 
               AND i.annee_scolaire_id = ?
               AND p.annule = 0`,
            [ecoleId, activeYearId]
        );

        // Paiements aujourd'hui (filtré par année active)
        const [paiementsAujourdhui] = await db.query<RowDataPacket[]>(
            `SELECT COUNT(*) as count, COALESCE(SUM(p.montant_paye), 0) as total
             FROM paiements p
             JOIN inscriptions i ON p.inscription_id = i.id
             JOIN eleves e ON i.eleve_id = e.id
             WHERE e.ecole_id = ? 
               AND i.annee_scolaire_id = ?
               AND DATE(p.date_paiement) = CURDATE()
               AND p.annule = 0`,
            [ecoleId, activeYearId]
        );

        // Nombre de reçus émis (filtré par année active)
        const [totalRecus] = await db.query<RowDataPacket[]>(
            `SELECT COUNT(*) as count 
             FROM paiements p
             JOIN inscriptions i ON p.inscription_id = i.id
             WHERE i.annee_scolaire_id = ? AND p.annule = 0`,
            [activeYearId]
        );

        // Impayés (élèves avec frais obligatoires non payés) - filtré par année active
        const [impayes] = await db.query<RowDataPacket[]>(
            `SELECT COUNT(DISTINCT e.id) as count
             FROM eleves e
             JOIN inscriptions i ON e.id = i.eleve_id
             JOIN types_frais tf ON tf.ecole_id = e.ecole_id 
                AND tf.annee_scolaire_id = i.annee_scolaire_id
                AND tf.est_obligatoire = 1
             LEFT JOIN paiements p ON i.id = p.inscription_id 
                AND p.type_frais_id = tf.id
                AND p.annule = 0
             WHERE e.ecole_id = ?
               AND i.annee_scolaire_id = ?
               AND (p.id IS NULL OR p.annule = 1)
             GROUP BY e.id
             HAVING COUNT(DISTINCT tf.id) > 0`,
            [ecoleId, activeYearId]
        );

        // Derniers paiements (filtré par année active)
        const [derniersPaiements] = await db.query<RowDataPacket[]>(
            `SELECT 
                p.id,
                p.numero_recu,
                p.montant_paye,
                p.date_paiement,
                p.mode_paiement,
                e.nom as eleve_nom,
                e.prenom as eleve_prenom,
                e.matricule as eleve_matricule,
                tf.nom as type_frais,
                c.nom as classe_nom
             FROM paiements p
             JOIN inscriptions i ON p.inscription_id = i.id
             JOIN eleves e ON i.eleve_id = e.id
             JOIN types_frais tf ON p.type_frais_id = tf.id
             JOIN classes c ON i.classe_id = c.id
             WHERE e.ecole_id = ? 
               AND i.annee_scolaire_id = ?
               AND p.annule = 0
             ORDER BY p.date_paiement DESC
             LIMIT 10`,
            [ecoleId, activeYearId]
        );

        // Paiements par jour (30 jours) - filtré par année active
        const [paiementsParJour] = await db.query<RowDataPacket[]>(
            `SELECT 
                DATE(p.date_paiement) as date,
                COALESCE(SUM(p.montant_paye), 0) as total,
                COUNT(*) as count
             FROM paiements p
             JOIN inscriptions i ON p.inscription_id = i.id
             JOIN eleves e ON i.eleve_id = e.id
             WHERE e.ecole_id = ?
               AND i.annee_scolaire_id = ?
               AND p.date_paiement >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
               AND p.annule = 0
             GROUP BY DATE(p.date_paiement)
             ORDER BY date ASC`,
            [ecoleId, activeYearId]
        );

        // Répartition par type de frais (filtré par année active)
        const [repartitionFrais] = await db.query<RowDataPacket[]>(
            `SELECT 
                tf.nom,
                COALESCE(SUM(p.montant_paye), 0) as total
             FROM types_frais tf
             LEFT JOIN paiements p ON tf.id = p.type_frais_id AND p.annule = 0
             LEFT JOIN inscriptions i ON p.inscription_id = i.id
             LEFT JOIN eleves e ON i.eleve_id = e.id
             WHERE tf.ecole_id = ?
               AND tf.annee_scolaire_id = ?
             GROUP BY tf.id, tf.nom`,
            [ecoleId, activeYearId]
        );

        res.json({
            activeYear: activeYear[0] || null,
            totalEncaissement: totalEncaissement[0]?.total || 0,
            paiementsAujourdhui: paiementsAujourdhui[0]?.count || 0,
            montantAujourdhui: paiementsAujourdhui[0]?.total || 0,
            totalRecus: totalRecus[0]?.count || 0,
            impayes: impayes[0]?.count || 0,
            derniersPaiements: derniersPaiements || [],
            paiementsParJour: paiementsParJour || [],
            repartitionFrais: repartitionFrais || []
        });

    } catch (error) {
        console.error('Erreur dashboard gestionnaire:', error);
        res.status(500).json({ message: 'Erreur lors du chargement du dashboard.' });
    }
};

export const listTypesFrais = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;

    try {
        const activeYearId = await getActiveYearId(ecoleId);
        if (!activeYearId) {
            res.json({ results: [], message: 'Aucune année scolaire active.' });
            return;
        }

        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT tf.*,
                (SELECT COUNT(*) FROM paiements p 
                 WHERE p.type_frais_id = tf.id AND p.annule = 0) as nb_paiements,
                (SELECT COUNT(*) FROM frais_par_periode fpp 
                 WHERE fpp.type_frais_id = tf.id) as nb_periodes
             FROM types_frais tf
             WHERE tf.ecole_id = ?
               AND tf.annee_scolaire_id = ?
             ORDER BY tf.created_at DESC`,
            [ecoleId, activeYearId]
        );

        res.json({ results: rows });
    } catch (error) {
        console.error('Erreur listTypesFrais:', error);
        res.status(500).json({ message: 'Erreur lors du chargement des frais.' });
    }
};

// ============================================
// 3.5. ENREGISTREMENT GROUPÉ DES FRAIS PAR PÉRIODE
// ============================================

export const saveFraisParPeriodes = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { type_frais_id, periodes } = req.body || {};

    try {
        if (!type_frais_id || !periodes || !Array.isArray(periodes) || periodes.length === 0) {
            res.status(400).json({
                message: 'type_frais_id et periodes (tableau) sont obligatoires.'
            });
            return;
        }

        // Récupérer l'année active
        const activeYearId = await getActiveYearId(ecoleId);
        if (!activeYearId) {
            res.status(400).json({ message: 'Aucune année scolaire ouverte.' });
            return;
        }

        // Vérifier que le type de frais appartient à l'école et à l'année active
        const [checkFrais] = await db.query<RowDataPacket[]>(
            'SELECT id, montant FROM types_frais WHERE id = ? AND ecole_id = ? AND annee_scolaire_id = ?',
            [type_frais_id, ecoleId, activeYearId]
        );

        if (checkFrais.length === 0) {
            res.status(404).json({ message: 'Type de frais non trouvé.' });
            return;
        }

        const montantTotalFrais = parseFloat(checkFrais[0].montant) || 0;

        // Vérifier que la somme des montants par période ne dépasse pas le montant total
        let sommePeriodes = 0;
        for (const periode of periodes) {
            const montant = parseFloat(periode.montant) || 0;
            if (montant < 0) {
                res.status(400).json({
                    message: `Le montant pour la période "${periode.periode_nom || periode.periode_id}" ne peut pas être négatif.`
                });
                return;
            }
            sommePeriodes += montant;
        }

        if (sommePeriodes > montantTotalFrais) {
            res.status(400).json({
                message: `La somme des montants par période (${sommePeriodes}) dépasse le montant total du frais (${montantTotalFrais}).`,
                montant_total: montantTotalFrais,
                somme_periodes: sommePeriodes,
                difference: sommePeriodes - montantTotalFrais
            });
            return;
        }

        // Démarrer une transaction
        await db.query('START TRANSACTION');

        try {
            // Pour chaque période, faire un INSERT ou UPDATE
            for (const periode of periodes) {
                const periodeId = periode.periode_id;
                const montant = parseFloat(periode.montant) || 0;

                // Vérifier que la période existe et appartient à l'école
                const [checkPeriode] = await db.query<RowDataPacket[]>(
                    'SELECT id FROM periodes WHERE id = ? AND ecole_id = ?',
                    [periodeId, ecoleId]
                );

                if (checkPeriode.length === 0) {
                    throw new Error(`Période ID ${periodeId} non trouvée.`);
                }

                if (montant === 0) {
                    // Si le montant est 0, on supprime l'enregistrement s'il existe
                    await db.query<ResultSetHeader>(
                        `DELETE FROM frais_par_periode 
                         WHERE type_frais_id = ? AND periode_id = ?`,
                        [type_frais_id, periodeId]
                    );
                } else {
                    // INSERT ou UPDATE
                    await db.query<ResultSetHeader>(
                        `INSERT INTO frais_par_periode (type_frais_id, periode_id, montant)
                         VALUES (?, ?, ?)
                         ON DUPLICATE KEY UPDATE montant = ?`,
                        [type_frais_id, periodeId, montant, montant]
                    );
                }
            }

            await db.query('COMMIT');

            res.status(200).json({
                message: 'Configuration des périodes enregistrée avec succès.',
                type_frais_id,
                somme_periodes: sommePeriodes,
                montant_total: montantTotalFrais,
                reste: montantTotalFrais - sommePeriodes
            });

        } catch (error) {
            await db.query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        console.error('Erreur saveFraisParPeriodes:', error);
        res.status(500).json({
            message: 'Erreur lors de l\'enregistrement des périodes.'
        });
    }
};

export const createTypeFrais = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { nom, montant, devise, est_obligatoire, periodicite, par_defaut_autorise } = req.body || {};

    try {
        if (!nom || montant === undefined || montant === null) {
            res.status(400).json({ message: 'nom et montant sont obligatoires.' });
            return;
        }

        // Récupérer l'année active
        const activeYearId = await getActiveYearId(ecoleId);
        if (!activeYearId) {
            res.status(400).json({ message: 'Aucune année scolaire ouverte.' });
            return;
        }

        const [result] = await db.query<ResultSetHeader>(
            `INSERT INTO types_frais 
             (ecole_id, annee_scolaire_id, nom, montant, devise, est_obligatoire, periodicite, par_defaut_autorise)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                ecoleId,
                activeYearId,
                nom,
                montant,
                devise || 'USD',
                est_obligatoire !== false,
                periodicite || 'ANNUELLE',
                par_defaut_autorise || false
            ]
        );

        // 🔥 Récupérer le frais complet pour le retourner
        const [newFrais] = await db.query<RowDataPacket[]>(
            `SELECT tf.*,
                (SELECT COUNT(*) FROM paiements p 
                 WHERE p.type_frais_id = tf.id AND p.annule = 0) as nb_paiements,
                (SELECT COUNT(*) FROM frais_par_periode fpp 
                 WHERE fpp.type_frais_id = tf.id) as nb_periodes
             FROM types_frais tf
             WHERE tf.id = ?`,
            [result.insertId]
        );

        res.status(201).json({
            message: 'Type de frais créé avec succès.',
            id: result.insertId,
            frais: newFrais[0] || null  // 👈 Retourner le frais complet
        });
    } catch (error) {
        console.error('Erreur createTypeFrais:', error);
        res.status(500).json({ message: 'Erreur lors de la création du frais.' });
    }
};

export const updateTypeFrais = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { id } = req.params;
    const { nom, montant, devise, est_obligatoire, periodicite, par_defaut_autorise } = req.body || {};

    try {
        await db.query<ResultSetHeader>(
            `UPDATE types_frais 
             SET nom = ?, montant = ?, devise = ?, est_obligatoire = ?, 
                 periodicite = ?, par_defaut_autorise = ?
             WHERE id = ? AND ecole_id = ?`,
            [nom, montant, devise || 'USD', est_obligatoire !== false,
                periodicite || 'ANNUELLE', par_defaut_autorise || false, id, ecoleId]
        );

        res.json({ message: 'Type de frais mis à jour.' });
    } catch (error) {
        console.error('Erreur updateTypeFrais:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour.' });
    }
};

export const deleteTypeFrais = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { id } = req.params;

    try {
        // Vérifier si des paiements existent
        const [check] = await db.query<RowDataPacket[]>(
            'SELECT COUNT(*) as count FROM paiements WHERE type_frais_id = ? AND annule = 0',
            [id]
        );

        if (check[0].count > 0) {
            res.status(400).json({
                message: 'Impossible de supprimer ce frais car des paiements sont associés.'
            });
            return;
        }

        await db.query<ResultSetHeader>(
            'DELETE FROM types_frais WHERE id = ? AND ecole_id = ?',
            [id, ecoleId]
        );

        res.json({ message: 'Type de frais supprimé.' });
    } catch (error) {
        console.error('Erreur deleteTypeFrais:', error);
        res.status(500).json({ message: 'Erreur lors de la suppression.' });
    }
};

// ============================================
// 3. GESTION DES FRAIS PAR PÉRIODE
// ============================================

export const listFraisParPeriode = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;

    try {
        const activeYearId = await getActiveYearId(ecoleId);
        if (!activeYearId) {
            res.json({ results: [], message: 'Aucune année scolaire active.' });
            return;
        }

        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT 
                fpp.*,
                tf.nom as type_frais_nom,
                p.nom as periode_nom
             FROM frais_par_periode fpp
             JOIN types_frais tf ON fpp.type_frais_id = tf.id
             JOIN periodes p ON fpp.periode_id = p.id
             WHERE tf.ecole_id = ?
               AND tf.annee_scolaire_id = ?
             ORDER BY p.ordre ASC, tf.nom ASC`,
            [ecoleId, activeYearId]
        );

        res.json({ results: rows });
    } catch (error) {
        console.error('Erreur listFraisParPeriode:', error);
        res.status(500).json({ message: 'Erreur lors du chargement des frais par période.' });
    }
};

export const createFraisParPeriode = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { type_frais_id, periode_id, montant } = req.body || {};

    try {
        if (!type_frais_id || !periode_id || montant === undefined) {
            res.status(400).json({ message: 'type_frais_id, periode_id et montant sont obligatoires.' });
            return;
        }

        // Vérifier que le type de frais appartient à l'école et à l'année active
        const activeYearId = await getActiveYearId(ecoleId);
        if (!activeYearId) {
            res.status(400).json({ message: 'Aucune année scolaire ouverte.' });
            return;
        }

        const [checkFrais] = await db.query<RowDataPacket[]>(
            'SELECT id FROM types_frais WHERE id = ? AND ecole_id = ? AND annee_scolaire_id = ?',
            [type_frais_id, ecoleId, activeYearId]
        );

        if (checkFrais.length === 0) {
            res.status(404).json({ message: 'Type de frais non trouvé.' });
            return;
        }

        // Vérifier que la période appartient à l'école
        const [checkPeriode] = await db.query<RowDataPacket[]>(
            'SELECT id FROM periodes WHERE id = ? AND ecole_id = ?',
            [periode_id, ecoleId]
        );

        if (checkPeriode.length === 0) {
            res.status(404).json({ message: 'Période non trouvée.' });
            return;
        }

        await db.query<ResultSetHeader>(
            `INSERT INTO frais_par_periode (type_frais_id, periode_id, montant)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE montant = ?`,
            [type_frais_id, periode_id, montant, montant]
        );

        res.status(201).json({ message: 'Montant par période enregistré avec succès.' });
    } catch (error) {
        console.error('Erreur createFraisParPeriode:', error);
        res.status(500).json({ message: 'Erreur lors de l\'enregistrement.' });
    }
};

export const deleteFraisParPeriode = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { id } = req.params;

    try {
        await db.query<ResultSetHeader>(
            `DELETE fpp FROM frais_par_periode fpp
             JOIN types_frais tf ON fpp.type_frais_id = tf.id
             WHERE fpp.id = ? AND tf.ecole_id = ?`,
            [id, ecoleId]
        );

        res.json({ message: 'Montant par période supprimé.' });
    } catch (error) {
        console.error('Erreur deleteFraisParPeriode:', error);
        res.status(500).json({ message: 'Erreur lors de la suppression.' });
    }
};

// ============================================
// 4. RECHERCHE D'ÉLÈVES
// ============================================

export const searchEleves = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const q = String(req.query?.q || '').trim();

    try {
        if (!q) {
            res.status(400).json({ message: 'q (matricule ou nom) est requis.' });
            return;
        }

        const activeYearId = await getActiveYearId(ecoleId);
        const like = `%${q}%`;

        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT 
                e.id,
                e.matricule,
                e.nom,
                e.postnom,
                e.prenom,
                e.sexe,
                c.id as classe_id,
                c.nom as classe_nom,
                c.section as classe_section,
                c.option_classe as classe_option,
                i.id as inscription_id,
                i.annee_scolaire_id
             FROM eleves e
             LEFT JOIN inscriptions i ON e.id = i.eleve_id 
                AND i.annee_scolaire_id = ?
             LEFT JOIN classes c ON i.classe_id = c.id
             WHERE e.ecole_id = ?
               AND (e.matricule = ? OR e.nom LIKE ? OR e.prenom LIKE ?)
             ORDER BY e.nom ASC, e.prenom ASC
             LIMIT 30`,
            [activeYearId, ecoleId, q, like, like]
        );

        res.json({ results: rows });
    } catch (error) {
        console.error('Erreur searchEleves:', error);
        res.status(500).json({ message: 'Erreur lors de la recherche.' });
    }
};

// ============================================
// 5. DÉTAILS ÉLÈVE ET PAIEMENTS
// ============================================

export const getDetailElevePaiement = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { eleveId } = req.params;

    try {
        // Récupérer l'année active
        const activeYearId = await getActiveYearId(ecoleId);
        if (!activeYearId) {
            res.json({ message: 'Aucune année scolaire ouverte.', frais: [], totalPaye: 0 });
            return;
        }

        // Récupérer l'inscription de l'élève
        const [inscription] = await db.query<RowDataPacket[]>(
            `SELECT id FROM inscriptions 
             WHERE eleve_id = ? AND annee_scolaire_id = ?`,
            [eleveId, activeYearId]
        );

        const inscriptionId = inscription.length > 0 ? inscription[0].id : null;

        // Récupérer les frais pour cette année
        const [frais] = await db.query<RowDataPacket[]>(
            `SELECT 
                tf.id as type_frais_id,
                tf.nom,
                tf.montant as montant_annuel,
                tf.devise,
                tf.est_obligatoire,
                tf.periodicite,
                ? as inscription_id,
                COALESCE(
                    (SELECT SUM(pa.montant_paye) 
                     FROM paiements pa 
                     WHERE pa.inscription_id = ? 
                       AND pa.type_frais_id = tf.id 
                       AND pa.annule = 0), 0
                ) as total_paye
             FROM types_frais tf
             WHERE tf.ecole_id = ?
               AND tf.annee_scolaire_id = ?
             ORDER BY tf.est_obligatoire DESC, tf.nom ASC`,
            [inscriptionId, inscriptionId, ecoleId, activeYearId]
        );

        // Calculer le total payé
        const [totalPaye] = await db.query<RowDataPacket[]>(
            `SELECT COALESCE(SUM(pa.montant_paye), 0) as total
             FROM paiements pa
             JOIN inscriptions i ON pa.inscription_id = i.id
             WHERE i.eleve_id = ? 
               AND i.annee_scolaire_id = ?
               AND pa.annule = 0`,
            [eleveId, activeYearId]
        );

        // Récupérer les infos de l'élève
        const [eleve] = await db.query<RowDataPacket[]>(
            `SELECT e.*, c.nom as classe_nom, c.section, c.option_classe
             FROM eleves e
             LEFT JOIN inscriptions i ON e.id = i.eleve_id 
                AND i.annee_scolaire_id = ?
             LEFT JOIN classes c ON i.classe_id = c.id
             WHERE e.id = ? AND e.ecole_id = ?`,
            [activeYearId, eleveId, ecoleId]
        );

        res.json({
            eleve: eleve[0] || null,
            annee_scolaire_id: activeYearId,
            inscription_id: inscriptionId,
            totalPaye: totalPaye[0]?.total || 0,
            frais: frais || []
        });

    } catch (error) {
        console.error('Erreur getDetailElevePaiement:', error);
        res.status(500).json({ message: 'Erreur lors du chargement des détails.' });
    }
};

// ============================================
// 6. CRÉATION DE PAIEMENT
// ============================================

export const createPaiement = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const gestionnaireId = req.user?.id;
    const { eleve_id, type_frais_id, montant_paye, mode_paiement, commentaire, reference_externe } = req.body || {};

    try {
        // Vérifications
        if (!eleve_id || !type_frais_id || !montant_paye) {
            res.status(400).json({
                message: 'eleve_id, type_frais_id et montant_paye sont obligatoires.'
            });
            return;
        }

        if (montant_paye <= 0) {
            res.status(400).json({ message: 'Le montant doit être supérieur à 0.' });
            return;
        }

        // Récupérer l'année active
        const activeYearId = await getActiveYearId(ecoleId);
        if (!activeYearId) {
            res.status(400).json({ message: 'Aucune année scolaire ouverte.' });
            return;
        }

        // Récupérer l'inscription de l'élève
        const [inscription] = await db.query<RowDataPacket[]>(
            `SELECT id FROM inscriptions 
             WHERE eleve_id = ? AND annee_scolaire_id = ?`,
            [eleve_id, activeYearId]
        );

        if (inscription.length === 0) {
            res.status(404).json({ message: 'Élève non inscrit pour cette année.' });
            return;
        }

        const inscriptionId = inscription[0].id;

        // Récupérer le type de frais et son montant annuel
        const [fraisInfo] = await db.query<RowDataPacket[]>(
            `SELECT tf.*, 
                    tf.montant as montant_annuel,
                    tf.periodicite
             FROM types_frais tf
             WHERE tf.id = ? AND tf.ecole_id = ? AND tf.annee_scolaire_id = ?`,
            [type_frais_id, ecoleId, activeYearId]
        );

        if (fraisInfo.length === 0) {
            res.status(404).json({ message: 'Type de frais non trouvé.' });
            return;
        }

        // Vérifier que le montant ne dépasse pas le total annuel
        const montantAnnuel = parseFloat(fraisInfo[0].montant_annuel) || 0;

        // Calculer le total déjà payé pour ce type de frais
        const [totalDejaPaye] = await db.query<RowDataPacket[]>(
            `SELECT COALESCE(SUM(montant_paye), 0) as total
             FROM paiements 
             WHERE inscription_id = ? 
               AND type_frais_id = ? 
               AND annule = 0`,
            [inscriptionId, type_frais_id]
        );

        const totalPaye = parseFloat(totalDejaPaye[0]?.total || 0);
        const nouveauTotal = totalPaye + montant_paye;

        if (nouveauTotal > montantAnnuel) {
            res.status(400).json({
                message: `Le montant total (${nouveauTotal}) dépasse le montant annuel (${montantAnnuel}).`
            });
            return;
        }

        // Récupérer les périodes actives avec leurs montants
        const [periodes] = await db.query<RowDataPacket[]>(
            `SELECT p.*, 
                    COALESCE(fpp.montant, ?) as montant_periode
             FROM periodes p
             LEFT JOIN frais_par_periode fpp ON fpp.periode_id = p.id AND fpp.type_frais_id = ?
             WHERE p.ecole_id = ? AND p.est_active = 1
             ORDER BY p.ordre ASC`,
            [montantAnnuel, type_frais_id, ecoleId]
        );

        if (periodes.length === 0) {
            res.status(400).json({ message: 'Aucune période active configurée.' });
            return;
        }

        // Récupérer les paiements existants par période
        const [paiementsExistants] = await db.query<RowDataPacket[]>(
            `SELECT periode_id, montant_paye
             FROM paiements 
             WHERE inscription_id = ? 
               AND type_frais_id = ? 
               AND annule = 0
               AND periode_id IS NOT NULL`,
            [inscriptionId, type_frais_id]
        );

        // Calculer ce qui a déjà été payé par période
        const payeParPeriode: { [key: number]: number } = {};
        for (const p of paiementsExistants) {
            if (p.periode_id) {
                payeParPeriode[p.periode_id] = (payeParPeriode[p.periode_id] || 0) + p.montant_paye;
            }
        }

        // Générer un TRANSACTION_ID unique
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 6);
        const transaction_id = `TXN-${timestamp}-${random}`;

        console.log(`📝 Transaction ID: ${transaction_id}`);

        // Répartition du paiement
        let montantRestant = montant_paye;
        const paiementsEffectues: any[] = [];
        let firstPaiementId = null;

        // Démarrer une transaction
        await db.query('START TRANSACTION');

        try {
            for (const periode of periodes) {
                if (montantRestant <= 0) break;

                const montantPeriode = parseFloat(periode.montant_periode) || 0;
                const dejaPaye = payeParPeriode[periode.id] || 0;
                const reste = Math.max(0, montantPeriode - dejaPaye);

                if (reste > 0) {
                    const aPayer = Math.min(montantRestant, reste);

                    console.log(`📌 Période ${periode.nom}: ${aPayer}$`);

                    const numero_recu_unique = await generateUniqueRecuNumber(ecoleId);

                    const [result] = await db.query<ResultSetHeader>(
                        `INSERT INTO paiements 
                         (inscription_id, type_frais_id, gestionnaire_id, montant_paye, 
                          date_paiement, mode_paiement, numero_recu, commentaire, 
                          reference_externe, periode_id, transaction_id)
                         VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?)`,
                        [
                            inscriptionId,
                            type_frais_id,
                            gestionnaireId,
                            aPayer,
                            mode_paiement || 'CASH',
                            numero_recu_unique,
                            commentaire || null,
                            reference_externe || null,
                            periode.id,
                            transaction_id
                        ]
                    );

                    if (firstPaiementId === null) {
                        firstPaiementId = result.insertId;
                    }

                    paiementsEffectues.push({
                        paiement_id: result.insertId,
                        periode_id: periode.id,
                        periode_nom: periode.nom,
                        montant: aPayer,
                        numero_recu: numero_recu_unique
                    });

                    montantRestant -= aPayer;
                    payeParPeriode[periode.id] = (payeParPeriode[periode.id] || 0) + aPayer;

                    await verifierAutorisationFraisParPeriode(inscriptionId, type_frais_id, periode.id, ecoleId);
                    await verifierAutorisationParPeriode(inscriptionId, periode.id, ecoleId);
                }
            }

            // Surplus
            if (montantRestant > 0) {
                console.log(`📌 Surplus: ${montantRestant}$`);

                const numero_recu_unique = await generateUniqueRecuNumber(ecoleId);

                const [result] = await db.query<ResultSetHeader>(
                    `INSERT INTO paiements 
                     (inscription_id, type_frais_id, gestionnaire_id, montant_paye, 
                      date_paiement, mode_paiement, numero_recu, commentaire, 
                      reference_externe, transaction_id)
                     VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)`,
                    [
                        inscriptionId,
                        type_frais_id,
                        gestionnaireId,
                        montantRestant,
                        mode_paiement || 'CASH',
                        numero_recu_unique,
                        commentaire || null,
                        reference_externe || null,
                        transaction_id
                    ]
                );

                paiementsEffectues.push({
                    paiement_id: result.insertId,
                    periode_id: null,
                    periode_nom: 'Surplus',
                    montant: montantRestant,
                    numero_recu: numero_recu_unique
                });
            }

            await db.query('COMMIT');

        } catch (error) {
            await db.query('ROLLBACK');
            throw error;
        }

        res.status(201).json({
            message: 'Paiement enregistré avec succès.',
            paiement_id: firstPaiementId,
            transaction_id: transaction_id,
            numero_recu: paiementsEffectues.length > 0 ? paiementsEffectues[0].numero_recu : null,
            montant_total: montant_paye,
            paiements_effectues: paiementsEffectues,
            montant_annuel: montantAnnuel,
            total_paye_apres: totalPaye + montant_paye
        });

    } catch (error) {
        console.error('Erreur createPaiement:', error);
        res.status(500).json({ message: 'Erreur lors de l\'enregistrement du paiement.' });
    }
};

// ✅ FONCTION POUR GÉNÉRER UN NUMÉRO DE REÇU UNIQUE
async function generateUniqueRecuNumber(ecoleId: number): Promise<string> {
    const dateStr = format(new Date(), 'yyyyMMdd');
    let numero_recu: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
        // Récupérer le MAXIMUM des numéros pour la date du jour
        const [maxRecu] = await db.query<RowDataPacket[]>(
            `SELECT MAX(CAST(SUBSTRING_INDEX(numero_recu, '-', -1) AS UNSIGNED)) as max_num
             FROM paiements 
             WHERE numero_recu LIKE ?`,
            [`REC-${dateStr}-%`]
        );

        let nextNumber = 1;
        if (maxRecu[0]?.max_num) {
            nextNumber = maxRecu[0].max_num + 1;
        }

        const recuNumber = String(nextNumber).padStart(4, '0');
        numero_recu = `REC-${dateStr}-${recuNumber}`;

        // Vérifier si ce numéro existe déjà (en cas de race condition)
        const [check] = await db.query<RowDataPacket[]>(
            'SELECT COUNT(*) as count FROM paiements WHERE numero_recu = ?',
            [numero_recu]
        );

        if (check[0].count === 0) {
            break; // Numéro unique trouvé
        }

        attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
        // Fallback: utiliser un timestamp pour garantir l'unicité
        const fallback = `${dateStr}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
        numero_recu = `REC-${fallback}`;
    }

    return numero_recu;
}

async function verifierAutorisationParPeriode(inscriptionId: number, periodeId: number, ecoleId: number): Promise<void> {
    try {
        const [fraisObligatoires] = await db.query<RowDataPacket[]>(
            `SELECT 
                tf.id,
                COALESCE(fpp.montant, tf.montant) as montant_periode
             FROM types_frais tf
             LEFT JOIN frais_par_periode fpp ON fpp.type_frais_id = tf.id AND fpp.periode_id = ?
             WHERE tf.ecole_id = ? 
               AND tf.annee_scolaire_id = (
                   SELECT annee_scolaire_id FROM inscriptions WHERE id = ?
               )
               AND tf.est_obligatoire = 1`,
            [periodeId, ecoleId, inscriptionId]
        );

        if (fraisObligatoires.length === 0) return;

        let tousPayes = true;
        for (const frais of fraisObligatoires) {
            const [paiement] = await db.query<RowDataPacket[]>(
                `SELECT COALESCE(SUM(montant_paye), 0) as total
                 FROM paiements 
                 WHERE inscription_id = ? 
                   AND type_frais_id = ? 
                   AND periode_id = ?
                   AND annule = 0`,
                [inscriptionId, frais.id, periodeId]
            );

            if (paiement[0].total < frais.montant_periode) {
                tousPayes = false;
                break;
            }
        }

        if (tousPayes) {
            // ✅ Écrase TOUT (dérogation incluse) → AUTO permanent
            await db.query<ResultSetHeader>(
                `INSERT INTO autorisations_bulletin 
                 (inscription_id, periode_id, statut, autorisation_auto, 
                  date_autorisation_auto, date_autorisation, gestionnaire_id,
                  duree_jours, date_expiration, motif_autorisation)
                 VALUES (?, ?, 'AUTORISE', TRUE, NOW(), NULL, NULL, NULL, NULL, NULL)
                 ON DUPLICATE KEY UPDATE 
                    statut = 'AUTORISE',
                    autorisation_auto = TRUE,
                    date_autorisation_auto = NOW(),
                    date_autorisation = NULL,
                    gestionnaire_id = NULL,
                    duree_jours = NULL,
                    date_expiration = NULL,
                    motif_autorisation = NULL`,
                [inscriptionId, periodeId]
            );
        }
    } catch (error) {
        console.error('Erreur verifierAutorisationParPeriode:', error);
    }
}

async function verifierAutorisationFraisParPeriode(
    inscriptionId: number,
    typeFraisId: number,
    periodeId: number,
    ecoleId: number
): Promise<void> {
    try {
        const [fraisInfo] = await db.query<RowDataPacket[]>(
            `SELECT 
                tf.id,
                tf.est_obligatoire,
                COALESCE(fpp.montant, tf.montant) as montant_periode
             FROM types_frais tf
             LEFT JOIN frais_par_periode fpp ON fpp.type_frais_id = tf.id AND fpp.periode_id = ?
             WHERE tf.id = ? AND tf.ecole_id = ?`,
            [periodeId, typeFraisId, ecoleId]
        );

        if (fraisInfo.length === 0) return;
        if (!fraisInfo[0].est_obligatoire) return;

        const montantPeriode = parseFloat(fraisInfo[0].montant_periode) || 0;

        const [paiement] = await db.query<RowDataPacket[]>(
            `SELECT COALESCE(SUM(montant_paye), 0) as total
             FROM paiements 
             WHERE inscription_id = ? 
               AND type_frais_id = ? 
               AND periode_id = ?
               AND annule = 0`,
            [inscriptionId, typeFraisId, periodeId]
        );

        const totalPaye = parseFloat(paiement[0]?.total || 0);

        if (totalPaye >= montantPeriode) {
            // Vérifier si tous les autres frais obligatoires sont aussi payés
            const [autresFrais] = await db.query<RowDataPacket[]>(
                `SELECT tf.id
                 FROM types_frais tf
                 WHERE tf.ecole_id = ? 
                   AND tf.annee_scolaire_id = (
                       SELECT annee_scolaire_id FROM inscriptions WHERE id = ?
                   )
                   AND tf.est_obligatoire = 1
                   AND tf.id != ?`,
                [ecoleId, inscriptionId, typeFraisId]
            );

            let tousPayes = true;
            for (const frais of autresFrais) {
                const [check] = await db.query<RowDataPacket[]>(
                    `SELECT COALESCE(SUM(montant_paye), 0) as total
                     FROM paiements 
                     WHERE inscription_id = ? 
                       AND type_frais_id = ? 
                       AND periode_id = ?
                       AND annule = 0`,
                    [inscriptionId, frais.id, periodeId]
                );

                const [fraisMontant] = await db.query<RowDataPacket[]>(
                    `SELECT COALESCE(fpp.montant, tf.montant) as montant_periode
                     FROM types_frais tf
                     LEFT JOIN frais_par_periode fpp ON fpp.type_frais_id = tf.id AND fpp.periode_id = ?
                     WHERE tf.id = ?`,
                    [periodeId, frais.id]
                );
                const montant = parseFloat(fraisMontant[0]?.montant_periode || 0);

                if (parseFloat(check[0]?.total || 0) < montant) {
                    tousPayes = false;
                    break;
                }
            }

            if (tousPayes) {
                // ✅ Écrase TOUT (dérogation incluse) → AUTO permanent
                await db.query<ResultSetHeader>(
                    `INSERT INTO autorisations_bulletin 
                     (inscription_id, periode_id, statut, autorisation_auto, 
                      date_autorisation_auto, date_autorisation, gestionnaire_id,
                      duree_jours, date_expiration, motif_autorisation)
                     VALUES (?, ?, 'AUTORISE', TRUE, NOW(), NULL, NULL, NULL, NULL, NULL)
                     ON DUPLICATE KEY UPDATE 
                        statut = 'AUTORISE',
                        autorisation_auto = TRUE,
                        date_autorisation_auto = NOW(),
                        date_autorisation = NULL,
                        gestionnaire_id = NULL,
                        duree_jours = NULL,
                        date_expiration = NULL,
                        motif_autorisation = NULL`,
                    [inscriptionId, periodeId]
                );
                console.log(`🤖 AUTO (paiement complet) - inscription ${inscriptionId}, période ${periodeId}`);
            }
        }
    } catch (error) {
        console.error('Erreur verifierAutorisationFraisParPeriode:', error);
    }
}

// ============================================
// 7. LISTE DES PAIEMENTS
// ============================================

export const listPaiements = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const page = Math.max(1, Number(req.query?.page || 1));
    const pageSize = Math.min(50, Math.max(5, Number(req.query?.pageSize || 10)));
    const offset = (page - 1) * pageSize;
    const search = String(req.query?.search || '').trim();

    try {
        const activeYearId = await getActiveYearId(ecoleId);
        if (!activeYearId) {
            res.json({ page, pageSize, total: 0, results: [], message: 'Aucune année scolaire active.' });
            return;
        }

        let query = `
            SELECT 
                p.id,
                p.numero_recu,
                p.montant_paye,
                p.date_paiement,
                p.mode_paiement,
                p.reference_externe,
                p.commentaire,
                p.annule,
                e.id as eleve_id,
                e.nom as eleve_nom,
                e.prenom as eleve_prenom,
                e.matricule as eleve_matricule,
                tf.nom as type_frais,
                c.nom as classe_nom,
                u.nom as gestionnaire_nom,
                u.prenom as gestionnaire_prenom
            FROM paiements p
            JOIN inscriptions i ON p.inscription_id = i.id
            JOIN eleves e ON i.eleve_id = e.id
            JOIN types_frais tf ON p.type_frais_id = tf.id
            JOIN classes c ON i.classe_id = c.id
            JOIN utilisateurs u ON p.gestionnaire_id = u.id
            WHERE e.ecole_id = ?
              AND i.annee_scolaire_id = ?
        `;

        const params: any[] = [ecoleId, activeYearId];

        if (search) {
            query += ` AND (e.matricule LIKE ? OR e.nom LIKE ? OR e.prenom LIKE ? OR p.numero_recu LIKE ?)`;
            const like = `%${search}%`;
            params.push(like, like, like, like);
        }

        query += ` ORDER BY p.date_paiement DESC LIMIT ? OFFSET ?`;
        params.push(pageSize, offset);

        const [rows] = await db.query<RowDataPacket[]>(query, params);

        let countQuery = `
            SELECT COUNT(*) as count
            FROM paiements p
            JOIN inscriptions i ON p.inscription_id = i.id
            JOIN eleves e ON i.eleve_id = e.id
            WHERE e.ecole_id = ?
              AND i.annee_scolaire_id = ?
        `;
        const countParams: any[] = [ecoleId, activeYearId];

        if (search) {
            countQuery += ` AND (e.matricule LIKE ? OR e.nom LIKE ? OR e.prenom LIKE ? OR p.numero_recu LIKE ?)`;
            const like = `%${search}%`;
            countParams.push(like, like, like, like);
        }

        const [countRows] = await db.query<RowDataPacket[]>(countQuery, countParams);

        res.json({
            page,
            pageSize,
            total: countRows[0]?.count || 0,
            results: rows
        });
    } catch (error) {
        console.error('Erreur listPaiements:', error);
        res.status(500).json({ message: 'Erreur lors du chargement des paiements.' });
    }
};

export const annulerPaiement = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const gestionnaireId = req.user?.id;
    const { id } = req.params;

    try {
        // Vérifier que le paiement existe
        const [check] = await db.query<RowDataPacket[]>(
            `SELECT p.id, p.annule FROM paiements p
             JOIN inscriptions i ON p.inscription_id = i.id
             JOIN eleves e ON i.eleve_id = e.id
             WHERE p.id = ? AND e.ecole_id = ?`,
            [id, ecoleId]
        );

        if (check.length === 0) {
            res.status(404).json({ message: 'Paiement non trouvé.' });
            return;
        }

        if (check[0].annule) {
            res.status(400).json({ message: 'Ce paiement est déjà annulé.' });
            return;
        }

        await db.query<ResultSetHeader>(
            `UPDATE paiements 
             SET annule = TRUE, date_annulation = NOW(), annule_par = ?
             WHERE id = ?`,
            [gestionnaireId, id]
        );

        res.json({ message: 'Paiement annulé avec succès.' });
    } catch (error) {
        console.error('Erreur annulerPaiement:', error);
        res.status(500).json({ message: 'Erreur lors de l\'annulation du paiement.' });
    }
};

// ============================================
// 8. REÇU
// ============================================

export const getRecuData = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { id } = req.params;

    try {
        // 1. Récupérer le paiement demandé pour obtenir son transaction_id
        const [payment] = await db.query<RowDataPacket[]>(
            `SELECT transaction_id, inscription_id 
             FROM paiements 
             WHERE id = ? AND annule = 0`,
            [id]
        );

        if (payment.length === 0) {
            res.status(404).json({ message: 'Paiement non trouvé.' });
            return;
        }

        const transactionId = payment[0].transaction_id;
        const inscriptionId = payment[0].inscription_id;

        if (!transactionId) {
            res.status(404).json({ message: 'Aucune transaction associée à ce paiement.' });
            return;
        }

        // 2. Récupérer TOUS les paiements de la transaction
        const [allPaiements] = await db.query<RowDataPacket[]>(
            `SELECT 
                p.id,
                p.numero_recu,
                p.montant_paye,
                p.date_paiement,
                p.mode_paiement,
                p.reference_externe,
                p.commentaire,
                p.periode_id,
                per.nom as periode_nom,
                per.ordre as periode_ordre,
                e.nom as eleve_nom,
                e.prenom as eleve_prenom,
                e.matricule as eleve_matricule,
                e.postnom as eleve_postnom,
                tf.nom as type_frais,
                tf.montant as frais_montant,
                tf.devise,
                u.nom as gestionnaire_nom,
                u.prenom as gestionnaire_prenom,
                c.nom as classe_nom,
                c.section as classe_section,
                c.option_classe as classe_option,
                a.nom as annee_scolaire_nom,
                ec.nom as ecole_nom,
                ec.adresse as ecole_adresse,
                ec.bp as ecole_bp,
                ec.telephone as ecole_telephone,
                ec.email as ecole_email,
                ec.logo as ecole_logo
             FROM paiements p
             LEFT JOIN periodes per ON p.periode_id = per.id
             JOIN inscriptions i ON p.inscription_id = i.id
             JOIN eleves e ON i.eleve_id = e.id
             JOIN types_frais tf ON p.type_frais_id = tf.id
             JOIN utilisateurs u ON p.gestionnaire_id = u.id
             JOIN classes c ON i.classe_id = c.id
             JOIN annees_scolaires a ON i.annee_scolaire_id = a.id
             JOIN ecoles ec ON e.ecole_id = ec.id
             WHERE p.transaction_id = ? 
               AND p.annule = 0
               AND e.ecole_id = ?
             ORDER BY per.ordre ASC, p.id ASC`,
            [transactionId, ecoleId]
        );

        if (allPaiements.length === 0) {
            res.status(404).json({ message: 'Aucun paiement trouvé pour cette transaction.' });
            return;
        }

        // 3. Construire les données du reçu
        const firstPayment = allPaiements[0];

        let montantTotal = 0;
        const repartition: any[] = [];

        for (const p of allPaiements) {
            montantTotal += Number(p.montant_paye) || 0;
            repartition.push({
                periode_nom: p.periode_nom || 'Paiement',
                montant_paye: Number(p.montant_paye) || 0,
                numero_recu: p.numero_recu,
                periode_id: p.periode_id,
                paiement_id: p.id,
                date_paiement: p.date_paiement
            });
        }

        const recuData = {
            ...firstPayment,
            montant_total: montantTotal,
            repartition: repartition,
            transaction_id: transactionId,
            numero_recu: firstPayment.numero_recu,
            montant_paye: montantTotal,
            devise: firstPayment.devise || 'USD'
        };

        res.json({ recu: recuData });
    } catch (error) {
        console.error('Erreur getRecuData:', error);
        res.status(500).json({ message: 'Erreur lors du chargement du reçu.' });
    }
};

// ============================================
// 9. IMPAYÉS
// ============================================

export const listImpayes = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;

    try {
        // Récupérer l'année active
        const activeYearId = await getActiveYearId(ecoleId);
        if (!activeYearId) {
            res.json({ results: [], message: 'Aucune année scolaire ouverte.' });
            return;
        }

        // Élèves avec impayés
        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT 
                e.id as eleve_id,
                e.matricule,
                e.nom,
                e.postnom,
                e.prenom,
                c.nom as classe_nom,
                c.section as classe_section,
                c.option_classe as classe_option,
                tf.id as frais_id,
                tf.nom as type_frais,
                tf.montant as frais_montant,
                tf.periodicite,
                COALESCE(SUM(p.montant_paye), 0) as total_paye,
                (tf.montant - COALESCE(SUM(p.montant_paye), 0)) as reste_a_payer
             FROM eleves e
             JOIN inscriptions i ON e.id = i.eleve_id
             JOIN classes c ON i.classe_id = c.id
             CROSS JOIN types_frais tf
             LEFT JOIN paiements p ON i.id = p.inscription_id 
                AND p.type_frais_id = tf.id 
                AND p.annule = 0
             WHERE e.ecole_id = ?
               AND i.annee_scolaire_id = ?
               AND tf.ecole_id = ?
               AND tf.annee_scolaire_id = ?
               AND tf.est_obligatoire = 1
             GROUP BY e.id, e.matricule, e.nom, e.prenom, tf.id, tf.nom, tf.montant, c.nom, c.section, c.option_classe
             HAVING reste_a_payer > 0
             ORDER BY e.nom ASC, e.prenom ASC`,
            [ecoleId, activeYearId, ecoleId, activeYearId]
        );

        res.json({ results: rows });
    } catch (error) {
        console.error('Erreur listImpayes:', error);
        res.status(500).json({ message: 'Erreur lors du chargement des impayés.' });
    }
};

// ============================================
// 10. GESTION DES STOCKS
// ============================================

export const listStocks = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const page = Math.max(1, Number(req.query?.page || 1));
    const pageSize = Math.min(50, Math.max(5, Number(req.query?.pageSize || 10)));
    const offset = (page - 1) * pageSize;
    const search = String(req.query?.search || '').trim();
    const categorie = req.query?.categorie ? String(req.query.categorie) : null;

    try {
        let query = `SELECT * FROM stocks WHERE ecole_id = ?`;
        const params: any[] = [ecoleId];

        if (search) {
            query += ` AND (nom LIKE ? OR reference LIKE ? OR fournisseur LIKE ?)`;
            const like = `%${search}%`;
            params.push(like, like, like);
        }

        if (categorie) {
            query += ` AND categorie = ?`;
            params.push(categorie);
        }

        query += ` ORDER BY nom ASC LIMIT ? OFFSET ?`;
        params.push(pageSize, offset);

        const [rows] = await db.query<RowDataPacket[]>(query, params);

        // Récupérer les catégories pour le filtre
        const [categories] = await db.query<RowDataPacket[]>(
            'SELECT DISTINCT categorie FROM stocks WHERE ecole_id = ? AND categorie IS NOT NULL',
            [ecoleId]
        );

        let countQuery = `SELECT COUNT(*) as count FROM stocks WHERE ecole_id = ?`;
        const countParams: any[] = [ecoleId];

        if (search) {
            countQuery += ` AND (nom LIKE ? OR reference LIKE ? OR fournisseur LIKE ?)`;
            const like = `%${search}%`;
            countParams.push(like, like, like);
        }

        if (categorie) {
            countQuery += ` AND categorie = ?`;
            countParams.push(categorie);
        }

        const [countRows] = await db.query<RowDataPacket[]>(countQuery, countParams);

        // Alertes de stock
        const [alertes] = await db.query<RowDataPacket[]>(
            `SELECT * FROM stocks 
             WHERE ecole_id = ? AND quantite <= seuil_alerte AND seuil_alerte > 0
             ORDER BY (seuil_alerte - quantite) DESC`,
            [ecoleId]
        );

        res.json({
            page,
            pageSize,
            total: countRows[0]?.count || 0,
            results: rows,
            categories: categories.map(c => c.categorie),
            alertes: alertes || []
        });
    } catch (error) {
        console.error('Erreur listStocks:', error);
        res.status(500).json({ message: 'Erreur lors du chargement du stock.' });
    }
};

export const createStock = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { nom, categorie, reference, quantite, unite, seuil_alerte, prix_unitaire, fournisseur, emplacement } = req.body || {};

    try {
        if (!nom || quantite === undefined) {
            res.status(400).json({ message: 'nom et quantite sont obligatoires.' });
            return;
        }

        const [result] = await db.query<ResultSetHeader>(
            `INSERT INTO stocks 
             (ecole_id, nom, categorie, reference, quantite, unite, 
              seuil_alerte, prix_unitaire, fournisseur, emplacement)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                ecoleId,
                nom,
                categorie || null,
                reference || null,
                quantite,
                unite || null,
                seuil_alerte || 0,
                prix_unitaire || 0,
                fournisseur || null,
                emplacement || null
            ]
        );

        // Journaliser le mouvement d'entrée
        await db.query<ResultSetHeader>(
            `INSERT INTO mouvements_stock 
             (stock_id, type, quantite, motif, gestionnaire_id)
             VALUES (?, 'ENTREE', ?, 'Création initiale', ?)`,
            [result.insertId, quantite, req.user?.id]
        );

        res.status(201).json({
            message: 'Article ajouté au stock.',
            id: result.insertId
        });
    } catch (error) {
        console.error('Erreur createStock:', error);
        res.status(500).json({ message: 'Erreur lors de l\'ajout au stock.' });
    }
};

export const updateStock = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { id } = req.params;
    const { nom, categorie, reference, quantite, unite, seuil_alerte, prix_unitaire, fournisseur, emplacement } = req.body || {};

    try {
        // Récupérer l'ancienne quantité pour journaliser
        const [old] = await db.query<RowDataPacket[]>(
            'SELECT quantite FROM stocks WHERE id = ? AND ecole_id = ?',
            [id, ecoleId]
        );

        if (old.length === 0) {
            res.status(404).json({ message: 'Article non trouvé.' });
            return;
        }

        await db.query<ResultSetHeader>(
            `UPDATE stocks 
             SET nom = ?, categorie = ?, reference = ?, quantite = ?, 
                 unite = ?, seuil_alerte = ?, prix_unitaire = ?,
                 fournisseur = ?, emplacement = ?
             WHERE id = ? AND ecole_id = ?`,
            [
                nom, categorie || null, reference || null, quantite,
                unite || null, seuil_alerte || 0, prix_unitaire || 0,
                fournisseur || null, emplacement || null, id, ecoleId
            ]
        );

        // Journaliser le changement de quantité
        if (quantite !== old[0].quantite) {
            const type = quantite > old[0].quantite ? 'ENTREE' : 'SORTIE';
            const diff = Math.abs(quantite - old[0].quantite);
            await db.query<ResultSetHeader>(
                `INSERT INTO mouvements_stock 
                 (stock_id, type, quantite, motif, gestionnaire_id)
                 VALUES (?, ?, ?, 'Ajustement manuel', ?)`,
                [id, type, diff, req.user?.id]
            );
        }

        res.json({ message: 'Stock mis à jour.' });
    } catch (error) {
        console.error('Erreur updateStock:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour.' });
    }
};

export const deleteStock = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { id } = req.params;

    try {
        await db.query<ResultSetHeader>(
            'DELETE FROM stocks WHERE id = ? AND ecole_id = ?',
            [id, ecoleId]
        );

        res.json({ message: 'Article supprimé.' });
    } catch (error) {
        console.error('Erreur deleteStock:', error);
        res.status(500).json({ message: 'Erreur lors de la suppression.' });
    }
};

export const getMouvementsStock = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { id } = req.params;

    try {
        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT m.*, u.nom as gestionnaire_nom, u.prenom as gestionnaire_prenom
             FROM mouvements_stock m
             JOIN utilisateurs u ON m.gestionnaire_id = u.id
             JOIN stocks s ON m.stock_id = s.id
             WHERE s.id = ? AND s.ecole_id = ?
             ORDER BY m.date_mouvement DESC
             LIMIT 50`,
            [id, ecoleId]
        );

        res.json({ results: rows });
    } catch (error) {
        console.error('Erreur getMouvementsStock:', error);
        res.status(500).json({ message: 'Erreur lors du chargement des mouvements.' });
    }
};

// ============================================
// 11. RAPPORTS FINANCIERS
// ============================================

export const getRapportJournalier = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const date = req.query?.date || format(new Date(), 'yyyy-MM-dd');

    try {
        const activeYearId = await getActiveYearId(ecoleId);

        const [paiements] = await db.query<RowDataPacket[]>(
            `SELECT 
                p.id,
                p.numero_recu,
                p.montant_paye,
                p.date_paiement,
                p.mode_paiement,
                e.nom as eleve_nom,
                e.prenom as eleve_prenom,
                e.matricule as eleve_matricule,
                tf.nom as type_frais,
                c.nom as classe_nom
             FROM paiements p
             JOIN inscriptions i ON p.inscription_id = i.id
             JOIN eleves e ON i.eleve_id = e.id
             JOIN types_frais tf ON p.type_frais_id = tf.id
             JOIN classes c ON i.classe_id = c.id
             WHERE e.ecole_id = ? 
               AND i.annee_scolaire_id = ?
               AND DATE(p.date_paiement) = ?
               AND p.annule = 0
             ORDER BY p.date_paiement DESC`,
            [ecoleId, activeYearId, date]
        );

        const [total] = await db.query<RowDataPacket[]>(
            `SELECT COALESCE(SUM(montant_paye), 0) as total
             FROM paiements p
             JOIN inscriptions i ON p.inscription_id = i.id
             JOIN eleves e ON i.eleve_id = e.id
             WHERE e.ecole_id = ? 
               AND i.annee_scolaire_id = ?
               AND DATE(p.date_paiement) = ? 
               AND p.annule = 0`,
            [ecoleId, activeYearId, date]
        );

        const [parMode] = await db.query<RowDataPacket[]>(
            `SELECT mode_paiement, COUNT(*) as count, COALESCE(SUM(montant_paye), 0) as total
             FROM paiements p
             JOIN inscriptions i ON p.inscription_id = i.id
             JOIN eleves e ON i.eleve_id = e.id
             WHERE e.ecole_id = ? 
               AND i.annee_scolaire_id = ?
               AND DATE(p.date_paiement) = ? 
               AND p.annule = 0
             GROUP BY mode_paiement`,
            [ecoleId, activeYearId, date]
        );

        res.json({
            date,
            total: total[0]?.total || 0,
            nb_paiements: paiements.length,
            paiements,
            par_mode_paiement: parMode
        });
    } catch (error) {
        console.error('Erreur getRapportJournalier:', error);
        res.status(500).json({ message: 'Erreur lors du chargement du rapport.' });
    }
};

export const getRapportMensuel = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const mois = req.query?.mois || format(new Date(), 'yyyy-MM');

    try {
        const activeYearId = await getActiveYearId(ecoleId);

        const [paiements] = await db.query<RowDataPacket[]>(
            `SELECT 
                DATE(p.date_paiement) as date,
                COUNT(*) as nb_paiements,
                COALESCE(SUM(p.montant_paye), 0) as total
             FROM paiements p
             JOIN inscriptions i ON p.inscription_id = i.id
             JOIN eleves e ON i.eleve_id = e.id
             WHERE e.ecole_id = ? 
               AND i.annee_scolaire_id = ?
               AND DATE_FORMAT(p.date_paiement, '%Y-%m') = ?
               AND p.annule = 0
             GROUP BY DATE(p.date_paiement)
             ORDER BY date ASC`,
            [ecoleId, activeYearId, mois]
        );

        const [total] = await db.query<RowDataPacket[]>(
            `SELECT 
                COALESCE(SUM(p.montant_paye), 0) as total,
                COUNT(*) as nb_paiements
             FROM paiements p
             JOIN inscriptions i ON p.inscription_id = i.id
             JOIN eleves e ON i.eleve_id = e.id
             WHERE e.ecole_id = ? 
               AND i.annee_scolaire_id = ?
               AND DATE_FORMAT(p.date_paiement, '%Y-%m') = ?
               AND p.annule = 0`,
            [ecoleId, activeYearId, mois]
        );

        const [parFrais] = await db.query<RowDataPacket[]>(
            `SELECT 
                tf.nom,
                COALESCE(SUM(p.montant_paye), 0) as total,
                COUNT(*) as nb_paiements
             FROM paiements p
             JOIN inscriptions i ON p.inscription_id = i.id
             JOIN eleves e ON i.eleve_id = e.id
             JOIN types_frais tf ON p.type_frais_id = tf.id
             WHERE e.ecole_id = ? 
               AND i.annee_scolaire_id = ?
               AND DATE_FORMAT(p.date_paiement, '%Y-%m') = ?
               AND p.annule = 0
             GROUP BY tf.id, tf.nom
             ORDER BY total DESC`,
            [ecoleId, activeYearId, mois]
        );

        const [parClasse] = await db.query<RowDataPacket[]>(
            `SELECT 
                c.nom as classe_nom,
                COALESCE(SUM(p.montant_paye), 0) as total,
                COUNT(*) as nb_paiements
             FROM paiements p
             JOIN inscriptions i ON p.inscription_id = i.id
             JOIN eleves e ON i.eleve_id = e.id
             JOIN classes c ON i.classe_id = c.id
             WHERE e.ecole_id = ? 
               AND i.annee_scolaire_id = ?
               AND DATE_FORMAT(p.date_paiement, '%Y-%m') = ?
               AND p.annule = 0
             GROUP BY c.id, c.nom
             ORDER BY total DESC`,
            [ecoleId, activeYearId, mois]
        );

        res.json({
            mois,
            total: total[0]?.total || 0,
            nb_paiements: total[0]?.nb_paiements || 0,
            paiements_par_jour: paiements,
            par_frais: parFrais,
            par_classe: parClasse
        });
    } catch (error) {
        console.error('Erreur getRapportMensuel:', error);
        res.status(500).json({ message: 'Erreur lors du chargement du rapport.' });
    }
};

// ============================================
// 12. GESTION DES PÉRIODES
// ============================================

export const listPeriodes = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;

    try {
        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT * FROM periodes 
             WHERE ecole_id = ?
             ORDER BY ordre ASC`,
            [ecoleId]
        );

        res.json({ results: rows });
    } catch (error) {
        console.error('Erreur listPeriodes:', error);
        res.status(500).json({ message: 'Erreur lors du chargement des périodes.' });
    }
};

export const createPeriode = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { nom, date_debut, date_fin, ordre, est_active } = req.body || {};

    try {
        if (!nom || !date_debut || !date_fin) {
            res.status(400).json({ message: 'nom, date_debut et date_fin sont obligatoires.' });
            return;
        }

        const [result] = await db.query<ResultSetHeader>(
            `INSERT INTO periodes (ecole_id, nom, date_debut, date_fin, ordre, est_active)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [ecoleId, nom, date_debut, date_fin, ordre || 0, est_active !== false]
        );

        res.status(201).json({
            message: 'Période créée avec succès.',
            id: result.insertId
        });
    } catch (error) {
        console.error('Erreur createPeriode:', error);
        res.status(500).json({ message: 'Erreur lors de la création de la période.' });
    }
};

export const updatePeriode = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { id } = req.params;
    const { nom, date_debut, date_fin, ordre, est_active } = req.body || {};

    try {
        await db.query<ResultSetHeader>(
            `UPDATE periodes 
             SET nom = ?, date_debut = ?, date_fin = ?, ordre = ?, est_active = ?
             WHERE id = ? AND ecole_id = ?`,
            [nom, date_debut, date_fin, ordre || 0, est_active !== false, id, ecoleId]
        );

        res.json({ message: 'Période mise à jour.' });
    } catch (error) {
        console.error('Erreur updatePeriode:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour.' });
    }
};

export const deletePeriode = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { id } = req.params;

    try {
        // Vérifier si des frais sont associés
        const [check] = await db.query<RowDataPacket[]>(
            'SELECT COUNT(*) as count FROM frais_par_periode WHERE periode_id = ?',
            [id]
        );

        if (check[0].count > 0) {
            res.status(400).json({
                message: 'Impossible de supprimer cette période car des frais y sont associés.'
            });
            return;
        }

        await db.query<ResultSetHeader>(
            'DELETE FROM periodes WHERE id = ? AND ecole_id = ?',
            [id, ecoleId]
        );

        res.json({ message: 'Période supprimée.' });
    } catch (error) {
        console.error('Erreur deletePeriode:', error);
        res.status(500).json({ message: 'Erreur lors de la suppression.' });
    }
};

// ============================================
// 13. AUTORISATIONS
// ============================================

export const listAutorisations = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const page = Math.max(1, Number(req.query?.page || 1));
    const pageSize = Math.min(50, Math.max(5, Number(req.query?.pageSize || 10)));
    const offset = (page - 1) * pageSize;

    try {
        await rebloquerAutorisationsExpireesParEcole(ecoleId);
        const activeYearId = await getActiveYearId(ecoleId);

        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT 
                ab.*,
                e.id as eleve_id,
                e.nom as eleve_nom,
                e.prenom as eleve_prenom,
                e.matricule as eleve_matricule,
                c.nom as classe_nom,
                c.section as classe_section,
                c.option_classe as classe_option,
                p.nom as periode_nom,
                u.nom as gestionnaire_nom,
                u.prenom as gestionnaire_prenom
             FROM autorisations_bulletin ab
             JOIN inscriptions i ON ab.inscription_id = i.id
             JOIN eleves e ON i.eleve_id = e.id
             JOIN classes c ON i.classe_id = c.id
             JOIN periodes p ON ab.periode_id = p.id
             LEFT JOIN utilisateurs u ON ab.gestionnaire_id = u.id
             WHERE e.ecole_id = ?
               AND i.annee_scolaire_id = ?
             ORDER BY ab.date_autorisation DESC
             LIMIT ? OFFSET ?`,
            [ecoleId, activeYearId, pageSize, offset]
        );

        const [countRows] = await db.query<RowDataPacket[]>(
            `SELECT COUNT(*) as count
             FROM autorisations_bulletin ab
             JOIN inscriptions i ON ab.inscription_id = i.id
             JOIN eleves e ON i.eleve_id = e.id
             WHERE e.ecole_id = ?
               AND i.annee_scolaire_id = ?`,
            [ecoleId, activeYearId]
        );

        res.json({
            page,
            pageSize,
            total: countRows[0]?.count || 0,
            results: rows
        });
    } catch (error) {
        console.error('Erreur listAutorisations:', error);
        res.status(500).json({ message: 'Erreur lors du chargement des autorisations.' });
    }
};

export const createAutorisation = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const gestionnaireId = req.user?.id;
    const { eleve_id, periode_id, statut } = req.body || {};

    try {
        if (!eleve_id || !periode_id) {
            res.status(400).json({ message: 'eleve_id et periode_id sont obligatoires.' });
            return;
        }

        // Récupérer l'année active
        const activeYearId = await getActiveYearId(ecoleId);
        if (!activeYearId) {
            res.status(400).json({ message: 'Aucune année scolaire ouverte.' });
            return;
        }

        // Vérifier que l'élève existe
        const [eleve] = await db.query<RowDataPacket[]>(
            `SELECT id FROM eleves WHERE id = ? AND ecole_id = ?`,
            [eleve_id, ecoleId]
        );

        if (eleve.length === 0) {
            res.status(404).json({ message: 'Élève non trouvé.' });
            return;
        }

        // Vérifier que la période existe
        const [periode] = await db.query<RowDataPacket[]>(
            `SELECT id FROM periodes WHERE id = ? AND ecole_id = ? AND est_active = 1`,
            [periode_id, ecoleId]
        );

        if (periode.length === 0) {
            res.status(404).json({ message: 'Période non trouvée.' });
            return;
        }

        // Récupérer ou créer une inscription
        let [inscription] = await db.query<RowDataPacket[]>(
            `SELECT id FROM inscriptions 
             WHERE eleve_id = ? AND annee_scolaire_id = ?`,
            [eleve_id, activeYearId]
        );

        let inscriptionId: number;

        if (inscription.length === 0) {
            const [result] = await db.query<ResultSetHeader>(
                `INSERT INTO inscriptions (eleve_id, annee_scolaire_id, date_inscription, statut)
                 VALUES (?, ?, NOW(), 'ACTIVE')`,
                [eleve_id, activeYearId]
            );
            inscriptionId = result.insertId;
        } else {
            inscriptionId = inscription[0].id;
        }

        // Créer ou mettre à jour l'autorisation
        const [authResult] = await db.query<ResultSetHeader>(
            `INSERT INTO autorisations_bulletin 
             (inscription_id, periode_id, statut, gestionnaire_id, date_autorisation, autorisation_auto)
             VALUES (?, ?, ?, ?, NOW(), FALSE)
             ON DUPLICATE KEY UPDATE 
             statut = VALUES(statut), 
             gestionnaire_id = VALUES(gestionnaire_id),
             date_autorisation = NOW(),
             autorisation_auto = FALSE`,
            [inscriptionId, periode_id, statut || 'AUTORISE', gestionnaireId]
        );

        let autorisationId = authResult.insertId;
        if (!autorisationId) {
            const [existing] = await db.query<RowDataPacket[]>(
                `SELECT id FROM autorisations_bulletin 
                 WHERE inscription_id = ? AND periode_id = ?`,
                [inscriptionId, periode_id]
            );
            if (existing.length > 0) {
                autorisationId = existing[0].id;
            }
        }

        res.status(201).json({
            message: 'Autorisation créée avec succès.',
            inscription_id: inscriptionId,
            autorisation_id: autorisationId
        });

    } catch (error) {
        console.error('Erreur createAutorisation:', error);
        res.status(500).json({ message: 'Erreur lors de la création de l\'autorisation.' });
    }
};

export const updateAutorisation = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const gestionnaireId = req.user?.id;
    const { id } = req.params;
    const { statut, duree_jours, motif } = req.body || {};

    try {
        if (statut === 'AUTORISE' && duree_jours && duree_jours > 0) {
            // ⏱️ Dérogation TEMPORAIRE
            await db.query<ResultSetHeader>(
                `UPDATE autorisations_bulletin ab
                 JOIN inscriptions i ON ab.inscription_id = i.id
                 JOIN eleves e ON i.eleve_id = e.id
                 SET ab.statut = 'AUTORISE',
                     ab.gestionnaire_id = ?,
                     ab.date_autorisation = NOW(),
                     ab.autorisation_auto = FALSE,
                     ab.duree_jours = ?,
                     ab.date_expiration = DATE_ADD(NOW(), INTERVAL ? DAY),
                     ab.motif_autorisation = ?
                 WHERE ab.id = ? AND e.ecole_id = ?`,
                [gestionnaireId, duree_jours, duree_jours, motif || null, id, ecoleId]
            );
        } else if (statut === 'AUTORISE') {
            // ♾️ Autorisation PERMANENTE manuelle
            await db.query<ResultSetHeader>(
                `UPDATE autorisations_bulletin ab
                 JOIN inscriptions i ON ab.inscription_id = i.id
                 JOIN eleves e ON i.eleve_id = e.id
                 SET ab.statut = 'AUTORISE',
                     ab.gestionnaire_id = ?,
                     ab.date_autorisation = NOW(),
                     ab.autorisation_auto = FALSE,
                     ab.duree_jours = NULL,
                     ab.date_expiration = NULL,
                     ab.motif_autorisation = ?
                 WHERE ab.id = ? AND e.ecole_id = ?`,
                [gestionnaireId, motif || null, id, ecoleId]
            );
        } else {
            // 🔒 BLOQUER → effacer tout
            await db.query<ResultSetHeader>(
                `UPDATE autorisations_bulletin ab
                 JOIN inscriptions i ON ab.inscription_id = i.id
                 JOIN eleves e ON i.eleve_id = e.id
                 SET ab.statut = 'BLOQUE',
                     ab.gestionnaire_id = NULL,
                     ab.date_autorisation = NULL,
                     ab.autorisation_auto = FALSE,
                     ab.duree_jours = NULL,
                     ab.date_expiration = NULL,
                     ab.motif_autorisation = NULL
                 WHERE ab.id = ? AND e.ecole_id = ?`,
                [id, ecoleId]
            );
        }

        res.json({ message: 'Autorisation mise à jour.' });
    } catch (error) {
        console.error('Erreur updateAutorisation:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour.' });
    }
};

export const getAutorisationsByEleve = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { eleveId } = req.params;

    try {
        // Récupérer l'année active
        await rebloquerAutorisationsExpireesParEcole(ecoleId);
        const activeYearId = await getActiveYearId(ecoleId);
        if (!activeYearId) {
            res.json({ results: [], message: 'Aucune année scolaire ouverte.' });
            return;
        }

        // Vérifier que l'élève existe
        const [eleve] = await db.query<RowDataPacket[]>(
            `SELECT id FROM eleves WHERE id = ? AND ecole_id = ?`,
            [eleveId, ecoleId]
        );

        if (eleve.length === 0) {
            res.status(404).json({ message: 'Élève non trouvé.' });
            return;
        }

        // Récupérer ou créer une inscription
        let [inscription] = await db.query<RowDataPacket[]>(
            `SELECT id FROM inscriptions 
             WHERE eleve_id = ? AND annee_scolaire_id = ?`,
            [eleveId, activeYearId]
        );

        let inscriptionId: number | null = null;
        if (inscription.length > 0) {
            inscriptionId = inscription[0].id;
        }

        // Récupérer TOUTES les périodes avec leurs statuts d'autorisation
        const [periodes] = await db.query<RowDataPacket[]>(
            `SELECT 
                p.id as periode_id,
                p.nom as periode_nom,
                p.ordre as periode_ordre,
                COALESCE(ab.statut, 'BLOQUE') as statut,
                ab.autorisation_auto as autorisation_auto,
                ab.gestionnaire_id,
                u.nom as gestionnaire_nom,
                u.prenom as gestionnaire_prenom,
                ab.date_autorisation,
                ab.date_expiration,
                ab.duree_jours,
                ab.motif_autorisation,
                ab.id as autorisation_id,
                ? as inscription_id
             FROM periodes p
             LEFT JOIN autorisations_bulletin ab ON ab.periode_id = p.id AND ab.inscription_id = ?
             LEFT JOIN utilisateurs u ON ab.gestionnaire_id = u.id
             WHERE p.ecole_id = ? AND p.est_active = 1
             ORDER BY p.ordre ASC`,
            [inscriptionId, inscriptionId, ecoleId]
        );

        res.json({
            results: periodes,
            eleve_id: eleveId,
            inscription_id: inscriptionId
        });

    } catch (error) {
        console.error('Erreur getAutorisationsByEleve:', error);
        res.status(500).json({ message: 'Erreur lors du chargement des autorisations.' });
    }
};