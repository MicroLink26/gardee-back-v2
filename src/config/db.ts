import mongoose from 'mongoose';

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGO_URL;
  if (!uri) throw new Error('MONGO_URL is not defined');
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}
