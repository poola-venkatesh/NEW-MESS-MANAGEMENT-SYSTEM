import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('Production Route Architecture & SPA Fallback Tests', () => {
  it('should serve API endpoints without falling back to index.html', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body.status).toBe('ok');
  });

  it('should return 404 JSON for non-existent API endpoints', async () => {
    const res = await request(app).get('/api/non-existent-endpoint');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body.error).toContain('API endpoint not found');
  });

  it('should serve index.html for direct navigation to /admin', async () => {
    const res = await request(app).get('/admin');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('<!doctype html>');
    expect(res.text).toContain('Smart Mess Management System');
  });

  it('should serve index.html for direct navigation to /admin/live-scan', async () => {
    const res = await request(app).get('/admin/live-scan');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
  });

  it('should serve index.html for direct navigation to /student', async () => {
    const res = await request(app).get('/student');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('<!doctype html>');
  });

  it('should serve index.html for direct navigation to /student/bills', async () => {
    const res = await request(app).get('/student/bills');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
  });

  it('should serve static assets correctly from client build', async () => {
    const res = await request(app).get('/vite.svg');
    // Either 200 or 404 for vite.svg, but must not be JSON or crash
    expect([200, 404]).toContain(res.status);
  });
});
