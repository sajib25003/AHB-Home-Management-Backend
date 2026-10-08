import app from './app';
import config from './app/config';
import mongoose from 'mongoose';
import type { Server } from 'http';

mongoose.set('sanitizeFilter', true);
mongoose.set('strictQuery', true);

let httpServer: Server | undefined;

const shutdown = async (signal: string) => {
  console.log(`${signal} received. Shutting down gracefully.`);

  if (httpServer) {
    await new Promise<void>((resolve, reject) => {
      httpServer?.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  await mongoose.disconnect();
};

async function server() {
  try {
    await mongoose.connect(config.database_url, {
      serverSelectionTimeoutMS: 10_000,
    });

    httpServer = app.listen(config.port, () => {
      console.log(`AHB API listening on port ${config.port}`);
    });
  } catch (error) {
    console.error('Failed to start the server:', error);
    process.exitCode = 1;
  }
}

void server();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void shutdown(signal)
      .catch((error) => {
        console.error('Graceful shutdown failed:', error);
        process.exitCode = 1;
      })
      .finally(() => process.exit());
  });
}
