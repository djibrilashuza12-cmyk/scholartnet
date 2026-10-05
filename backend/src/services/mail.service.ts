import dotenv from 'dotenv';

dotenv.config();

export interface SendOtpOptions {
    to: string;
    code: string;
    nomDestinataire?: string;
    nomEcole?: string;
}

export interface SendPasswordSetupOptions {
    to: string;
    resetUrl: string;
    nomDestinataire?: string;
    nomEcole?: string;
    role?: string;
    isRenewal?: boolean;
}

export class MailService {
    private static transporter: any = null;

    private static getTransporter() {
        if (this.transporter) return this.transporter;

        const host = process.env.SMTP_HOST;
        const port = Number(process.env.SMTP_PORT || 587);
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
        const secure = process.env.SMTP_SECURE === 'true' || port === 465;

        if (!host || !user || !pass) {
            return null;
        }

        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const nodemailer = require('nodemailer');
            this.transporter = nodemailer.createTransport({
                host,
                port,
                secure,
                auth: {
                    user,
                    pass,
                },
                tls: {
                    rejectUnauthorized: false
                }
            });
            return this.transporter;
        } catch (err) {
            console.warn('[MailService] Module nodemailer non disponible ou erreur transporteur:', err);
            return null;
        }
    }

    /**
     * Envoie le code de vérification à 6 chiffres par email (durée 3 min)
     */
    public static async sendOtpEmail(options: SendOtpOptions): Promise<{ success: boolean; messageId?: string }> {
        const { to, code, nomDestinataire, nomEcole } = options;

        const dateExpiration = new Date(Date.now() + 3 * 60 * 1000).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        // Journalisation claire dans la console pour faciliter les tests et le monitoring
        console.log('\n==================================================================');
        console.log(`📧 [ScolarNet - Vérification Email]`);
        console.log(`Destinataire : ${to}`);
        if (nomDestinataire) console.log(`Utilisateur  : ${nomDestinataire}`);
        if (nomEcole) console.log(`Établissement: ${nomEcole}`);
        console.log(`CODE OTP     : [ ${code} ]`);
        console.log(`Durée validité: 3 MINUTES (Expire à environ ${dateExpiration})`);
        console.log('==================================================================\n');

        const transporter = this.getTransporter();
        if (!transporter) {
            return { success: true };
        }

        const sender = process.env.EMAIL_FROM || '"ScolarNet" <no-reply@scolarnet.cd>';

        const digits = code.split('');
        const digitBadges = digits
            .map(d => `<span style="display:inline-block; width:44px; height:52px; line-height:52px; margin:0 4px; background:#f1f5f9; color:#0f172a; font-size:28px; font-weight:700; border-radius:10px; border:2px solid #cbd5e1; text-align:center;">${d}</span>`)
            .join('');

        const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code de vérification ScolarNet</title>
</head>
<body style="margin:0; padding:0; background-color:#f8fafc; font-family:'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc; padding:40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:540px; background-color:#ffffff; border-radius:18px; box-shadow:0 10px 25px rgba(0,0,0,0.06); border:1px solid #e2e8f0; overflow:hidden;" cellspacing="0" cellpadding="0">
          
          <!-- En-tête avec dégradé ScolarNet -->
          <tr>
            <td style="background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%); padding:36px 30px; text-align:center;">
              <h1 style="color:#ffffff; margin:0; font-size:26px; font-weight:800; letter-spacing:-0.5px;">ScolarNet</h1>
              <p style="color:#bfdbfe; margin:8px 0 0 0; font-size:14px; font-weight:500;">Plateforme de Gestion Scolaire Sécurisée</p>
            </td>
          </tr>

          <!-- Contenu Principal -->
          <tr>
            <td style="padding:36px 32px 30px 32px;">
              <h2 style="color:#0f172a; margin:0 0 14px 0; font-size:20px; font-weight:700;">Vérification de votre adresse email</h2>
              <p style="color:#475569; margin:0 0 24px 0; font-size:15px; line-height:1.6;">
                Bonjour ${nomDestinataire ? `<strong>${nomDestinataire}</strong>` : ''},<br>
                Vous venez de créer le compte Administrateur pour votre établissement ${nomEcole ? `<strong>${nomEcole}</strong>` : ''}.<br>
                Veuillez utiliser le code de vérification ci-dessous pour finaliser l'activation de votre compte :
              </p>

              <!-- Affichage du code 6 chiffres -->
              <div style="text-align:center; margin:32px 0 28px 0;">
                <div style="display:inline-block;">
                  ${digitBadges}
                </div>
              </div>

              <!-- Alerte Délai 3 minutes -->
              <div style="background-color:#eff6ff; border-left:4px solid #2563eb; border-radius:8px; padding:14px 18px; margin-bottom:28px;">
                <p style="margin:0; color:#1e40af; font-size:14px; line-height:1.5;">
                  ⏱️ <strong>Attention :</strong> Ce code est strictement valable pendant <strong>3 minutes</strong>. Une fois ce délai dépassé, il expirera et vous devrez en demander un nouveau.
                </p>
              </div>

              <p style="color:#64748b; margin:0; font-size:13px; line-height:1.5;">
                Si vous n'êtes pas à l'origine de cette inscription, veuillez simplement ignorer cet e-mail.
              </p>
            </td>
          </tr>

          <!-- Pied de page -->
          <tr>
            <td style="background-color:#f8fafc; padding:20px 30px; text-align:center; border-top:1px solid #e2e8f0;">
              <p style="color:#94a3b8; margin:0; font-size:12px;">
                © ${new Date().getFullYear()} ScolarNet. Tous droits réservés. Système d'authentification sécurisé.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `;

        try {
            const info = await transporter.sendMail({
                from: sender,
                to,
                subject: `Votre code de vérification ScolarNet : ${code}`,
                text: `Votre code de vérification ScolarNet est : ${code}. Ce code expire dans 3 minutes.`,
                html
            });
            console.log(`[MailService] Email OTP envoyé avec succès à ${to} (ID: ${info.messageId})`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('[MailService] Échec lors de l\'envoi de l\'email OTP:', error);
            return { success: false };
        }
    }

    /**
     * Envoie le lien d'activation / définition de mot de passe (durée 1 mois, expiration immédiate dès usage)
     */
    public static async sendPasswordSetupEmail(options: SendPasswordSetupOptions): Promise<{ success: boolean; messageId?: string }> {
        const { to, resetUrl, nomDestinataire, nomEcole, role, isRenewal } = options;

        const dateExpiration = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });

        console.log('\n==================================================================');
        console.log(`📧 [ScolarNet - ${isRenewal ? 'Renouvellement' : 'Invitation & Activation'}]`);
        console.log(`Destinataire : ${to}`);
        if (nomDestinataire) console.log(`Utilisateur  : ${nomDestinataire}`);
        if (nomEcole) console.log(`Établissement: ${nomEcole} (Rôle: ${role || 'Personnel'})`);
        console.log(`Lien d'accès : ${resetUrl}`);
        console.log(`Durée validité: 1 MOIS (Expire le ${dateExpiration} si inutilisé)`);
        console.log(`Sécurité     : Expire AUTOMATIQUEMENT et IMMÉDIATEMENT dès usage`);
        console.log('==================================================================\n');

        const transporter = this.getTransporter();
        if (!transporter) {
            return { success: true };
        }

        const sender = process.env.EMAIL_FROM || '"ScolarNet" <no-reply@scolarnet.cd>';
        const subject = isRenewal
            ? `ScolarNet - Renouvellement de votre mot de passe (${nomEcole || 'Établissement'})`
            : `Bienvenue sur ScolarNet - Définissez votre mot de passe (${nomEcole || 'Établissement'})`;

        const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; background-color:#f8fafc; font-family:'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc; padding:40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px; background-color:#ffffff; border-radius:20px; box-shadow:0 12px 30px rgba(0,0,0,0.06); border:1px solid #e2e8f0; overflow:hidden;" cellspacing="0" cellpadding="0">
          
          <!-- En-tête -->
          <tr>
            <td style="background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%); padding:36px 32px; text-align:center;">
              <h1 style="color:#ffffff; margin:0; font-size:26px; font-weight:800; letter-spacing:-0.5px;">ScolarNet</h1>
              <p style="color:#bfdbfe; margin:8px 0 0 0; font-size:14px; font-weight:500;">Portail Sécurisé de Gestion Scolaire</p>
            </td>
          </tr>

          <!-- Contenu -->
          <tr>
            <td style="padding:36px 32px 30px 32px;">
              <h2 style="color:#0f172a; margin:0 0 16px 0; font-size:21px; font-weight:700;">
                ${isRenewal ? 'Réinitialisation de votre mot de passe' : 'Bienvenue dans votre équipe pédagogique'}
              </h2>
              
              <p style="color:#475569; margin:0 0 20px 0; font-size:15px; line-height:1.6;">
                Bonjour ${nomDestinataire ? `<strong>${nomDestinataire}</strong>` : ''},<br>
                ${isRenewal 
                  ? `Une demande de réinitialisation de mot de passe a été émise pour votre compte rattaché à l'établissement ${nomEcole ? `<strong>${nomEcole}</strong>` : ''}.`
                  : `Votre compte professionnel a été créé sur ScolarNet pour l'établissement ${nomEcole ? `<strong>${nomEcole}</strong>` : ''} avec le rôle <strong>${role || 'Membre du personnel'}</strong>.`
                }
              </p>

              <p style="color:#475569; margin:0 0 28px 0; font-size:15px; line-height:1.6;">
                Pour des raisons de sécurité, le mot de passe doit être défini directement par vous-même. Cliquez sur le bouton ci-dessous pour choisir votre mot de passe :
              </p>

              <!-- Bouton d'action -->
              <div style="text-align:center; margin:32px 0;">
                <a href='${resetUrl}' 
                   style="display:inline-block; padding:15px 36px; background:linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color:#ffffff; text-decoration:none; font-size:15px; font-weight:700; border-radius:12px; box-shadow:0 6px 18px rgba(37,99,235,0.35); letter-spacing:0.2px;">
                  ${isRenewal ? 'Réinitialiser mon mot de passe' : 'Définir mon mot de passe'}
                </a>
              </div>

              <!-- Bloc d'information sur la validité 1 mois & expiration dès utilisation -->
              <div style="background-color:#f0fdf4; border-left:4px solid #16a34a; border-radius:8px; padding:16px; margin:28px 0 24px 0;">
                <p style="margin:0 0 6px 0; color:#166534; font-size:14px; font-weight:700;">
                  ⏱️ Validité du lien : 1 mois (${dateExpiration})
                </p>
                <p style="margin:0; color:#15803d; font-size:13px; line-height:1.5;">
                  Ce lien reste valable pendant 1 mois si inutilisé. <strong>Dès que vous aurez configuré votre mot de passe, ce lien expirera immédiatement et définitivement</strong> par mesure de sécurité.
                </p>
              </div>

              <!-- Lien alternatif direct -->
              <p style="color:#64748b; font-size:12px; margin:0 0 8px 0; line-height:1.5;">
                Si le bouton ci-dessus ne fonctionne pas, copiez et collez l'URL suivante dans votre navigateur :
              </p>
              <div style="background-color:#f1f5f9; padding:12px; border-radius:8px; word-break:break-all; font-family:monospace; font-size:12px; color:#334155; margin-bottom:24px;">
                ${resetUrl}
              </div>

              <p style="color:#94a3b8; margin:0; font-size:12px; line-height:1.5;">
                Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute tranquillité.
              </p>
            </td>
          </tr>

          <!-- Pied de page -->
          <tr>
            <td style="background-color:#f8fafc; padding:20px 30px; text-align:center; border-top:1px solid #e2e8f0;">
              <p style="color:#94a3b8; margin:0; font-size:12px;">
                © ${new Date().getFullYear()} ScolarNet. Sécurité et confidentialité des données scolaires.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `;

        try {
            const info = await transporter.sendMail({
                from: sender,
                to,
                subject,
                text: `Bonjour, veuillez définir votre mot de passe pour ScolarNet via ce lien (valable 1 mois) : ${resetUrl}`,
                html
            });
            console.log(`[MailService] Email d'activation envoyé avec succès à ${to} (ID: ${info.messageId})`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('[MailService] Échec lors de l\'envoi de l\'email d\'activation:', error);
            return { success: false };
        }
    }
}

export default MailService;
