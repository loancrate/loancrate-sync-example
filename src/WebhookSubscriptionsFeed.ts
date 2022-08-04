import { gql } from "graphql-request";
import { ApiClient } from "./ApiClient.js";
import { FeedInput, FilterOperator } from "./Feed.js";

export interface WebhookSubscriptionsFeedInput extends FeedInput {
  filters?: {
    fieldKey: "status" | "scopeType" | "scopeId";
    operator: FilterOperator;
    value: string;
  }[];
}

export interface WebhookSubscriptionsFeedOutput {
  WebhookSubscriptionsFeed: {
    totalCount: number;
    webhookSubscriptions: {
      id: string;
      webhook: { id: string };
      status: string;
      scopeType: string;
      scopeId: string;
      eventTypes: string[];
    }[];
  };
}

const WebhookSubscriptionsFeedQuery = gql`
  query WebhookSubscriptionsFeed(
    $limit: Int
    $offset: Int
    $orderBy: [OrderByInput!]
    $filters: [FilterInput!]
  ) {
    WebhookSubscriptionsFeed(
      limit: $limit
      offset: $offset
      orderBy: $orderBy
      filters: $filters
    ) {
      totalCount
      webhookSubscriptions {
        id
        webhook {
          id
        }
        status
        scopeType
        scopeId
        eventTypes
      }
    }
  }
`;

export async function getWebhookSubscriptionsFeed(
  client: ApiClient,
  input?: WebhookSubscriptionsFeedInput
): Promise<WebhookSubscriptionsFeedOutput> {
  return await client.request<
    WebhookSubscriptionsFeedOutput,
    WebhookSubscriptionsFeedInput
  >(WebhookSubscriptionsFeedQuery, input);
}
