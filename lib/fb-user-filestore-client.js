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
let defaultExpires = 28

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
   * @param {number} [options.expires]
   * Default expiry duration in days for uploads
   * eg. 14
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
   * @param {object} args
   * Fetch args
   *
   * @param {string} args.userId
   * User ID
   *
   * @param {string} args.userToken
   * User token
   *
   * @param {string} args.fingerprint
   * File fingerprint
   *
   * @param {object} logger
   * Bunyan logger instance
   *
   * @return {promise<string>}
   * Promise resolving to file
   *
   **/
  fetch (args, logger) {
    const {userId, userToken, fingerprint} = args
    const url = endpoints.fetch
    const serviceSlug = this.serviceSlug

    /* eslint-disable camelcase */
    const encrypted_user_id_and_token = this.encryptUserIdAndToken(userId, userToken)
    /* eslint-enable camelcase */

    const context = {serviceSlug, userId, fingerprint}
    const payload = {encrypted_user_id_and_token}

    return this.sendGet({url, context, payload}, logger)
      .then(json => {
        const {file} = json
        return Buffer.from(file, 'base64').toString()
      })
  }

  /**
   * Store user file
   *
   * @param {object} args
   * Store args
   *
   * @param {string} args.userId
   * User ID
   *
   * @param {string} args.userToken
   * User token
   *
   * @param {string|buffer} args.file
   * User file
   *
   * @param {object} args.policy
   * Policy to apply to file
   *
   * @param {number} [args.policy.max_size]
   * Maximum file size in bytes
   *
   * @param {string} [args.policy.expires]
   * Maximum file size in bytes
   *
   * @param {array<string>} [args.policy.allowed_types]
   * Allowed mime-types
   *
   * @param {object} logger
   * Bunyan logger instance
   *
   * @return {promise<undefined>}
   *
   **/
  store (args, logger) {
    const {userId, userToken} = args
    let {file, policy} = args
    const url = endpoints.store
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

    const context = {serviceSlug, userId}
    const payload = {encrypted_user_id_and_token, file, policy}

    return this.sendPost({url, context, payload}, logger)
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
   * @param {string} filePath
   * Path to user file
   *
   * @param {object} args
   * Store args
   *
   * @param {string} args.userId
   * User ID
   *
   * @param {string} args.userToken
   * User token
   *
   * @param {object} args.policy
   * Policy to apply to file - see store method for details
   *
   * @param {object} logger
   * Bunyan logger instance
   *
   * @return {promise<undefined>}
   *
   **/
  storeFromPath (filePath, args, logger) {
    return readFile(filePath)
      .then(file => {
        args.file = file
        this.store(args, logger)
      })
  }
}

module.exports = FBUserfilestoreClient
