import db from '../config/db';
import { RowDataPacket } from 'mysql2/promise';

// ============================================
// TYPES
// ============================================
export interface CampaignJob {
    id: string;
    ecoleId: number;
    status: 'en_cours' | 'termine' | 'erreur';
    total: number;
    sent: number;
    failed: number;
    errors: Array<{ parentName: string; number: string; error: string }>;
    startedAt: Date;
    finishedAt?: Date;
}

// In-memory campaign job tracker
export const campaignJobs = new Map<string, CampaignJob>();

// ============================================
// CONFIGURATION DU TEMPLATE (à adapter)
// ============================================
const TEMPLATE_NAME = 'communique_ecole'; // Nom exact validé dans Meta
const TEMPLATE_LANG = 'fr';               // Code langue du template (fr, fr_FR, en_US...)

// ============================================
// UTILITAIRES
// ============================================
export function formatPhoneNumber(num: string): string {
    // Nettoie le numéro en ne gardant que les chiffres
    return num.replace(/\D/g, '');
}

// ============================================
// ENVOI VIA TEMPLATE (obligatoire hors fenêtre 24h)
// ============================================
/**
 * Envoie un message via un Template WhatsApp Cloud API.
 * Le template doit contenir 2 variables dans son corps :
 *   {{1}} = nom de l'école
 *   {{2}} = corps du message
 */
export async function sendWhatsAppMessage(
    to: string,
    message: string,
    phoneNumberId: string,
    token: string,
    schoolName: string
): Promise<any> {
    const cleanNumber = formatPhoneNumber(to);

    if (cleanNumber.length < 8) {
        throw new Error('Numéro de téléphone invalide (trop court).');
    }

    const url = `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`;

    const body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanNumber,
        type: 'template',
        template: {
            name: TEMPLATE_NAME,
            language: { code: TEMPLATE_LANG },
            components: [
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', text: schoolName }, // {{1}}
                        { type: 'text', text: message }     // {{2}}
                    ]
                }
            ]
        }
    };

    // ========== LOG PAYLOAD SORTANT ==========
    console.log('📤 [WhatsApp] === ENVOI TEMPLATE ===');
    console.log('📤 [WhatsApp] Destinataire (clean):', cleanNumber);
    console.log('📤 [WhatsApp] Template:', TEMPLATE_NAME, '| Langue:', TEMPLATE_LANG);
    console.log('📤 [WhatsApp] Payload complet:', JSON.stringify(body, null, 2));

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const data = await response.json() as any;

    // ========== LOG RÉPONSE META ==========
    console.log('📥 [WhatsApp] Status HTTP:', response.status);
    console.log('📥 [WhatsApp] Réponse Meta brute:', JSON.stringify(data, null, 2));

    if (!response.ok) {
        const errCode = data?.error?.code || 'N/A';
        const errTitle = data?.error?.error_data?.details || data?.error?.message || 'Erreur inconnue';
        console.error(`🔴 [WhatsApp] ÉCHEC - Code ${errCode}: ${errTitle}`);
        throw new Error(`[${errCode}] ${errTitle}`);
    }

    // ========== LOG SUCCÈS D'ACCEPTATION ==========
    const messageId = data?.messages?.[0]?.id;
    const waId = data?.contacts?.[0]?.wa_id;
    console.log('✅ [WhatsApp] Message accepté par Meta');
    console.log('✅ [WhatsApp] message_id:', messageId);
    console.log('✅ [WhatsApp] wa_id (numéro côté Meta):', waId);

    return data;
}

// ============================================
// VÉRIFICATION DU STATUT DE LIVRAISON
// ============================================
/**
 * Vérifie le statut de livraison d'un message (sent/delivered/read/failed).
 */
export async function checkMessageStatus(
    messageId: string,
    token: string
): Promise<any> {
    const url = `https://graph.facebook.com/v17.0/${messageId}`;
    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json() as any;
        console.log(`🔍 [WhatsApp] Statut du message ${messageId}:`, JSON.stringify(data, null, 2));
        return data;
    } catch (err) {
        console.error('🔴 [WhatsApp] Erreur check statut:', err);
        return null;
    }
}

// ============================================
// CAMPAGNE PRINCIPALE
// ============================================
/**
 * Démarre une campagne de messagerie WhatsApp en tâche de fond.
 */
export async function runWhatsAppCampaign(
    jobId: string,
    ecoleId: number,
    targetType: 'classe' | 'ecole',
    targetId: number | null,
    message: string
): Promise<void> {
    const job = campaignJobs.get(jobId);
    if (!job) return;

    console.log(`\n🚀 [Campagne ${jobId}] === DÉMARRAGE ===`);
    console.log(`🚀 [Campagne ${jobId}] ecoleId=${ecoleId}, targetType=${targetType}, targetId=${targetId}`);

    try {
        // ========== 1. Récupérer le nom de l'école ==========
        const [ecoleRows] = await db.query<RowDataPacket[]>(
            'SELECT nom FROM ecoles WHERE id = ?',
            [ecoleId]
        );

        if (ecoleRows.length === 0) {
            job.status = 'erreur';
            job.errors.push({ parentName: 'Système', number: '', error: "L'école n'existe pas." });
            job.finishedAt = new Date();
            console.error(`🔴 [Campagne ${jobId}] École introuvable (id=${ecoleId})`);
            return;
        }

        const schoolName = ecoleRows[0].nom;
        console.log(`🚀 [Campagne ${jobId}] École: ${schoolName}`);

        // ========== 2. Vérifier la configuration WhatsApp ==========
        const token = process.env.WHATSAPP_TOKEN || '';
        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';

        if (!token || !phoneNumberId) {
            job.status = 'erreur';
            job.errors.push({
                parentName: 'Configuration',
                number: '',
                error: "L'API WhatsApp globale n'est pas configurée sur le serveur. Veuillez renseigner WHATSAPP_TOKEN et WHATSAPP_PHONE_NUMBER_ID dans le fichier .env du serveur."
            });
            job.finishedAt = new Date();
            console.error('🔴 [Campagne] WHATSAPP_TOKEN ou WHATSAPP_PHONE_NUMBER_ID manquant dans .env');
            return;
        }

        console.log(`🚀 [Campagne ${jobId}] PhoneNumberId: ${phoneNumberId}`);
        console.log(`🚀 [Campagne ${jobId}] Token (masqué): ${token.substring(0, 15)}...`);

        // ========== 3. Récupérer les destinataires ==========
        let recipients: Array<{ id: number; nom: string; prenom: string; numero_parent: string }> = [];

        if (targetType === 'classe' && targetId) {
            const [rows] = await db.query<RowDataPacket[]>(
                `SELECT DISTINCT e.id, e.nom, e.prenom, e.numero_parent
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
            recipients = rows as any;
        } else {
            const [rows] = await db.query<RowDataPacket[]>(
                `SELECT DISTINCT e.id, e.nom, e.prenom, e.numero_parent
                 FROM eleves e
                 JOIN inscriptions i ON e.id = i.eleve_id
                 JOIN annees_scolaires a ON i.annee_scolaire_id = a.id
                 WHERE e.ecole_id = ?
                   AND a.statut = 'OUVERTE'
                   AND e.numero_parent IS NOT NULL
                   AND e.numero_parent != ''`,
                [ecoleId]
            );
            recipients = rows as any;
        }

        job.total = recipients.length;
        console.log(`🚀 [Campagne ${jobId}] ${recipients.length} destinataire(s) trouvé(s)`);

        // Log détaillé des destinataires
        recipients.forEach((r, idx) => {
            console.log(`   [${idx + 1}] ${r.nom} ${r.prenom} → ${r.numero_parent}`);
        });

        if (recipients.length === 0) {
            job.status = 'termine';
            job.finishedAt = new Date();
            console.log(`⚠️ [Campagne ${jobId}] Aucun destinataire, fin immédiate.`);
            return;
        }

        // ========== 4. Envoi séquentiel ==========
        for (let i = 0; i < recipients.length; i++) {
            const recipient = recipients[i];
            const parentName = `${recipient.nom} ${recipient.prenom}`;
            const num = recipient.numero_parent;

            console.log(`\n📨 [Campagne ${jobId}] Envoi ${i + 1}/${recipients.length} → ${parentName} (${num})`);

            try {
                // ✅ On passe le message BRUT (sans en-tête) + le schoolName séparément
                const result = await sendWhatsAppMessage(
                    num,
                    message,
                    phoneNumberId,
                    token,
                    schoolName
                );
                job.sent++;

                // Vérifier le statut 3 secondes plus tard (asynchrone, sans bloquer)
                const msgId = result?.messages?.[0]?.id;
                if (msgId) {
                    setTimeout(() => {
                        checkMessageStatus(msgId, token).catch(err =>
                            console.error('🔴 [WhatsApp] Erreur check statut:', err)
                        );
                    }, 3000);
                }
            } catch (error: any) {
                console.error(`🔴 [Campagne ${jobId}] Échec pour ${parentName}:`, error.message);
                job.failed++;
                job.errors.push({
                    parentName,
                    number: num,
                    error: error.message || 'Erreur inconnue'
                });
            }

            // Mettre à jour l'état du job
            campaignJobs.set(jobId, { ...job });

            // Délai anti-spam d'une seconde entre chaque envoi
            if (i < recipients.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }

        job.status = 'termine';
        job.finishedAt = new Date();
        campaignJobs.set(jobId, { ...job });

        console.log(`\n🏁 [Campagne ${jobId}] === TERMINÉE ===`);
        console.log(`   ✅ Succès : ${job.sent}`);
        console.log(`   ❌ Échecs : ${job.failed}`);
        if (job.errors.length > 0) {
            console.log('   Détails des échecs :');
            job.errors.forEach(e => console.log(`     - ${e.parentName} (${e.number}): ${e.error}`));
        }

    } catch (err: any) {
        console.error('🔴 [Campagne] Erreur générale:', err);
        job.status = 'erreur';
        job.errors.push({
            parentName: 'Système',
            number: '',
            error: err.message || 'Erreur système générale'
        });
        job.finishedAt = new Date();
        campaignJobs.set(jobId, { ...job });
    }
}