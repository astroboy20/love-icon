/**
 * Minimal ambient type declarations for Deno globals used in Edge Functions.
 *
 * These cover only what the LoveCoin Edge Functions actually use, so the
 * project TypeScript compiler (Node / Vite) can type-check Edge Function
 * files without the full Deno CLI toolchain installed.
 *
 * The Deno LSP (VS Code extension: denoland.vscode-deno) provides complete
 * types automatically when enabled for this directory via .vscode/settings.json.
 */

declare namespace Deno {
  /** Provides access to process environment variables. */
  const env: {
    /** Returns the value of the environment variable, or undefined. */
    get(key: string): string | undefined;
  };

  /**
   * Starts an HTTP server using the standard Web Fetch API types.
   * The handler receives a Request and must return a Response.
   */
  function serve(handler: (req: Request) => Response | Promise<Response>): void;
  function serve(
    options: { port?: number; hostname?: string },
    handler: (req: Request) => Response | Promise<Response>,
  ): void;
}
