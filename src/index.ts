import { readFile } from "fs/promises";
import { isObjectType } from "graphql";
import ngrok from "ngrok";
import path from "path";
import { getApiClient } from "./ApiClient.js";
import { applyLoanChange } from "./applyObjectChange.js";
import { configuration } from "./Configuration.js";
import { createWebhook } from "./CreateWebhook.js";
import { createWebhookCertificate } from "./CreateWebhookCertificate.js";
import { createWebhookSubscription } from "./CreateWebhookSubscription.js";
import {
  FilterOperator,
  getFeed,
  getFeedTotalCount,
  makeFeedQuery,
} from "./Feed.js";
import { getIntrospection } from "./IntrospectionQuery.js";
import { IntrospectionSchema } from "./IntrospectionSchema.js";
import {
  getJsonFileSingletonDatabase,
  JsonFileDatabase,
} from "./JsonFileDatabase.js";
import { Loan, LoansFeedOutput } from "./Loan.js";
import { makeLoanQuery } from "./LoanQuery.js";
import { logger } from "./logger.js";
import { selectAllFields, selectSubfields } from "./selectField.js";
import { startServer } from "./server.js";
import { updateWebhook } from "./UpdateWebhook.js";
import {
  getWebhookIdFromUrl,
  WebhooksFeedWebhookCertificate,
  WebhooksFeedWebhookSubscription,
} from "./WebhooksFeed.js";

interface SyncStatus {
  synced: boolean;
}

try {
  const statusDatabase = getJsonFileSingletonDatabase<SyncStatus>({
    dataPath: configuration.dataDirectory,
    id: "status",
  });
  const status = (await statusDatabase.read()) || { synced: false };

  const loanDatabase = new JsonFileDatabase<Loan>({
    dataPath: path.join(configuration.dataDirectory, "loans"),
    cacheOptions: { max: 1000 },
  });

  const apiClient = getApiClient();
  const introspection = await getIntrospection(apiClient);
  const schema = new IntrospectionSchema(introspection);
  const loanType = schema.getNamedType("Loan");
  if (!loanType || !isObjectType(loanType)) {
    throw new Error("Loan type not found in introspection query");
  }
  const loanSelectionSet = selectAllFields(loanType);
  const loanQuery = makeLoanQuery(loanSelectionSet.join(" "));

  let acceptEvents = false;
  const { protocol, address, port } = await startServer(async (batch) => {
    if (acceptEvents) {
      for (const { subscriptionId, events } of batch.subscriptionEvents) {
        const count = events.length;
        logger.info(
          { count, subscriptionId },
          "Applying received data change events"
        );
        for (const event of events) {
          if (event.__typename !== "PingEvent" && event.objectType === "Loan") {
            await applyLoanChange(
              { apiClient, loanDatabase, loanQuery },
              event
            );
          }
        }
      }
      return true;
    } else {
      logger.debug("Rejecting events during initial import");
      return false;
    }
  });
  let webhookUrl: string;
  let searchUrl: string;
  let searchOperator: FilterOperator;
  const { publicHostName = address, useNgrok } = configuration;
  if (useNgrok) {
    const ngrokUrl = await ngrok.connect({
      addr: port,
      authtoken: configuration.ngrokAuthToken,
    });
    webhookUrl = `${ngrokUrl}/webhook`;
    searchUrl = "ngrok.io";
    searchOperator = "contains";
  } else {
    webhookUrl = `${protocol}://${publicHostName}:${port}/webhook`;
    searchUrl = webhookUrl;
    searchOperator = "equals";
  }
  logger.info(`Using webhook URL: ${webhookUrl}`);

  const webhook = await getWebhookIdFromUrl(
    apiClient,
    searchUrl,
    searchOperator
  );
  let webhookId: string;
  let certificates: WebhooksFeedWebhookCertificate[];
  let subscriptions: WebhooksFeedWebhookSubscription[];
  if (!webhook) {
    const webhook = await createWebhook(apiClient, { url: webhookUrl });
    webhookId = webhook.createWebhook.webhook.id;
    certificates = [];
    subscriptions = [];
    logger.info(`Created webhook ${webhookId}`);
  } else {
    webhookId = webhook.id;
    certificates = webhook.certificates;
    subscriptions = webhook.subscriptions;
    logger.info(`Found existing webhook ${webhookId}`);

    if (webhook.url !== webhookUrl) {
      logger.info(`Updating webhook URL: ${webhook.url} -> ${webhookUrl}`);
      await updateWebhook(apiClient, { id: webhookId, url: webhookUrl });
    }
  }

  const { serverCaCertificatePath } = configuration;
  if (serverCaCertificatePath) {
    if (!certificates.length) {
      const caCert = await readFile(serverCaCertificatePath);
      const result = await createWebhookCertificate(apiClient, {
        webhookId,
        certificate: caCert.toString(),
      });
      const certificateId =
        result.createWebhookCertificate.webhookCertificate.id;
      logger.info(`Created webhook certificate ${certificateId}`);
    } else {
      const certificateId = certificates[0].id;
      logger.info(`Found existing webhook certificate ${certificateId}`);
    }
  }

  let subscriptionId;
  let existingSubscription;
  if (!subscriptions.length) {
    const result = await createWebhookSubscription(apiClient, {
      webhookId,
      eventTypes: ["Object"],
    });
    subscriptionId = result.createWebhookSubscription.webhookSubscription.id;
    existingSubscription = false;
    logger.info(`Created webhook subscription ${subscriptionId}`);
  } else {
    subscriptionId = subscriptions[0].id;
    existingSubscription = true;
    logger.info(`Found existing webhook subscription ${subscriptionId}`);
  }

  if (!existingSubscription || !status.synced) {
    const loanCount = await getFeedTotalCount(apiClient, "LoansFeed");
    const maxLoanCount = 1000;
    const loanCountDisplay =
      loanCount > maxLoanCount ? ">1000" : String(loanCount);
    const loansFeedQuery = makeFeedQuery(
      "LoansFeed",
      selectSubfields("loans", loanSelectionSet)
    );
    const limit = 10;
    const { loanImportLimit } = configuration;
    logger.info(
      `Performing initial import of ${loanImportLimit ?? "all"} loans`
    );
    for (let offset = 0; ; offset += limit) {
      const endIndex =
        loanCount <= maxLoanCount
          ? Math.min(offset + limit, loanCount)
          : offset + limit;
      logger.info(
        `Fetching loans ${offset + 1}-${endIndex} of ${loanCountDisplay}`
      );
      const output = await getFeed<LoansFeedOutput>(apiClient, loansFeedQuery, {
        limit,
        offset,
        orderBy: [{ fieldKey: "createdAt", sortOrder: "asc" }],
      });
      const { loans } = output.LoansFeed;
      for (const loan of loans) {
        await loanDatabase.write(loan.id, loan);
      }
      const imported = offset + loans.length;
      if (
        loans.length < limit ||
        (loanCount <= maxLoanCount && imported >= loanCount)
      ) {
        break;
      }
      if (loanImportLimit != null && imported >= loanImportLimit) {
        logger.info(`Reached import limit of ${loanImportLimit} loans`);
        break;
      }
    }

    status.synced = true;
    await statusDatabase.write(status);
    logger.info(`Completed initial import of ${await loanDatabase.size} loans`);
  } else {
    const loanCount = await loanDatabase.size;
    logger.info(`Already synced ${loanCount} loans`);
  }

  acceptEvents = true;
  logger.info(`Resetting webhook error count`);
  await updateWebhook(apiClient, { id: webhookId, errorCount: 0 });
} catch (err) {
  logger.error(err);
}
