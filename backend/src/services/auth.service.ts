// backend/src/services/auth.service.ts
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import db from '../config/db';
import { RowDataPacket } from 'mysql2/promise';

// ✅ Initialisation du client Google
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export class AuthService {
    // ✅ Garder la méthode getGoogleClient pour compatibilité
    private static googleClient: OAuth2Client | null = null;

    private static getGoogleClient() {
        if (this.googleClient) return this.googleClient;

        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            console.warn('[AuthService] Google OAuth non configuré');
            return null;
        }

        this.googleClient = new OAuth2Client(
            clientId,
            clientSecret,
            process.env.GOOGLE_REDIRECT_URI
        );

        return this.googleClient;
    }

    /**
     * Vérifie un token Google (ID Token JWT OU Access Token ya29...)
     */
    static async verifyGoogleToken(token: string): Promise<{ email: string; name: string } | null> {
        try {
            if (!token) {
                console.log('[AuthService] Token vide');
                return null;
            }

            console.log('[AuthService] Vérification token, type:', token.startsWith('ya29') ? 'Access Token' : 'ID Token');

            // 1. Si c'est un ID Token JWT (contient 3 parties séparées par des points)
            if (token.split('.').length === 3) {
                console.log('[AuthService] Traitement comme ID Token JWT');
                
                const ticket = await client.verifyIdToken({
                    idToken: token,
                    audience: process.env.GOOGLE_CLIENT_ID,
                });
                
                const payload = ticket.getPayload();
                if (!payload || !payload.email) {
                    console.log('[AuthService] ID Token invalide: pas d\'email');
                    return null;
                }
                
                console.log('[AuthService] ID Token valide pour:', payload.email);
                return {
                    email: payload.email,
                    name: payload.name || payload.given_name || 'Utilisateur Google',
                };
            }

            // 2. Si c'est un Access Token OAuth2 (commence par ya29... ou format standard)
            console.log('[AuthService] Traitement comme Access Token');
            
            const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { 
                    Authorization: `Bearer ${token}` 
                }
            });

            if (!response.ok) {
                console.error('[AuthService] Échec validation Access Token Google:', response.status, response.statusText);
                return null;
            }

            const data = await response.json();
            console.log('[AuthService] Réponse userinfo:', data);

            if (!data || !data.email) {
                console.log('[AuthService] Access Token invalide: pas d\'email');
                return null;
            }

            return {
                email: data.email,
                name: data.name || data.given_name || 'Utilisateur Google',
            };

        } catch (error) {
            console.error('[AuthService] Erreur vérification Google:', error);
            return null;
        }
    }

    // ✅ Garder l'ancienne méthode pour compatibilité (dépréciée)
    static async verifyGoogleTokenOld(idToken: string): Promise<{ email: string; name: string } | null> {
        return this.verifyGoogleToken(idToken);
    }
}