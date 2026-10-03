const request = require('supertest');
const prisma = require('../../src/config/prisma');
const { app } = require('../../src/server');

// These tests TRUNCATE tables, so refuse to touch anything that isn't
// clearly a throwaway test database.
function assertTestDatabase() {
  const url = process.env.DATABASE_URL || '';
  const dbName = url.split('?')[0].split('/').pop();
  if (!/_test$/.test(dbName)) {
    throw new Error(
      `Integration tests need a DATABASE_URL whose database name ends in "_test" (got "${dbName}").`,
    );
  }
}

async function resetDatabase() {
  // Questions are seed data the API reads but never writes, so keep them.
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE assessment_responses, assessment_summary, interviews, users CASCADE',
  );
}

let userCounter = 0;

async function registerUser(overrides = {}) {
  userCounter += 1;
  const body = {
    email: `interviewer${userCounter}-${Date.now()}@example.com`,
    password: 'correct-horse-battery',
    firstName: 'Test',
    lastName: `User${userCounter}`,
    ...overrides,
  };
  const res = await request(app).post('/api/v1/auth/register').send(body).expect(201);
  return { ...res.body, password: body.password, auth: `Bearer ${res.body.token}` };
}

async function createInterview(user, overrides = {}) {
  const res = await request(app)
    .post('/api/v1/interviews')
    .set('Authorization', user.auth)
    .send({ candidateName: 'Ada Candidate', candidateEmail: 'ada@example.com', ...overrides })
    .expect(201);
  return res.body;
}

module.exports = { app, prisma, request, assertTestDatabase, resetDatabase, registerUser, createInterview };
