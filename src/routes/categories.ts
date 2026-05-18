import { Router, Request, Response } from 'express';
import { isConnected, isStaff } from '../middlewares/auth';
import { Category } from '../models/Category';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const categories = await Category.find().sort({ name: 1 });
  res.json(categories);
});

router.post('/', isConnected, isStaff, async (req: Request, res: Response) => {
  const { name, description } = req.body as { name: string; description?: string };
  const category = await Category.create({ name, description });
  res.status(201).json(category);
});

router.delete('/:id', isConnected, isStaff, async (req: Request, res: Response) => {
  await Category.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

export default router;
