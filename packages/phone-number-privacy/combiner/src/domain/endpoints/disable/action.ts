import { DisableDomainRequest, ErrorMessage } from '@celo/phone-number-privacy-common'
import { CombineAction } from '../../../common/combine'
import { IO } from '../../../common/io'
import { Session } from '../../../common/session'
import { OdisConfig } from '../../../config'
import { DomainSignerResponseLogger } from '../../services/log-responses'
import { DomainThresholdStateService } from '../../services/threshold-state'

export class DomainDisableAction extends CombineAction<DisableDomainRequest> {
  readonly responseLogger: DomainSignerResponseLogger = new DomainSignerResponseLogger()

  constructor(
    readonly config: OdisConfig,
    readonly thresholdStateService: DomainThresholdStateService<DisableDomainRequest>,
    readonly io: IO<DisableDomainRequest>
  ) {
    super(config, io)
  }

  combine(session: Session<DisableDomainRequest>): void {
    this.responseLogger.logResponseDiscrepancies(session)
    try {
      const disableDomainStatus = this.thresholdStateService.findThresholdDomainState(session)
      if (disableDomainStatus.disabled) {
        this.io.sendSuccess(200, session.response, disableDomainStatus)
        return
      }
    } catch (err) {
      session.logger.error({ err }, 'Error combining signer disable domain status responses')
    }

    this.io.sendFailure(
      ErrorMessage.THRESHOLD_DISABLE_DOMAIN_FAILURE,
      session.getMajorityErrorCode() ?? 500,
      session.response,
      session.logger
    )
  }
}
