import { gql } from "graphql-request";
import { ApiClient } from "./ApiClient.js";
import { FeedInput, FilterOperator } from "./Feed.js";

export interface WebhooksFeedInput extends FeedInput {
  filters?: {
    fieldKey: "url" | "status";
    operator: FilterOperator;
    value: string;
  }[];
}

export interface WebhooksFeedWebhookCertificate {
  id: string;
  fingerprintSha256: string;
}

export interface WebhooksFeedWebhookSubscription {
  id: string;
  status: string;
  scopeType: string;
  scopeId: string;
  eventTypes: string[];
}

export interface WebhooksFeedWebhook {
  id: string;
  url: string;
  status: string;
  certificates: WebhooksFeedWebhookCertificate[];
  subscriptions: WebhooksFeedWebhookSubscription[];
  errorCount: number | null;
}

export interface WebhooksFeedOutput {
  WebhooksFeed: {
    totalCount: number;
    webhooks: WebhooksFeedWebhook[];
  };
}

const WebhooksFeedQuery = gql`
  query WebhooksFeed(
    $limit: Int
    $offset: Int
    $orderBy: [OrderByInput!]
    $filters: [FilterInput!]
  ) {
    WebhooksFeed(
      limit: $limit
      offset: $offset
      orderBy: $orderBy
      filters: $filters
    ) {
      totalCount
      webhooks {
        id
        url
        status
        certificates {
          id
          fingerprintSha256
        }
        subscriptions {
          id
          status
          scopeType
          scopeId
          eventTypes
        }
        errorCount
      }
    }
  }
`;

export async function getWebhooksFeed(
  client: ApiClient,
  input?: WebhooksFeedInput
): Promise<WebhooksFeedOutput> {
  return await client.request<WebhooksFeedOutput, WebhooksFeedInput>(
    WebhooksFeedQuery,
    input
  );
}

export async function getWebhookIdFromUrl(
  client: ApiClient,
  url: string,
  operator: FilterOperator = "equals"
): Promise<WebhooksFeedWebhook | undefined> {
  const data = await getWebhooksFeed(client, {
    filters: [
      {
        fieldKey: "url",
        operator,
        value: url,
      },
    ],
  });
  return data.WebhooksFeed.webhooks[0];
}
