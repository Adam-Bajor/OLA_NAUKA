'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { exec } = require('node:child_process');

const HOST = '127.0.0.1';
const PORT = 8765;
const ROOT = path.resolve(__dirname);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon',
};

const server = http.createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${HOST}:${PORT}`).pathname);
  } catch {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Nieprawidłowy adres.');
    return;
  }

  const relativePath = pathname.replace(/^\/+/, '') || 'index.html';
  const filePath = path.resolve(ROOT, relativePath);
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Brak dostępu.');
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    const target = !statError && stats.isDirectory() ? path.join(filePath, 'index.html') : filePath;
    fs.readFile(target, (readError, content) => {
      if (readError) {
        const status = readError.code === 'ENOENT' || readError.code === 'EISDIR' ? 404 : 500;
        response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end(status === 404 ? 'Nie znaleziono pliku.' : 'Błąd odczytu pliku.');
        return;
      }

      response.writeHead(200, {
        'Content-Type': TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache',
      });
      if (request.method === 'HEAD') response.end();
      else response.end(content);
    });
  });
});

server.on('error', error => {
  console.error(`Nie można uruchomić serwera: ${error.message}`);
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log(`Lokalny serwer działa: http://${HOST}:${PORT}/`);
  console.log('Zamknij to okno konsoli, aby zatrzymać serwer.');
  if (process.platform === 'win32' && process.argv.includes('--open-browser')) {
    exec(`start "" "http://${HOST}:${PORT}/"`);
  }
});
