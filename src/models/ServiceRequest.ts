import { Schema, model, Document, Types } from 'mongoose';
import { RequestStatus } from '../types';

interface IProposal {
  by: 'provider' | 'client';
  date: Date;
  comment?: string;
  createdAt: Date;
}

interface IRatingDetails {
  time: number;
  quality: number;
  sympathy: number;
  value: number;
  punctuality: number;
}

export interface IServiceRequest extends Document {
  _id: Types.ObjectId;
  prestataireId: Types.ObjectId;
  // Client info — ObjectId if registered client, email if guest
  clientId?: Types.ObjectId;
  requesterEmail: string;
  requesterNom?: string;
  requesterPrenom?: string;
  requesterTelephone?: string;
  // Service details
  prestations: string[];
  estimatedHours?: number;
  recurring: boolean;
  description?: string;
  subject?: string;
  address?: string;
  codePostal?: string;
  ville?: string;
  desiredAt?: Date;
  // Workflow
  status: RequestStatus;
  proposals: IProposal[];
  // Email verification (for guest requests)
  verifyToken?: string;
  verifyTokenExpiresAt?: Date;
  lastResendAt?: Date;
  // Notifications
  lastProviderNotifiedAt?: Date;
  // Rating
  ratingDetails?: IRatingDetails;
  ratingComment?: string;
  recommend?: boolean;
  ratingGivenAt?: Date;
  proposalToken?: string;
  proposalTokenExpiresAt?: Date;
  ratingToken?: string;
  ratingTokenExpiresAt?: Date;
  ratingEmailSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProposalSchema = new Schema<IProposal>({
  by: { type: String, enum: ['provider', 'client'], required: true },
  date: { type: Date, required: true },
  comment: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const RatingSchema = new Schema<IRatingDetails>({
  time: { type: Number, min: 1, max: 5 },
  quality: { type: Number, min: 1, max: 5 },
  sympathy: { type: Number, min: 1, max: 5 },
  value: { type: Number, min: 1, max: 5 },
  punctuality: { type: Number, min: 1, max: 5 },
});

const ServiceRequestSchema = new Schema<IServiceRequest>(
  {
    prestataireId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'User' },
    requesterEmail: { type: String, required: true, lowercase: true, trim: true },
    requesterNom: { type: String },
    requesterPrenom: { type: String },
    requesterTelephone: { type: String },
    prestations: [{ type: String }],
    estimatedHours: { type: Number },
    recurring: { type: Boolean, default: false },
    description: { type: String },
    subject: { type: String },
    address: { type: String },
    codePostal: { type: String },
    ville: { type: String },
    desiredAt: { type: Date },
    status: {
      type: String,
      enum: [
        'email_pending', 'client_confirmed', 'sent_to_provider',
        'provider_proposed', 'provider_accepted', 'client_accepted',
        'scheduled', 'completed', 'refused', 'cancelled',
      ],
      default: 'email_pending',
    },
    proposals: [ProposalSchema],
    verifyToken: { type: String, index: true },
    verifyTokenExpiresAt: { type: Date },
    lastResendAt: { type: Date },
    lastProviderNotifiedAt: { type: Date },
    ratingDetails: { type: RatingSchema },
    ratingComment: { type: String },
    recommend: { type: Boolean },
    ratingGivenAt: { type: Date },
    proposalToken: { type: String, index: true },
    proposalTokenExpiresAt: { type: Date },
    ratingToken: { type: String, index: true },
    ratingTokenExpiresAt: { type: Date },
    ratingEmailSentAt: { type: Date },
  },
  { timestamps: true }
);

export const ServiceRequest = model<IServiceRequest>('ServiceRequest', ServiceRequestSchema);
