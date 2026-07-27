// Minimal ambient declarations for the Deno globals this Edge Function uses, so
// a plain TypeScript editor (VS Code without the Deno extension) doesn't flag
// `Deno` as undefined. This file is only for the editor — at deploy time the
// real Deno runtime provides these. Not part of the Next.js build (tsconfig
// excludes supabase/functions).
declare namespace Deno {
  export const env: { get(key: string): string | undefined };
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}
