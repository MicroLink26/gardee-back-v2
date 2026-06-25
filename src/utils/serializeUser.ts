import { IUser } from '../models/User';
import { IPrestataire } from '../models/Prestataire';

export function serializeUser(user: IUser, prestataire?: IPrestataire | null) {
  const { passwordHash: _pw, ...safeUser } = user.toObject();

  // Compute role from legacy fields if needed
  let role = user.role;
  if (!role) {
    const legacy = user as any;
    if (legacy.is_superuser) {
      role = 'admin';
    } else if (legacy.is_staff) {
      role = 'staff';
    } else {
      role = 'user';
    }
  }

  return {
    ...safeUser,
    role,
    isPrestataire: !!prestataire,
    prestataire: prestataire ? (() => { const p = prestataire.toObject(); return p; })() : null,
  };
}
