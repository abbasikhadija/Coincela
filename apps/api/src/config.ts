import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().url().refine(value => /^postgres(ql)?:/.test(value)),
  CORS_ORIGINS: z.string().min(1).transform(value => value.split(',').map(origin => origin.trim()))
    .refine(origins => origins.every(origin => {
      try { return new URL(origin).origin === origin && /^https?:/.test(origin); } catch { return false; }
    }), 'Use comma-separated HTTP origins without paths or wildcards'),
}).superRefine((config, ctx) => {
  if (config.NODE_ENV === 'production' && config.CORS_ORIGINS.some(origin => !origin.startsWith('https://'))) {
    ctx.addIssue({ code: 'custom', path: ['CORS_ORIGINS'], message: 'Production origins require HTTPS' });
  }
});
export function readConfig(env: NodeJS.ProcessEnv) {
  const result = schema.safeParse(env);
  if (!result.success) {
    // Field names only: never print supplied connection strings or credentials.
    throw new Error(`Invalid environment: ${[...new Set(result.error.issues.map(issue => issue.path.join('.')))].join(', ')}`);
  }
  return result.data;
}
export type Config = ReturnType<typeof readConfig>;
