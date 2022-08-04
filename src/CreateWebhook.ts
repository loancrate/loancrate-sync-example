import { gql } from "graphql-request";
import { ApiClient } from "./ApiClient";

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
  client: ApiClient,
  input?: CreateWebhookInput
): Promise<CreateWebhookOutput> {
  return await client.request<CreateWebhookOutput>(CreateWebhookQuery, {
    input,
  });
}
