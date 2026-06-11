import { Schema, model, Document, Types } from 'mongoose';
import { UserRole } from '../types';

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  role: UserRole;
  nom: string;
  prenom: string;
  telephone: string;
  cgu: boolean;
  consentDataProcessing: boolean;
  is_validated: boolean;
  last_login?: Date;
  date_joined: Date;
  createdAt: Date;
  updatedAt: Date;
  bannedPermanently: boolean;
  rejectedTemporarily: boolean;
  rejectionReason?: string;
  rejectedAt?: Date;
  rejectionPingShown: boolean;
  emailVerified: boolean;
  emailVerificationCode?: string;
  emailVerificationExpiresAt?: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, unique: true, sparse: true, index: true, lowercase: true, trim: true, maxlength: 255 },
    passwordHash: { type: String },
    role: { type: String, enum: ['user', 'staff', 'admin'], default: 'user', index: true },
    nom: { type: String, required: true, trim: true, maxlength: 100 },
    prenom: { type: String, required: true, trim: true, maxlength: 100 },
    telephone: { type: String, required: true, trim: true, maxlength: 20 },
    cgu: { type: Boolean, default: false },
    consentDataProcessing: { type: Boolean, default: false },
    is_validated: { type: Boolean, default: true, index: true },
    last_login: { type: Date },
    date_joined: { type: Date, default: Date.now, index: true },
    bannedPermanently: { type: Boolean, default: false },
    rejectedTemporarily: { type: Boolean, default: false },
    rejectionReason: { type: String, maxlength: 1000 },
    rejectedAt: { type: Date },
    rejectionPingShown: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    emailVerificationCode: { type: String, sparse: true, index: true },
    emailVerificationExpiresAt: { type: Date },
  },
  { timestamps: true }
);

// Compound index for prestataire queries
UserSchema.index({ role: 1, is_validated: 1 });
UserSchema.index({ role: 1, createdAt: -1 });

export const User = model<IUser>('User', UserSchema);
