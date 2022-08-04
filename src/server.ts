import { X509Certificate } from "crypto";
import express from "express";
import { readFile } from "fs/promises";
import { createServer as createHttpServer, Server } from "http";
import { createServer as createHttpsServer } from "https";
import { configuration } from "./Configuration.js";
import { logger } from "./logger.js";

export async function startServer(): Promise<{
  app: express.Express;
  protocol: string;
  host: string;
  port: number;
  url: string;
}> {
  const app = express();

  app.use(express.json());

  app.get("/", (_req, res) => {
    res.sendStatus(200);
  });

  let protocol: string;
  let server: Server;
  const {
    clientCaCertificatePath,
    serverCertificatePath,
    serverKeyPath,
    useNgrok,
  } = configuration;
  if (serverCertificatePath && serverKeyPath && !useNgrok) {
    const ca =
      clientCaCertificatePath && (await readFile(clientCaCertificatePath));
    if (ca) {
      const x509 = new X509Certificate(ca);
      const { subject, validFrom, validTo, fingerprint256 } = x509;
      const cn = subject.replace(/^.*\bCN=/s, "");
      logger.info(
        { subject, validFrom, validTo, fingerprint256 },
        `Loaded client CA certificate for ${cn}`
      );
    }

    const cert = await readFile(serverCertificatePath);
    const key = await readFile(serverKeyPath);

    const x509 = new X509Certificate(cert);
    const { subject, subjectAltName, validFrom, validTo, fingerprint256 } =
      x509;
    logger.info(
      { subject, subjectAltName, validFrom, validTo, fingerprint256 },
      `Loaded certificate and key for ${subjectAltName || subject}`
    );

    protocol = "https";
    server = createHttpsServer(
      {
        ca,
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
        const host =
          address === "::"
            ? "localhost"
            : address.includes(":")
            ? `[${address}]`
            : address;
        const url = `${protocol}://${host}:${port}`;
        logger.info(`Webhook server listening on ${url}`);
        resolve({ app, protocol, host, port, url });
      } else {
        reject(new Error(`Invalid server address: ${addr ?? "null"}`));
      }
    });
  });
}
