import { X509Certificate } from "crypto";
import express from "express";
import asyncHandler from "express-async-handler";
import { readFile } from "fs/promises";
import { createServer as createHttpServer, Server } from "http";
import { createServer as createHttpsServer } from "https";
import { TLSSocket } from "tls";
import { configuration } from "./Configuration.js";
import { logger } from "./logger.js";
import { SubscriptionEventsBatch } from "./SubscriptionEventsBatch.js";
import { isObject } from "./util.js";

export async function startServer(
  handleEvents: (batch: SubscriptionEventsBatch) => Promise<boolean>
): Promise<{ protocol: string; address: string; port: number; url: string }> {
  const app = express();

  app.use(express.json());

  app.get("/", (_req, res) => {
    res.sendStatus(200);
  });

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

      const body: unknown = req.body;
      if (isSubscriptionEventsBatch(body)) {
        try {
          if (await handleEvents(body)) {
            res.sendStatus(200);
          } else {
            res.sendStatus(503);
          }
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

  let protocol: string;
  let server: Server;
  const { serverCertificatePath, serverKeyPath, useNgrok } = configuration;
  if (serverCertificatePath && serverKeyPath && !useNgrok) {
    const cert = await readFile(serverCertificatePath);
    const key = await readFile(serverKeyPath);

    const x509 = new X509Certificate(cert);
    const { subject, subjectAltName, validFrom, validTo, fingerprint256 } =
      x509;
    logger.info(
      { subjectAltName, validFrom, validTo, fingerprint256 },
      `Loaded certificate and key for ${subjectAltName || subject}`
    );

    protocol = "https";
    server = createHttpsServer(
      {
        cert,
        key,
        requestCert: true,
        rejectUnauthorized: false,
      },
      app
    );
  } else {
    protocol = "http";
    server = createHttpServer(app);
  }

  return new Promise((resolve, reject) => {
    server.listen({ port: configuration.webhookPort }, () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        const { address, port } = addr;
        const url = `${protocol}://[${addr.address}]:${addr.port}`;
        logger.info(`Webhook server listening on ${url}`);
        resolve({ protocol, address, port, url });
      } else {
        reject(new Error(`Invalid server address: ${addr ?? "null"}`));
      }
    });
  });
}

function isSubscriptionEventsBatch(v: unknown): v is SubscriptionEventsBatch {
  return isObject(v) && v.__typename === "SubscriptionEventsBatch";
}
