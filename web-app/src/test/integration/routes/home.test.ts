import supertest from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';
import homeRouter from '../../../routes/home';

const app = express();
app.use(bodyParser.json());
app.use('/', homeRouter);

describe('Home Routes', () => {
  it('should redirect to /account/login on GET /', async () => {
    const response = await supertest(app).get('/');
    expect(response.status).toBe(302);
    expect(response.header.location).toBe('/account/login');
  });

  it('should return Privacy Policy Coming Soon on GET /privacy-policy', async () => {
    const response = await supertest(app).get('/privacy-policy');
    expect(response.status).toBe(200);
    expect(response.text).toBe('Privacy Policy Coming Soon');
  });

  it('should return Terms and Conditions Coming Soon on GET /terms', async () => {
    const response = await supertest(app).get('/terms');
    expect(response.status).toBe(200);
    expect(response.text).toBe('Terms and Conditions Coming Soon');
  });
});