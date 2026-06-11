import { Schema, model, Document, Types } from 'mongoose';

export interface IPrestataire extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
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
  profil_image?: { secure_url: string; public_id: string };
  is_validated: boolean;
  location?: { type: 'Point'; coordinates: [number, number] };
  geocodeStatus: 'pending' | 'ok' | 'error' | 'not_found';
  geocodedAt?: Date;
  averageRating: number;
  numberOfReviews: number;
  createdAt: Date;
  updatedAt: Date;
}

const PrestataireSchema = new Schema<IPrestataire>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    prestations: [{ type: String, maxlength: 100 }],
    tarifHoraire: { type: Number, min: 0, max: 10000 },
    description: { type: String, maxlength: 5000 },
    adresse: { type: String, maxlength: 500 },
    codePostal: { type: String, maxlength: 20 },
    ville: { type: String, maxlength: 100 },
    contactCom: { type: Boolean, default: false },
    materielOK: { type: Boolean, default: false },
    isEntrepreneur: { type: Boolean, default: false },
    siret: { type: String, maxlength: 20 },
    qualifElagage: { type: Boolean, default: false },
    cgu: { type: Boolean, default: false },
    profil_image: { secure_url: String, public_id: String },
    is_validated: { type: Boolean, default: false },
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
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    numberOfReviews: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Indexes for performance optimization
PrestataireSchema.index({ location: '2dsphere' });
PrestataireSchema.index({ userId: 1 });
PrestataireSchema.index({ is_validated: 1, createdAt: -1 });
PrestataireSchema.index({ ville: 1, is_validated: 1 });
PrestataireSchema.index({ averageRating: -1, numberOfReviews: -1 });
PrestataireSchema.index({ createdAt: -1 });

export const Prestataire = model<IPrestataire>('Prestataire', PrestataireSchema);
