import { Schema, model, Document, Types } from 'mongoose';

export interface IPushSubscription extends Document {
  user: Types.ObjectId;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: Date;
}

const PushSubscriptionSchema = new Schema<IPushSubscription>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  endpoint: { type: String, required: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
}, { timestamps: { createdAt: true, updatedAt: false } });

PushSubscriptionSchema.index({ user: 1, endpoint: 1 }, { unique: true });

export const PushSubscription = model<IPushSubscription>('PushSubscription', PushSubscriptionSchema);
