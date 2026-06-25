import { Request, Response } from 'express';
import { AppSettings } from '../models/AppSettings';

export async function getSettings(req: Request, res: Response): Promise<void> {
  try {
    let settings = await AppSettings.findOne();
    if (!settings) {
      settings = await AppSettings.create({ notificationPollingInterval: 600000 });
    }
    res.json({
      notificationPollingInterval: settings.notificationPollingInterval,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des paramètres' });
  }
}

export async function updateSettings(req: Request, res: Response): Promise<void> {
  try {
    const { notificationPollingInterval } = req.body;

    if (notificationPollingInterval && (notificationPollingInterval < 1000 || notificationPollingInterval > 3600000)) {
      res.status(400).json({ error: 'L\'intervalle doit être entre 1000 et 3600000 ms' });
      return;
    }

    let settings = await AppSettings.findOne();
    if (!settings) {
      settings = await AppSettings.create({ notificationPollingInterval: 600000 });
    }

    if (notificationPollingInterval) {
      settings.notificationPollingInterval = notificationPollingInterval;
    }

    await settings.save();
    res.json({
      notificationPollingInterval: settings.notificationPollingInterval,
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour des paramètres' });
  }
}
