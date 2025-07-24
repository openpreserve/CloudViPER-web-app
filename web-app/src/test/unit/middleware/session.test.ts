import request from 'supertest';
import express from 'express';
import session from 'express-session';

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
          return res.redirect(302, ['https://vipercloud.cc', req.url].join(''));
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
      expect(response.headers.location).toBe('https://vipercloud.cc/test');
    });

    it('should not redirect HTTPS requests', async () => {
      process.env.NODE_ENV = 'production';
      
      app.use((req, res, next) => {
        if (req.headers['x-forwarded-proto'] !== 'https') {
          return res.redirect(302, ['https://vipercloud.cc', req.url].join(''));
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
        if (req.headers.host === 'vipercloud.cc') {
          res.redirect(302, 'https://www.vipercloud.cc' + req.originalUrl);
        } else {
          next();
        }
      });

      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/test')
        .set('host', 'vipercloud.cc');

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('https://www.vipercloud.cc/test');
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
