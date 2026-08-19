const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const questions = await prisma.question.findMany({ orderBy: { sortOrder: 'asc' } });
  res.json({ questions });
});

module.exports = { list };
