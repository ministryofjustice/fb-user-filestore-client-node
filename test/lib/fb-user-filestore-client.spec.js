require('@ministryofjustice/module-alias/register')

const proxyquire = require('proxyquire')

const chai = require('chai')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

const chaiAsPromised = require('chai-as-promised')

const {
  expect
} = chai

chai.use(sinonChai)
chai.use(chaiAsPromised)

const readFileStub = sinon.stub()
const promisifyStub = sinon.stub().returns(readFileStub)

const FBUserFileStoreClient = proxyquire('~/fb-user-filestore-client-node/fb-user-filestore-client', {
  util: {
    promisify: promisifyStub
  }
})

const serviceSlug = 'testServiceSlug'
const serviceToken = 'testServiceToken'
const serviceSecret = 'testServiceSecret'
const userFileStoreUrl = 'https://userfilestore'

describe('~/fb-user-filestore-client-node/fb-user-filestore-client', () => {
  describe('Always', () => it('exports the class', () => expect(FBUserFileStoreClient).to.be.a('function')))

  describe('Instantiating a client', () => {
    describe('With required parameters', () => {
      let client

      beforeEach(() => {
        client = new FBUserFileStoreClient(serviceSecret, serviceToken, serviceSlug, userFileStoreUrl)
      })

      it('assigns the service secret to a field of the instance', () => expect(client.serviceSecret).to.equal(serviceSecret))

      it('assigns the service token to a field of the instance', () => expect(client.serviceToken).to.equal(serviceToken))

      it('assigns the service slug to a field of the instance', () => expect(client.serviceSlug).to.equal(serviceSlug))

      it('assigns a default metrics object to the field `apiMetrics`', () => {
        expect(client.apiMetrics).to.be.an('object')

        const {
          startTimer
        } = client.apiMetrics

        expect(startTimer).to.be.a('function')
      })

      it('assigns a default metrics object to the field `requestMetrics`', () => {
        expect(client.requestMetrics).to.be.an('object')

        const {
          startTimer
        } = client.requestMetrics

        expect(startTimer).to.be.a('function')
      })
    })

    describe('Without a service secret parameter', () => {
      it('throws an error', () => expect(() => new FBUserFileStoreClient()).to.throw(Error, 'No service secret passed to client'))

      describe('The error', () => {
        it('has the expected name', () => {
          try {
            new FBUserFileStoreClient()
          } catch ({name}) {
            expect(name).to.equal('FBUserFileStoreClientError')
          }
        })

        it('has the expected code', () => {
          try {
            new FBUserFileStoreClient()
          } catch ({code}) {
            expect(code).to.equal('ENOSERVICESECRET')
          }
        })
      })
    })

    describe('Without a service token parameter', () => {
      it('throws an error', () => expect(() => new FBUserFileStoreClient(serviceSecret)).to.throw(Error, 'No service token passed to client'))

      describe('The error', () => {
        it('has the expected name', () => {
          try {
            new FBUserFileStoreClient(serviceSecret)
          } catch ({name}) {
            expect(name).to.equal('FBUserFileStoreClientError')
          }
        })

        it('has the expected code', () => {
          try {
            new FBUserFileStoreClient(serviceSecret)
          } catch ({code}) {
            expect(code).to.equal('ENOSERVICETOKEN')
          }
        })
      })
    })

    describe('Without a service slug parameter', () => {
      it('throws an error', () => expect(() => new FBUserFileStoreClient(serviceSecret, serviceToken)).to.throw(Error, 'No service slug passed to client'))

      describe('The error', () => {
        it('has the expected name', () => {
          try {
            new FBUserFileStoreClient(serviceSecret, serviceToken)
          } catch ({name}) {
            expect(name).to.equal('FBUserFileStoreClientError')
          }
        })

        it('has the expected code', () => {
          try {
            new FBUserFileStoreClient(serviceSecret, serviceToken)
          } catch ({code}) {
            expect(code).to.equal('ENOSERVICESLUG')
          }
        })
      })
    })

    describe('Without a service url parameter', () => {
      it('throws an error', () => expect(() => new FBUserFileStoreClient(serviceSecret, serviceToken, serviceSlug)).to.throw(Error, 'No microservice url passed to client'))

      describe('The error', () => {
        it('has the expected name', () => {
          try {
            new FBUserFileStoreClient(serviceSecret, serviceToken, serviceSlug)
          } catch ({name}) {
            expect(name).to.equal('FBUserFileStoreClientError')
          }
        })

        it('has the expected code', () => {
          try {
            new FBUserFileStoreClient(serviceSecret, serviceToken, serviceSlug)
          } catch ({code}) {
            expect(code).to.equal('ENOMICROSERVICEURL')
          }
        })
      })
    })
  })

  describe('`getFetchUrl()`', () => {
    let client
    let createEndpointUrlStub

    let returnValue

    beforeEach(async () => {
      client = new FBUserFileStoreClient(serviceSecret, serviceToken, serviceSlug, userFileStoreUrl)

      createEndpointUrlStub = sinon.stub(client, 'createEndpointUrl').returns('mock endpoint url')

      returnValue = await client.getFetchUrl('mock user id', 'mock fingerprint')
    })

    afterEach(() => {
      createEndpointUrlStub.restore()
    })

    it('calls `createEndpointUrl`', () => {
      expect(createEndpointUrlStub).to.be.calledWith('/service/:serviceSlug/user/:userId/:fingerprint', {serviceSlug, userId: 'mock user id', fingerprint: 'mock fingerprint'})
    })

    it('returns a string', () => {
      expect(returnValue).to.equal('mock endpoint url')
    })
  })

  describe('`fetch()`', () => {
    let client
    let encryptUserIdAndTokenStub
    let sendGetStub

    let mockArgs
    let mockLogger

    let returnValue

    beforeEach(async () => {
      client = new FBUserFileStoreClient(serviceSecret, serviceToken, serviceSlug, userFileStoreUrl)
      encryptUserIdAndTokenStub = sinon.stub(client, 'encryptUserIdAndToken').returns({payload: 'mock payload'})
      sendGetStub = sinon.stub(client, 'sendGet').returns({file: Buffer.from('mock file data')})

      mockArgs = {userId: 'mock user id', userToken: 'mock user token', fingerprint: 'mock fingerprint'}
      mockLogger = {}

      returnValue = await client.fetch(mockArgs, mockLogger)
    })

    afterEach(() => {
      encryptUserIdAndTokenStub.restore()
      sendGetStub.restore()
    })

    it('calls `encryptUserIdAndToken`', () => {
      expect(encryptUserIdAndTokenStub).to.be.calledWith('mock user id', 'mock user token')
    })

    it('calls `sendGet`', () => {
      expect(sendGetStub).to.be.calledWith({url: '/service/:serviceSlug/user/:userId/:fingerprint', context: {serviceSlug, userId: 'mock user id', fingerprint: 'mock fingerprint'}, payload: {encrypted_user_id_and_token: {payload: 'mock payload'}}}, mockLogger)
    })

    it('returns a string', () => {
      return expect(returnValue).to.be.a('string')
    })
  })

  describe('`store()`', () => {
    let client
    let encryptUserIdAndTokenStub
    let sendPostStub

    let mockArgs
    let mockLogger

    beforeEach(() => {
      client = new FBUserFileStoreClient(serviceSecret, serviceToken, serviceSlug, userFileStoreUrl)
      encryptUserIdAndTokenStub = sinon.stub(client, 'encryptUserIdAndToken').returns({payload: 'mock payload'})
      sendPostStub = sinon.stub(client, 'sendPost')

      mockArgs = {userId: 'mock user id', userToken: 'mock user token', file: 'mock file data', policy: {}}
      mockLogger = {}
    })

    afterEach(() => {
      encryptUserIdAndTokenStub.restore()
      sendPostStub.restore()
    })

    describe('`sendPost` returns an object with a `fingerprint` field', () => {
      beforeEach(async () => {
        sendPostStub.returns({fingerprint: 'mock fingerprint'})
      })

      it('calls `encryptUserIdAndToken`', async () => {
        await client.store(mockArgs, mockLogger)

        expect(encryptUserIdAndTokenStub).to.be.calledWith('mock user id', 'mock user token')
      })

      it('calls `sendPost`', async () => {
        await client.store(mockArgs, mockLogger)

        expect(sendPostStub).to.be.calledWith({
          url: '/service/:serviceSlug/user/:userId',
          context: {serviceSlug, userId: 'mock user id'},
          payload: {
            encrypted_user_id_and_token: {payload: 'mock payload'},
            file: 'bW9jayBmaWxlIGRhdGE=',
            policy: {
              max_size: client.maxSize,
              expires: client.expires
            }
          }
        }, mockLogger)
      })

      it('does not throw an error', async () => expect(await client.store(mockArgs, mockLogger)).not.to.throw)

      it('returns an object', async () => expect(await client.store(mockArgs, mockLogger)).to.be.an('object'))
    })

    describe('`sendPost` returns an object without a `fingerprint` field', () => {
      beforeEach(async () => {
        sendPostStub.returns({})
      })

      it('calls `encryptUserIdAndToken`', async () => {
        try {
          await client.store(mockArgs, mockLogger)
        } catch (e) {
          expect(encryptUserIdAndTokenStub).to.be.calledWith('mock user id', 'mock user token')
        }
      })

      it('calls `sendPost`', async () => {
        try {
          await client.store(mockArgs, mockLogger)
        } catch (e) {
          expect(sendPostStub).to.be.calledWith({
            url: '/service/:serviceSlug/user/:userId',
            context: {serviceSlug, userId: 'mock user id'},
            payload: {
              encrypted_user_id_and_token: {payload: 'mock payload'},
              file: 'bW9jayBmaWxlIGRhdGE=',
              policy: {
                max_size: client.maxSize,
                expires: client.expires
              }
            }
          }, mockLogger)
        }
      })

      it('throws an error', async () => expect(client.store(mockArgs, mockLogger)).to.eventually.be.rejectedWith(Error))

      it('does not return an object', async () => {
        let returnValue
        try {
          returnValue = await client.store(mockArgs, mockLogger)
        } catch (e) {
          expect(returnValue).not.to.be.an('object')
        }
      })
    })
  })

  describe('`storeFromPath()`', () => {
    let client
    let storeStub

    let mockFilePath
    let mockArgs
    let mockLogger

    let returnValue

    beforeEach(async () => {
      client = new FBUserFileStoreClient(serviceSecret, serviceToken, serviceSlug, userFileStoreUrl)
      readFileStub.returns('mock file data')
      storeStub = sinon.stub(client, 'store')

      mockFilePath = 'mock file path'
      mockArgs = {}
      mockLogger = {}

      returnValue = await client.storeFromPath(mockFilePath, mockArgs, mockLogger)
    })

    afterEach(() => {
      readFileStub.reset()
      storeStub.restore()
    })

    it('calls `readFile`', () => {
      expect(readFileStub).to.be.calledWith('mock file path')
    })

    it('calls `store`', () => {
      expect(storeStub).to.be.calledWith({file: 'mock file data'}, mockLogger)
    })

    it('returns a `Promise` which resolves to undefined', () => {
      return expect(returnValue).to.be.undefined
    })
  })
})
