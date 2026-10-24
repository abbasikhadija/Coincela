import { z } from 'zod';
const email = z.string().trim().toLowerCase().email().max(254);
// Do not trim or normalize passwords: every entered character matters.
const password = z.string().min(12).max(128);
export const registrationSchema = z.object({ email, password, workspaceName: z.string().trim().min(1).max(100) }).strict();
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) }).strict();
export const workspaceSchema = z.object({ name: z.string().trim().min(1).max(100) }).strict();
export const workspaceIdSchema = z.string().uuid();
