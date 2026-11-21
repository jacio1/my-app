import { z } from "zod";

export const oauthRequestSchema = z.object({
  response_type: z.literal("code"), client_id: z.string().min(1).max(128),
  redirect_uri: z.string().url().max(2048), code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  code_challenge_method: z.literal("S256"), state: z.string().min(1).max(2048),
  scope: z.string().max(100).default("records:read records:write"), resource: z.string().url().optional(),
});
export function validRedirect(value: string, allowedOrigins: string[] = []) {
  try {
    const url = new URL(value);
    if (url.hash || url.username || url.password) return false;
    if (url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) return true;
    return url.protocol === "https:" && ["https://chatgpt.com", "https://chat.openai.com", "https://codex.openai.com", ...allowedOrigins].includes(url.origin);
  } catch { return false; }
}
