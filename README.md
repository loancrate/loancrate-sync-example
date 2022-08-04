# LoanCrate Data Synchronization Example

## Overview

This application performs one-way data synchronization from LoanCrate to a local set of loans stored as JSON files.
It registers a webhook via the LoanCrate API to be notified of data change events.
On the first run, it downloads all the existing loans in creation order.
Subsequent loan creations, deletions, and updates occur based on received webhook events.

## Setup

### Configuration

Copy `.env-sample` to `.env` and set one of the following:

- `LOANCRATE_API_USER_EMAIL` to your LoanCrate account email address.
  This will open a browser to obtain an access token and refresh token via OAuth.
  You can close the browser window once the tokens have been obtained.
- `LOANCRATE_API_ACCESS_TOKEN` to a valid LoanCrate authorization token.
  You can obtain an authorization token from the web client using a tool like the Chrome Inspector.
  On the Application tab, copy the value of `AuthToken` from Local Storage.
  Note that unless you also set `LOANCRATE_API_REFRESH_TOKEN`, the client will no longer
  be able to fetch from the API after the access token expires (within 12 hours).

### Install Dependencies

```
npm install
```

### Go!

```
npm start
```

## License

This example is available under the [ISC license](LICENSE).
