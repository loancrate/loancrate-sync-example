import { GraphQLClient } from "graphql-request";
import { configuration } from "./Configuration.js";

export function getApiClient(): GraphQLClient {
  return new GraphQLClient(configuration.loancrateApiUrl, {
    headers: {
      authorization: `Bearer ${configuration.loancrateApiBearerToken}`,
    },
  });
}
