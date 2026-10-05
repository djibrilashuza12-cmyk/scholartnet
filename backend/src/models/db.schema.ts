export interface Ecole {
    id?: number;
    code_epst: string;
    nom: string;
    mot_de_passe?: string | null;
    adresse?: string;
    bp?: string;
    telephone?: string;
    email?: string;
    created_at?: Date;
}

export interface Utilisateur {
    id?: number;
    ecole_id: number;
    nom: string;
    prenom: string;
    email: string;

    // Mot de passe hashé (optionnel jusqu'à définition par l'utilisateur)
    mot_de_passe?: string | null;
    role: 'ADMIN' | 'GESTIONNAIRE' | 'SECRETAIRE' | 'TITULAIRE';
    is_active?: boolean;

    // Statut de vérification d'email & code OTP (3 minutes)
    is_verified?: boolean;
    verification_code?: string | null;
    verification_expires_at?: Date | string | null;

    // Jeton d'activation et de réinitialisation de mot de passe (1 mois)
    reset_token?: string | null;
    reset_expires_at?: Date | string | null;

    // Matricule / identifiant interne
    matricule?: string | null;
    identifiant?: string | null;

    eleve_id?: number | null;
    created_at?: Date;
}

