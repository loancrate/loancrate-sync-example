export interface Loan {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface LoanEdge {
  cursor: string;
  node: Loan;
}

export interface PageInfo {
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

export interface LoansOutput {
  loans: {
    edges: LoanEdge[];
    pageInfo: PageInfo;
    totalCount: number;
  };
}
