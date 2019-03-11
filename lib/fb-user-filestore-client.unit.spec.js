/* eslint-disable prefer-promise-reject-errors */

const test = require('tape')
const {stub, useFakeTimers} = require('sinon')
const path = require('path')

const jwt = require('jsonwebtoken')

const request = require('request-promise-native')

const FBUserFileStoreClient = require('./fb-user-filestore-client')

/* test values */
const userId = 'testUserId'
const userToken = 'testUserToken'
const serviceSlug = 'testServiceSlug'
const serviceToken = 'testServiceToken'
const serviceSecret = 'testServiceSecret'
const userFileStoreUrl = 'http://localhost:8080'
const fingerprint = '31d-x9323s39amdsa'
const storeEndpointUrl = `${userFileStoreUrl}/service/${serviceSlug}/user/${userId}`
const fetchEndpointUrl = `${userFileStoreUrl}/service/${serviceSlug}/user/${userId}/${fingerprint}`
const defaultMaxSize = 10 * 1024 * 1024
const defaultExpires = '28d'
const maxSize = 100 * 1024
const expires = '7d'
const fileContents = 'testFileContents'
const filePath = path.resolve(__dirname, 'test-data', 'test-file')
const fileBuffer = Buffer.from(fileContents)
const fileBase64 = fileBuffer.toString('base64')
const policy = {
  max_size: maxSize,
  expires,
  allowed_types: ['image/*']
}
const expectedEncryptedUserIdToken = 'pOXXs5YW9mUW1weBLNawiMRFdk6Hh92YBfGqmg8ych8PqnZ5l8JbcqHXHKjmcrKYJqZXn53sFr/eCq7Mbh5j9rj87w=='

// const encryptedPayload = 'RRqDeJRQlZULKx1NYql/imRmDsy9AZshKozgLuY='

// Ensure that client is properly instantiated

/**
 * Convenience function for testing client instantiation
 *
 * @param {object} t
 *  Object containing tape methods
 *
 * @param {array} params
 *  Arguments to pass to client constructor
 *
 * @param {string} expectedCode
 *  Error code expected to be returned by client
 *
 * @param {string} expectedMessage
 *  Error message expected to be returned by client
 *
 * @return {undefined}
 *
 **/
const testInstantiation = (t, params, expectedCode, expectedMessage) => {
  t.plan(4)

  let failedClient
  try {
    failedClient = new FBUserFileStoreClient(...params)
  } catch (e) {
    t.equal(e.name, 'FBUserFileStoreClientError', 'it should return an error of the correct type')
    t.equal(e.code, expectedCode, 'it should return the correct error code')
    t.equal(e.message, expectedMessage, 'it should return the correct error message')
  }
  t.equal(failedClient, undefined, 'it should not return an instantiated client')
}

test('When instantiating user filestore client without a service secret', t => {
  testInstantiation(t, [], 'ENOSERVICESECRET', 'No service secret passed to client')
})

test('When instantiating user filestore client without a service token', t => {
  testInstantiation(t, [serviceSecret], 'ENOSERVICETOKEN', 'No service token passed to client')
})

test('When instantiating user filestore client without a service slug', t => {
  testInstantiation(t, [serviceSecret, serviceToken], 'ENOSERVICESLUG', 'No service slug passed to client')
})

test('When instantiating user filestore client using default values', t => {
  const client = new FBUserFileStoreClient(serviceSecret, serviceToken, serviceSlug, userFileStoreUrl)
  t.equal(client.maxSize, defaultMaxSize, 'it should use the default max size')
  t.equal(client.expires, defaultExpires, 'it should use the default expires')
  t.ok(true)
  t.end()
})

test('When instantiating user filestore client overriding defaut values', t => {
  const client = new FBUserFileStoreClient(serviceSecret, serviceToken, serviceSlug, userFileStoreUrl, {
    maxSize,
    expires
  })
  t.equal(client.maxSize, maxSize, 'it should use the provided value for max size')
  t.equal(client.expires, expires, 'it should use the provided value for expires')
  t.ok(true)
  t.end()
})

// Set up a client to test the methods
const userFileStoreClient = new FBUserFileStoreClient(serviceSecret, serviceToken, serviceSlug, userFileStoreUrl)

// Endpoint URLs
test('When asking for endpoint urls', t => {
  const storeUrl =
  userFileStoreClient.createEndpointUrl('/service/:serviceSlug/user/:userId', {serviceSlug, userId})
  t.equal(storeUrl, storeEndpointUrl, 'it should return the correct value for the store endpoint')
  const fetchUrl =
  userFileStoreClient.createEndpointUrl('/service/:serviceSlug/user/:userId/:fingerprint', {serviceSlug, userId, fingerprint})
  t.equal(fetchUrl, fetchEndpointUrl, 'it should return the correct value for the fetch endpoint')

  t.end()
})

test('When generating json web token', async t => {
  const clock = useFakeTimers({
    now: 1483228800000
  })
  const accessToken = userFileStoreClient.generateAccessToken({payload: 'testPayload'})
  const decodedAccessToken = jwt.verify(accessToken, serviceToken)
  t.equal(decodedAccessToken.payload, 'testPayload', 'it should output a token containing the payload')
  t.equal(decodedAccessToken.iat, 1483228800, 'it should output a token containing the iat property')

  clock.restore()
  t.end()
})

// JWT
test('When generating json web token', async t => {
  const clock = useFakeTimers({
    now: 1483228800000
  })
  const accessToken = userFileStoreClient.generateAccessToken({payload: 'testPayload'})
  const decodedAccessToken = jwt.verify(accessToken, serviceToken)
  t.equal(decodedAccessToken.payload, 'testPayload', 'it should output a token containing the payload')
  t.equal(decodedAccessToken.iat, 1483228800, 'it should output a token containing the iat property')

  clock.restore()
  t.end()
})

// Fetching user file
test('When requesting a user file with a valid fingerprint', async t => {
  t.plan(3)

  const stubRequest = stub(request, 'get')
  stubRequest.callsFake(options => {
    return Promise.resolve({
      file: fileBase64
    })
  })
  const userFile = await userFileStoreClient.fetch(userId, userToken, fingerprint)
  t.equal(userFile, fileContents, 'it should return the correctly decoded file')

  const callArgs = stubRequest.getCall(0).args[0]
  t.equal(callArgs.url, fetchEndpointUrl, 'it should call the correct url')
  t.ok(callArgs.headers['x-access-token'], 'it should add the x-access-token header')

  stubRequest.restore()
  t.end()
})

// Storing user file
test('When storing a user file', async t => {
  t.plan(9)

  const stubRequest = stub(request, 'post')
  stubRequest.callsFake(async () => ({
    fingerprint
  }))
  await userFileStoreClient.store(userId, userToken, fileContents, policy)

  const callArgs = stubRequest.getCall(0).args[0]
  t.equal(callArgs.url, storeEndpointUrl, 'it should call the correct url')
  t.ok(callArgs.headers['x-access-token'], 'it should add the x-access-token header')
  const jsonBundle = callArgs.json
  t.equal(jsonBundle.encrypted_user_id_and_token, expectedEncryptedUserIdToken, 'it should send the correctly encrypted user id and token')
  t.equal(jsonBundle.file, fileBase64, 'it should send the correctly encoded file')
  t.deepEqual(jsonBundle.policy, policy, 'it should send the policy for the file')
  stubRequest.resetHistory()

  await userFileStoreClient.store(userId, userToken, fileContents)
  const policyBundle = stubRequest.getCall(0).args[0].json.policy
  t.equal(policyBundle.max_size, defaultMaxSize, 'it should use the default max size if none passed')
  t.equal(policyBundle.expires, defaultExpires, 'it should use the default expires if none passed')
  t.equal(policyBundle.allowed_types, undefined, 'it should pass no allowed types if none passed')
  stubRequest.resetHistory()

  await userFileStoreClient.store(userId, userToken, fileContents, {allowed_types: []})
  const policyBundleB = stubRequest.getCall(0).args[0].json.policy
  t.equal(policyBundleB.allowed_types, undefined, 'it should pass no allowed types if an empty list is passed')

  stubRequest.restore()
  t.end()
})

test('When storing a user file but no fingerprint is returned', async t => {
  t.plan(3)

  const stubRequest = stub(request, 'post')
  stubRequest.callsFake(async () => ({}))
  try {
    await userFileStoreClient.store(userId, userToken, fileContents, policy)
    // these tests should not run
    t.notOk('it should throw an error')
    t.notOk('it should throw an error')
    t.notOk('it should throw an error')
  } catch (e) {
    t.equal(e.name, 'FBUserFileStoreClientError', 'it should return an error of the correct type')
    t.equal(e.code, 500, 'it should return an error with the correct code')
    t.equal(e.message, 'ENOFINGERPRINT', 'it should return an error with the correct message')
  }

  stubRequest.restore()
  t.end()
})

// Storing file from a path
test('When storing a user file using a file path', async t => {
  t.plan(4)

  const clientStoreStub = stub(userFileStoreClient, 'store')
  clientStoreStub.callsFake(async () => {})
  await userFileStoreClient.storeFromPath(userId, userToken, filePath, policy)

  const callArgs = clientStoreStub.getCall(0).args
  const filePathBuffer = callArgs[2]
  t.equal(filePathBuffer.constructor.name, 'Buffer', 'it should pass the file as a buffer')

  t.equal(callArgs[0], userId, 'it should pass the user id as is')
  t.equal(callArgs[1], userToken, 'it should pass the user token as is')
  t.deepEqual(callArgs[3], policy, 'it should pass the policy as is')

  clientStoreStub.restore()
  t.end()
})

/**
 * Convenience function for testing client error handling
 *
 * Stubs request[stubMethod], creates error object response and tests
 * - error name
 * - error code
 * - error message
 * - payload is undefined
 *
 * @param {function} clientMethod
 *  Function providing call to client method to execute with args pre-populated
 *
 * @param {string} stubMethod
 *  Request method to stub
 *
 * @param {object} t
 *  Object containing tape methods
 *
 * @param {number|string} requestErrorCode
 *  Error code or status code returned by request
 *
 * @param {number} [applicationErrorCode]
 *  Error code expoected to be thrown by client (defaults to requestErrorCode)
 *
 * @param {number} [expectedRequestErrorCode]
 *  Error code expoected to be thrown if no code is returned by client (defaults to requestErrorCode)
 *
 * @return {undefined}
 *
 **/
const testError = async (clientMethod, stubMethod, t, requestErrorCode, applicationErrorCode, expectedRequestErrorCode) => {
  applicationErrorCode = applicationErrorCode || requestErrorCode

  const error = {}
  if (typeof requestErrorCode === 'string') {
    error.error = {
      code: requestErrorCode
    }
  } else {
    error.statusCode = requestErrorCode
  }

  expectedRequestErrorCode = expectedRequestErrorCode || requestErrorCode

  const stubRequest = stub(request, stubMethod)
  stubRequest.callsFake(options => {
    return Promise.reject(error)
  })

  t.plan(4)
  let decryptedPayload
  try {
    decryptedPayload = await clientMethod()
  } catch (e) {
    t.equal(e.name, 'FBUserFileStoreClientError', 'it should return an error object of the correct type')
    t.equal(e.code, applicationErrorCode, `it should return correct error code (${applicationErrorCode})`)
    t.equal(e.message, expectedRequestErrorCode, `it should return the correct error message (${expectedRequestErrorCode})`)
  }
  t.equal(decryptedPayload, undefined, 'it should not return a value for the payload')

  stubRequest.restore()
}

// Convenience function for testing client's fetch method - calls generic testError function
// Params same as for testError, minus the clientMethod and stubMethod ones
const testFetchError = async (t, requestErrorCode, applicationErrorCode, expectedRequestErrorCode) => {
  const clientMethod = async () => {
    return userFileStoreClient.fetch(userId, userToken, fingerprint)
  }
  testError(clientMethod, 'get', t, requestErrorCode, applicationErrorCode, expectedRequestErrorCode)
}

// Convenience function for testing client's store method - calls generic testError function
// Params same as for testError, minus the clientMethod and stubMethod one
const testStoreError = async (t, requestErrorCode, applicationErrorCode, expectedRequestErrorCode) => {
  const clientMethod = async () => {
    return userFileStoreClient.store(userId, userToken, fileContents, policy)
  }
  testError(clientMethod, 'post', t, requestErrorCode, applicationErrorCode, expectedRequestErrorCode)
}

// Test all the errors for userFileStoreClient.fetch

test('When requesting user data that does not exist', async t => {
  testFetchError(t, 404)
})

test('When making an unauthorized request for user data', async t => {
  testFetchError(t, 401)
})

test('When making an invalid request for user data', async t => {
  testFetchError(t, 403)
})

test('When requesting user data but the user filestore cannot be reached', async t => {
  testFetchError(t, 'ECONNREFUSED', 503)
})

test('When requesting user data but dns resolution for user filestore fails', async t => {
  testFetchError(t, 'ENOTFOUND', 502)
})

test('When an unspecified error code is returned', async t => {
  testFetchError(t, 'EMADEUP', 500)
})

test('When an an error object without error code is returned', async t => {
  testFetchError(t, '', 500, 'EUNSPECIFIED')
})

test('When an error occurs but not error code is present', async t => {
  testFetchError(t, undefined, 500, 'ENOERROR')
})

// Test all the errors for userFileStoreClient.store

test('When making an unauthorized attempt to store user file', async t => {
  testStoreError(t, 401)
})

test('When making an invalid attemp to store user file', async t => {
  testStoreError(t, 403)
})

test('When storing user file but the filestore cannot be reached', async t => {
  testStoreError(t, 'ECONNREFUSED', 503)
})

test('When storing user file but dns resolution for user filestore fails', async t => {
  testStoreError(t, 'ENOTFOUND', 502)
})

test('When storing user file and an unspecified error code is returned', async t => {
  testStoreError(t, 'EMADEUP', 500)
})

test('When storing user file and an error object without error code is returned', async t => {
  testStoreError(t, '', 500, 'EUNSPECIFIED')
})

test('When storing user file and an error occurs but not error code is present', async t => {
  testStoreError(t, undefined, 500, 'ENOERROR')
})
