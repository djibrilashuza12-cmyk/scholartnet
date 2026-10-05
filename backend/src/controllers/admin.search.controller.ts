import { Response } from 'express';
import db from '../config/db';
import { RowDataPacket } from 'mysql2/promise';
import bcrypt from 'bcrypt';

export const searchUserProfile = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const q = String(req.query?.q || '').trim();

    try {
        if (!q) {
            res.status(400).json({ message: 'q (matricule ou nom) est requis.' });
            return;
        }

        // Recherche par matricule (utilisateurs.matricule) ou par nom/prenom
        // On joint eleves via utilisateurs.eleve_id
        const like = `%${q}%`;

        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT 
        u.id as user_id,
        u.matricule as utilisateur_matricule,
        u.nom as utilisateur_nom,
        u.prenom as utilisateur_prenom,
        u.role as role,
        u.sexe as genre,
        u.date_naissance as date_naissance,
        u.lieu_naissance as lieu_naissance,
        u.adresse as adresse,
        u.niveau_etude as niveau_etude,
        u.postnom as postnom,
        u.nom_pere as nom_pere,
        u.nom_mere as nom_mere
      FROM utilisateurs u
      WHERE u.ecole_id = ?
        AND (
          u.matricule = ?
          OR u.nom LIKE ?
          OR u.prenom LIKE ?
        )
      ORDER BY u.created_at DESC
      LIMIT 15`,
            [ecoleId, q, like, like]
        );

        res.json({ results: rows });
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la recherche.' });
    }
};

export const getArchivedEleves = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { annee_scolaire_id, q } = req.query || {};

    try {
        if (!annee_scolaire_id) {
            res.status(400).json({ message: 'L\'année scolaire est requise.' });
            return;
        }

        let query = `
            SELECT 
                i.id as inscription_id,
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
              AND i.annee_scolaire_id = ?
        `;

        const params: any[] = [ecoleId, annee_scolaire_id];

        if (q && String(q).trim()) {
            query += ` AND (e.matricule LIKE ? OR e.nom LIKE ? OR e.prenom LIKE ? OR e.postnom LIKE ?)`;
            const like = `%${String(q).trim()}%`;
            params.push(like, like, like, like);
        }

        query += ` ORDER BY e.nom ASC, e.prenom ASC`;

        const [rows] = await db.query<RowDataPacket[]>(query, params);
        res.json({ results: rows });
    } catch (error) {
        console.error('Erreur getArchivedEleves:', error);
        res.status(500).json({ message: 'Erreur lors de la recherche des archives.' });
    }
};

export const getArchivedBulletinData = async (req: any, res: Response): Promise<void> => {
    const ecoleId = req.user?.ecole_id;
    const { inscriptionId } = req.params;
    const { periode_id } = req.query || {};

    try {
        if (!inscriptionId) {
            res.status(400).json({ message: 'inscriptionId est obligatoire.' });
            return;
        }

        if (!periode_id) {
            res.status(400).json({ message: 'periode_id est obligatoire.' });
            return;
        }

        // 1. Récupérer le nom de la période
        const [periodeData] = await db.query<RowDataPacket[]>(
            `SELECT nom FROM periodes WHERE id = ? AND ecole_id = ?`,
            [periode_id, ecoleId]
        );

        if (periodeData.length === 0) {
            res.status(404).json({ message: 'Période non trouvée.' });
            return;
        }

        const periodeNom = periodeData[0].nom;

        // 2. Récupérer les informations de l'inscription
        const [inscriptionInfo] = await db.query<RowDataPacket[]>(
            `SELECT i.id as inscription_id, i.classe_id, i.eleve_id, i.annee_scolaire_id,
                    e.nom, e.prenom, e.postnom, e.matricule, e.sexe,
                    c.nom as classe_nom, c.section, c.option_classe,
                    ec.nom as ecole_nom, ec.adresse, ec.telephone, ec.email, ec.logo,
                    a.nom as annee_scolaire_nom
             FROM inscriptions i
             JOIN eleves e ON i.eleve_id = e.id
             JOIN classes c ON i.classe_id = c.id
             JOIN ecoles ec ON e.ecole_id = ec.id
             JOIN annees_scolaires a ON i.annee_scolaire_id = a.id
             WHERE i.id = ? AND e.ecole_id = ?`,
            [inscriptionId, ecoleId]
        );

        if (inscriptionInfo.length === 0) {
            res.status(404).json({ message: 'Inscription non trouvée ou non autorisée.' });
            return;
        }

        const info = inscriptionInfo[0];
        const classeId = info.classe_id;
        const eleveId = info.eleve_id;
        const anneeScolaireId = info.annee_scolaire_id;

        // 3. Récupérer TOUS les cours configurés pour cette classe/période
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

        // 4. Récupérer les notes existantes
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

        // Construire les notes complètes avec tous les cours
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
            // Compter le nombre total de cours requis pour le classement
            const [totalCoursResult] = await db.query<RowDataPacket[]>(
                `SELECT COUNT(DISTINCT c.id) as total
                 FROM cours c
                 JOIN cours_periodes cp ON c.id = cp.cours_id
                 JOIN periodes p ON cp.periode_id = p.id
                 WHERE c.classe_id = ? AND p.nom = ? AND p.est_active = 1`,
                [classeId, periodeNom]
            );
            const totalCoursRequisRanking = totalCoursResult[0]?.total || 0;

            // Classement pour la classe lors de cette année scolaire spécifique
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
                 AND i.annee_scolaire_id = ?
                 GROUP BY i.eleve_id
                 HAVING cours_notes_count >= ? AND total_points_max > 0
                 ORDER BY pourcentage DESC`,
                [periodeNom, classeId, anneeScolaireId, totalCoursRequisRanking]
            );

            const eleveIdNum = Number(eleveId);
            const position = classement.findIndex((e: any) => Number(e.eleve_id) === eleveIdNum);
            if (position !== -1) {
                rang = position + 1;
            }
        }

        const bulletinData = {
            ecole: {
                nom: info.ecole_nom || '',
                adresse: info.adresse || '',
                telephone: info.telephone || '',
                email: info.email || '',
                logo: info.logo || null
            },
            eleve: {
                nom: info.nom || '',
                prenom: info.prenom || '',
                postnom: info.postnom || '',
                matricule: info.matricule || '',
                sexe: info.sexe || ''
            },
            classe: {
                nom: info.classe_nom || '',
                section: info.section || '',
                option: info.option_classe || ''
            },
            anneeScolaire: info.annee_scolaire_nom || '',
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
        console.error('Erreur getArchivedBulletinData:', error);
        res.status(500).json({ message: 'Erreur lors du chargement des données d\'archive.' });
    }
};

