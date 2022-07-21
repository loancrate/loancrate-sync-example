import { gql, GraphQLClient } from "graphql-request";

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
  client: GraphQLClient,
  input: CreateWebhookSubscriptionInput
): Promise<CreateWebhookSubscriptionOutput> {
  return await client.request<CreateWebhookSubscriptionOutput>(
    CreateWebhookSubscriptionQuery,
    {
      input,
    }
  );
}
