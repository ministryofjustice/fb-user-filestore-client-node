/* eslint-disable prefer-promise-reject-errors */

const test = require('tape')
const {stub, useFakeTimers} = require('sinon')
const path = require('path')

const jwt = require('jsonwebtoken')

const FBUserFileStoreClient = require('./fb-user-filestore-client')

/* test values */
const userId = 'testUserId'
const userToken = 'testUserToken'
const serviceSlug = 'testServiceSlug'
const serviceToken = 'testServiceToken'
const serviceSecret = 'testServiceSecret'
const userFileStoreUrl = 'http://localhost:8080'
const fingerprint = '31-x9323s39amdsa'
const storeEndpointUrl = `${userFileStoreUrl}/service/${serviceSlug}/user/${userId}`
const fetchEndpointUrl = `${userFileStoreUrl}/service/${serviceSlug}/user/${userId}/${fingerprint}`
const defaultMaxSize = 10 * 1024 * 1024
const defaultExpires = 28
const maxSize = 100 * 1024
const expires = 7
const fileContents = 'testFileContents'
const filePath = path.resolve(__dirname, 'test-data', 'test-file')
const fileBuffer = Buffer.from(fileContents)
const fileBase64 = fileBuffer.toString('base64')
const policy = {
  max_size: maxSize,
  expires,
  allowed_types: ['image/*']
}

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
  let failedClient
  try {
    t.throws(failedClient = new FBUserFileStoreClient(...params))
  } catch (e) {
    t.equal(e.name, 'FBUserFileStoreClientError', 'it should return an error of the correct type')
    t.equal(e.code, expectedCode, 'it should return the correct error code')
    t.equal(e.message, expectedMessage, 'it should return the correct error message')
  }
  t.equal(failedClient, undefined, 'it should not return an instantiated client')
  t.end()
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

// getFetchUrl methood
test('When asking for fetch endpoint url', t => {
  const fetchUrl =
  userFileStoreClient.getFetchUrl(userId, fingerprint)
  t.equal(fetchUrl, fetchEndpointUrl, 'it should return the correct value')

  t.end()
})

// JWT
test('When generating json web token', async t => {
  const clock = useFakeTimers({
    now: 1483228800000
  })
  const accessToken = userFileStoreClient.generateAccessToken({payload: 'testPayload'})
  const decodedAccessToken = jwt.verify(accessToken, serviceToken)
  t.equal(decodedAccessToken.checksum, 'e236cbfa627a1790355fca6aa1afbf322dad7ec025dad844b4778923a5659f06', 'it should output a token containing a checksum of the data')
  t.equal(decodedAccessToken.iat, 1483228800, 'it should output a token containing the iat property')

  clock.restore()
  t.end()
})

// Fetching user file
test('When requesting a user file with a valid fingerprint', async t => {
  const sendGetStub = stub(userFileStoreClient, 'sendGet')
  sendGetStub.callsFake(options => {
    return Promise.resolve({
      file: fileBase64
    })
  })
  const logger = {}

  const userFile = await userFileStoreClient.fetch({userId, userToken, fingerprint}, logger)
  t.equal(userFile, fileContents, 'it should return the correctly decoded file')

  const callArgs = sendGetStub.getCall(0).args
  t.equal(callArgs[0].url, '/service/:serviceSlug/user/:userId/:fingerprint', 'it should pass the correct url pattern to the sendGet method')
  t.deepEqual(callArgs[0].context, {serviceSlug: 'testServiceSlug', userId: 'testUserId', fingerprint: '31-x9323s39amdsa'}, 'it should pass the correct url context pattern to the sendGet method')
  t.equal(callArgs[1], logger, 'it should pass any logger instance to the sendGet method')

  sendGetStub.restore()
  t.end()
})

// Storing user file
test('When storing a user file', async t => {
  const sendPostStub = stub(userFileStoreClient, 'sendPost')
  sendPostStub.callsFake(async () => ({
    fingerprint
  }))
  const logger = {}
  await userFileStoreClient.store({userId, userToken, file: fileContents, policy}, logger)

  const callArgs = sendPostStub.getCall(0).args
  t.equal(callArgs[0].url, '/service/:serviceSlug/user/:userId', 'it should pass the correct url pattern to the sendPost method')
  t.deepEqual(callArgs[0].context, {serviceSlug: 'testServiceSlug', userId: 'testUserId'}, 'it should pass the correct context to substitue keys in the url')
  t.deepEqual(callArgs[0].payload, {
    encrypted_user_id_and_token: 'pOXXs5YW9mUW1weBLNawiMRFdk6Hh92YBfGqmg8ych8PqnZ5l8JbcqHXHKjmcrKYJqZXn53sFr/eCq7Mbh5j9rj87w==',
    file: 'dGVzdEZpbGVDb250ZW50cw==',
    policy: {max_size: 102400, expires: 7, allowed_types: ['image/*']}
  }, 'it should pass the correct payload to the sendPost method')
  t.equal(callArgs[1], logger, 'it should pass any logger instance to the sendGet method')

  sendPostStub.resetHistory()

  await userFileStoreClient.store({userId, userToken, file: fileContents})
  const policyBundle = sendPostStub.getCall(0).args[0].payload.policy
  t.equal(policyBundle.max_size, defaultMaxSize, 'it should use the default max size if none passed')
  t.equal(policyBundle.expires, defaultExpires, 'it should use the default expires if none passed')
  t.equal(policyBundle.allowed_types, undefined, 'it should pass no allowed types if none passed')
  sendPostStub.resetHistory()

  await userFileStoreClient.store({userId, userToken, file: fileContents, policy: {allowed_types: []}})
  const policyBundleB = sendPostStub.getCall(0).args[0].payload.policy
  t.equal(policyBundleB.allowed_types, undefined, 'it should pass no allowed types if an empty list is passed')

  sendPostStub.restore()
  t.end()
})

test('When storing a user file but no fingerprint is returned', async t => {
  const sendPostStub = stub(userFileStoreClient, 'sendPost')
  sendPostStub.callsFake(async () => ({}))
  try {
    t.throws(await userFileStoreClient.store({userId, userToken, file: fileContents, policy}))
  } catch (e) {
    t.equal(e.name, 'FBUserFileStoreClientError', 'it should return an error of the correct type')
    t.equal(e.code, 500, 'it should return an error with the correct code')
    t.equal(e.message, 'ENOFINGERPRINT', 'it should return an error with the correct message')
  }

  sendPostStub.restore()
  t.end()
})

// Storing file from a path
test('When storing a user file using a file path', async t => {
  const clientStoreStub = stub(userFileStoreClient, 'store')
  clientStoreStub.callsFake(async () => {})
  const logger = {}
  await userFileStoreClient.storeFromPath(filePath, {userId, userToken, policy}, logger)

  const callArgs = clientStoreStub.getCall(0).args
  const filePathBuffer = callArgs[0].file
  t.equal(filePathBuffer.constructor.name, 'Buffer', 'it should pass the file as a buffer')

  t.equal(callArgs[0].userId, userId, 'it should pass the user id as is')
  t.equal(callArgs[0].userToken, userToken, 'it should pass the user token as is')
  t.deepEqual(callArgs[0].policy, policy, 'it should pass the policy as is')
  t.equal(callArgs[1], logger, 'it should pass any logger instance as is')

  clientStoreStub.restore()
  t.end()
})

// Offline version
test('When calling the store method with the offline version of the client', async t => {
  const offlineClient = FBUserFileStoreClient.offline()
  const stored = await offlineClient.store({})

  t.notEqual(stored.fingerprint, undefined, 'it should return a fingerprint')
  t.notEqual(stored.date, undefined, 'it should return a date')
  t.notEqual(stored.timestamp, undefined, 'it should return a timestamp')
  t.end()
})
