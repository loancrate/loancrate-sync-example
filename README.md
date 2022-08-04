# LoanCrate Data Synchronization Example

## Overview

This application performs one-way data synchronization from LoanCrate to a local set of loans stored as JSON files.
It registers a webhook via the LoanCrate API to be notified of data change events.
On the first run, it downloads all the existing loans in creation order.
Subsequent loan creations, deletions, and updates occur based on received webhook events.

## Setup

### Configuration

Copy `.env-sample` to `.env` and set `LOANCRATE_API_ACCESS_TOKEN` to your LoanCrate Bearer token.
You can obtain a bearer token from the web client using a tool like the Chrome Inspector.
On the Network tab, find a `graphql` POST request and copy the token from the `authorization` header.

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
