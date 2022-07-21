import { gql, GraphQLClient } from "graphql-request";

export interface CreateWebhookInput {
  url: string;
}

export interface CreateWebhookOutput {
  createWebhook: {
    webhook: {
      id: string;
    };
  };
}

const CreateWebhookQuery = gql`
  mutation CreateWebhook($input: CreateWebhookInput!) {
    createWebhook(input: $input) {
      webhook {
        id
      }
    }
  }
`;

export async function createWebhook(
  client: GraphQLClient,
  input?: CreateWebhookInput
): Promise<CreateWebhookOutput> {
  return await client.request<CreateWebhookOutput>(CreateWebhookQuery, {
    input,
  });
}
