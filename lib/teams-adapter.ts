import type {
  HttpMethod,
  HttpRouteHandler,
  IHttpServerAdapter,
} from "@microsoft/teams.apps";

/**
 * Bridges the Teams SDK onto Next.js route handlers.
 *
 * The SDK normally owns a long-lived HTTP server (see ExpressAdapter), which
 * doesn't exist under Next.js route handlers on Vercel. IHttpServerAdapter is
 * the supported seam for this: IHttpServer keeps the Teams protocol logic —
 * crucially including inbound JWT validation — and delegates only wire
 * concerns here. `start()` and `serveStatic()` are optional in the interface,
 * so a serverless adapter just needs to capture the registered handler and
 * hand it to our own route.
 *
 * Do NOT bypass this by calling `app.process()` from a route: that takes an
 * already-validated IToken and performs no signature verification, which would
 * reproduce the forgeable-approval hole the Slack endpoint has today.
 */
export class NextAdapter implements IHttpServerAdapter {
  private readonly routes = new Map<string, HttpRouteHandler>();

  registerRoute(method: HttpMethod, path: string, handler: HttpRouteHandler) {
    this.routes.set(`${method} ${path}`, handler);
  }

  /**
   * The messaging handler the SDK registered. Returns undefined until
   * `App.initialize()` has run.
   */
  getHandler(path = "/api/messages", method: HttpMethod = "POST") {
    return this.routes.get(`${method} ${path}`);
  }

  /** Registered routes, for debugging which paths the SDK claimed. */
  get registeredRoutes(): string[] {
    return [...this.routes.keys()];
  }

  // start() / stop() / serveStatic() are intentionally not implemented:
  // there is no server to listen on, and tabs/static assets are served by
  // Next.js itself.
}
