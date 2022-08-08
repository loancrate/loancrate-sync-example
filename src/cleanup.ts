import { logger } from "./logger.js";

export type CleanupHandler = () => void | Promise<void>;

let cleanupHandlers: Array<CleanupHandler> | undefined;

export function addCleanupHandler(handler: CleanupHandler): void {
  if (!cleanupHandlers) {
    installCleanupHandlers();
    cleanupHandlers = [];
  }
  cleanupHandlers.push(handler);
}

function signalHandler(signal: NodeJS.Signals) {
  logger.info(`Exiting on signal ${signal}`);
  if (cleanupHandlers) {
    const promises: Promise<void>[] = [];
    for (const handler of cleanupHandlers) {
      const promise = handler();
      if (promise) promises.push(promise);
    }
    Promise.all(promises)
      .then(() => {
        process.kill(process.pid, signal);
      })
      .catch((err) => {
        logger.error(err, "Unhandled error during cleanup");
        process.kill(process.pid, signal);
      });
  }
}

function installCleanupHandlers() {
  const exitSignals: NodeJS.Signals[] = [
    "SIGTERM",
    "SIGINT",
    "SIGQUIT",
    "SIGUSR2",
  ];
  exitSignals.forEach((signal) => process.once(signal, signalHandler));
}
