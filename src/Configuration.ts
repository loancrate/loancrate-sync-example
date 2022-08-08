const {
  ALLOW_UNAUTHENTICATED_CLIENT = "true",
  CLIENT_ALLOWED_ALT_NAMES,
  CLIENT_CA_CERTIFICATE_PATH,
  DATA_DIRECTORY = "data",
  DELETE_WEBHOOK_ON_EXIT = "true",
  LOANCRATE_API_ACCESS_TOKEN,
  LOANCRATE_API_REFRESH_TOKEN,
  LOANCRATE_API_USER_EMAIL,
  LOG_LEVEL = "info",
  NGROK_AUTH_TOKEN,
  PUBLIC_HOST_NAME,
  SERVER_CA_CERTIFICATE_PATH,
  SERVER_CERTIFICATE_PATH,
  SERVER_KEY_PATH,
  USE_NGROK = "auto",
  USE_PORT_MAPPING = "auto",
} = process.env;

export class Configuration {
  allowUnauthenticatedClient: boolean;
  clientAllowedAltNames: Set<string>;
  clientCaCertificatePath: string | undefined;
  dataDirectory: string;
  deleteWebhookOnExit: boolean;
  loancrateApiUrl: string;
  loancrateApiAccessToken: string | undefined;
  loancrateApiRefreshToken: string | undefined;
  loancrateApiUserEmail: string | undefined;
  loanImportLimit: number | undefined;
  logLevel: string;
  ngrokAuthToken: string | undefined;
  publicHostName: string | undefined;
  publicPort: number | undefined;
  serverCaCertificatePath: string | undefined;
  serverCertificatePath: string | undefined;
  serverKeyPath: string | undefined;
  useNgrok: boolean;
  usePortMapping: boolean;
  webhookPort: number | undefined;

  constructor() {
    this.allowUnauthenticatedClient = parseBoolean(
      ALLOW_UNAUTHENTICATED_CLIENT
    );
    this.clientAllowedAltNames = new Set(
      CLIENT_ALLOWED_ALT_NAMES ? CLIENT_ALLOWED_ALT_NAMES.split(/,\s*/) : []
    );
    this.clientCaCertificatePath = CLIENT_CA_CERTIFICATE_PATH;
    this.dataDirectory = DATA_DIRECTORY;
    this.deleteWebhookOnExit = parseBoolean(DELETE_WEBHOOK_ON_EXIT);
    this.loancrateApiUrl = required("LOANCRATE_API_URL");
    this.loancrateApiAccessToken = LOANCRATE_API_ACCESS_TOKEN;
    this.loancrateApiRefreshToken = LOANCRATE_API_REFRESH_TOKEN;
    this.loancrateApiUserEmail = LOANCRATE_API_USER_EMAIL;
    this.loanImportLimit = parseOptionalInt("LOAN_IMPORT_LIMIT");
    this.logLevel = LOG_LEVEL;
    this.ngrokAuthToken = NGROK_AUTH_TOKEN;
    this.publicHostName = PUBLIC_HOST_NAME;
    this.publicPort = parseOptionalInt("PUBLIC_PORT");
    this.serverCaCertificatePath = SERVER_CA_CERTIFICATE_PATH;
    this.serverCertificatePath = SERVER_CERTIFICATE_PATH;
    this.serverKeyPath = SERVER_KEY_PATH;
    // By default, use ngrok if we don't have public host name but allow unauthenticated clients
    this.useNgrok =
      USE_NGROK === "auto"
        ? this.allowUnauthenticatedClient && !PUBLIC_HOST_NAME
        : parseBoolean(USE_NGROK);
    // By default, use port mapping if we don't have public host name and don't allow unauthenticated clients
    this.usePortMapping =
      USE_PORT_MAPPING === "auto"
        ? !this.allowUnauthenticatedClient && !PUBLIC_HOST_NAME
        : parseBoolean(USE_PORT_MAPPING);
    this.webhookPort = parseOptionalInt("WEBHOOK_PORT");
  }
}

export const configuration = new Configuration();

function parseBoolean(s: string | undefined): boolean {
  return s === "1" || s === "true";
}

function parseOptionalInt(name: string): number | undefined {
  const value = process.env[name];
  if (value) {
    const i = parseInt(value);
    if (Number.isNaN(i)) {
      throw new Error(
        `Integer value expected for environment variable ${name}`
      );
    }
    return i;
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value;
}
