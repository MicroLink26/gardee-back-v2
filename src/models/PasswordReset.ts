import { Schema, model, Document, Types } from 'mongoose';

export interface IPasswordReset extends Document {
  user: Types.ObjectId;
  token: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PasswordResetSchema = new Schema<IPasswordReset>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, unique: true, index: true, required: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const PasswordReset = model<IPasswordReset>('PasswordReset', PasswordResetSchema);
