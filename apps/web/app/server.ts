import { isIP } from 'node:net';
import { getConnInfo } from '@hono/node-server/conninfo';
import { Hono } from 'hono';
import { compress } from 'hono/compress';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { trimTrailingSlash } from 'hono/trailing-slash';
import { createHonoServer } from 'react-router-hono-server/node';

function trusted(address: string | undefined): boolean {
  const ip = (address ?? '').replace(/^::ffff:/, '');
  if (isIP(ip) === 6) return ip === '::1' || /^f[cd]/i.test(ip) || /^fe80:/i.test(ip);

  return /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
}

const app = new Hono({
  strict: true,
  router: new RegExpRouter(),
});
app.use(trimTrailingSlash({ alwaysRedirect: true }));

export default await createHonoServer({
  app,
  beforeAll(server) {
    server.use(compress());
    // Behind a TLS proxy the socket is plain HTTP; give the request the
    // scheme the proxy reports, so React Router's Origin check passes.
    server.use(async (c, next) => {
      const proto = c.req.header('X-Forwarded-Proto')?.split(',')[0]?.trim();
      if (proto === 'https' && c.req.url.startsWith('http:') && trusted(getConnInfo(c).remote.address)) {
        c.req.raw = new Request(c.req.url.replace(/^http:/, 'https:'), c.req.raw);
      }

      await next();
    });
  },
});
