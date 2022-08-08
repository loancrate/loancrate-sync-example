import { gql } from "graphql-request";
import { ApiClient } from "./ApiClient";

export interface DeleteWebhookInput {
  id: string;
}

export interface DeleteWebhookOutput {
  deleteWebhook: {
    deleted: boolean;
  };
}

const DeleteWebhookQuery = gql`
  mutation DeleteWebhook($input: DeleteWebhookInput!) {
    deleteWebhook(input: $input) {
      deleted
    }
  }
`;

export async function deleteWebhook(
  client: ApiClient,
  input: DeleteWebhookInput
): Promise<DeleteWebhookOutput> {
  return await client.request<DeleteWebhookOutput>(DeleteWebhookQuery, {
    input,
  });
}
