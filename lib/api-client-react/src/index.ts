/**
 * API client barrel export.
 *
 * Re-exports all generated React Query hooks, fetch functions, and Zod
 * schema types produced by Orval from the OpenAPI spec.  Also exposes
 * helpers for configuring the base URL and auth token getter used by the
 * underlying custom fetch function.
 */

export * from "./generated/api";
export * from "./generated/api.schemas";
export { setBaseUrl, setAuthTokenGetter } from "./custom-fetch";
export type { AuthTokenGetter } from "./custom-fetch";
