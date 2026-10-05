"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = exports.createSchoolAndAdmin = void 0;
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = __importDefault(require("../config/db"));
const promise_1 = require("mysql2/promise");
const db_schema_1 = require("../models/db.schema");
const createSchoolAndAdmin = async (req, res) => {
    const { code_epst, nom_ecole, adresse, bp, mot_de_passe_ecole, nom_admin, prenom_admin, identifiant_admin, mot_de_passe_admin } = req.body;
    const connection = await db_1.default.getConnection();
    try {
        await connection.beginTransaction();
        // Check if school exists
        const [existing] = await connection.query('SELECT id FROM ecoles WHERE code_epst = ?', [code_epst]);
        if (existing.length > 0) {
            res.status(400).json({ message: 'Code EPST déjà enregistré.' });
            return;
        }
        // Hash passwords
        const hashedSchoolPwd = await bcrypt_1.default.hash(mot_de_passe_ecole, 10);
        const hashedAdminPwd = await bcrypt_1.default.hash(mot_de_passe_admin, 10);
        // Insert School
        const [schoolResult] = await connection.query('INSERT INTO ecoles (code_epst, nom, mot_de_passe, adresse, bp) VALUES (?, ?, ?, ?, ?)', [code_epst, nom_ecole, hashedSchoolPwd, adresse, bp]);
        const ecoleId = schoolResult.insertId;
        // Insert Admin
        await connection.query('INSERT INTO utilisateurs (ecole_id, nom, prenom, identifiant, mot_de_passe, role) VALUES (?, ?, ?, ?, ?, ?)', [ecoleId, nom_admin, prenom_admin, identifiant_admin, hashedAdminPwd, 'ADMIN']);
        await connection.commit();
        res.status(201).json({ message: 'École et compte administrateur créés avec succès.' });
    }
    catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ message: 'Erreur serveur lors de la création.' });
    }
    finally {
        connection.release();
    }
};
exports.createSchoolAndAdmin = createSchoolAndAdmin;
const login = async (req, res) => {
    const { code_epst, identifiant, mot_de_passe } = req.body;
    try {
        // Find school
        const [ecoles] = await db_1.default.query('SELECT id FROM ecoles WHERE code_epst = ?', [code_epst]);
        if (ecoles.length === 0) {
            res.status(404).json({ message: 'École introuvable avec ce code EPST.' });
            return;
        }
        const ecoleId = ecoles[0].id;
        // Find user
        const [users] = await db_1.default.query('SELECT * FROM utilisateurs WHERE ecole_id = ? AND identifiant = ?', [ecoleId, identifiant]);
        if (users.length === 0) {
            res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' });
            return;
        }
        const user = users[0];
        // Check password
        const isMatch = await bcrypt_1.default.compare(mot_de_passe, user.mot_de_passe);
        if (!isMatch) {
            res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' });
            return;
        }
        if (!user.is_active) {
            res.status(403).json({ message: 'Votre compte est désactivé.' });
            return;
        }
        // Generate JWT
        const token = jsonwebtoken_1.default.sign({ id: user.id, ecole_id: user.ecole_id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '12h' });
        res.json({
            message: 'Connexion réussie',
            token,
            user: {
                id: user.id,
                nom: user.nom,
                prenom: user.prenom,
                role: user.role,
                ecole_id: user.ecole_id
            }
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
};
exports.login = login;
//# sourceMappingURL=auth.controller.js.map