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
  // Prestataire-only fields
  prestations: string[];
  tarifHoraire?: number;
  description?: string;
  adresse?: string;
  codePostal?: string;
  ville?: string;
  contactCom: boolean;
  materielOK: boolean;
  isEntrepreneur: boolean;
  siret?: string;
  qualifElagage: boolean;
  cgu: boolean;
  consentDataProcessing: boolean;
  profil_image?: { secure_url: string; public_id: string };
  // Status
  is_validated: boolean;
  last_login?: Date;
  date_joined: Date;
  // Geolocation
  location?: { type: 'Point'; coordinates: [number, number] };
  geocodeStatus: 'pending' | 'ok' | 'error' | 'not_found';
  geocodedAt?: Date;
  // Reviews
  averageRating: number;
  numberOfReviews: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, unique: true, sparse: true, index: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    role: { type: String, enum: ['client', 'prestataire', 'staff', 'admin'], default: 'client' },
    nom: { type: String, required: true, trim: true },
    prenom: { type: String, required: true, trim: true },
    telephone: { type: String, required: true, trim: true },
    // Prestataire fields
    prestations: [{ type: String }],
    tarifHoraire: { type: Number },
    description: { type: String },
    adresse: { type: String },
    codePostal: { type: String },
    ville: { type: String },
    contactCom: { type: Boolean, default: false },
    materielOK: { type: Boolean, default: false },
    isEntrepreneur: { type: Boolean, default: false },
    siret: { type: String },
    qualifElagage: { type: Boolean, default: false },
    cgu: { type: Boolean, default: false },
    consentDataProcessing: { type: Boolean, default: false },
    profil_image: {
      secure_url: String,
      public_id: String,
    },
    // Status
    is_validated: { type: Boolean, default: false },
    last_login: { type: Date },
    date_joined: { type: Date, default: Date.now },
    // Geolocation
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number] },
    },
    geocodeStatus: {
      type: String,
      enum: ['pending', 'ok', 'error', 'not_found'],
      default: 'pending',
    },
    geocodedAt: { type: Date },
    // Reviews
    averageRating: { type: Number, default: 0 },
    numberOfReviews: { type: Number, default: 0 },
  },
  { timestamps: true }
);

UserSchema.index({ location: '2dsphere' });

export const User = model<IUser>('User', UserSchema);
