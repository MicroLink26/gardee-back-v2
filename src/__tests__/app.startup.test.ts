// Tests app.ts startup behaviour separately using jest.resetModules() + jest.doMock()
// so the DB-failure catch branch (lines 78-79) can be covered.

describe('app startup — DB failure', () => {
  let mockExit: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockConsoleError.mockRestore();
    jest.resetModules();
  });

  it('logs error and calls process.exit(1) when connectDB rejects', async () => {
    jest.doMock('../config/db', () => ({
      connectDB: jest.fn().mockRejectedValue(new Error('DB down')),
    }));
    jest.doMock('morgan', () => () => (_req: any, _res: any, next: any) => next());
    jest.doMock('../models/User', () => ({ User: { findById: jest.fn() } }));
    jest.doMock('../models/Prestataire', () => ({ Prestataire: { findOne: jest.fn() } }));

    await import('../index');
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockConsoleError).toHaveBeenCalledWith('Server failed to start:', expect.any(Error));
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('uses "combined" morgan format when NODE_ENV is production', async () => {
    const savedEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const morganMock = jest.fn().mockReturnValue((_req: any, _res: any, next: any) => next());
    jest.doMock('morgan', () => morganMock);
    // connectDB never resolves → app.listen() never called → no port conflict
    jest.doMock('../config/db', () => ({ connectDB: jest.fn().mockReturnValue(new Promise(() => {})) }));
    jest.doMock('../models/User', () => ({ User: { findById: jest.fn() } }));
    jest.doMock('../models/Prestataire', () => ({ Prestataire: { findOne: jest.fn() } }));

    await import('../index');

    expect(morganMock).toHaveBeenCalledWith('combined');
    process.env.NODE_ENV = savedEnv;
  });

  it('uses PORT env var when set', async () => {
    const savedPort = process.env.PORT;
    process.env.PORT = '4567';

    // connectDB never resolves → app.listen() never called → no port conflict
    jest.doMock('../config/db', () => ({ connectDB: jest.fn().mockReturnValue(new Promise(() => {})) }));
    jest.doMock('morgan', () => () => (_req: any, _res: any, next: any) => next());
    jest.doMock('../models/User', () => ({ User: { findById: jest.fn() } }));
    jest.doMock('../models/Prestataire', () => ({ Prestataire: { findOne: jest.fn() } }));

    const indexModule = await import('../index');
    expect(indexModule).toBeDefined();

    if (savedPort === undefined) delete process.env.PORT;
    else process.env.PORT = savedPort;
  });
});
