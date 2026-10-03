const { prisma, assertTestDatabase, resetDatabase } = require('./helpers');

beforeAll(async () => {
  assertTestDatabase();
  const questions = await prisma.question.count();
  if (questions !== 16) {
    throw new Error(`Expected 16 seeded questions, found ${questions}. Run "npm run prisma:seed".`);
  }
});

beforeEach(resetDatabase);

afterAll(() => prisma.$disconnect());
