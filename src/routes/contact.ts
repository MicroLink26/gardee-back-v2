import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { Contact } from '../models/Contact';

const router = Router();

router.post(
  '/',
  [
    body('email').isEmail().normalizeEmail(),
    body('name').isString().notEmpty().trim(),
    body('message').isString().notEmpty().trim(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const { email, name, message } = req.body as { email: string; name: string; message: string };
    await Contact.create({ email, name, message });
    res.json({ ok: true });
  }
);

export default router;
