import { resolve } from 'node:path';
import { createPaperloomServer } from './create-server.mjs';

const dataDir = resolve(process.env.PAPERLOOM_DATA_DIR || 'data');
let app;
try {
  app = await createPaperloomServer({
    dataDir,
    port: Number(process.env.PAPERLOOM_PORT || 3000),
    crossref: process.env.PAPERLOOM_CROSSREF !== 'off',
  });
  const origin = await app.start();
  console.log(
    `\nPaperloom\n${origin}\n\nLocal single-user mode. PDFs and notes are stored in the configured data directory.\nPress Ctrl+C to stop.\n`,
  );
} catch (error) {
  if (app) await app.close();
  console.error(
    error.code === 'EADDRINUSE'
      ? 'Port is already in use. Set PAPERLOOM_PORT to another port.'
      : 'Paperloom could not start: ' + error.message,
  );
  process.exitCode = 1;
}
let closing = false;
for (const name of ['SIGINT', 'SIGTERM'])
  process.on(name, async () => {
    if (closing) return;
    closing = true;
    try {
      await app?.close();
    } finally {
      process.exit(0);
    }
  });
