import {
  DomainRestrictedSignatureRequest,
  domainRestrictedSignatureRequestSchema,
  DomainRestrictedSignatureResponseFailure,
  DomainRestrictedSignatureResponseSuccess,
  DomainSchema,
  DomainState,
  ErrorType,
  KEY_VERSION_HEADER,
  OdisResponse,
  send,
  SignerEndpoint,
  verifyDomainRestrictedSignatureRequestAuthenticity,
  WarningMessage,
} from '@celo/phone-number-privacy-common'
import { Request, Response } from 'express'
import { Counters } from '../../common/metrics'
import config, { getVersion } from '../../config'
import { Key } from '../../key-management/key-provider-base'
import { IOAbstract } from '../io.abstract'
import { DomainSession } from './session'

export class DomainSignIO extends IOAbstract<DomainRestrictedSignatureRequest> {
  readonly enabled: boolean = config.api.domains.enabled
  readonly endpoint = SignerEndpoint.DOMAIN_SIGN

  async init(
    request: Request<{}, {}, unknown>,
    response: Response<OdisResponse<DomainRestrictedSignatureRequest>> // @victor type weirdness here
  ): Promise<DomainSession<DomainRestrictedSignatureRequest> | null> {
    if (!super.inputChecks(request, response)) {
      return null
    }
    if (!(await this.authenticate(request))) {
      this.sendFailure(WarningMessage.UNAUTHENTICATED_USER, 401, response)
      return null
    }
    return new DomainSession(request, response)
  }

  validate(
    request: Request<{}, {}, unknown>
  ): request is Request<{}, {}, DomainRestrictedSignatureRequest> {
    return domainRestrictedSignatureRequestSchema(DomainSchema).is(request.body)
  }

  authenticate(request: Request<{}, {}, DomainRestrictedSignatureRequest>): Promise<boolean> {
    return Promise.resolve(verifyDomainRestrictedSignatureRequestAuthenticity(request.body))
  }

  sendSuccess(
    status: number,
    response: Response<DomainRestrictedSignatureResponseSuccess>,
    key: Key,
    signature: string,
    domainState: DomainState
  ) {
    response.set(KEY_VERSION_HEADER, key.version.toString())
    send(
      response,
      {
        success: true,
        version: getVersion(),
        signature,
        status: domainState,
      },
      status,
      response.locals.logger()
    )
    Counters.responses.labels(this.endpoint, status.toString()).inc()
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
        version: getVersion(),
        error,
        status: domainState,
      },
      status,
      response.locals.logger()
    )
    Counters.responses.labels(this.endpoint, status.toString()).inc()
  }
}
