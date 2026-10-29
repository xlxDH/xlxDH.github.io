#!/usr/bin/env node
/* ==========================================================================
 * serve.mjs — 零依赖本地静态服务器（只为预览，部署时不需要）
 * ==========================================================================
 *   npm run dev            → http://127.0.0.1:5173
 *   npm run dev -- 8080    → 换端口
 * ========================================================================== */

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const portArg = Number(process.argv[2]);
const PORT = Number.isFinite(portArg) && portArg > 0 ? portArg : 5173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2',
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';

    const target = path.join(ROOT, path.normalize(pathname));

    /* 防止 ../ 穿越 */
    if (!target.startsWith(ROOT)) {
      response.writeHead(403).end('403');
      return;
    }

    const info = await stat(target);
    if (info.isDirectory()) {
      response.writeHead(302, { Location: `${pathname.replace(/\/?$/, '/')}index.html` }).end();
      return;
    }

    response.writeHead(200, {
      'Content-Type': TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Content-Length': info.size,
    });
    createReadStream(target).pipe(response);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 Not Found');
      return;
    }
    response.writeHead(500).end('500');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  终端主页跑起来了：http://127.0.0.1:${PORT}\n  Ctrl+C 停止\n`);
});
