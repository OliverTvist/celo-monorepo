import {
  CombinerEndpoint,
  DomainRestrictedSignatureRequest,
  domainRestrictedSignatureRequestSchema,
  DomainRestrictedSignatureResponse,
  DomainRestrictedSignatureResponseFailure,
  domainRestrictedSignatureResponseSchema,
  DomainRestrictedSignatureResponseSuccess,
  DomainSchema,
  DomainState,
  ErrorType,
  getSignerEndpoint,
  send,
  SequentialDelayDomainStateSchema,
  verifyDomainRestrictedSignatureRequestAuthenticity,
  WarningMessage,
} from '@celo/phone-number-privacy-common'
import { Request, Response } from 'express'
import * as t from 'io-ts'
import { BLSCryptographyClient } from '../../../../bls/bls-cryptography-client'
import { VERSION } from '../../../../config'
import { IO } from '../../../base/io'
import { Session } from '../../../session'

export class DomainSignIO extends IO<DomainRestrictedSignatureRequest> {
  readonly endpoint = CombinerEndpoint.DOMAIN_SIGN
  readonly signerEndpoint = getSignerEndpoint(this.endpoint)
  readonly requestSchema: t.Type<
    DomainRestrictedSignatureRequest,
    DomainRestrictedSignatureRequest,
    unknown
  > = domainRestrictedSignatureRequestSchema(DomainSchema)
  readonly responseSchema: t.Type<
    DomainRestrictedSignatureResponse,
    DomainRestrictedSignatureResponse,
    unknown
  > = domainRestrictedSignatureResponseSchema(SequentialDelayDomainStateSchema)

  async init(
    request: Request<{}, {}, unknown>,
    response: Response<DomainRestrictedSignatureResponse>
  ): Promise<Session<DomainRestrictedSignatureRequest> | null> {
    if (!super.inputChecks(request, response)) {
      return null
    }
    if (!(await this.authenticate(request))) {
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

  authenticate(request: Request<{}, {}, DomainRestrictedSignatureRequest>): Promise<boolean> {
    // Note that signing requests may include a nonce for replay protection that will be checked by
    // the signer, but is not checked here. As a result, requests that pass the authentication check
    // here may still fail when sent to the signer.
    return Promise.resolve(verifyDomainRestrictedSignatureRequestAuthenticity(request.body))
  }

  sendSuccess(
    status: number,
    response: Response<DomainRestrictedSignatureResponseSuccess>,
    signature: string,
    domainState: DomainState
  ) {
    send(
      response,
      {
        success: true,
        version: VERSION,
        signature,
        status: domainState,
      },
      status,
      response.locals.logger()
    )
  }

  sendFailure(
    error: ErrorType,
    status: number,
    response: Response<DomainRestrictedSignatureResponseFailure>,
    domainState?: DomainState
  ) {
    send(
      response,
      {
        success: false,
        version: VERSION,
        error,
        status: domainState,
      },
      status,
      response.locals.logger()
    )
  }
}
