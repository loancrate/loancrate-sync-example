import { gql } from "graphql-request";
import { ApiClient } from "./ApiClient.js";
import { isObject } from "./util.js";

export type FilterOperator = "equals" | "contains";

export interface OrderByInput {
  fieldKey: string;
  sortOrder: "asc" | "desc";
}

export interface QueryInput {
  first?: number;
  after?: string | null;
  orderBy?: OrderByInput[];
}

export function makeQuery(
  queryName: string, // e.g. loans
  selectionSet: string
): string {
  return gql`
    query ${queryName}($first: Int, $after: String, $orderBy: [OrderByInput!]) {
      ${queryName}(first: $first, after: $after, orderBy: $orderBy) {
        edges {
          node {
            ${selectionSet}
          }
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          startCursor
          endCursor
        }
        totalCount
      }
    }
  `;
}

export async function getData<T>(
  client: ApiClient,
  query: string,
  input?: QueryInput
): Promise<T> {
  return await client.request<T, QueryInput>(query, input);
}

export async function getTotalCount(
  client: ApiClient,
  queryName: string
): Promise<number> {
  const result: unknown = await client.request(
    gql`query ${queryName}Count { ${queryName} { totalCount } }`
  );

  if (isObject(result)) {
    const data = result[queryName];
    if (isObject(data)) {
      const { totalCount } = data;
      if (typeof totalCount === "number") {
        return totalCount;
      }
    }
  }
  throw new Error(`Invalid response for ${queryName} total count query`);
}
