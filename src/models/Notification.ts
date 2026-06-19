import { Schema, model, Types } from 'mongoose';

interface INotification {
  userId: Types.ObjectId;
  type: 'request_created' | 'request_confirmed' | 'provider_accepted' | 'provider_proposed' | 'provider_refused' | 'client_accepted' | 'client_refused' | 'request_completed' | 'message' | 'other';
  title: string;
  body: string;
  relatedRequestId?: Types.ObjectId;
  relatedUserId?: Types.ObjectId;
  data?: Record<string, unknown>;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['request_created', 'request_confirmed', 'provider_accepted', 'provider_proposed', 'provider_refused', 'client_accepted', 'client_refused', 'request_completed', 'message', 'other'], required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    relatedRequestId: { type: Schema.Types.ObjectId, ref: 'ServiceRequest', index: true },
    relatedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    data: { type: Schema.Types.Mixed },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Notification = model<INotification>('Notification', NotificationSchema);
