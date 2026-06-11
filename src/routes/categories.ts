import { Router, Request, Response } from 'express';
import { isConnected, isStaff } from '../middlewares/auth';
import { Category } from '../models/Category';
import { validateTextField } from '../utils/validation';
import { logMessageActionError } from '../utils/logger';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    logMessageActionError('categories.get: Failed to fetch categories', undefined, undefined, error);
    res.status(500).json({ error: 'Erreur lors de la récupération des catégories' });
  }
});

router.post('/', isConnected, isStaff, async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body as { name: string; description?: string };

    if (!name) {
      res.status(400).json({ error: 'Le nom est requis' });
      return;
    }

    const nameValidation = validateTextField(name, 'Nom', 1, 100);
    if (!nameValidation.valid) {
      res.status(400).json({ error: nameValidation.error });
      return;
    }

    if (description !== undefined) {
      const descValidation = validateTextField(description, 'Description', 1, 500);
      if (!descValidation.valid) {
        res.status(400).json({ error: descValidation.error });
        return;
      }
    }

    const category = await Category.create({ name: (name as string).trim(), description: description ? (description as string).trim() : undefined });
    res.status(201).json(category);
  } catch (error) {
    logMessageActionError('categories.post: Failed to create category', undefined, undefined, error);
    res.status(500).json({ error: 'Erreur lors de la création de la catégorie' });
  }
});

router.delete('/:id', isConnected, isStaff, async (req: Request, res: Response) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
      res.status(404).json({ error: 'Catégorie introuvable' });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    logMessageActionError('categories.delete: Failed to delete category', undefined, undefined, error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

export default router;
