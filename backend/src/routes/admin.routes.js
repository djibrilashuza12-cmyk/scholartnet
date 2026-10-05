"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_controller_1 = require("../controllers/admin.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticateToken);
router.use((0, auth_middleware_1.requireRole)(['ADMIN']));
router.get('/stats', admin_controller_1.getDashboardStats);
router.post('/users', admin_controller_1.createUser);
router.post('/annee-scolaire', admin_controller_1.openSchoolYear);
exports.default = router;
//# sourceMappingURL=admin.routes.js.map