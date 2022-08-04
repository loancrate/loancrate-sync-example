const {
  ALLOW_UNAUTHENTICATED_CLIENT = "true",
  CLIENT_ALLOWED_ALT_NAMES = "DNS:loancrate.dev",
  DATA_DIRECTORY = "data",
  LOANCRATE_API_ACCESS_TOKEN,
  LOANCRATE_API_REFRESH_TOKEN,
  LOANCRATE_API_USER_EMAIL,
  LOAN_IMPORT_LIMIT,
  LOG_LEVEL = "info",
  NGROK_AUTH_TOKEN,
  PUBLIC_HOST_NAME,
  SERVER_CA_CERTIFICATE_PATH,
  SERVER_CERTIFICATE_PATH,
  SERVER_KEY_PATH,
  USE_NGROK = "auto",
  WEBHOOK_PORT = "8000",
} = process.env;

export class Configuration {
  allowUnauthenticatedClient: boolean;
  clientAllowedAltNames: Set<string>;
  dataDirectory: string;
  loancrateApiUrl: string;
  loancrateApiAccessToken: string | undefined;
  loancrateApiRefreshToken: string | undefined;
  loancrateApiUserEmail: string | undefined;
  loanImportLimit: number | undefined;
  logLevel: string;
  ngrokAuthToken: string | undefined;
  publicHostName: string | undefined;
  serverCaCertificatePath: string | undefined;
  serverCertificatePath: string | undefined;
  serverKeyPath: string | undefined;
  useNgrok: boolean;
  webhookPort: number;

  constructor() {
    this.allowUnauthenticatedClient = parseBoolean(
      ALLOW_UNAUTHENTICATED_CLIENT
    );
    this.clientAllowedAltNames = new Set(
      CLIENT_ALLOWED_ALT_NAMES.split(/,\s*/)
    );
    this.dataDirectory = DATA_DIRECTORY;
    this.loancrateApiUrl = required("LOANCRATE_API_URL");
    this.loancrateApiAccessToken = LOANCRATE_API_ACCESS_TOKEN;
    this.loancrateApiRefreshToken = LOANCRATE_API_REFRESH_TOKEN;
    this.loancrateApiUserEmail = LOANCRATE_API_USER_EMAIL;
    this.loanImportLimit = LOAN_IMPORT_LIMIT
      ? parseInt(LOAN_IMPORT_LIMIT)
      : undefined;
    this.logLevel = LOG_LEVEL;
    this.ngrokAuthToken = NGROK_AUTH_TOKEN;
    this.publicHostName = PUBLIC_HOST_NAME;
    this.serverCaCertificatePath = SERVER_CA_CERTIFICATE_PATH;
    this.serverCertificatePath = SERVER_CERTIFICATE_PATH;
    this.serverKeyPath = SERVER_KEY_PATH;
    this.useNgrok =
      USE_NGROK === "auto" ? !PUBLIC_HOST_NAME : parseBoolean(USE_NGROK);
    this.webhookPort = parseInt(WEBHOOK_PORT);
  }
}

export const configuration = new Configuration();

function parseBoolean(s: string | undefined): boolean {
  return s === "1" || s === "true";
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value;
}
