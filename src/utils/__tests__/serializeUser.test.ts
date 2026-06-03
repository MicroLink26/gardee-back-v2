import { serializeUser } from '../serializeUser';

const makeUser = (overrides = {}) =>
  ({
    toObject: () => ({
      _id: 'uid',
      email: 'user@example.com',
      nom: 'Dupont',
      prenom: 'Jean',
      role: 'user',
      passwordHash: 'secret-hash',
      ...overrides,
    }),
  }) as any;

const makePrestataire = (overrides = {}) =>
  ({
    toObject: () => ({
      _id: 'pid',
      userId: 'uid',
      prestations: ['Tonte'],
      tarifHoraire: 25,
      ...overrides,
    }),
  }) as any;

describe('serializeUser', () => {
  it('strips passwordHash from the output', () => {
    const result = serializeUser(makeUser());

    expect(result).not.toHaveProperty('passwordHash');
    expect(result.email).toBe('user@example.com');
  });

  it('sets isPrestataire:false and prestataire:null when no prestataire', () => {
    const result = serializeUser(makeUser(), null);

    expect(result.isPrestataire).toBe(false);
    expect(result.prestataire).toBeNull();
  });

  it('sets isPrestataire:true and embeds prestataire object when provided', () => {
    const result = serializeUser(makeUser(), makePrestataire());

    expect(result.isPrestataire).toBe(true);
    expect(result.prestataire).toEqual(expect.objectContaining({ prestations: ['Tonte'] }));
  });

  it('preserves all safe user fields', () => {
    const result = serializeUser(makeUser());

    expect(result).toMatchObject({ _id: 'uid', email: 'user@example.com', nom: 'Dupont', prenom: 'Jean', role: 'user' });
  });
});
