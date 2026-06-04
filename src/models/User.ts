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
    email: { type: String, unique: true, sparse: true, index: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    role: { type: String, enum: ['user', 'staff', 'admin'], default: 'user' },
    nom: { type: String, required: true, trim: true },
    prenom: { type: String, required: true, trim: true },
    telephone: { type: String, required: true, trim: true },
    cgu: { type: Boolean, default: false },
    consentDataProcessing: { type: Boolean, default: false },
    is_validated: { type: Boolean, default: true },
    last_login: { type: Date },
    date_joined: { type: Date, default: Date.now },
    bannedPermanently: { type: Boolean, default: false },
    rejectedTemporarily: { type: Boolean, default: false },
    rejectionReason: { type: String },
    rejectedAt: { type: Date },
    rejectionPingShown: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    emailVerificationCode: { type: String },
    emailVerificationExpiresAt: { type: Date },
  },
  { timestamps: true }
);

export const User = model<IUser>('User', UserSchema);
