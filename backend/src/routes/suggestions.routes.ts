// backend/routes/suggestions.routes.ts
import { Router } from 'express';
import { createSuggestion } from '../controllers/suggestions.controller';

const router = Router();

// Route publique pour soumettre une suggestion
router.post('/', createSuggestion);

export default router;