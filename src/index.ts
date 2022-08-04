import asyncHandler from "express-async-handler";
import { readFile } from "fs/promises";
import { isObjectType } from "graphql";
import ngrok from "ngrok";
import open from "open";
import path from "path";
import { TLSSocket } from "tls";
import {
  ApiClient,
  getAuthorizationUrl,
  getOAuthTokens,
  OAuthTokens,
} from "./ApiClient.js";
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
import { isSubscriptionEventsBatch } from "./util.js";
import {
  getWebhookIdFromUrl,
  WebhooksFeedWebhookCertificate,
  WebhooksFeedWebhookSubscription,
} from "./WebhooksFeed.js";

interface SyncStatus {
  synced: boolean;
  accessToken?: string;
  refreshToken?: string;
}

try {
  // Load the status from prior runs, if any
  const statusDatabase = getJsonFileSingletonDatabase<SyncStatus>({
    dataPath: configuration.dataDirectory,
    id: "status",
  });
  const status = (await statusDatabase.read()) || { synced: false };

  // Initialize the loan "database", which is a directory of JSON files and an LRU cache
  const loanDatabase = new JsonFileDatabase<Loan>({
    dataPath: path.join(configuration.dataDirectory, "loans"),
    cacheOptions: { max: 1000 },
  });

  // Start the HTTP(S) server with no endpoints configured yet
  const { app, protocol, host, port } = await startServer();

  // Get LoanCrate API access and refresh tokens from prior run, configuration, or browser
  let accessToken: string;
  let refreshToken: string | undefined;
  if (status.accessToken) {
    logger.info(`Using tokens from prior run`);
    accessToken = status.accessToken;
    refreshToken = status.refreshToken;
  } else if (configuration.loancrateApiAccessToken) {
    logger.info(`Using tokens from configuration`);
    accessToken = configuration.loancrateApiAccessToken;
    refreshToken = configuration.loancrateApiRefreshToken;
  } else if (configuration.loancrateApiUserEmail) {
    // Add an endpoint to the HTTP(S) server to use as the OAuth redirect URI
    const authorizationPromise = new Promise<OAuthTokens>((resolve, reject) => {
      app.get(
        "/oauth",
        asyncHandler(async (req, _res) => {
          const { code } = req.query;
          if (typeof code === "string") {
            resolve(await getOAuthTokens(configuration.loancrateApiUrl, code));
          } else {
            reject(new Error("Invalid authorization code"));
          }
        })
      );
    });

    // Get the SSO authorization URL from the LoanCrate API
    const redirectUrl = `${protocol}://${host}:${port}/oauth`;
    const authorizationUrl = await getAuthorizationUrl(
      configuration.loancrateApiUrl,
      configuration.loancrateApiUserEmail,
      redirectUrl
    );

    logger.info(`Authenticating via browser at ${authorizationUrl}`);
    await open(authorizationUrl);

    ({ accessToken, refreshToken } = await authorizationPromise);
    logger.info("Received OAuth access and refresh tokens");
    status.accessToken = accessToken;
    status.refreshToken = refreshToken;
    await statusDatabase.write(status);
  } else {
    throw new Error(
      "LOANCRATE_API_ACCESS_TOKEN or LOANCRATE_API_USER_EMAIL required"
    );
  }

  // Create the LoanCrate API client, introspect the schema, and build the loan query
  const apiClient = new ApiClient({
    baseUrl: configuration.loancrateApiUrl,
    accessToken,
    refreshToken,
    onTokenUpdate: async (tokens) => {
      logger.info("Saving updated access and refresh tokens");
      Object.assign(status, tokens);
      await statusDatabase.write(status);
    },
  });
  const introspection = await getIntrospection(apiClient);
  const schema = new IntrospectionSchema(introspection);
  const loanType = schema.getNamedType("Loan");
  if (!loanType || !isObjectType(loanType)) {
    throw new Error("Loan type not found in introspection query");
  }
  const loanSelectionSet = selectAllFields(loanType);
  const loanQuery = makeLoanQuery(loanSelectionSet.join(" "));

  // Add the webhook endpoint to the HTTP(S) server
  // (but don't accept events until the initial fetch is complete)
  let acceptEvents = false;
  app.post(
    "/webhook",
    asyncHandler(async (req, res) => {
      const { socket } = req;
      if (socket instanceof TLSSocket && socket.authorized) {
        const altNames = socket
          .getPeerCertificate()
          ?.subjectaltname?.split(/,\s*/);
        if (
          altNames?.some((name) =>
            configuration.clientAllowedAltNames.has(name)
          )
        ) {
          logger.debug({ altNames }, "Client authenticated");
        } else if (!configuration.allowUnauthenticatedClient) {
          res.sendStatus(403);
          return;
        } else {
          logger.warn(
            { altNames },
            "Allowing client with unrecognized certificate"
          );
        }
      } else if (!configuration.allowUnauthenticatedClient) {
        res.sendStatus(401);
        return;
      } else {
        logger.warn("Allowing unauthenticated client");
      }

      if (!acceptEvents) {
        logger.debug("Rejecting events during initial import");
        res.sendStatus(503);
      }

      const body: unknown = req.body;
      if (isSubscriptionEventsBatch(body)) {
        try {
          for (const { subscriptionId, events } of body.subscriptionEvents) {
            const count = events.length;
            logger.info(
              { count, subscriptionId },
              "Applying received data change events"
            );
            for (const event of events) {
              if (
                event.__typename !== "PingEvent" &&
                event.objectType === "Loan"
              ) {
                await applyLoanChange(
                  { apiClient, loanDatabase, loanQuery },
                  event
                );
              }
            }
          }
          res.sendStatus(200);
        } catch (err) {
          logger.error({ err }, "Unhandled exception in webhook");
          res.sendStatus(500);
        }
      } else {
        logger.info({ body }, "Invalid webhook body");
        res.sendStatus(400);
      }
    })
  );

  // Determine the webhook URL to provide to the LoanCrate API
  // based on the configured public host name or a dynamic ngrok tunnel
  let webhookUrl: string;
  let searchUrl: string;
  let searchOperator: FilterOperator;
  const { publicHostName = host, useNgrok } = configuration;
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

  // Create/update the webhook in the LoanCrate API
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

  // Add the CA certificate to the webhook if using HTTPS with a self-signed certificate
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

  // Create a subscription to all object changes in the organization
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

  // If we created a new subscription or haven't synced before,
  // fetch all existing loans (or up to the configured limit)
  if (!existingSubscription || !status.synced) {
    // The API can provide the total loan count, but is currently capped at 1000
    const loanCount = await getFeedTotalCount(apiClient, "LoansFeed");
    const maxLoanCount = 1000;
    const loanCountDisplay =
      loanCount > maxLoanCount ? `>${maxLoanCount}` : String(loanCount);

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

  // Start accepting incremental changes via the webhook, and reset its error
  // count to that it will retry immediately if there were errors previously
  acceptEvents = true;
  logger.info(`Resetting webhook error count`);
  await updateWebhook(apiClient, { id: webhookId, errorCount: 0 });
} catch (err) {
  logger.error(err, "Unhandled exception");
}
