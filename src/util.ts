import { isError } from "catch-unknown";
import { ClientError } from "graphql-request";
import { SubscriptionEventsBatch } from "./SubscriptionEventsBatch.js";

export function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v != null;
}

export function isNodeError(v: unknown): v is Error & { code: string } {
  return isError(v) && isObject(v) && typeof v.code === "string";
}

export function isSubscriptionEventsBatch(
  v: unknown
): v is SubscriptionEventsBatch {
  return isObject(v) && v.__typename === "SubscriptionEventsBatch";
}

const MaximumErrorStringLength = 1024;

// Truncate long strings containing the GraphQL query because they can
// cause the underlying error message to scroll out of the terminal.
export function truncateError(err: unknown): unknown {
  if (isError(err)) {
    if (err.message.length > MaximumErrorStringLength) {
      err.message =
        err.message.substring(0, MaximumErrorStringLength) +
        `... (total length ${err.message.length})`;
    }
    if (err.stack && err.stack.length > MaximumErrorStringLength) {
      err.stack =
        err.stack.substring(0, MaximumErrorStringLength) +
        `... (total length ${err.stack.length})`;
    }
  }
  if (err instanceof ClientError) {
    const { query } = err.request;
    if (typeof query === "string" && query.length > MaximumErrorStringLength) {
      err.request.query =
        query.substring(0, MaximumErrorStringLength) +
        `... (total length ${query.length})`;
    }
  }
  return err;
}
