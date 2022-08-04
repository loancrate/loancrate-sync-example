import got from "got";
import { ClientError, GraphQLClient, RequestDocument } from "graphql-request";
import { isObject } from "./util.js";

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type TokenUpdateCallback = (tokens: OAuthTokens) => Promise<void>;

export interface ApiClientConfig {
  baseUrl: string;
  accessToken: string;
  refreshToken?: string;
  onTokenUpdate?: TokenUpdateCallback;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly client: GraphQLClient;
  private refreshToken?: string;
  private readonly onTokenUpdate?: TokenUpdateCallback;

  public constructor({
    baseUrl,
    accessToken,
    refreshToken,
    onTokenUpdate,
  }: ApiClientConfig) {
    this.baseUrl = baseUrl;
    this.client = new GraphQLClient(`${baseUrl}/graphql`, {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    this.refreshToken = refreshToken;
    this.onTokenUpdate = onTokenUpdate;
  }

  public async request<T, V = Record<string, unknown>>(
    document: RequestDocument,
    variables?: V
  ): Promise<T> {
    try {
      return await this.client.request(document, variables);
    } catch (err) {
      if (isAuthenticationError(err) && this.refreshToken != null) {
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
        responseType: "json",
      }
    );
    this.client.setHeader("authorization", `Bearer ${body.access_token}`);
    this.refreshToken = body.refresh_token;
    if (this.onTokenUpdate) {
      const tokens = {
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
      };
      await this.onTokenUpdate(tokens);
    }
  }
}

function isAuthenticationError(err: unknown): boolean {
  return (
    err instanceof ClientError &&
    err.response.errors?.some(
      (e) => isObject(e.extensions) && e.extensions.code === "UNAUTHENTICATED"
    ) === true
  );
}

interface RefreshAccessTokenResponse {
  access_token: string;
  refresh_token: string;
}

interface WorkOSAuthResponse {
  authorizationURL: string;
}

export async function getAuthorizationUrl(
  baseUrl: string,
  email: string,
  oAuthRedirectUrl: string
): Promise<string> {
  const { body } = await got.get<WorkOSAuthResponse>("workos/auth", {
    prefixUrl: baseUrl,
    searchParams: { email, oAuthRedirectUrl },
    responseType: "json",
  });
  return body.authorizationURL;
}

export async function getOAuthTokens(
  baseUrl: string,
  code: string
): Promise<OAuthTokens> {
  const { body } = await got.get<RefreshAccessTokenResponse>(
    "workos/oauth-token",
    {
      prefixUrl: baseUrl,
      searchParams: { code },
      responseType: "json",
    }
  );
  return { accessToken: body.access_token, refreshToken: body.refresh_token };
}
