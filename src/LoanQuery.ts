import { gql, GraphQLClient } from "graphql-request";
import { Loan } from "./Loan";

export interface LoanQueryOutput {
  Loan: Loan;
}

export function makeLoanQuery(selectionSet: string): string {
  return gql`
  query Loan(
    $loanId: ID
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
  client: GraphQLClient,
  loanQuery: string,
  loanId: string
): Promise<LoanQueryOutput> {
  return await client.request<LoanQueryOutput>(loanQuery, { loanId });
}
