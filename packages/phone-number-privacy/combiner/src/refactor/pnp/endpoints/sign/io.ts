import {
  authenticateUser,
  CombinerEndpoint,
  ErrorType,
  getSignerEndpoint,
  hasValidAccountParam,
  hasValidBlindedPhoneNumberParam,
  identifierIsValidIfExists,
  isBodyReasonablySized,
  send,
  SignerEndpoint,
  SignMessageRequest,
  SignMessageRequestSchema,
  SignMessageResponse,
  SignMessageResponseFailure,
  SignMessageResponseSchema,
  SignMessageResponseSuccess,
  WarningMessage,
} from '@celo/phone-number-privacy-common'
import Logger from 'bunyan'
import { Request, Response } from 'express'
import * as t from 'io-ts'
import { BLSCryptographyClient } from '../../../../bls/bls-cryptography-client'
import { VERSION } from '../../../../config'
import { getContractKit } from '../../../../web3/contracts'
import { IO } from '../../../base/io'
import { Session } from '../../../session'

export class PnpSignIO extends IO<SignMessageRequest> {
  readonly endpoint: CombinerEndpoint = CombinerEndpoint.SIGN_MESSAGE
  readonly signerEndpoint: SignerEndpoint = getSignerEndpoint(this.endpoint)
  readonly requestSchema: t.Type<
    SignMessageRequest,
    SignMessageRequest,
    unknown
  > = SignMessageRequestSchema
  readonly responseSchema: t.Type<
    SignMessageResponse,
    SignMessageResponse,
    unknown
  > = SignMessageResponseSchema

  async init(
    request: Request<{}, {}, unknown>,
    response: Response<SignMessageResponse>
  ): Promise<Session<SignMessageRequest> | null> {
    if (!super.inputChecks(request, response)) {
      return null
    }
    if (!(await this.authenticate(request, response.locals.logger()))) {
      this.sendFailure(WarningMessage.UNAUTHENTICATED_USER, 401, response)
      return null
    }
    return new Session(
      request,
      response,
      new BLSCryptographyClient(
        this.config.keys.threshold,
        this.config.keys.pubKey,
        this.config.keys.polynomial
      )
    )
  }

  validateClientRequest(
    request: Request<{}, {}, unknown>
  ): request is Request<{}, {}, SignMessageRequest> {
    return (
      super.validateClientRequest(request) &&
      hasValidAccountParam(request.body) &&
      hasValidBlindedPhoneNumberParam(request.body) &&
      identifierIsValidIfExists(request.body) &&
      isBodyReasonablySized(request.body)
    )
  }

  async authenticate(
    request: Request<{}, {}, SignMessageRequest>,
    logger: Logger
  ): Promise<boolean> {
    return authenticateUser(request, getContractKit(), logger)
  }

  sendSuccess(
    status: number,
    response: Response<SignMessageResponseSuccess>,
    signature: string,
    performedQueryCount?: number,
    totalQuota?: number,
    blockNumber?: number,
    warnings?: string[]
  ) {
    send(
      response,
      {
        success: true,
        version: VERSION,
        signature,
        performedQueryCount,
        totalQuota,
        blockNumber,
        warnings,
      },
      status,
      response.locals.logger()
    )
  }

  sendFailure(
    error: ErrorType,
    status: number,
    response: Response<SignMessageResponseFailure>,
    queryCount?: number,
    totalQuota?: number,
    blockNumber?: number,
    signature?: string
  ) {
    send(
      response,
      {
        success: false,
        version: VERSION,
        error,
        performedQueryCount: queryCount,
        totalQuota,
        blockNumber,
        signature,
      },
      status,
      response.locals.logger()
    )
  }
}
