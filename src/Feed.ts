import { gql, GraphQLClient } from "graphql-request";
import { isObject } from "./util.js";

export type FilterOperator = "equals" | "contains";

export interface OrderByInput {
  fieldKey: string;
  sortOrder: "asc" | "desc";
}

export interface FeedInput {
  limit?: number;
  offset?: number;
  orderBy?: OrderByInput[];
}

export function makeFeedQuery(
  feedName: string, // e.g. LoansFeed
  selectionSet: string
): string {
  return gql`
    query ${feedName}($limit: Int, $offset: Int, $orderBy: [OrderByInput!]) {
      ${feedName}(limit: $limit, offset: $offset, orderBy: $orderBy) {
        ${selectionSet}
      }
    }
  `;
}

export async function getFeed<T>(
  client: GraphQLClient,
  feedQuery: string,
  input?: FeedInput
): Promise<T> {
  return await client.request<T>(feedQuery, input);
}

export async function getFeedTotalCount(
  client: GraphQLClient,
  feedName: string
): Promise<number> {
  const result: unknown = await client.request(
    gql`query ${feedName}Count { ${feedName} { totalCount } }`
  );

  if (isObject(result)) {
    const feed = result[feedName];
    if (isObject(feed)) {
      const { totalCount } = feed;
      if (typeof totalCount === "number") {
        return totalCount;
      }
    }
  }
  throw new Error(`Invalid response for ${feedName} total count query`);
}
