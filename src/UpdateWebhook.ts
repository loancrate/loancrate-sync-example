import { gql, GraphQLClient } from "graphql-request";

export interface UpdateWebhookInput {
  id: string;
  url?: string;
}

export interface UpdateWebhookOutput {
  updateWebhook: {
    webhook: {
      id: string;
    };
  };
}

const UpdateWebhookQuery = gql`
  mutation UpdateWebhook($input: UpdateWebhookInput!) {
    updateWebhook(input: $input) {
      webhook {
        id
      }
    }
  }
`;

export async function updateWebhook(
  client: GraphQLClient,
  input: UpdateWebhookInput
): Promise<UpdateWebhookOutput> {
  return await client.request<UpdateWebhookOutput>(UpdateWebhookQuery, {
    input,
  });
}
