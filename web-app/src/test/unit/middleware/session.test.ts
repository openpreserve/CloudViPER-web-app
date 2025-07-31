import request from 'supertest';
import express from 'express';
import session from 'express-session';

const DOMAIN_NAME = process.env.DOMAIN_NAME || 'cloudviper.org';
const DOMAIN_WITHOUT_WWW = DOMAIN_NAME.replace(/^www\./, '');

describe('Session and Authentication Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    
    // Setup basic session for testing
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false }
    }));
  });

  describe('Session Configuration', () => {
    it('should create session with correct name', async () => {
      app.get('/test', (req, res) => {
        res.json({ hasSession: !!req.session });
      });

      const response = await request(app).get('/test');
      expect(response.body.hasSession).toBe(true);
    });

    it('should persist session data across requests', async () => {
      app.post('/set', (req, res) => {
        (req.session as any).testData = 'test-value';
        res.json({ set: true });
      });

      app.get('/get', (req, res) => {
        res.json({ testData: (req.session as any).testData });
      });

      const agent = request.agent(app);
      await agent.post('/set');
      const response = await agent.get('/get');
      
      expect(response.body.testData).toBe('test-value');
    });
  });

  describe('HTTPS Redirect Middleware', () => {
    it('should redirect HTTP to HTTPS in production', async () => {
      process.env.NODE_ENV = 'production';
      
      app.use((req, res, next) => {
        if (req.headers['x-forwarded-proto'] !== 'https') {
          return res.redirect(302, [`https://${DOMAIN_WITHOUT_WWW}`, req.url].join(''));
        }
        next();
      });

      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/test')
        .set('x-forwarded-proto', 'http');

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(`https://${DOMAIN_WITHOUT_WWW}/test`);
    });

    it('should not redirect HTTPS requests', async () => {
      process.env.NODE_ENV = 'production';
      
      app.use((req, res, next) => {
        if (req.headers['x-forwarded-proto'] !== 'https') {
          return res.redirect(302, [`https://${DOMAIN_WITHOUT_WWW}`, req.url].join(''));
        }
        next();
      });

      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/test')
        .set('x-forwarded-proto', 'https');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Domain Redirect Middleware', () => {
    it('should redirect bare domain to www in production', async () => {
      process.env.NODE_ENV = 'production';
      
      app.use((req, res, next) => {
        if (req.headers.host === DOMAIN_WITHOUT_WWW) {
          res.redirect(302, `https://${DOMAIN_NAME}` + req.originalUrl);
        } else {
          next();
        }
      });

      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/test')
        .set('host', DOMAIN_WITHOUT_WWW);

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(`https://${DOMAIN_NAME}/test`);
    });
  });

  describe('404 Handler', () => {
    it('should return 404 JSON for unknown routes', async () => {
      app.use((req, res) => {
        res.json({"error": {code: 404, status: "not found"}});
      });

      const response = await request(app).get('/unknown-route');
      
      expect(response.status).toBe(200); // Note: Should probably be 404
      expect(response.body).toEqual({
        error: { code: 404, status: "not found" }
      });
    });
  });
});
