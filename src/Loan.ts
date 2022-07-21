export interface Loan {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface LoansFeedOutput {
  LoansFeed: {
    loans: Loan[];
  };
}
