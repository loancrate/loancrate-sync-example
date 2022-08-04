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

### Running

Start the application by running `npm start`. It will continue syncing until you terminate it (such as by pressing Ctrl-C).
Note that the webhook subscription is left active, so it will continue to accumulate events.
Running the application again will resume receiving events from where it left off.

## License

This example is available under the [ISC license](LICENSE).
