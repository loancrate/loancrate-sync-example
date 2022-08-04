import { isError } from "catch-unknown";
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
