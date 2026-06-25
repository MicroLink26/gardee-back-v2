import { Schema, model, Document } from 'mongoose';

export interface IAppSettings extends Document {
  notificationPollingInterval: number;
}

const AppSettingsSchema = new Schema<IAppSettings>(
  {
    notificationPollingInterval: {
      type: Number,
      default: 600000, // 600 seconds = 10 minutes
    },
  },
  { timestamps: true }
);

export const AppSettings = model<IAppSettings>('AppSettings', AppSettingsSchema);
