// src/services/autorisationsCron.service.ts
import db from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

// ============================================================
// SERVICE: Reblocage automatique des autorisations temporaires
// Vérifie TOUTES les écoles toutes les 45 minutes
// Résistant au redémarrage serveur (la vérité est en BDD)
// ============================================================

/**
 * Rebloque TOUTES les autorisations temporaires expirées,
 * peu importe l'école. Une seule requête SQL = performant.
 */
export async function rebloquerAutorisationsExpireesGlobal(): Promise<number> {
    try {
        console.log('🔍 [CRON] Vérification des autorisations expirées...');

        // 1. Récupérer les autorisations à rebloquer (pour historiser)
        const [aRebloquer] = await db.query<RowDataPacket[]>(
            `SELECT 
                ab.id,
                ab.date_expiration,
                e.nom as eleve_nom,
                e.prenom as eleve_prenom,
                p.nom as periode_nom
             FROM autorisations_bulletin ab
             JOIN inscriptions i ON ab.inscription_id = i.id
             JOIN eleves e ON i.eleve_id = e.id
             JOIN periodes p ON ab.periode_id = p.id
             WHERE ab.statut = 'AUTORISE'
               AND ab.autorisation_auto = FALSE
               AND ab.date_expiration IS NOT NULL
               AND ab.date_expiration <= NOW()`
        );

        if (aRebloquer.length === 0) {
            console.log('✅ [CRON] Aucune autorisation à rebloquer.');
            return 0;
        }

        console.log(`⚠️ [CRON] ${aRebloquer.length} autorisation(s) expirée(s) détectée(s).`);

        // 2. Rebloquer
        const [result] = await db.query<ResultSetHeader>(
            `UPDATE autorisations_bulletin 
             SET statut = 'BLOQUE',
                 autorisation_auto = FALSE,
                 gestionnaire_id = NULL,
                 date_autorisation = NULL,
                 duree_jours = NULL,
                 date_expiration = NULL,
                 motif_autorisation = NULL
             WHERE statut = 'AUTORISE'
               AND autorisation_auto = FALSE
               AND date_expiration IS NOT NULL
               AND date_expiration <= NOW()`
        );

        const nbRebloques = result.affectedRows || 0;

        // 3. Historiser
        for (const auth of aRebloquer) {
            await db.query<ResultSetHeader>(
                `INSERT INTO autorisations_historique 
                 (autorisation_id, ancien_statut, nouveau_statut, raison)
                 VALUES (?, 'AUTORISE', 'BLOQUE', ?)`,
                [
                    auth.id,
                    `Expiration auto - ${auth.eleve_nom} ${auth.eleve_prenom} - ${auth.periode_nom}`
                ]
            );
        }

        console.log(`🔒 [CRON] ${nbRebloques} autorisation(s) rebloquée(s).`);
        return nbRebloques;

    } catch (error) {
        console.error('❌ [CRON] Erreur:', error);
        return 0;
    }
}

/**
 * Rebloque pour UNE école spécifique (utilisé à la volée dans les API)
 */
export async function rebloquerAutorisationsExpireesParEcole(
    ecoleId: number
): Promise<number> {
    try {
        const [result] = await db.query<ResultSetHeader>(
            `UPDATE autorisations_bulletin ab
             JOIN inscriptions i ON ab.inscription_id = i.id
             JOIN eleves e ON i.eleve_id = e.id
             SET ab.statut = 'BLOQUE',
                 ab.autorisation_auto = FALSE,
                 ab.gestionnaire_id = NULL,
                 ab.date_autorisation = NULL,
                 ab.duree_jours = NULL,
                 ab.date_expiration = NULL,
                 ab.motif_autorisation = NULL
             WHERE e.ecole_id = ?
               AND ab.statut = 'AUTORISE'
               AND ab.autorisation_auto = FALSE
               AND ab.date_expiration IS NOT NULL
               AND ab.date_expiration <= NOW()`,
            [ecoleId]
        );
        return result.affectedRows || 0;
    } catch (error) {
        console.error('Erreur rebloquerParEcole:', error);
        return 0;
    }
}

/**
 * Démarre le service cron automatique
 * @param intervalMinutes Intervalle en minutes (45 par défaut)
 * @returns L'ID de l'interval (pour pouvoir l'arrêter)
 */
export function startAutorisationsCron(intervalMinutes: number = 45): NodeJS.Timeout {
    console.log(`🚀 [CRON] Démarrage du service de reblocage automatique (${intervalMinutes} min)`);

    // Exécution 5 sec après le boot (laisser la BDD se connecter)
    setTimeout(async () => {
        console.log('🔄 [BOOT] Vérification initiale des autorisations expirées...');
        await rebloquerAutorisationsExpireesGlobal();
    }, 5000);

    // Puis toutes les X minutes
    const intervalMs = intervalMinutes * 60 * 1000;
    const intervalId = setInterval(async () => {
        console.log(`⏰ [CRON] Vérification périodique (${new Date().toLocaleString()})`);
        await rebloquerAutorisationsExpireesGlobal();
    }, intervalMs);

    return intervalId;
}