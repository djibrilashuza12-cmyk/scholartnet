"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = __importDefault(require("./config/db"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3007;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
app.use('/api/auth', auth_routes_1.default);
app.use('/api/admin', admin_routes_1.default);
// Point de terminaison pour vérifier la santé de l'API
app.get('/api/health', async (req, res) => {
    try {
        const [rows] = await db_1.default.query('SELECT 1');
        res.json({ status: 'ok', database: 'connected' });
    }
    catch (error) {
        console.error("Database error:", error);
        res.status(500).json({ status: 'error', message: 'Database connection failed' });
    }
});
app.listen(port, () => {
    console.log(`Serveur démarré sur le port ${port}`);
});
//# sourceMappingURL=index.js.map