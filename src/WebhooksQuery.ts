import { gql } from "graphql-request";
import { ApiClient } from "./ApiClient.js";
import { QueryInput, FilterOperator } from "./Query.js";
import { PageInfo } from "./Loan.js";

export interface WebhooksQueryInput extends QueryInput {
  filters?: {
    fieldKey: "url" | "status";
    operator: FilterOperator;
    value: string;
  }[];
}

export interface WebhooksQueryWebhookCertificate {
  id: string;
  fingerprintSha256: string;
}

export interface WebhooksQueryWebhookSubscription {
  id: string;
  status: string;
  scopeType: string;
  scopeId: string;
  eventTypes: string[];
}

export interface Webhook {
  id: string;
  url: string;
  status: string;
  certificates: WebhooksQueryWebhookCertificate[];
  subscriptions: WebhooksQueryWebhookSubscription[];
  errorCount: number | null;
}

interface WebhookNode {
  cursor: string;
  node: Webhook;
}

export interface WebhooksQueryOutput {
  webhooks: {
    edges: WebhookNode[];
    pageInfo: PageInfo;
    totalCount: number;
  };
}

const WebhooksQuery = gql`
  query webhooks(
    $first: Int
    $after: String
    $orderBy: [OrderByInput!]
    $filters: [FilterInput!]
  ) {
    webhooks(
      first: $first
      after: $after
      orderBy: $orderBy
      filters: $filters
    ) {
      edges {
        node {
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
  }
`;

export async function getWebhooksQuery(
  client: ApiClient,
  input?: WebhooksQueryInput
): Promise<WebhooksQueryOutput> {
  return await client.request<WebhooksQueryOutput, WebhooksQueryInput>(
    WebhooksQuery,
    input
  );
}

export async function getWebhookIdFromUrl(
  client: ApiClient,
  url: string,
  operator: FilterOperator = "equals"
): Promise<Webhook> {
  const data = await getWebhooksQuery(client, {
    filters: [
      {
        fieldKey: "url",
        operator,
        value: url,
      },
    ],
  });

  return data.webhooks.edges.map(({ node }) => node)[0];
}
