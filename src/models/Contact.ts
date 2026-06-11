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
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 255 },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
  },
  { timestamps: true }
);

export const Contact = model<IContact>('Contact', ContactSchema);
