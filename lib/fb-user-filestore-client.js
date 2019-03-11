const FBJWTClient = require('@ministryofjustice/fb-jwt-client-node')
class FBUserFileStoreClientError extends FBJWTClient.prototype.ErrorClass {}

const util = require('util')
const fs = require('fs')
const readFile = util.promisify(fs.readFile)

// endpoint urls
const endpoints = {
  fetch: '/service/:serviceSlug/user/:userId/:fingerprint',
  store: '/service/:serviceSlug/user/:userId'
}

// defaults - can be overridden in constructor
let defaultMaxSize = 10 * 1024 * 1024 // 10Mb
let defaultExpires = '28d'

/**
 * Creates user filestore client
 * @class
 */
class FBUserfilestoreClient extends FBJWTClient {
  /**
   * Initialise user filestore client
   *
   * @param {string} serviceSecret
   * Service secret
   *
   * @param {string} serviceToken
   * Service token
   *
   * @param {string} serviceSlug
   * Service slug
   *
   * @param {string} userFileStoreUrl
   * User filestore URL
   *
   * @param {object} [options]
   * Options for instantiating client
   *
   * @param {number} [options.maxSize]
   * Default max size for uploads (bytes)
   *
   * @param {string} [options.expires]
   * Default expiry duration for uploads
   * eg. 28d
   *
   * @return {object}
   *
   **/
  constructor (serviceSecret, serviceToken, serviceSlug, userFileStoreUrl, options = {}) {
    super(serviceSecret, serviceToken, serviceSlug, userFileStoreUrl, FBUserFileStoreClientError)

    this.maxSize = options.maxSize || defaultMaxSize
    this.expires = options.expires || defaultExpires
  }

  /**
   * Fetch user file
   *
   * @param {string} userId
   * User ID
   *
   * @param {string} userToken
   * User token
   *
   * @param {string} fingerprint
   * File fingerprint
   *
   * @return {promise<string>}
   * Promise resolving to file
   *
   **/
  fetch (userId, userToken, fingerprint) {
    const urlPattern = endpoints.fetch
    const serviceSlug = this.serviceSlug

    /* eslint-disable camelcase */
    const encrypted_user_id_and_token = this.encryptUserIdAndToken(userId, userToken)
    /* eslint-enable camelcase */

    return this.sendGet(urlPattern, {serviceSlug, userId, fingerprint}, {encrypted_user_id_and_token}, true)
      .then(json => {
        const {file} = json
        return Buffer.from(file, 'base64').toString()
      })
  }

  /**
   * Store user file
   *
   * @param {string} userId
   * User ID
   *
   * @param {string} userToken
   * User token
   *
   * @param {string|buffer} file
   * User file
   *
   * @param {object} policy
   * Policy to apply to file
   *
   * @param {number} [policy.max_size]
   * Maximum file size in bytes
   *
   * @param {string} [policy.expires]
   * Maximum file size in bytes
   *
   * @param {array<string>} [policy.allowed_types]
   * Allowed mime-types
   *
   * @return {promise<undefined>}
   *
   **/
  store (userId, userToken, file, policy) {
    const urlPattern = endpoints.store
    const serviceSlug = this.serviceSlug

    if (!file.buffer) {
      file = Buffer.from(file)
    }
    file = file.toString('base64')

    policy = Object.assign({}, policy)
    if (!policy.max_size) {
      policy.max_size = this.maxSize
    }
    if (!policy.expires) {
      policy.expires = this.expires
    }
    if (policy.allowed_types && policy.allowed_types.length === 0) {
      delete policy.allowed_types
    }

    /* eslint-disable camelcase */
    const encrypted_user_id_and_token = this.encryptUserIdAndToken(userId, userToken)
    /* eslint-enable camelcase */

    const data = {
      encrypted_user_id_and_token,
      file,
      policy
    }

    return this.sendPost(urlPattern, {serviceSlug, userId}, data)
      .then(result => {
        // useless if no fingerprint returned
        if (!result.fingerprint) {
          this.throwRequestError(500, 'ENOFINGERPRINT')
        }
        return result
      })
  }

  /**
   * Store user file from a file path
   *
   * @param {string} userId
   * User ID
   *
   * @param {string} userToken
   * User token
   *
   * @param {string} filePath
   * Path to user file
   *
   * @param {object} policy
   * Policy to apply to file - see store method for details
   *
   * @return {promise<undefined>}
   *
   **/
  storeFromPath (userId, userToken, filePath, policy) {
    return readFile(filePath)
      .then(file => this.store(userId, userToken, file, policy))
  }
}

module.exports = FBUserfilestoreClient
