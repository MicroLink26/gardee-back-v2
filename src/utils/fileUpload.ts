import { UploadedFile } from 'express-fileupload';
import { uploadImage } from '../config/cloudinary';

export async function uploadProfileImage(
  file: UploadedFile,
  userId: string
): Promise<{ secure_url: string; public_id: string }> {
  if (!file.mimetype.startsWith('image/')) {
    throw new Error('Le fichier doit être une image');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Le fichier ne doit pas dépasser 5 Mo');
  }
  const base64 = `data:${file.mimetype};base64,${file.data.toString('base64')}`;
  return uploadImage(base64, `gardee/profils/${userId}/preview`);
}
