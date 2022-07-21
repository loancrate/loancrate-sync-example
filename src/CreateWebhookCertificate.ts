import { gql, GraphQLClient } from "graphql-request";

export interface CreateWebhookCertificateInput {
  webhookId: string;
  mimeType?: string;
  certificate: string;
}

export interface CreateWebhookCertificateOutput {
  createWebhookCertificate: {
    webhookCertificate: {
      id: string;
    };
  };
}

const CreateWebhookCertificateQuery = gql`
  mutation CreateWebhookCertificate($input: CreateWebhookCertificateInput!) {
    createWebhookCertificate(input: $input) {
      webhookCertificate {
        id
      }
    }
  }
`;

export async function createWebhookCertificate(
  client: GraphQLClient,
  input: CreateWebhookCertificateInput
): Promise<CreateWebhookCertificateOutput> {
  return await client.request<CreateWebhookCertificateOutput>(
    CreateWebhookCertificateQuery,
    {
      input,
    }
  );
}
