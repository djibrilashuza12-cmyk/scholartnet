export interface Ecole {
    id?: number;
    code_epst: string;
    nom: string;
    mot_de_passe: string;
    adresse?: string;
    bp?: string;
    created_at?: Date;
}
export interface Utilisateur {
    id?: number;
    ecole_id: number;
    nom: string;
    prenom: string;
    identifiant: string;
    mot_de_passe: string;
    role: 'ADMIN' | 'GESTIONNAIRE' | 'SECRETAIRE' | 'TITULAIRE';
    is_active?: boolean;
    created_at?: Date;
}
//# sourceMappingURL=db.schema.d.ts.map