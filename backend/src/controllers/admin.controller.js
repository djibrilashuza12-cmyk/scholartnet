"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openSchoolYear = exports.createUser = exports.getDashboardStats = void 0;
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const promise_1 = require("mysql2/promise");
const bcrypt_1 = __importDefault(require("bcrypt"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const getDashboardStats = async (req, res) => {
    const ecoleId = req.user?.ecole_id;
    try {
        const [elevesCount] = await db_1.default.query('SELECT COUNT(*) as count FROM eleves WHERE ecole_id = ?', [ecoleId]);
        const [usersCount] = await db_1.default.query('SELECT COUNT(*) as count FROM utilisateurs WHERE ecole_id = ?', [ecoleId]);
        const [classesCount] = await db_1.default.query('SELECT COUNT(*) as count FROM classes WHERE ecole_id = ?', [ecoleId]);
        res.json({
            eleves: elevesCount[0].count,
            utilisateurs: usersCount[0].count,
            classes: classesCount[0].count
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Erreur lors de la récupération des statistiques.' });
    }
};
exports.getDashboardStats = getDashboardStats;
const createUser = async (req, res) => {
    const ecoleId = req.user?.ecole_id;
    const { nom, prenom, identifiant, mot_de_passe, role } = req.body;
    try {
        const hashedPwd = await bcrypt_1.default.hash(mot_de_passe, 10);
        await db_1.default.query('INSERT INTO utilisateurs (ecole_id, nom, prenom, identifiant, mot_de_passe, role) VALUES (?, ?, ?, ?, ?, ?)', [ecoleId, nom, prenom, identifiant, hashedPwd, role]);
        res.status(201).json({ message: 'Utilisateur créé avec succès.' });
    }
    catch (error) {
        res.status(500).json({ message: 'Erreur lors de la création de l\'utilisateur.' });
    }
};
exports.createUser = createUser;
const openSchoolYear = async (req, res) => {
    const ecoleId = req.user?.ecole_id;
    const { nom, date_debut, date_fin } = req.body;
    try {
        await db_1.default.query('INSERT INTO annees_scolaires (ecole_id, nom, date_debut, date_fin, statut) VALUES (?, ?, ?, ?, ?)', [ecoleId, nom, date_debut, date_fin, 'OUVERTE']);
        res.status(201).json({ message: 'Année scolaire ouverte avec succès.' });
    }
    catch (error) {
        res.status(500).json({ message: 'Erreur lors de l\'ouverture de l\'année scolaire.' });
    }
};
exports.openSchoolYear = openSchoolYear;
//# sourceMappingURL=admin.controller.js.map