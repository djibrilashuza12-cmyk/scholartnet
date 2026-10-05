# ScolarNet

Systeme de gestion scolaire moderne pour les etablissements primaires et secondaires en Republique Democratique du Congo.

Gestion des eleves, notes, paiements, bulletins, presences, communication parents - le tout dans une seule plateforme web securisee et multi-utilisateurs.

![Status](https://img.shields.io/badge/status-en%20developpement-orange)
![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18-green)
![Angular](https://img.shields.io/badge/angular-%3E%3D17-red)
![TypeScript](https://img.shields.io/badge/typescript-5.x-blue)
![MySQL](https://img.shields.io/badge/mysql-8.x-orange)

---

## Table des matieres

- [A propos](#a-propos)
- [Fonctionnalites](#fonctionnalites)
- [Architecture](#architecture)
- [Stack technique](#stack-technique)
- [Prerequis](#prerequis)
- [Installation](#installation)
- [Configuration](#configuration)
- [Utilisation](#utilisation)
- [Comptes de test](#comptes-de-test)
- [API Endpoints](#api-endpoints)
- [Deploiement](#deploiement)
- [Securite](#securite)
- [Tests](#tests)
- [Contribuer](#contribuer)
- [Roadmap](#roadmap)
- [Licence](#licence)
- [Contact](#contact)

---

## A propos

ScolarNet est une application web complete de gestion scolaire concue pour les ecoles primaires et secondaires en Republique Democratique du Congo. Elle permet aux directions, gestionnaires, secretariats et titulaires de gerer efficacement l'ensemble des operations scolaires quotidiennes.

Le projet est concu pour etre :
- Multi-ecoles (une installation peut gerer plusieurs etablissements)
- Multi-roles (admin, gestionnaire, secretaire, titulaire)
- Securise (JWT, bcrypt, HTTPS)
- Moderne (Angular 17+, Node.js, MySQL)
- Extensible (architecture modulaire)

---

## Fonctionnalites

### Gestion administrative

- Inscription des eleves avec matricule automatique
- Gestion des classes, sections et annees scolaires
- Import/export des donnees eleves (CSV, Excel)
- Fiche complete par eleve (identite, parents, historique)
- Gestion des inscriptions et reinscriptions

### Gestion pedagogique

- Saisie des notes par periode et par cours
- Calcul automatique des moyennes ponderees
- Classement automatique par classe
- Generation des bulletins PDF
- Appreciations des titulaires
- Suivi des presences et absences
- Gestion des cours et titulaires par classe

### Gestion financiere

- Configuration des frais par classe et par annee
- Enregistrement des paiements (especes, mobile money, virement)
- Suivi des impayes et relances
- Generation des recus PDF
- Rapports financiers (journalier, mensuel, annuel)
- Gestion des stocks (fournitures, uniformes)

### Gestion des utilisateurs

- Multi-roles : admin, gestionnaire, secretaire, titulaire
- Authentification JWT securisee
- Connexion via Google OAuth2
- Activation de compte par email avec lien securise (30 jours)
- Reinitialisation de mot de passe securisee
- Systeme de permissions par role

### Communication

- Envoi d'emails SMTP (activation, mot de passe, notifications)
- Notifications WhatsApp Cloud API
- Alertes aux parents (absences, impayes, bulletin disponible)
- Communication groupee par classe ou par section

### Tableaux de bord

- Vue d'ensemble par role
- Statistiques en temps reel
- Graphiques et rapports
- Export des donnees

---

## Architecture
scolarNet/
├── backend/ # API Node.js + Express + TypeScript
│ ├── src/
│ │ ├── config/
│ │ │ ├── db.ts # Configuration MySQL
│ │ │ └── env.ts # Chargement des variables d'environnement
│ │ ├── controllers/
│ │ │ ├── admin.controller.ts
│ │ │ ├── admin.users.controller.ts
│ │ │ ├── admin.annees.controller.ts
│ │ │ ├── admin.search.controller.ts
│ │ │ ├── auth.controller.ts
│ │ │ ├── communication.controller.ts
│ │ │ ├── gestionnaire.controller.ts
│ │ │ ├── secretariat.controller.ts
│ │ │ ├── suggestions.controller.ts
│ │ │ └── titulaire.controller.ts
│ │ ├── middlewares/
│ │ │ ├── auth.middleware.ts
│ │ │ └── dateFormatter.ts
│ │ ├── models/
│ │ │ └── db.schema.ts
│ │ ├── routes/
│ │ │ ├── admin.routes.ts
│ │ │ ├── auth.routes.ts
│ │ │ ├── communication.routes.ts
│ │ │ ├── gestionnaire.routes.ts
│ │ │ ├── secretariat.routes.ts
│ │ │ ├── suggestions.routes.ts
│ │ │ └── titulaire.routes.ts
│ │ ├── services/
│ │ │ ├── auth.service.ts
│ │ │ ├── autorisationsCron.service.ts
│ │ │ ├── bulletin.service.ts
│ │ │ ├── mail.service.ts
│ │ │ └── whatsapp.service.ts
│ │ ├── utils/
│ │ │ ├── dates.ts
│ │ │ └── matricule.ts
│ │ └── index.ts
│ ├── .env.example
│ ├── package.json
│ └── tsconfig.json
│
├── frontend/ # Application Angular 17+
│ ├── src/
│ │ ├── app/
│ │ │ ├── animations/
│ │ │ ├── core/
│ │ │ │ └── interceptors/
│ │ │ │ └── auth.interceptor.ts
│ │ │ ├── features/
│ │ │ │ ├── admin/
│ │ │ │ ├── auth/
│ │ │ │ ├── gestionnaire/
│ │ │ │ ├── landing/
│ │ │ │ ├── secretariat/
│ │ │ │ └── titulaire/
│ │ │ ├── shared/
│ │ │ │ ├── layouts/
│ │ │ │ └── logo/
│ │ │ ├── app.component.ts
│ │ │ ├── app.config.ts
│ │ │ └── app.routes.ts
│ │ ├── assets/
│ │ ├── environments/
│ │ ├── index.html
│ │ ├── main.ts
│ │ └── styles.css
│ ├── angular.json
│ ├── package.json
│ ├── tailwind.config.js
│ └── tsconfig.json
│
├── Public/ # Pages publiques statiques
├── database.sql # Script de creation de la base
├── .gitignore
├── README.md
└── LICENSE

text

---

## Stack technique

| Couche | Technologies |
|---|---|
| Backend | Node.js 18+, Express 4, TypeScript 5 |
| Base de donnees | MySQL 8 |
| Frontend | Angular 17, TypeScript, TailwindCSS |
| Authentification | JWT (jsonwebtoken), bcrypt, Google OAuth2 |
| Email | Nodemailer (SMTP Gmail) |
| WhatsApp | WhatsApp Cloud API (Meta) |
| Generation PDF | Bibliotheque PDF (bulletins, recus) |
| Cron jobs | node-cron |
| Validation | Validation manuelle + SQL prepare |
| Serveur HTTP | Express avec middlewares de securite |

---

## Prerequis

Avant d'installer ScolarNet, assure-toi d'avoir :

- Node.js >= 18 - https://nodejs.org/
- npm >= 9 (installe avec Node.js)
- MySQL >= 8 - https://dev.mysql.com/downloads/
- Git - https://git-scm.com/
- Angular CLI - `npm install -g @angular/cli`

### Comptes externes requis

- Un compte Gmail avec mot de passe d'application active
- Un projet Google Cloud avec OAuth2 configure
- Un compte WhatsApp Business avec Cloud API activee
- (Optionnel) Un nom de domaine et un certificat SSL

---

## Installation

### 1. Cloner le depot

```bash
git clone https://github.com/djibrilashuza12-cmyk/scholartnet.git
cd scholartnet
