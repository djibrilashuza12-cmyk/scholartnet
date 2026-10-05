-- Base de données pour le Système de Gestion Scolaire Multi-Écoles
-- SGBD: MySQL

CREATE DATABASE IF NOT EXISTS scolarnet_db;
USE scolarnet_db;

-- 1. Écoles (Gérées via l'inscription initiale)
CREATE TABLE IF NOT EXISTS ecoles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code_epst VARCHAR(50) UNIQUE NOT NULL,
    nom VARCHAR(255) NOT NULL,
    adresse TEXT,
    bp VARCHAR(50),
    telephone VARCHAR(50) NULL,
    email VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Années Scolaires (Gérées par Admin)
CREATE TABLE IF NOT EXISTS annees_scolaires (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ecole_id INT NOT NULL,
    nom VARCHAR(20) NOT NULL, -- Ex: 2023-2024
    date_debut DATE,
    date_fin DATE,
    statut ENUM('OUVERTE', 'CLOTUREE') DEFAULT 'OUVERTE',
    FOREIGN KEY (ecole_id) REFERENCES ecoles(id) ON DELETE CASCADE
);

-- 3. Utilisateurs (Comptes Admin, Gestionnaire, Secrétaire, Titulaire)
-- Connexion via Email + Mot de passe (Support multi-écoles)
CREATE TABLE IF NOT EXISTS utilisateurs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ecole_id INT NOT NULL,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    email VARCHAR(191) NOT NULL,

    -- Mot de passe (Hashed) - NULL lors de la création par l'admin jusqu'à définition par l'utilisateur
    mot_de_passe VARCHAR(255) NULL,
    role ENUM('ADMIN', 'GESTIONNAIRE', 'SECRETAIRE', 'TITULAIRE') NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,

    -- Vérification email et OTP (6 chiffres, validité 3 minutes pour inscription initiale)
    is_verified BOOLEAN DEFAULT FALSE,
    verification_code VARCHAR(10) NULL,
    verification_expires_at DATETIME NULL,

    -- Jeton d'activation / réinitialisation de mot de passe (validité 1 mois, expiration immédiate dès usage)
    reset_token VARCHAR(255) NULL,
    reset_expires_at DATETIME NULL,

    -- Matricule & identifiant internes (conservés pour la gestion du dossier personnel)
    matricule VARCHAR(50) NULL,
    identifiant VARCHAR(100) NULL,

    -- Profil numérique personnel (origine/identité)
    sexe ENUM('M', 'F') NULL,
    date_naissance DATE NULL,
    lieu_naissance VARCHAR(100) NULL,
    adresse TEXT NULL,
    niveau_etude VARCHAR(100) NULL,
    postnom VARCHAR(100) NULL,
    nom_pere VARCHAR(150) NULL,
    nom_mere VARCHAR(150) NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ecole_id) REFERENCES ecoles(id) ON DELETE CASCADE,

    UNIQUE(ecole_id, email),
    UNIQUE(matricule)
);


-- 4. Classes
CREATE TABLE IF NOT EXISTS classes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ecole_id INT NOT NULL,
    nom VARCHAR(50) NOT NULL, -- Ex: 3ème
    section VARCHAR(100), -- Ex: Scientifique, Littéraire
    option_classe VARCHAR(100), -- Ex: Math-Physique, Latin-Philo
    titulaire_id INT, -- Chef de classe (Role: TITULAIRE)
    FOREIGN KEY (ecole_id) REFERENCES ecoles(id) ON DELETE CASCADE,
    FOREIGN KEY (titulaire_id) REFERENCES utilisateurs(id) ON DELETE SET NULL
);

-- 5. Élèves (Inscrits par Secrétaire)
CREATE TABLE IF NOT EXISTS eleves (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ecole_id INT NOT NULL,
    matricule VARCHAR(50) NOT NULL, -- Généré / unique par école
    nom VARCHAR(100) NOT NULL,
    postnom VARCHAR(100),
    prenom VARCHAR(100) NOT NULL,
    sexe ENUM('M', 'F') NOT NULL,
    date_naissance DATE,
    lieu_naissance VARCHAR(100),
    nom_pere VARCHAR(150),
    nom_mere VARCHAR(150),
    adresse TEXT,

    -- Niveau d'étude (pour le profil numérique)
    niveau_etude VARCHAR(100),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ecole_id) REFERENCES ecoles(id) ON DELETE CASCADE,
    UNIQUE(ecole_id, matricule)
);


-- 6. Inscriptions (Historique annuel de l'élève)
CREATE TABLE IF NOT EXISTS inscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    eleve_id INT NOT NULL,
    classe_id INT NOT NULL,
    annee_scolaire_id INT NOT NULL,
    date_inscription DATE NOT NULL,
    FOREIGN KEY (eleve_id) REFERENCES eleves(id) ON DELETE CASCADE,
    FOREIGN KEY (classe_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (annee_scolaire_id) REFERENCES annees_scolaires(id) ON DELETE CASCADE,
    UNIQUE(eleve_id, annee_scolaire_id) -- Un élève = une classe par an
);



-- 10. Cours (Branches)
CREATE TABLE IF NOT EXISTS cours (
    id INT AUTO_INCREMENT PRIMARY KEY,
    classe_id INT NOT NULL,
    nom VARCHAR(100) NOT NULL,
    ponderation INT NOT NULL DEFAULT 10,
    max_points INT NOT NULL DEFAULT 10, -- Points max sur lesquels la note est évaluée (ex: /10, /20)
    FOREIGN KEY (classe_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- 11. Notes (Saisies par le Titulaire)
CREATE TABLE IF NOT EXISTS notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inscription_id INT NOT NULL,
    cours_id INT NOT NULL,
    titulaire_id INT NOT NULL, -- Le titulaire qui a saisi la note
    periode VARCHAR(50) NOT NULL, -- Ex: '1ere Periode', '1er Semestre'
    note_obtenue DECIMAL(5, 2) NOT NULL,
    date_saisie DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inscription_id) REFERENCES inscriptions(id) ON DELETE CASCADE,
    FOREIGN KEY (cours_id) REFERENCES cours(id) ON DELETE CASCADE,
    FOREIGN KEY (titulaire_id) REFERENCES utilisateurs(id)
);

-- 12. Présences & Disciplines (Saisies par le Titulaire)
CREATE TABLE IF NOT EXISTS presences_disciplines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inscription_id INT NOT NULL,
    date_jour DATE NOT NULL,
    statut ENUM('PRESENT', 'ABSENT', 'JUSTIFIE') DEFAULT 'PRESENT',
    observation_discipline TEXT, -- Comportement, blâme, etc.
    FOREIGN KEY (inscription_id) REFERENCES inscriptions(id) ON DELETE CASCADE
);

-- ============================================================
-- PARTIE 2: GESTIONNAIRE (ÉCONOME)
-- ============================================================

-- 13. Périodes scolaires (pour bulletin et frais)
CREATE TABLE IF NOT EXISTS periodes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ecole_id INT NOT NULL,
    nom VARCHAR(50) NOT NULL, -- Ex: "1ère Période", "2ème Période"
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    ordre INT DEFAULT 0,
    est_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ecole_id) REFERENCES ecoles(id) ON DELETE CASCADE
);

-- 14. Types de Frais (version améliorée avec périodicité)
CREATE TABLE IF NOT EXISTS types_frais (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ecole_id INT NOT NULL,
    annee_scolaire_id INT NOT NULL,
    nom VARCHAR(100) NOT NULL,
    montant DECIMAL(10, 2) NOT NULL,
    devise VARCHAR(10) DEFAULT 'USD',
    est_obligatoire BOOLEAN DEFAULT TRUE,
    periodicite ENUM('ANNUELLE', 'SEMESTRIELLE', 'TRIMESTRIELLE', 'MENSUELLE', 'UNIQUE') DEFAULT 'ANNUELLE',
    par_defaut_autorise BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ecole_id) REFERENCES ecoles(id) ON DELETE CASCADE,
    FOREIGN KEY (annee_scolaire_id) REFERENCES annees_scolaires(id) ON DELETE CASCADE
);

-- 15. Frais par Période (montant ajusté par période)
CREATE TABLE IF NOT EXISTS frais_par_periode (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type_frais_id INT NOT NULL,
    periode_id INT NOT NULL,
    montant DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (type_frais_id) REFERENCES types_frais(id) ON DELETE CASCADE,
    FOREIGN KEY (periode_id) REFERENCES periodes(id) ON DELETE CASCADE,
    UNIQUE(type_frais_id, periode_id)
);

-- 16. Paiements (version améliorée)
CREATE TABLE IF NOT EXISTS paiements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inscription_id INT NOT NULL,
    type_frais_id INT NOT NULL,
    gestionnaire_id INT NOT NULL,
    montant_paye DECIMAL(10, 2) NOT NULL,
    date_paiement DATETIME DEFAULT CURRENT_TIMESTAMP,
    mode_paiement ENUM('CASH', 'M-PESA', 'AIRTELL_MONEY', 'ORANGE_MONEY', 'VIREMENT', 'CHEQUE') DEFAULT 'CASH',
    numero_recu VARCHAR(50) UNIQUE NOT NULL,
    reference_externe VARCHAR(100) NULL,
    commentaire TEXT NULL,
    annule BOOLEAN DEFAULT FALSE,
    date_annulation DATETIME NULL,
    annule_par INT NULL,
    FOREIGN KEY (inscription_id) REFERENCES inscriptions(id) ON DELETE CASCADE,
    FOREIGN KEY (type_frais_id) REFERENCES types_frais(id) ON DELETE CASCADE,
    FOREIGN KEY (gestionnaire_id) REFERENCES utilisateurs(id),
    FOREIGN KEY (annule_par) REFERENCES utilisateurs(id)
);

-- 17. Autorisations de Bulletin
CREATE TABLE IF NOT EXISTS autorisations_bulletin (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inscription_id INT NOT NULL,
    periode_id INT NOT NULL,
    statut ENUM('BLOQUE', 'AUTORISE') DEFAULT 'BLOQUE',
    gestionnaire_id INT NULL,
    date_autorisation DATETIME NULL,
    autorisation_auto BOOLEAN DEFAULT FALSE,
    date_autorisation_auto DATETIME NULL,
    FOREIGN KEY (inscription_id) REFERENCES inscriptions(id) ON DELETE CASCADE,
    FOREIGN KEY (periode_id) REFERENCES periodes(id) ON DELETE CASCADE,
    FOREIGN KEY (gestionnaire_id) REFERENCES utilisateurs(id),
    UNIQUE(inscription_id, periode_id)
);

-- 18. Stocks / Inventaire
CREATE TABLE IF NOT EXISTS stocks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ecole_id INT NOT NULL,
    nom VARCHAR(255) NOT NULL,
    categorie VARCHAR(100) NULL,
    reference VARCHAR(50) NULL,
    quantite DECIMAL(10, 2) NOT NULL DEFAULT 0,
    unite VARCHAR(20) NULL,
    seuil_alerte DECIMAL(10, 2) DEFAULT 0,
    prix_unitaire DECIMAL(10, 2) DEFAULT 0,
    fournisseur VARCHAR(255) NULL,
    emplacement VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (ecole_id) REFERENCES ecoles(id) ON DELETE CASCADE
);

-- 19. Mouvements de Stock
CREATE TABLE IF NOT EXISTS mouvements_stock (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stock_id INT NOT NULL,
    type ENUM('ENTREE', 'SORTIE') NOT NULL,
    quantite DECIMAL(10, 2) NOT NULL,
    motif VARCHAR(255) NULL,
    gestionnaire_id INT NOT NULL,
    date_mouvement DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE CASCADE,
    FOREIGN KEY (gestionnaire_id) REFERENCES utilisateurs(id)
);

-- 20. Paramètres de l'école
CREATE TABLE IF NOT EXISTS parametres_ecole (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ecole_id INT NOT NULL,
    clef VARCHAR(100) NOT NULL,
    valeur TEXT NULL,
    description TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (ecole_id) REFERENCES ecoles(id) ON DELETE CASCADE,
    UNIQUE(ecole_id, clef)
);

-- 21. Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ecole_id INT NOT NULL,
    utilisateur_id INT NULL,
    type VARCHAR(50) NOT NULL,
    titre VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    lien VARCHAR(255) NULL,
    est_lu BOOLEAN DEFAULT FALSE,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ecole_id) REFERENCES ecoles(id) ON DELETE CASCADE,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
);

-- 22. Activités (logs)
CREATE TABLE IF NOT EXISTS activites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ecole_id INT NOT NULL,
    utilisateur_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT NULL,
    ip VARCHAR(45) NULL,
    user_agent TEXT NULL,
    date_activite DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ecole_id) REFERENCES ecoles(id) ON DELETE CASCADE,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
);

-- ============================================================
-- MODIFICATIONS DES TABLES EXISTANTES
-- ============================================================

-- Ajout de la colonne d'autorisation auto dans inscriptions
ALTER TABLE inscriptions ADD COLUMN autorisation_auto BOOLEAN DEFAULT FALSE;
ALTER TABLE inscriptions ADD COLUMN date_autorisation_auto DATETIME NULL;

-- 7. Modifier mode_paiement pour utiliser ENUM
ALTER TABLE paiements 
MODIFY COLUMN mode_paiement ENUM('CASH', 'M-PESA', 'AIRTELL_MONEY', 'ORANGE_MONEY', 'VIREMENT', 'CHEQUE') DEFAULT 'CASH';

ALTER TABLE periodes 
MODIFY COLUMN date_debut DATETIME,
MODIFY COLUMN date_fin DATETIME;

ALTER TABLE eleves 
MODIFY COLUMN date_naissance DATETIME;

ALTER TABLE inscriptions 
MODIFY COLUMN date_inscription DATETIME;

-- Ajouter la colonne periode_id dans la table paiements
ALTER TABLE paiements 
ADD COLUMN periode_id INT NULL,
ADD FOREIGN KEY (periode_id) REFERENCES periodes(id) ON DELETE SET NULL;

-- Ajouter un index pour améliorer les performances
CREATE INDEX idx_paiements_periode_id ON paiements(periode_id);

ALTER TABLE paiements 
ADD COLUMN transaction_id VARCHAR(50) NULL,
ADD INDEX idx_transaction_id (transaction_id);

ALTER TABLE ecoles ADD COLUMN logo VARCHAR(255) NULL;

-- ============================================================
-- NOUVELLES TABLES POUR LE MODULE TITULAIRE
-- ============================================================

-- Table des bulletins publiés
CREATE TABLE IF NOT EXISTS bulletins_publies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inscription_id INT NOT NULL,
    periode_id INT NOT NULL,
    est_publie BOOLEAN DEFAULT FALSE,
    date_publication DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inscription_id) REFERENCES inscriptions(id) ON DELETE CASCADE,
    FOREIGN KEY (periode_id) REFERENCES periodes(id) ON DELETE CASCADE,
    UNIQUE(inscription_id, periode_id)
);

-- Ajout de la colonne statut dans inscriptions (pour gérer les inscriptions actives/inactives)
ALTER TABLE inscriptions ADD COLUMN statut ENUM('ACTIVE', 'INACTIVE', 'TERMINEE') DEFAULT 'ACTIVE';

-- Ajout de l'index pour améliorer les performances des recherches publiques
CREATE INDEX idx_eleves_matricule ON eleves(matricule);
CREATE INDEX idx_notes_inscription_periode ON notes(inscription_id, periode);
CREATE INDEX idx_inscriptions_eleve_annee ON inscriptions(eleve_id, annee_scolaire_id);

-- Trigger pour la création automatique d'autorisations lors de l'inscription
DELIMITER //
CREATE TRIGGER after_inscription_insert
AFTER INSERT ON inscriptions
FOR EACH ROW
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE periode_id INT;
    DECLARE cur CURSOR FOR SELECT id FROM periodes WHERE ecole_id = (SELECT ecole_id FROM eleves WHERE id = NEW.eleve_id) AND est_active = 1;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    OPEN cur;
    read_loop: LOOP
        FETCH cur INTO periode_id;
        IF done THEN
            LEAVE read_loop;
        END IF;

        INSERT INTO autorisations_bulletin (inscription_id, periode_id, statut, autorisation_auto)
        VALUES (NEW.id, periode_id, 'BLOQUE', FALSE)
        ON DUPLICATE KEY UPDATE statut = 'BLOQUE';
    END LOOP;
    CLOSE cur;
END//
DELIMITER ;

-- Trigger pour la mise à jour des autorisations lors de la création d'une nouvelle période
DELIMITER //
CREATE TRIGGER after_periode_insert
AFTER INSERT ON periodes
FOR EACH ROW
BEGIN
    INSERT IGNORE INTO autorisations_bulletin (inscription_id, periode_id, statut, autorisation_auto)
    SELECT i.id, NEW.id, 'BLOQUE', FALSE
    FROM inscriptions i
    JOIN eleves e ON i.eleve_id = e.id
    WHERE e.ecole_id = NEW.ecole_id
    AND i.annee_scolaire_id = (SELECT id FROM annees_scolaires WHERE ecole_id = NEW.ecole_id AND statut = 'OUVERTE' ORDER BY date_debut DESC LIMIT 1);
END//
DELIMITER ;

-- ============================================================
-- MIGRATION: LIER MAX_POINTS À LA PÉRIODE
-- ============================================================

-- 1. Créer la table cours_periodes
CREATE TABLE IF NOT EXISTS cours_periodes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cours_id INT NOT NULL,
    periode_id INT NOT NULL,
    max_points DECIMAL(6,2) NOT NULL DEFAULT 10,
    coefficient DECIMAL(4,2) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (cours_id) REFERENCES cours(id) ON DELETE CASCADE,
    FOREIGN KEY (periode_id) REFERENCES periodes(id) ON DELETE CASCADE,
    UNIQUE KEY unique_cours_periode (cours_id, periode_id)
);

-- 2. Migrer les données existantes
-- Pour chaque cours, créer une entrée pour chaque période active de l'école
INSERT INTO cours_periodes (cours_id, periode_id, max_points, coefficient)
SELECT 
    c.id, 
    p.id, 
    COALESCE(c.max_points, 10) as max_points,
    1 as coefficient
FROM cours c
CROSS JOIN periodes p
WHERE p.ecole_id = (SELECT ecole_id FROM classes WHERE id = c.classe_id)
AND p.est_active = 1
ON DUPLICATE KEY UPDATE max_points = c.max_points;

-- 3. Supprimer la colonne max_points de la table cours
ALTER TABLE cours DROP COLUMN max_points;

ALTER TABLE eleves 
ADD COLUMN numero_parent VARCHAR(20) NULL COMMENT 'Numéro de téléphone du parent (format international +243...)';

CREATE INDEX idx_ecoles_nom ON ecoles(nom);
CREATE INDEX idx_ecoles_telephone ON ecoles(telephone);
CREATE INDEX idx_ecoles_email ON ecoles(email);
CREATE INDEX idx_ecoles_created_at ON ecoles(created_at);

-- 2. INDEX SUR TABLE annees_scolaires
CREATE INDEX idx_annees_ecole_statut ON annees_scolaires(ecole_id, statut);
CREATE INDEX idx_annees_ecole_dates ON annees_scolaires(ecole_id, date_debut, date_fin);
CREATE INDEX idx_annees_statut ON annees_scolaires(statut);
CREATE INDEX idx_annees_nom ON annees_scolaires(nom);

-- 3. INDEX SUR TABLE utilisateurs
CREATE INDEX idx_utilisateurs_ecole_role ON utilisateurs(ecole_id, role);
CREATE INDEX idx_utilisateurs_nom_prenom ON utilisateurs(nom, prenom);
CREATE INDEX idx_utilisateurs_ecole_active ON utilisateurs(ecole_id, is_active);
CREATE INDEX idx_utilisateurs_role_active ON utilisateurs(role, is_active);
CREATE INDEX idx_utilisateurs_created_at ON utilisateurs(created_at);

-- 4. INDEX SUR TABLE classes
CREATE INDEX idx_classes_ecole ON classes(ecole_id);
CREATE INDEX idx_classes_titulaire ON classes(titulaire_id);
CREATE INDEX idx_classes_ecole_nom ON classes(ecole_id, nom);
CREATE INDEX idx_classes_section ON classes(section);
CREATE INDEX idx_classes_option ON classes(option_classe);

-- 5. INDEX SUR TABLE eleves
CREATE INDEX idx_eleves_ecole_nom_prenom ON eleves(ecole_id, nom, prenom);
CREATE INDEX idx_eleves_ecole_matricule ON eleves(ecole_id, matricule);
CREATE INDEX idx_eleves_nom_prenom ON eleves(nom, prenom);
CREATE INDEX idx_eleves_sexe ON eleves(sexe);
CREATE INDEX idx_eleves_date_naissance ON eleves(date_naissance);
CREATE INDEX idx_eleves_created_at ON eleves(created_at);
CREATE INDEX idx_eleves_numero_parent ON eleves(numero_parent);

-- 6. INDEX SUR TABLE inscriptions
CREATE INDEX idx_inscriptions_eleve ON inscriptions(eleve_id);
CREATE INDEX idx_inscriptions_classe ON inscriptions(classe_id);
CREATE INDEX idx_inscriptions_annee ON inscriptions(annee_scolaire_id);
CREATE INDEX idx_inscriptions_classe_annee ON inscriptions(classe_id, annee_scolaire_id);
CREATE INDEX idx_inscriptions_statut ON inscriptions(statut);
CREATE INDEX idx_inscriptions_date ON inscriptions(date_inscription);
CREATE INDEX idx_inscriptions_eleve_statut ON inscriptions(eleve_id, statut);
CREATE INDEX idx_inscriptions_annee_statut ON inscriptions(annee_scolaire_id, statut);

-- 7. INDEX SUR TABLE cours
CREATE INDEX idx_cours_classe ON cours(classe_id);
CREATE INDEX idx_cours_classe_nom ON cours(classe_id, nom);
CREATE INDEX idx_cours_nom ON cours(nom);

-- 8. INDEX SUR TABLE notes
CREATE INDEX idx_notes_inscription ON notes(inscription_id);
CREATE INDEX idx_notes_cours ON notes(cours_id);
CREATE INDEX idx_notes_titulaire ON notes(titulaire_id);
CREATE INDEX idx_notes_periode ON notes(periode);
CREATE INDEX idx_notes_inscription_cours ON notes(inscription_id, cours_id);
CREATE INDEX idx_notes_titulaire_periode ON notes(titulaire_id, periode);
CREATE INDEX idx_notes_date_saisie ON notes(date_saisie);
CREATE INDEX idx_notes_inscription_periode_cours ON notes(inscription_id, periode, cours_id, note_obtenue);

-- 9. INDEX SUR TABLE presences_disciplines
CREATE INDEX idx_presences_inscription ON presences_disciplines(inscription_id);
CREATE INDEX idx_presences_date ON presences_disciplines(date_jour);
CREATE INDEX idx_presences_statut ON presences_disciplines(statut);
CREATE INDEX idx_presences_inscription_date ON presences_disciplines(inscription_id, date_jour);
CREATE INDEX idx_presences_date_statut ON presences_disciplines(date_jour, statut);
CREATE INDEX idx_presences_inscription_statut ON presences_disciplines(inscription_id, statut);

-- 10. INDEX SUR TABLE periodes
CREATE INDEX idx_periodes_ecole ON periodes(ecole_id);
CREATE INDEX idx_periodes_ecole_active ON periodes(ecole_id, est_active);
CREATE INDEX idx_periodes_ordre ON periodes(ordre);
CREATE INDEX idx_periodes_dates ON periodes(date_debut, date_fin);
CREATE INDEX idx_periodes_ecole_ordre ON periodes(ecole_id, ordre);

-- 11. INDEX SUR TABLE types_frais
CREATE INDEX idx_types_frais_ecole ON types_frais(ecole_id);
CREATE INDEX idx_types_frais_annee ON types_frais(annee_scolaire_id);
CREATE INDEX idx_types_frais_ecole_annee ON types_frais(ecole_id, annee_scolaire_id);
CREATE INDEX idx_types_frais_periodicite ON types_frais(periodicite);
CREATE INDEX idx_types_frais_obligatoire ON types_frais(est_obligatoire);
CREATE INDEX idx_types_frais_nom ON types_frais(nom);

-- 12. INDEX SUR TABLE frais_par_periode
CREATE INDEX idx_frais_periode_type ON frais_par_periode(type_frais_id);
CREATE INDEX idx_frais_periode_periode ON frais_par_periode(periode_id);

-- 13. INDEX SUR TABLE paiements
CREATE INDEX idx_paiements_inscription ON paiements(inscription_id);
CREATE INDEX idx_paiements_type ON paiements(type_frais_id);
CREATE INDEX idx_paiements_gestionnaire ON paiements(gestionnaire_id);
CREATE INDEX idx_paiements_date ON paiements(date_paiement);
CREATE INDEX idx_paiements_annule ON paiements(annule);
CREATE INDEX idx_paiements_mode ON paiements(mode_paiement);
CREATE INDEX idx_paiements_inscription_date ON paiements(inscription_id, date_paiement);
CREATE INDEX idx_paiements_type_date ON paiements(type_frais_id, date_paiement);
CREATE INDEX idx_paiements_gestionnaire_date ON paiements(gestionnaire_id, date_paiement);
CREATE INDEX idx_paiements_date_periode ON paiements(date_paiement, periode_id);
CREATE INDEX idx_paiements_inscription_annule ON paiements(inscription_id, annule);

-- 14. INDEX SUR TABLE autorisations_bulletin
CREATE INDEX idx_autorisations_inscription ON autorisations_bulletin(inscription_id);
CREATE INDEX idx_autorisations_periode ON autorisations_bulletin(periode_id);
CREATE INDEX idx_autorisations_statut ON autorisations_bulletin(statut);
CREATE INDEX idx_autorisations_periode_statut ON autorisations_bulletin(periode_id, statut);
CREATE INDEX idx_autorisations_gestionnaire ON autorisations_bulletin(gestionnaire_id);

-- 15. INDEX SUR TABLE stocks
CREATE INDEX idx_stocks_ecole ON stocks(ecole_id);
CREATE INDEX idx_stocks_ecole_categorie ON stocks(ecole_id, categorie);
CREATE INDEX idx_stocks_nom ON stocks(nom);
CREATE INDEX idx_stocks_reference ON stocks(reference);
CREATE INDEX idx_stocks_seuil ON stocks(seuil_alerte);

-- 16. INDEX SUR TABLE mouvements_stock
CREATE INDEX idx_mouvements_stock ON mouvements_stock(stock_id);
CREATE INDEX idx_mouvements_type ON mouvements_stock(type);
CREATE INDEX idx_mouvements_gestionnaire ON mouvements_stock(gestionnaire_id);
CREATE INDEX idx_mouvements_date ON mouvements_stock(date_mouvement);
CREATE INDEX idx_mouvements_stock_date ON mouvements_stock(stock_id, date_mouvement);

-- 17. INDEX SUR TABLE parametres_ecole
CREATE INDEX idx_parametres_ecole_clef ON parametres_ecole(ecole_id, clef);

-- 18. INDEX SUR TABLE notifications
CREATE INDEX idx_notifications_utilisateur ON notifications(utilisateur_id);
CREATE INDEX idx_notifications_ecole ON notifications(ecole_id);
CREATE INDEX idx_notifications_utilisateur_lu ON notifications(utilisateur_id, est_lu);
CREATE INDEX idx_notifications_ecole_date ON notifications(ecole_id, date_creation);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_date_creation ON notifications(date_creation);

-- 19. INDEX SUR TABLE activites
CREATE INDEX idx_activites_utilisateur ON activites(utilisateur_id);
CREATE INDEX idx_activites_ecole ON activites(ecole_id);
CREATE INDEX idx_activites_utilisateur_date ON activites(utilisateur_id, date_activite);
CREATE INDEX idx_activites_ecole_date ON activites(ecole_id, date_activite);
CREATE INDEX idx_activites_action_date ON activites(action, date_activite);
CREATE INDEX idx_activites_date ON activites(date_activite);

-- 20. INDEX SUR TABLE bulletins_publies
CREATE INDEX idx_bulletins_inscription ON bulletins_publies(inscription_id);
CREATE INDEX idx_bulletins_periode ON bulletins_publies(periode_id);
CREATE INDEX idx_bulletins_publication ON bulletins_publies(est_publie, date_publication);
CREATE INDEX idx_bulletins_inscription_periode ON bulletins_publies(inscription_id, periode_id);

-- 21. INDEX SUR TABLE cours_periodes
CREATE INDEX idx_cours_periodes_cours ON cours_periodes(cours_id);
CREATE INDEX idx_cours_periodes_periode ON cours_periodes(periode_id);

-- Ajouter une colonne pour stocker si l'utilisateur a vérifié son identité avec Google
ALTER TABLE utilisateurs ADD COLUMN google_verified BOOLEAN DEFAULT FALSE;

-- Ajouter une colonne pour la date de vérification Google
ALTER TABLE utilisateurs ADD COLUMN google_verified_at DATETIME NULL;

-- Ajouter un index pour améliorer les performances
CREATE INDEX idx_google_verified ON utilisateurs(google_verified);

ALTER TABLE utilisateurs 
ADD COLUMN google_verified_expires_at DATETIME NULL AFTER google_verified_at;

-- ============================================================
-- TABLE DES SUGGESTIONS (Feedback utilisateur)
-- ============================================================
CREATE TABLE IF NOT EXISTS suggestions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(150) NOT NULL,
    email VARCHAR(191) NOT NULL,
    sujet VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    statut ENUM('NOUVEAU', 'EN_COURS', 'TRAITE', 'REJETE') DEFAULT 'NOUVEAU',
    ip VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Index pour faciliter la consultation via phpMyAdmin
CREATE INDEX idx_suggestions_statut ON suggestions(statut);
CREATE INDEX idx_suggestions_created_at ON suggestions(created_at);
CREATE INDEX idx_suggestions_email ON suggestions(email);

ALTER TABLE autorisations_bulletin 
ADD COLUMN duree_jours INT NULL COMMENT 'Durée en jours (NULL = permanent/auto)',
ADD COLUMN date_expiration DATETIME NULL COMMENT 'Date d''expiration automatique',
ADD COLUMN motif_autorisation TEXT NULL COMMENT 'Motif de la dérogation';

-- 2. Index pour accélérer la détection des expirations
CREATE INDEX idx_autorisations_expiration 
ON autorisations_bulletin(date_expiration, statut, autorisation_auto);

-- 3. Table d'historique
CREATE TABLE IF NOT EXISTS autorisations_historique (
    id INT AUTO_INCREMENT PRIMARY KEY,
    autorisation_id INT NOT NULL,
    ancien_statut ENUM('BLOQUE', 'AUTORISE') NOT NULL,
    nouveau_statut ENUM('BLOQUE', 'AUTORISE') NOT NULL,
    raison VARCHAR(255) NULL,
    gestionnaire_id INT NULL,
    date_changement DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (autorisation_id) REFERENCES autorisations_bulletin(id) ON DELETE CASCADE,
    FOREIGN KEY (gestionnaire_id) REFERENCES utilisateurs(id) ON DELETE SET NULL,
    INDEX idx_historique_autorisation (autorisation_id),
    INDEX idx_historique_date (date_changement)
);