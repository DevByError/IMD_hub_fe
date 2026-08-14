const { createServer } = require('http');
const https = require('https');
const next = require('next');

const app = next({ dev: false });
const handle = app.getRequestHandler();

// The backend is a separate Plesk Node.js app on api.imd.studylincoln.com.
// That subdomain has no public DNS record on this hosting account, and this
// Plesk subscription doesn't expose "Additional nginx/Apache directives" to
// proxy /api/* at the web-server level. So this custom server proxies it
// itself: it opens a connection to the loopback address (127.0.0.1 always
// resolves — it's not a DNS name) with the TLS SNI and Host header both set
// to api.imd.studylincoln.com, so the box's own web server dispatches the
// request to the right vhost/app, exactly like a normal external request
// would — just without needing public DNS for that subdomain.
const BACKEND_HOST = 'api.imd.studylincoln.com';

function proxyToBackend(req, res) {
    const proxyReq = https.request(
        {
            hostname: '127.0.0.1',
            port: 443,
            path: req.url,
            method: req.method,
            headers: { ...req.headers, host: BACKEND_HOST },
            servername: BACKEND_HOST, // TLS SNI override — picks the right vhost/cert
        },
        (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
        }
    );

    proxyReq.on('error', (err) => {
        console.error('API proxy error:', err);
        if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'BadGateway', message: 'Could not reach the backend.' }));
    });

    req.pipe(proxyReq, { end: true });
}

app.prepare().then(() => {
    createServer((req, res) => {
        if (req.url.startsWith('/api/')) {
            proxyToBackend(req, res);
        } else {
            handle(req, res);
        }
    }).listen(process.env.PORT || 3000, () => {
        console.log('Frontend ready on port', process.env.PORT || 3000);
    });
});
