import { Schema, model, Document, Types } from 'mongoose';
import { RequestStatus } from '../types';

interface IProposal {
  by: 'provider' | 'client';
  date: Date;
  comment?: string;
  createdAt: Date;
}

interface IReaction {
  emoji: string;
  reactorEmail: string;
  createdAt: Date;
}

interface IEditHistory {
  previousContent: string;
  editedAt: Date;
  editedBy: string;
}

export interface IMessage {
  _id: Types.ObjectId;
  fromRole: 'provider' | 'client';
  fromEmail: string;
  fromName: string;
  content: string;
  createdAt: Date;
  readBy?: string[];
  reactions?: IReaction[];
  isPinned?: boolean;
  pinnedAt?: Date;
  editedAt?: Date;
  editHistory?: IEditHistory[];
  isDeleted?: boolean;
  deletedAt?: Date;
}

interface ILabel {
  name: string;
  color?: string;
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
  messages: IMessage[];
  messageToken?: string;
  messageTokenExpiresAt?: Date;
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
  // Archive
  isArchived?: boolean;
  archivedAt?: Date;
  // Labels
  labels?: ILabel[];
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
  reviewApproved?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReactionSchema = new Schema<IReaction>({
  emoji: { type: String, required: true },
  reactorEmail: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const LabelSchema = new Schema<ILabel>({
  name: { type: String, required: true },
  color: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const EditHistorySchema = new Schema<IEditHistory>({
  previousContent: { type: String, required: true },
  editedAt: { type: Date, required: true },
  editedBy: { type: String, required: true },
});

const MessageSchema = new Schema<IMessage>({
  fromRole: { type: String, enum: ['provider', 'client'], required: true },
  fromEmail: { type: String, required: true },
  fromName: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  readBy: { type: [String], default: [] },
  reactions: { type: [ReactionSchema], default: [] },
  isPinned: { type: Boolean, default: false },
  pinnedAt: { type: Date },
  editedAt: { type: Date },
  editHistory: { type: [EditHistorySchema], default: [] },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
});

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
    messages: { type: [MessageSchema], default: [] },
    messageToken: { type: String, index: true },
    messageTokenExpiresAt: { type: Date },
    proposals: [ProposalSchema],
    verifyToken: { type: String, index: true },
    verifyTokenExpiresAt: { type: Date },
    lastResendAt: { type: Date },
    lastProviderNotifiedAt: { type: Date },
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date },
    labels: { type: [LabelSchema], default: [] },
    ratingDetails: { type: RatingSchema },
    ratingComment: { type: String },
    recommend: { type: Boolean },
    ratingGivenAt: { type: Date },
    proposalToken: { type: String, index: true },
    proposalTokenExpiresAt: { type: Date },
    ratingToken: { type: String, index: true },
    ratingTokenExpiresAt: { type: Date },
    ratingEmailSentAt: { type: Date },
    reviewApproved: { type: Boolean },
  },
  { timestamps: true }
);

export const ServiceRequest = model<IServiceRequest>('ServiceRequest', ServiceRequestSchema);
