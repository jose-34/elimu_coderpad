const { z } = require('zod');

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum(['admin', 'interviewer']).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const createInterviewSchema = z.object({
  candidateName: z.string().min(1).max(255),
  candidateEmail: z.string().email(),
  scheduledAt: z.string().datetime().optional(),
  language: z.enum(['python', 'javascript', 'html']).optional(),
});

const scoreQuestionSchema = z.object({
  score: z.number().int().min(0).max(4),
  notes: z.string().max(5000).optional(),
});

const finalAssessmentSchema = z.object({
  redFlags: z.boolean().optional(),
  strengths: z.string().max(5000).optional(),
  concerns: z.string().max(5000).optional(),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  createInterviewSchema,
  scoreQuestionSchema,
  finalAssessmentSchema,
};
