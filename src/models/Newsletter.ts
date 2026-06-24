import { Schema, model } from 'mongoose';

export interface INewsletter extends Document {
  email: string;
  subscribed: boolean;
  subscriptionDate: Date;
  unsubscribeToken: string;
  userType?: 'client' | 'prestataire'; // optionnel
}

const newsletterSchema = new Schema<INewsletter>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    subscribed: { type: Boolean, default: true },
    subscriptionDate: { type: Date, default: () => new Date() },
    unsubscribeToken: { type: String, required: true },
    userType: { type: String, enum: ['client', 'prestataire'] },
  },
  { timestamps: true }
);

export const Newsletter = model<INewsletter>('Newsletter', newsletterSchema);
