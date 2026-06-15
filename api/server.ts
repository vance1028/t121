import app from './app.js';
import { waitForDatabase, initializeDatabase } from './db/init.js';
import { seedData } from './db/seed.js';

const PORT = process.env.PORT || 7455;

async function start() {
  try {
    await waitForDatabase();
    await initializeDatabase();
    await seedData();

    const server = app.listen(PORT, () => {
      console.log(`ClinRand server ready on port ${PORT}`);
    });

    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT signal received');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

export default app;
