import { gql } from "graphql-request";
import { ApiClient } from "./ApiClient";
import { Loan } from "./Loan";

export interface LoanQueryOutput {
  Loan: Loan;
}

export function makeLoanQuery(selectionSet: string): string {
  return gql`
  query Loan(
    $loanId: ID!
  ) {
    Loan(
      loanId: $loanId
    ) {
      ${selectionSet}
    }
  }
`;
}

export async function getLoan(
  client: ApiClient,
  loanQuery: string,
  loanId: string
): Promise<LoanQueryOutput> {
  return await client.request<LoanQueryOutput>(loanQuery, { loanId });
}
