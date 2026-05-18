import { Request } from 'express';
import { IUser } from '../models/User';

export interface AuthRequest extends Request {
  user?: IUser;
}

export type UserRole = 'client' | 'prestataire' | 'staff' | 'admin';

export type RequestStatus =
  | 'email_pending'
  | 'client_confirmed'
  | 'sent_to_provider'
  | 'provider_proposed'
  | 'provider_accepted'
  | 'client_accepted'
  | 'scheduled'
  | 'completed'
  | 'refused'
  | 'cancelled';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiSuccess {
  ok: true;
  [key: string]: unknown;
}
