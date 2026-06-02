import { IUser } from '../models/User';
import { IPrestataire } from '../models/Prestataire';

export function serializeUser(user: IUser, prestataire?: IPrestataire | null) {
  const { passwordHash: _pw, ...safeUser } = user.toObject();
  return {
    ...safeUser,
    isPrestataire: !!prestataire,
    prestataire: prestataire ? (() => { const p = prestataire.toObject(); return p; })() : null,
  };
}
