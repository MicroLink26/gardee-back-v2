import { UploadedFile } from 'express-fileupload';
import { uploadProfileImage } from '../fileUpload';
import * as cloudinary from '../../config/cloudinary';

jest.mock('../../config/cloudinary', () => ({
  uploadImage: jest.fn(),
}));

describe('uploadProfileImage', () => {
  const mockUploadImage = cloudinary.uploadImage as jest.Mock;

  const makeFile = (overrides: Partial<UploadedFile> = {}): UploadedFile => ({
    name: 'photo.jpg',
    mimetype: 'image/jpeg',
    size: 1024 * 100,
    data: Buffer.from('fake-image-data'),
    encoding: '7bit',
    tempFilePath: '',
    truncated: false,
    md5: '',
    mv: jest.fn(),
    ...overrides,
  } as unknown as UploadedFile);

  beforeEach(() => jest.clearAllMocks());

  it('throws when file is not an image', async () => {
    const file = makeFile({ mimetype: 'application/pdf' });

    await expect(uploadProfileImage(file, 'uid-1')).rejects.toThrow('Le fichier doit être une image');
    expect(mockUploadImage).not.toHaveBeenCalled();
  });

  it('throws when file exceeds 5 MB', async () => {
    const file = makeFile({ size: 6 * 1024 * 1024 });

    await expect(uploadProfileImage(file, 'uid-1')).rejects.toThrow('Le fichier ne doit pas dépasser 5 Mo');
    expect(mockUploadImage).not.toHaveBeenCalled();
  });

  it('calls uploadImage with base64 data and correct folder path', async () => {
    mockUploadImage.mockResolvedValue({ secure_url: 'https://img.url/photo.jpg', public_id: 'gardee/profils/uid-1/preview' });
    const file = makeFile();

    const result = await uploadProfileImage(file, 'uid-1');

    expect(mockUploadImage).toHaveBeenCalledWith(
      expect.stringMatching(/^data:image\/jpeg;base64,/),
      'gardee/profils/uid-1/preview'
    );
    expect(result).toEqual({ secure_url: 'https://img.url/photo.jpg', public_id: 'gardee/profils/uid-1/preview' });
  });

  it('accepts any image/* mimetype', async () => {
    mockUploadImage.mockResolvedValue({ secure_url: 'https://img.url/photo.png', public_id: 'pid' });
    const file = makeFile({ mimetype: 'image/png' });

    await expect(uploadProfileImage(file, 'uid-2')).resolves.toBeDefined();
    expect(mockUploadImage).toHaveBeenCalledWith(
      expect.stringMatching(/^data:image\/png;base64,/),
      'gardee/profils/uid-2/preview'
    );
  });
});
