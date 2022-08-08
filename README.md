# LoanCrate Data Synchronization Example

## Overview

This Typescript/Node.js application performs one-way data synchronization from LoanCrate to a local set of loans stored as JSON files under `data/loans`.
It registers a webhook via the LoanCrate API to be notified of data change events.
On the first run, it downloads all the existing loans in creation order (up to a configurable limit) before accepting events.
Subsequent loan creations, deletions, and updates occur based on received webhook events.
These events are also written as JSON files under `data/events`, so you can inspect them.

## Setup

### Install Node.js

The application requires Node.js 16 or later.
The easiest way to ensure you have a compatible version installed is to use [Node Version Manager (nvm)](https://github.com/nvm-sh/nvm).
Using nvm, you can install the version of Node listed in `.nvmrc` by running `nvm install`.

### Install CMake (optional)

If you want to use PCP, NAT-PMP, or UPnP port mapping to test TLS mutual authentication from an internal network,
you'll need to [install CMake](https://cmake.org/install/) before installing dependencies.
The easiest way is with a package manager, such as Homebrew on Mac (`brew install cmake`),
Apt on Linux (`apt-get install cmake`), or Chocolatey on Windows (`choco install cmake`).

### Install Dependencies

Install the Node.js libraries the application depends on by running `npm install`.

### Configuration

Copy `.env-sample` to `.env` and set one of the following:

- `LOANCRATE_API_USER_EMAIL` to your LoanCrate account email address.
  This will open a browser to obtain an access token and refresh token via OAuth on the first run.
  You can close the browser window once the tokens have been obtained.
  The tokens are stored in `data/status.json` and updated as necessary for future runs.
- `LOANCRATE_API_ACCESS_TOKEN` to a valid LoanCrate access token.
  You can obtain an access token from the LoanCrate web UI using a tool like the Chrome Inspector.
  On the Application tab, copy the value of `AuthToken` from Local Storage.
  Note that unless you also set `LOANCRATE_API_REFRESH_TOKEN`, the client will no longer
  be able to fetch from the API after the access token expires (within 12 hours).
  For this reason, we recommend using the OAuth approach above.

The following configuration settings are also available in `.env`:

- `ALLOW_UNAUTHENTICATED_CLIENT` (default: `true`): Whether to allow unauthenticated clients to access the webhook endpoint.
  Note that setting this to false requires either a public host name and port or NAT port mapping.
  TLS client authentication via ngrok is not currently supported because TLS tunnels and custom domains require a paid ngrok subscription.
- `CLIENT_ALLOWED_ALT_NAMES`: A comma-separated list of subject alternative names (SANs) to accept in an authenticated client certificate.
- `CLIENT_CA_CERTIFICATE_PATH`: Path to a certificate authority (CA) certificate bundle used to validate client certificates.
- `DATA_DIRECTORY` (default: `data`): Directory under which to store synchronized JSON files.
- `DELETE_WEBHOOK_ON_EXIT` (default: `true`): Whether to delete the synchronization webhook when the application exits.
  Note that deleting the webhook will cause any subsequent updates to be lost, and the application will need to perform initial
  synchronization on the next run. This behavior is useful for testing. For production use, the webhook should remain active.
- `LOAN_IMPORT_LIMIT`: Maximum number of loans to import on initial synchronization.
  Useful for testing when an organization has a large number of loans and you don't want to fetch them all upfront.
- `LOANCRATE_API_ACCESS_TOKEN`: LoanCrate API access/bearer token used to authenticated to the API.
- `LOANCRATE_API_REFRESH_TOKEN`: LoanCrate API refresh token used to obtain a new access token when the current one expires.
- `LOANCRATE_API_URL`: LoanCrate API base URL, which varies based on the target environment, such as production or staging.
- `LOANCRATE_API_USER_EMAIL`: LoanCrate user account email address used to authenticate via OAuth.
- `LOG_LEVEL` (default: `info`): Diagnostic [logging level](https://github.com/pinojs/pino/blob/master/docs/api.md#level-string).
- `NGROK_AUTH_TOKEN`: Optional [ngrok authtoken](https://ngrok.com/docs/secure-tunnels#tunnel-authtokens) allowing access to additional ngrok features.
- `PUBLIC_HOST_NAME`: Host name to use when registering the webhook. If not set, the behavior depends on other settings:
  - If unauthenticated clients are allowed, ngrok is used if enabled.
  - If client authentication is required, port mapping is used if enabled.
  - If neither ngrok or port mapping are available, `localhost` is used.
- `PUBLIC_PORT`: Port number to use when registering the webhook. This defaults to the local listening port.
- `SERVER_CA_CERTIFICATE_PATH`: Path to a certificate authority (CA) certificate bundle that the LoanCrate API should use to authenticate the webhook HTTPS server.
- `SERVER_CERTIFICATE_PATH`: Path to the TLS certificate to use for the webhook HTTPS server.
- `SERVER_KEY_PATH`: Path to the TLS certificate private key to use for the webhook HTTPS server.
- `USE_NGROK` (default: `auto`): Whether to use [ngrok](https://ngrok.com/) for tunneling to the webhook server.
  Note that TLS client authentication is not supported via ngrok.
- `USE_PORT_MAPPING` (default: `auto`): Whether to use PCP, NAT-PMP, or UPnP port mapping to test TLS mutual authentication from an internal network.
  Note that this requires your internet gateway to support one of those protocols and requires that CMake was installed before installing dependencies.
- `WEBHOOK_PORT`: Local port number to listen on for webhook events. If not specified, an ephemeral port number is chosen.

### Running

Start the application by running `npm start`. It will continue syncing until you terminate it (such as by pressing Ctrl-C).
Note that the webhook subscription is left active, so it will continue to accumulate events.
Running the application again will resume receiving events from where it left off.

## License

This example is available under the [ISC license](LICENSE).
