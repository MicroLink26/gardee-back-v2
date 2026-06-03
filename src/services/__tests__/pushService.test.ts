import { sendPushToUser } from '../pushService';
import { PushSubscription } from '../../models/PushSubscription';
import { Types } from 'mongoose';

jest.mock('../../models/PushSubscription', () => ({
  PushSubscription: {
    find: jest.fn(),
    deleteMany: jest.fn(),
  },
}));

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

describe('pushService', () => {
  const mockFind = PushSubscription.find as jest.Mock;
  const mockDeleteMany = PushSubscription.deleteMany as jest.Mock;
  const webpush = jest.requireMock('web-push');

  const userId = new Types.ObjectId();
  const requestId = new Types.ObjectId().toString();
  const payload = { title: 'Test', body: 'Message test', url: `/app/requests/${requestId}`, requestId };

  const sub = (endpoint: string) => ({
    endpoint,
    keys: { p256dh: 'key', auth: 'auth' },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteMany.mockResolvedValue({});
  });

  it('sends push to all subscriptions of a user', async () => {
    mockFind.mockResolvedValue([sub('https://push.endpoint/1'), sub('https://push.endpoint/2')]);
    webpush.sendNotification.mockResolvedValue({});

    await sendPushToUser(userId, payload);

    expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'https://push.endpoint/1' }),
      JSON.stringify(payload)
    );
  });

  it('does nothing when user has no subscriptions', async () => {
    mockFind.mockResolvedValue([]);

    await sendPushToUser(userId, payload);

    expect(webpush.sendNotification).not.toHaveBeenCalled();
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it('removes stale subscriptions on 410 Gone', async () => {
    mockFind.mockResolvedValue([sub('https://stale.endpoint/1')]);
    webpush.sendNotification.mockRejectedValue({ statusCode: 410 });

    await sendPushToUser(userId, payload);

    expect(mockDeleteMany).toHaveBeenCalledWith({
      endpoint: { $in: ['https://stale.endpoint/1'] },
    });
  });

  it('removes stale subscriptions on 404 Not Found', async () => {
    mockFind.mockResolvedValue([sub('https://stale.endpoint/2')]);
    webpush.sendNotification.mockRejectedValue({ statusCode: 404 });

    await sendPushToUser(userId, payload);

    expect(mockDeleteMany).toHaveBeenCalledWith({
      endpoint: { $in: ['https://stale.endpoint/2'] },
    });
  });

  it('keeps subscription on non-stale errors (e.g. 500)', async () => {
    mockFind.mockResolvedValue([sub('https://valid.endpoint/1')]);
    webpush.sendNotification.mockRejectedValue({ statusCode: 500 });

    await sendPushToUser(userId, payload);

    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it('configures VAPID details when VAPID_PUBLIC_KEY is set', async () => {
    const savedPub = process.env.VAPID_PUBLIC_KEY;
    const savedPriv = process.env.VAPID_PRIVATE_KEY;
    process.env.VAPID_PUBLIC_KEY = 'test-pub-key';
    process.env.VAPID_PRIVATE_KEY = 'test-priv-key';
    mockFind.mockResolvedValue([]);

    await sendPushToUser(userId, payload);

    expect(webpush.setVapidDetails).toHaveBeenCalledWith(
      expect.any(String),
      'test-pub-key',
      'test-priv-key'
    );

    if (savedPub === undefined) delete process.env.VAPID_PUBLIC_KEY;
    else process.env.VAPID_PUBLIC_KEY = savedPub;
    if (savedPriv === undefined) delete process.env.VAPID_PRIVATE_KEY;
    else process.env.VAPID_PRIVATE_KEY = savedPriv;
  });

  it('sends partial batch — removes stale, keeps valid', async () => {
    mockFind.mockResolvedValue([
      sub('https://valid.endpoint/ok'),
      sub('https://stale.endpoint/gone'),
    ]);
    webpush.sendNotification
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ statusCode: 410 });

    await sendPushToUser(userId, payload);

    expect(mockDeleteMany).toHaveBeenCalledWith({
      endpoint: { $in: ['https://stale.endpoint/gone'] },
    });
  });
});
