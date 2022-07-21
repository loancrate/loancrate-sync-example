import pino from "pino";
import { configuration } from "./Configuration.js";

export const logger = pino(
  { level: configuration.logLevel },
  pino.destination({ sync: true })
);
