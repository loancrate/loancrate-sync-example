import { addCleanupListener } from "async-cleanup";
import asyncHandler from "express-async-handler";
import { readFile } from "fs/promises";
import { isObjectType } from "graphql";
import ngrok from "ngrok";
// @ts-ignore optional dependency
import { Mapping } from "node-portmapping";
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
import { deleteWebhook } from "./DeleteWebhook.js";
import { getData, getTotalCount, makeQuery } from "./Query.js";
import { getIntrospection } from "./IntrospectionQuery.js";
import { IntrospectionSchema } from "./IntrospectionSchema.js";
import {
  getJsonFileSingletonDatabase,
  JsonFileDatabase,
} from "./JsonFileDatabase.js";
import { Loan, LoansOutput } from "./Loan.js";
import { makeLoanQuery } from "./LoanQuery.js";
import { logger } from "./logger.js";
import { selectAllFields } from "./selectField.js";
import { startServer } from "./server.js";
import { DataEventWithId } from "./SubscriptionEventsBatch.js";
import { updateWebhook } from "./UpdateWebhook.js";
import { isSubscriptionEventsBatch } from "./util.js";
import {
  getWebhookIdFromUrl,
  WebhooksQueryWebhookCertificate,
  WebhooksQueryWebhookSubscription,
} from "./WebhooksQuery.js";

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

  // Write all data events to JSON files for diagnostic use
  const eventsDatabase = new JsonFileDatabase<DataEventWithId>({
    dataPath: path.join(configuration.dataDirectory, "events"),
    cacheOptions: { max: 1 },
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
          logger.info({ altNames }, "Client authenticated");
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
        logger.info("Rejecting unauthenticated client");
        res.sendStatus(401);
        return;
      } else {
        logger.warn("Allowing unauthenticated client");
      }

      if (!acceptEvents) {
        logger.debug("Rejecting events during initial import");
        res.sendStatus(503);
        return;
      }

      const body: unknown = req.body;
      if (isSubscriptionEventsBatch(body)) {
        try {
          for (const { subscriptionId, events } of body.subscriptionEvents) {
            const changes = events.filter(
              (event): event is DataEventWithId =>
                event.__typename !== "PingEvent"
            );

            const count = changes.length;
            if (!count) {
              logger.info({ subscriptionId }, "Received ping event");
              continue;
            }
            logger.info(
              { count, subscriptionId },
              "Applying received data change events"
            );

            for (const event of changes) {
              if (event.objectType === "Loan") {
                await eventsDatabase.write(event.eventId, event);
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
  if (configuration.usePortMapping) {
    logger.info(`Attempting to forward a port using PCP, NAT-PMP, or UPnP`);
    // @ts-ignore optional dependency
    const nodePortMapping = (await import("node-portmapping")).default;
    nodePortMapping.init({ logLevel: "Info" });
    const mapping = await new Promise<Mapping>((resolve) => {
      const mapping = nodePortMapping.createMapping(
        {
          internalPort: port,
          externalPort: configuration.publicPort,
        },
        () => {
          resolve(mapping);
          return {};
        }
      );
    });
    addCleanupListener(() => mapping.destroy());
    const info = mapping.getInfo();
    webhookUrl = `${protocol}://${info.externalHost}:${info.externalPort}/webhook`;
    searchUrl = info.externalHost;
  } else if (configuration.useNgrok) {
    logger.info(`Attempting to open an ngrok tunnel`);
    const ngrokUrl = await ngrok.connect({
      addr: port,
      authtoken: configuration.ngrokAuthToken,
    });
    webhookUrl = `${ngrokUrl}/webhook`;
    searchUrl = "ngrok.io";
  } else {
    const { publicHostName = host, publicPort = port } = configuration;
    webhookUrl = `${protocol}://${publicHostName}:${publicPort}/webhook`;
    searchUrl = publicHostName;
  }
  logger.info(`Using webhook URL: ${webhookUrl}`);

  // Create/update the webhook in the LoanCrate API
  const webhook = await getWebhookIdFromUrl(apiClient, searchUrl, "contains");
  let webhookId: string;
  let certificates: WebhooksQueryWebhookCertificate[];
  let subscriptions: WebhooksQueryWebhookSubscription[];
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

  // For testing purposes only, delete webhook on exit
  if (configuration.deleteWebhookOnExit) {
    addCleanupListener(async () => {
      logger.info(`Deleting webhook ${webhookId}`);
      await deleteWebhook(apiClient, { id: webhookId });
    });
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
    const loanCount = await getTotalCount(apiClient, "loans");
    const maxLoanCount = 1000;

    const loansQuery = makeQuery("loans", loanSelectionSet.join(" "));

    const first = 10;
    const { loanImportLimit } = configuration;
    logger.info(
      `Performing initial import of ${loanImportLimit ?? "all"} loans`
    );
    let after: string | undefined;
    let hasNextPage = true;
    let importedLoansCount = 0;
    while (hasNextPage) {
      const data = await getData<LoansOutput>(
        apiClient,
        loansQuery,
        {
          first,
          after,
          orderBy: [{ fieldKey: "createdAt", sortOrder: "asc" }],
        }
      );
      const {
        loans: { edges, pageInfo },
      } = data;
      const loans = edges.map(({ node }) => node);
      after = pageInfo.endCursor;
      hasNextPage = pageInfo.hasNextPage;
      for (const loan of loans) {
        await loanDatabase.write(loan.id, loan);
      }
      importedLoansCount += loans.length;
      if (
        !hasNextPage ||
        (loanCount <= maxLoanCount && importedLoansCount >= loanCount)
      ) {
        break;
      }
      if (loanImportLimit != null && importedLoansCount >= loanImportLimit) {
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
  process.exit(1);
}
