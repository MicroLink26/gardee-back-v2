import { Response } from 'express';
import { Notification } from '../models/Notification';
import { AuthRequest } from '../types';
import { logMessageActionError } from '../utils/logger';

export async function listNotifications(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { page = '1', pageSize = '20', unread } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);

    const filter: Record<string, unknown> = { userId: req.user!._id };
    if (unread === 'true') filter.read = false;

    const [items, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(pageSize)),
      Notification.countDocuments(filter),
    ]);

    res.json({ items, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (error) {
    logMessageActionError('listNotifications: Failed to list notifications', undefined, req.user!._id.toString(), error);
    res.status(500).json({ error: 'Erreur lors de la récupération des notifications' });
  }
}

export async function getUnreadCount(req: AuthRequest, res: Response): Promise<void> {
  try {
    const count = await Notification.countDocuments({ userId: req.user!._id, read: false });
    res.json({ unreadCount: count });
  } catch (error) {
    logMessageActionError('getUnreadCount: Failed to count unread', undefined, req.user!._id.toString(), error);
    res.status(500).json({ error: 'Erreur lors du comptage' });
  }
}

export async function markAsRead(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user!._id, read: false },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      res.status(404).json({ error: 'Notification introuvable' });
      return;
    }

    res.json({ ok: true, notification });
  } catch (error) {
    logMessageActionError('markAsRead: Failed to mark notification as read', undefined, req.user!._id.toString(), error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
}

export async function markAllAsRead(req: AuthRequest, res: Response): Promise<void> {
  try {
    const now = new Date();
    const result = await Notification.updateMany(
      { userId: req.user!._id, read: false },
      { read: true, readAt: now }
    );

    res.json({ ok: true, updated: result.modifiedCount });
  } catch (error) {
    logMessageActionError('markAllAsRead: Failed to mark all as read', undefined, req.user!._id.toString(), error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
}

export async function deleteNotification(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const result = await Notification.deleteOne({ _id: id, userId: req.user!._id });

    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Notification introuvable' });
      return;
    }

    res.json({ ok: true });
  } catch (error) {
    logMessageActionError('deleteNotification: Failed to delete notification', undefined, req.user!._id.toString(), error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
}
