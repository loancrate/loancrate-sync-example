import { logger } from "./logger.js";

export type CleanupHandler = () => void | Promise<void>;

let cleanupHandlers: Array<CleanupHandler> | undefined;

export function addCleanupHandler(handler: CleanupHandler): void {
  // Install exit handlers on initial cleanup handler
  if (!cleanupHandlers) {
    installExitHandlers();
    cleanupHandlers = [];
  }

  cleanupHandlers.push(handler);
}

export function exitAfterCleanup(code: number) {
  executeCleanupHandlers()
    .then(() => {
      process.exit(code);
    })
    .catch((err) => {
      logger.error(err, "Unhandled error during cleanup");
      process.exit(code);
    });
}

export function killAfterCleanup(signal: NodeJS.Signals) {
  executeCleanupHandlers()
    .then(() => {
      process.kill(process.pid, signal);
    })
    .catch((err) => {
      logger.error(err, "Unhandled error during cleanup");
      process.kill(process.pid, signal);
    });
}

function executeCleanupHandlers(): Promise<unknown> {
  // Remove exit handlers in case there are additional signals during cleanup
  uninstallExitHandlers();

  const promises: Promise<void>[] = [];
  if (cleanupHandlers) {
    for (const handler of cleanupHandlers) {
      const promise = handler();
      if (promise) promises.push(promise);
    }
  }
  return Promise.all(promises);
}

function beforeExitHandler(code: number) {
  logger.info(`Exiting with code ${code} due to empty event loop`);
  exitAfterCleanup(code);
}

function uncaughtExceptionHandler(error: Error) {
  logger.error(error, "Exiting with code 1 due to uncaught exception");
  exitAfterCleanup(1);
}

function signalHandler(signal: NodeJS.Signals) {
  logger.info(`Exiting due to signal ${signal}`);
  killAfterCleanup(signal);
}

const exitSignals: NodeJS.Signals[] = [
  "SIGTERM",
  "SIGINT",
  "SIGQUIT",
  "SIGUSR2",
];

function installExitHandlers() {
  process.on("beforeExit", beforeExitHandler);
  process.on("uncaughtException", uncaughtExceptionHandler);
  exitSignals.forEach((signal) => process.on(signal, signalHandler));
}

function uninstallExitHandlers() {
  process.removeListener("beforeExit", beforeExitHandler);
  process.removeListener("uncaughtException", uncaughtExceptionHandler);
  exitSignals.forEach((signal) =>
    process.removeListener(signal, signalHandler)
  );
}
