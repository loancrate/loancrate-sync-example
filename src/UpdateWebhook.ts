import { gql } from "graphql-request";
import { ApiClient } from "./ApiClient";

export interface UpdateWebhookInput {
  id: string;
  url?: string;
  errorCount?: number;
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
  client: ApiClient,
  input: UpdateWebhookInput
): Promise<UpdateWebhookOutput> {
  return await client.request<UpdateWebhookOutput>(UpdateWebhookQuery, {
    input,
  });
}
