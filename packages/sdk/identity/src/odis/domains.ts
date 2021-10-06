import {
  EIP712Object,
  EIP712ObjectValue,
  EIP712TypedData,
  generateTypedDataHash,
  Optional,
  optionalEIP712Type,
} from '@celo/utils/lib/sign-typed-data-utils'

// Concrete Domain subtypes are only assignable to Domain and EIP712Object when using type instead
// of interface. Otherwise the compiler complains about a missing index signature.
// tslint:disable:interface-over-type-literal

/**
 * ODIS OPRF domain specifier type as described in CIP-40
 * https://github.com/celo-org/celo-proposals/blob/master/CIPs/cip-0040.md
 */
export interface Domain {
  /** Unique name of the domain. (e.g. "ODIS Password Domain") */
  name: string
  /** Version number. Allows for backwards incompatible changes. */
  version: string
  /** Arbitrary key-value pairs. Must be serializeable to EIP-712 encoding. */
  [key: string]: EIP712ObjectValue
}

/**
 * Options that accompany a Domain in a request to ODIS. Concrete subtype is determined by the
 * concrete subtype of Domain.
 *
 * @remarks DomainOptions is simply an alias of EIP712Object.
 */
export type DomainOptions = EIP712Object

export type SequentialDelayStage = {
  // How many seconds each batch of attempts in this stage is delayed with
  // respect to the timer.
  delay: number
  // Whether the timer should be reset between attempts during this stage.
  // Defaults to true.
  resetTimer: Optional<boolean>
  // The number of continuous attempts a user gets before the next delay
  // in each repetition of this stage. Defaults to 1.
  batchSize: Optional<number>
  // The number of times this stage repeats before continuing to the next stage
  // in the RateLimit array. Defaults to 1.
  repetitions: Optional<number>
}

export type SequentialDelayDomain = {
  name: 'ODIS Sequential Delay Domain'
  version: '1'
  stages: SequentialDelayStage[]
  // Optional public key of a against which signed requests must be authenticated.
  // In the case of Cloud Backup, this will be a one-time key stored with the ciphertext.
  publicKey: Optional<string>
  // Optional string to distinguish the output of this domain instance from
  // other SequentialDelayDomain instances
  salt: Optional<string>
}

export type SequentialDelayDomainOptions = {
  // EIP-712 signature over the entire request by the key specified in the domain.
  // Required if `publicKey` is defined in the domain instance. If `publicKey` is
  // not defined in the domain instance, then a signature must not be provided.
  signature: Optional<string>
  // Used to prevent replay attacks. Required if a signature is provided.
  nonce: Optional<number>
}

export function isSequentialDelayDomain(domain: Domain): domain is SequentialDelayDomain {
  return domain.name === 'ODIS Sequential Delay Domain' && domain.version === '1'
}

/**
 * Union type of domains which are currently implmented and standardized for use with ODIS.
 * Domains should be added to the union type as they are implemented.
 */
export type KnownDomain = SequentialDelayDomain

export function isKnownDomain(domain: Domain): domain is KnownDomain {
  return isSequentialDelayDomain(domain)
}

/**
 * Wraps a domain instance of a standardized type into an EIP-712 typed data structure, including
 * the EIP-712 type signature specififed by the mapping from TypeScript types in CIP-40.
 * https://github.com/celo-org/celo-proposals/blob/master/CIPs/cip-0040.md#mapping-typescript-to-eip-712-types
 */
export function domainEIP712(domain: KnownDomain): EIP712TypedData {
  if (isSequentialDelayDomain(domain)) {
    return {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
        ],
        SequentialDelayDomain: [
          { name: 'publicKey', type: 'Optional<string>' },
          { name: 'salt', type: 'Optional<string>' },
          { name: 'stages', type: 'SequentialDelayStage[]' },
        ],
        SequentialDelayStage: [
          { name: 'batchSize', type: 'Optional<uint256>' },
          { name: 'delay', type: 'uint256' },
          { name: 'repetitions', type: 'Optional<uint256>' },
          { name: 'resetTimer', type: 'Optional<bool>' },
        ],
        ...optionalEIP712Type('string'),
        ...optionalEIP712Type('uint256'),
        ...optionalEIP712Type('bool'),
      },
      primaryType: 'SequentialDelayDomain',
      domain: {
        name: 'ODIS Sequential Delay Domain',
        version: '1',
      },
      message: domain,
    }
  }

  // canary provides a compile-time check that all subtypes of KnownDomain have branches. If a case
  // was missed, then an error will report that domain cannot be assigned to type `never`.
  const canary = (x: never) => x
  canary(domain)
  throw new Error('Implementation error. Input of type KnownDomain was not recognized')
}

/**
 * Produces the canonical 256-bit EIP-712 typed hash of the given domain.
 *
 * @remarks Note that this is a simple wraper to get the EIP-712 hash after encoding it to an
 * EIP-712 typed data format. If a signature over the domain is needed, enocide to EIP-712 format
 * and pass that into a signTypedData function.
 */
export function domainHash(domain: KnownDomain): Buffer {
  return generateTypedDataHash(domainEIP712(domain))
}
