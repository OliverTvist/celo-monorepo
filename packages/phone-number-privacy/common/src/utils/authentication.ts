import { hexToBuffer, retryAsyncWithBackOffAndTimeout } from '@celo/base'
import { ContractKit } from '@celo/contractkit'
import { AccountsWrapper } from '@celo/contractkit/lib/wrappers/Accounts'
import { AttestationsWrapper } from '@celo/contractkit/lib/wrappers/Attestations'
import { trimLeading0x } from '@celo/utils/lib/address'
import { verifySignature } from '@celo/utils/lib/signatureUtils'
import Logger from 'bunyan'
import crypto from 'crypto'
import { Request } from 'express'
import { fetchEnv, rootLogger } from '..'
import {
  AuthenticationMethod,
  ErrorMessage,
  ErrorType,
  PhoneNumberPrivacyRequest,
  WarningMessage,
} from '../interfaces'
import { FULL_NODE_TIMEOUT_IN_MS, RETRY_COUNT, RETRY_DELAY_IN_MS } from './constants'

/*
 * Confirms that user is who they say they are and throws error on failure to confirm.
 * Authorization header should contain the EC signed body
 */
export async function authenticateUser<R extends PhoneNumberPrivacyRequest>(
  request: Request<{}, {}, R>,
  contractKit: ContractKit,
  logger: Logger,
  shouldFailOpen: boolean = false,
  warnings: ErrorType[] = []
): Promise<boolean> {
  logger.debug('Authenticating user')

  // https://tools.ietf.org/html/rfc7235#section-4.2
  const messageSignature = request.get('Authorization')
  const message = JSON.stringify(request.body)
  const signer = request.body.account
  const authMethod = request.body.authenticationMethod

  if (!messageSignature || !signer) {
    return false
  }

  if (authMethod && authMethod === AuthenticationMethod.ENCRYPTION_KEY) {
    let registeredEncryptionKey
    try {
      registeredEncryptionKey = await getDataEncryptionKey(signer, contractKit, logger)
    } catch (err) {
      // getDataEncryptionKey should only throw if there is a full-node connection issue.
      // That is, it does not throw if the DEK is undefined or invalid
      const failureStatus = shouldFailOpen ? ErrorMessage.FAILING_OPEN : ErrorMessage.FAILING_CLOSED
      logger.error({
        err,
        warning: ErrorMessage.FAILURE_TO_GET_DEK,
        failureStatus,
      })
      warnings.push(ErrorMessage.FAILURE_TO_GET_DEK, failureStatus)
      return shouldFailOpen
    }
    if (!registeredEncryptionKey) {
      logger.warn({ account: signer }, 'Account does not have registered encryption key')
      return false
    } else {
      logger.info({ dek: registeredEncryptionKey, account: signer }, 'Found DEK for account')
      if (
        verifyDEKSignature(message, messageSignature, registeredEncryptionKey, logger, {
          insecureAllowIncorrectlyGeneratedSignature: true,
        })
      ) {
        return true
      }
    }
  }

  // Fallback to previous signing pattern
  logger.info(
    { account: signer, message, messageSignature },
    'Message was not authenticated with DEK, attempting to authenticate using wallet key'
  )
  // TODO This uses signature utils, why doesn't DEK authentication?
  // (https://github.com/celo-org/celo-monorepo/issues/9803)
  return verifySignature(message, messageSignature, signer)
}

export function getMessageDigest(message: string) {
  // NOTE: Elliptic will truncate the raw msg to 64 bytes before signing,
  // so make sure to always pass the hex encoded msgDigest instead.
  return crypto.createHash('sha256').update(JSON.stringify(message)).digest('hex')
}

// Used primarily for signing requests with a DEK, counterpart of verifyDEKSignature
// For general signing, use SignatureUtils in @celo/utils
export function signWithRawKey(msg: string, rawKey: string) {
  // NOTE: elliptic is disabled elsewhere in this library to prevent
  // accidental signing of truncated messages.
  // tslint:disable-next-line:import-blacklist
  const EC = require('elliptic').ec
  const ec = new EC('secp256k1')

  // Sign
  const key = ec.keyFromPrivate(hexToBuffer(rawKey))
  return JSON.stringify(key.sign(getMessageDigest(msg)).toDER())
}

export function verifyDEKSignature(
  message: string,
  messageSignature: string,
  registeredEncryptionKey: string,
  logger?: Logger,
  { insecureAllowIncorrectlyGeneratedSignature } = {
    insecureAllowIncorrectlyGeneratedSignature: false,
  }
) {
  logger = logger ?? rootLogger(fetchEnv('SERVICE_NAME'))
  try {
    // NOTE: elliptic is disabled elsewhere in this library to prevent
    // accidental signing of truncated messages.
    // tslint:disable-next-line:import-blacklist
    const EC = require('elliptic').ec
    const ec = new EC('secp256k1')
    const key = ec.keyFromPublic(trimLeading0x(registeredEncryptionKey), 'hex')
    const parsedSig = JSON.parse(messageSignature)
    // TODO why do we use a different signing method instead of SignatureUtils?
    // (https://github.com/celo-org/celo-monorepo/issues/9803)
    if (key.verify(getMessageDigest(message), parsedSig)) {
      return true
    }
    // TODO(2.0.0, deployment): Remove this once clients upgrade to @celo/identity v1.5.3
    // Due to an error in the original implementation of the sign and verify functions
    // used here, older clients may generate signatures over the truncated message,
    // instead of its hash. These signatures represent a risk to the signer as they do
    // not protect against modifications of the message past the first 64 characters of the message.
    // (https://github.com/celo-org/celo-monorepo/issues/9802)
    if (insecureAllowIncorrectlyGeneratedSignature && key.verify(message, parsedSig)) {
      logger.warn(WarningMessage.INVALID_AUTH_SIGNATURE)
      return true
    }
    return false
  } catch (err) {
    logger.error('Failed to verify signature with DEK')
    logger.error({ err, dek: registeredEncryptionKey })
    return false
  }
}

export async function getDataEncryptionKey(
  address: string,
  contractKit: ContractKit,
  logger: Logger
): Promise<string> {
  try {
    const res = await retryAsyncWithBackOffAndTimeout(
      async () => {
        const accountWrapper: AccountsWrapper = await contractKit.contracts.getAccounts()
        return accountWrapper.getDataEncryptionKey(address)
      },
      RETRY_COUNT,
      [],
      RETRY_DELAY_IN_MS,
      1.5,
      FULL_NODE_TIMEOUT_IN_MS
    )
    return res
  } catch (error) {
    logger.error('Failed to retrieve DEK: ' + error)
    logger.error(ErrorMessage.FULL_NODE_ERROR)
    throw error
  }
}

export async function isVerified(
  account: string,
  hashedPhoneNumber: string,
  contractKit: ContractKit,
  logger: Logger
): Promise<boolean> {
  try {
    const res = await retryAsyncWithBackOffAndTimeout(
      async () => {
        const attestationsWrapper: AttestationsWrapper = await contractKit.contracts.getAttestations()
        const {
          isVerified: _isVerified,
          completed,
          numAttestationsRemaining,
          total,
        } = await attestationsWrapper.getVerifiedStatus(hashedPhoneNumber, account)

        logger.debug({
          account,
          isVerified: _isVerified,
          completedAttestations: completed,
          remainingAttestations: numAttestationsRemaining,
          totalAttestationsRequested: total,
        })
        return _isVerified
      },
      RETRY_COUNT,
      [],
      RETRY_DELAY_IN_MS,
      1.5,
      FULL_NODE_TIMEOUT_IN_MS
    )
    return res
  } catch (error) {
    logger.error('Failed to get verification status: ' + error)
    logger.error(ErrorMessage.FULL_NODE_ERROR)
    logger.warn('Assuming user is verified')
    return true
  }
}
