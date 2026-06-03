import { connectDB } from '../db';

jest.mock('mongoose', () => ({
  connect: jest.fn(),
}));

describe('connectDB', () => {
  const mongoose = jest.requireMock('mongoose');
  const mockConnect: jest.Mock = mongoose.connect;

  beforeEach(() => {
    mockConnect.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('throws when MONGO_URL is not set', async () => {
    const saved = process.env.MONGO_URL;
    delete process.env.MONGO_URL;

    await expect(connectDB()).rejects.toThrow('MONGO_URL is not defined');
    expect(mockConnect).not.toHaveBeenCalled();

    if (saved !== undefined) process.env.MONGO_URL = saved;
  });

  it('connects to MongoDB with the MONGO_URL env var', async () => {
    process.env.MONGO_URL = 'mongodb://localhost:27017/test';
    mockConnect.mockResolvedValue({});

    await connectDB();

    expect(mockConnect).toHaveBeenCalledWith('mongodb://localhost:27017/test');
    expect(console.log).toHaveBeenCalledWith('MongoDB connected');

    delete process.env.MONGO_URL;
  });
});
