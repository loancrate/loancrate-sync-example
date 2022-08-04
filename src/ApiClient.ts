import got from "got";
import { GraphQLClient, RequestDocument } from "graphql-request";

export interface ApiClientConfig {
  baseUrl: string;
  accessToken: string;
  refreshToken?: string;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly client: GraphQLClient;
  private refreshToken?: string;

  public constructor({ baseUrl, accessToken, refreshToken }: ApiClientConfig) {
    this.baseUrl = baseUrl;
    this.client = new GraphQLClient(`${baseUrl}/graphql`, {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    this.refreshToken = refreshToken;
  }

  public async request<T, V = Record<string, unknown>>(
    document: RequestDocument,
    variables?: V
  ): Promise<T> {
    try {
      return await this.client.request(document, variables);
    } catch (err) {
      if (
        err instanceof got.HTTPError &&
        err.code === "401" &&
        this.refreshToken != null
      ) {
        await this.refreshTokens();
        return await this.client.request(document, variables);
      }
      throw err;
    }
  }

  private async refreshTokens(): Promise<void> {
    const { body } = await got.post<RefreshAccessTokenResponse>(
      "workos/refresh-access-token",
      {
        prefixUrl: this.baseUrl,
        json: { refreshToken: this.refreshToken },
      }
    );
    this.client.setHeader("authorization", `Bearer ${body.access_token}`);
    this.refreshToken = body.refresh_token;
  }
}

interface RefreshAccessTokenResponse {
  access_token: string;
  refresh_token: string;
}
