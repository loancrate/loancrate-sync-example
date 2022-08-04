import { gql } from "graphql-request";
import { ApiClient } from "./ApiClient";

export interface CreateWebhookSubscriptionInput {
  webhookId: string;
  scopeType?: string;
  scopeId?: string;
  eventTypes?: string[];
}

export interface CreateWebhookSubscriptionOutput {
  createWebhookSubscription: {
    webhookSubscription: {
      id: string;
    };
  };
}

const CreateWebhookSubscriptionQuery = gql`
  mutation CreateWebhookSubscription($input: CreateWebhookSubscriptionInput!) {
    createWebhookSubscription(input: $input) {
      webhookSubscription {
        id
      }
    }
  }
`;

export async function createWebhookSubscription(
  client: ApiClient,
  input: CreateWebhookSubscriptionInput
): Promise<CreateWebhookSubscriptionOutput> {
  return await client.request<CreateWebhookSubscriptionOutput>(
    CreateWebhookSubscriptionQuery,
    {
      input,
    }
  );
}
