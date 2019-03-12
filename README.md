# Form Builder User File Store client (Node)

Client for making requests to Form Builder platform user filestore endpoints

## Requirements

Node

## Installation

`npm install @ministryofjustice/fb-user-filestore-client-node`

## Usage

### Loading and initialising

``` javascript
// load client
const FBUserFileStoreClient = require('@ministryofjustice/fb-user-filestore-client-node')

// initialise client
const userFileStoreClient = new FBUserFileStoreClient(serviceSecret, serviceToken, serviceSlug, userFileStoreUrl)
```

### Fetching and storing

``` javascript
// fetch user file
userFile = await userFileStoreClient.fetch(userId, userToken, fingerprint)
// userFile => { file }

// store user file
policy = { [max_size], [expires], [allowed_types] }
uploadDetails = await userFileStoreClient.store(userId, userToken, file, policy)
// uploadDetails => { fingerpint, url, size, type, date }

// store user file from file path
uploadDetails = await userFileStoreClient.storeFromPath(userId, userToken, filePath, policy)
```

