import { ApiClient } from "./ApiClient.js";
import { applyFieldChange } from "./applyFieldChange.js";
import { Database } from "./Database.js";
import { Loan } from "./Loan.js";
import { getLoan } from "./LoanQuery.js";
import { logger } from "./logger.js";
import { DataEvent } from "./SubscriptionEventsBatch.js";

export interface LoanChangeContext {
  apiClient: ApiClient;
  loanDatabase: Database<Loan>;
  loanQuery: string;
}

export async function applyLoanChange(
  { apiClient, loanDatabase, loanQuery }: LoanChangeContext,
  event: DataEvent
): Promise<void> {
  const { objectId } = event;
  switch (event.__typename) {
    case "ObjectCreate":
      await loanDatabase.write(objectId, event.value as unknown as Loan);
      break;
    case "ObjectDelete":
      await loanDatabase.delete(objectId);
      break;
    case "ObjectUpdate": {
      let loan = await loanDatabase.read(objectId);
      if (loan != null) {
        if (event.objectVersion != null) {
          if (loan.version === event.objectVersion) {
            try {
              for (const change of event.fieldChanges) {
                applyFieldChange(change, loan);
              }
              ++loan.version;
              loan.updatedAt = new Date(event.objectNowUpdatedAt).toISOString();
            } catch (err) {
              logger.warn(
                { err, loanId: objectId },
                "Failed to apply update to loan; refetching entire loan"
              );
              loan = (await getLoan(apiClient, loanQuery, objectId)).Loan;
            }
            await loanDatabase.write(objectId, loan);
          } else if (loan.version < event.objectVersion) {
            loan = (await getLoan(apiClient, loanQuery, objectId)).Loan;
            await loanDatabase.write(objectId, loan);
          } else {
            // ignore past update
          }
        } else {
          const updatedAt = new Date(loan.updatedAt).getTime();
          if (updatedAt === event.objectWasUpdatedAt) {
            try {
              for (const change of event.fieldChanges) {
                applyFieldChange(change, loan);
              }
              ++loan.version;
              loan.updatedAt = new Date(event.objectNowUpdatedAt).toISOString();
            } catch (err) {
              logger.warn(
                { err, loanId: objectId },
                "Failed to apply update to loan; refetching entire loan"
              );
              loan = (await getLoan(apiClient, loanQuery, objectId)).Loan;
            }
            await loanDatabase.write(objectId, loan);
          } else if (updatedAt < event.objectWasUpdatedAt) {
            loan = (await getLoan(apiClient, loanQuery, objectId)).Loan;
            await loanDatabase.write(objectId, loan);
          } else {
            // ignore past update
          }
        }
      } else {
        loan = (await getLoan(apiClient, loanQuery, objectId)).Loan;
        await loanDatabase.write(objectId, loan);
      }
      break;
    }
  }
}
