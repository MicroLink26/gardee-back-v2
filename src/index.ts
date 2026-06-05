import { startServer } from './app';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

startServer(PORT).catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
