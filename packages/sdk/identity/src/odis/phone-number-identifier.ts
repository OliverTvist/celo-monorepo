import { isE164Number } from '@celo/base/lib/phoneNumbers'
import BigNumber from 'bignumber.js'
import debugFactory from 'debug'
import { BlsBlindingClient, WasmBlsBlindingClient } from './bls-blinding-client'
import {
  getBlindedIdentifier,
  getBlindedIdentifierSignature,
  getOnchainIdentifierFromSignature,
  IdentifierType,
} from './identifier'
import { AuthenticationMethod, AuthSigner, EncryptionKeySigner, ServiceContext } from './query'

// ODIS minimum dollar balance for sig retrieval
export const ODIS_MINIMUM_DOLLAR_BALANCE = 0.01
// ODIS minimum celo balance for sig retrieval
export const ODIS_MINIMUM_CELO_BALANCE = 0.005

const debug = debugFactory('kit:odis:phone-number-identifier')

export interface PhoneNumberHashDetails {
  e164Number: string
  phoneHash: string
  pepper: string
  unblindedSignature?: string
}

/**
 * Retrieve the on-chain identifier for the provided phone number
 * Performs blinding, querying, and unblinding
 */
export async function getPhoneNumberIdentifier(
  e164Number: string,
  account: string,
  signer: AuthSigner,
  context: ServiceContext,
  blindingFactor?: string,
  clientVersion?: string,
  blsBlindingClient?: BlsBlindingClient,
  sessionID?: string
): Promise<PhoneNumberHashDetails> {
  debug('Getting phone number pepper')

  if (!isE164Number(e164Number)) {
    throw new Error(`Invalid phone number: ${e164Number}`)
  }

  let seed: Buffer | undefined
  if (blindingFactor) {
    seed = Buffer.from(blindingFactor)
  } else if (signer.authenticationMethod === AuthenticationMethod.ENCRYPTION_KEY) {
    seed = Buffer.from((signer as EncryptionKeySigner).rawKey)
  }

  // Fallback to using Wasm version if not specified

  if (!blsBlindingClient) {
    debug('No BLSBlindingClient found, using WasmBlsBlindingClient')
    blsBlindingClient = new WasmBlsBlindingClient(context.odisPubKey)
  }

  const base64BlindedMessage = await getBlindedIdentifier(e164Number, blsBlindingClient, seed)

  const base64BlindSig = await getBlindedIdentifierSignature(
    account,
    signer,
    context,
    base64BlindedMessage,
    clientVersion,
    sessionID
  )

  const {
    offchainIdentifier,
    identifierHash,
    pepper,
    unblindedSignature,
  } = await getOnchainIdentifierFromSignature(
    e164Number,
    IdentifierType.PHONE_NUMBER,
    base64BlindSig,
    blsBlindingClient
  )
  return { e164Number: offchainIdentifier, phoneHash: identifierHash, pepper, unblindedSignature }
}

/**
 * Check if balance is sufficient for quota retrieval
 */
export function isBalanceSufficientForSigRetrieval(
  dollarBalance: BigNumber.Value,
  celoBalance: BigNumber.Value
) {
  return (
    new BigNumber(dollarBalance).isGreaterThanOrEqualTo(ODIS_MINIMUM_DOLLAR_BALANCE) ||
    new BigNumber(celoBalance).isGreaterThanOrEqualTo(ODIS_MINIMUM_CELO_BALANCE)
  )
}
