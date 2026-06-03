import { uploadImage, deleteImage } from '../cloudinary';

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload: jest.fn(),
      destroy: jest.fn(),
    },
  },
}));

describe('cloudinary', () => {
  const { v2: cloudinary } = jest.requireMock('cloudinary');
  const mockUpload: jest.Mock = cloudinary.uploader.upload;
  const mockDestroy: jest.Mock = cloudinary.uploader.destroy;

  beforeEach(() => jest.clearAllMocks());

  describe('uploadImage', () => {
    it('returns secure_url and public_id from cloudinary response', async () => {
      mockUpload.mockResolvedValue({
        secure_url: 'https://res.cloudinary.com/demo/image/upload/photo.jpg',
        public_id: 'gardee/profils/uid/preview',
      });

      const result = await uploadImage('data:image/jpeg;base64,abc', 'gardee/profils/uid');

      expect(mockUpload).toHaveBeenCalledWith('data:image/jpeg;base64,abc', { folder: 'gardee/profils/uid' });
      expect(result).toEqual({
        secure_url: 'https://res.cloudinary.com/demo/image/upload/photo.jpg',
        public_id: 'gardee/profils/uid/preview',
      });
    });
  });

  describe('deleteImage', () => {
    it('calls cloudinary destroy with the public_id', async () => {
      mockDestroy.mockResolvedValue({ result: 'ok' });

      await deleteImage('gardee/profils/uid/preview');

      expect(mockDestroy).toHaveBeenCalledWith('gardee/profils/uid/preview');
    });
  });
});
