import { Schema, model, Document, Types } from 'mongoose';

export interface IExpoToken extends Document {
  user: Types.ObjectId;
  token: string;
  createdAt: Date;
}

const ExpoTokenSchema = new Schema<IExpoToken>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true, maxlength: 200 },
}, { timestamps: { createdAt: true, updatedAt: false } });

ExpoTokenSchema.index({ user: 1, token: 1 }, { unique: true });

export const ExpoToken = model<IExpoToken>('ExpoToken', ExpoTokenSchema);
