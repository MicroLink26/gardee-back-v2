import { Schema, model, Document } from 'mongoose';

export interface IContact extends Document {
  email: string;
  name: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

const ContactSchema = new Schema<IContact>(
  {
    email: { type: String, required: true },
    name: { type: String, required: true },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

export const Contact = model<IContact>('Contact', ContactSchema);
