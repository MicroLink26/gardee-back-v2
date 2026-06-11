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
  emoji: { type: String, required: true, maxlength: 8 },
  reactorEmail: { type: String, required: true, maxlength: 255 },
  createdAt: { type: Date, default: Date.now },
});

const LabelSchema = new Schema<ILabel>({
  name: { type: String, required: true, maxlength: 50 },
  color: { type: String, maxlength: 20 },
  createdAt: { type: Date, default: Date.now },
});

const EditHistorySchema = new Schema<IEditHistory>({
  previousContent: { type: String, required: true, maxlength: 5000 },
  editedAt: { type: Date, required: true },
  editedBy: { type: String, required: true, maxlength: 255 },
});

const MessageSchema = new Schema<IMessage>({
  fromRole: { type: String, enum: ['provider', 'client'], required: true },
  fromEmail: { type: String, required: true, maxlength: 255 },
  fromName: { type: String, required: true, maxlength: 200 },
  content: { type: String, required: true, maxlength: 5000 },
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
  comment: { type: String, maxlength: 1000 },
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
    requesterEmail: { type: String, required: true, lowercase: true, trim: true, maxlength: 255 },
    requesterNom: { type: String, maxlength: 100 },
    requesterPrenom: { type: String, maxlength: 100 },
    requesterTelephone: { type: String, maxlength: 20 },
    prestations: [{ type: String, maxlength: 100 }],
    estimatedHours: { type: Number, min: 0, max: 1000 },
    recurring: { type: Boolean, default: false },
    description: { type: String, maxlength: 5000 },
    subject: { type: String, maxlength: 300 },
    address: { type: String, maxlength: 500 },
    codePostal: { type: String, maxlength: 20 },
    ville: { type: String, maxlength: 100 },
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
    ratingComment: { type: String, maxlength: 1000 },
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

// Indexes for performance optimization
ServiceRequestSchema.index({ prestataireId: 1, createdAt: -1 });
ServiceRequestSchema.index({ status: 1, createdAt: -1 });
ServiceRequestSchema.index({ requesterEmail: 1 });
ServiceRequestSchema.index({ clientId: 1, createdAt: -1 });
ServiceRequestSchema.index({ desiredAt: 1 });
ServiceRequestSchema.index({ isArchived: 1, prestataireId: 1 });
ServiceRequestSchema.index({ 'messages.createdAt': 1 });

export const ServiceRequest = model<IServiceRequest>('ServiceRequest', ServiceRequestSchema);
