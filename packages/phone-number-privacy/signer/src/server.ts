import { timeout } from '@celo/base'
import { loggerMiddleware, rootLogger, SignerEndpoint } from '@celo/phone-number-privacy-common'
import Logger from 'bunyan'
import express, { Request, Response } from 'express'
import fs from 'fs'
import https from 'https'
import { Knex } from 'knex'
import * as PromClient from 'prom-client'
import { Counters, Histograms } from './common/metrics'
import { Config, getVersion } from './config'
import { KeyProvider } from './key-management/key-provider-base'
import { Controller } from './refactor/controller'
import { DomainDisableAction } from './refactor/domain/endpoints/disable/action'
import { DomainDisableIO } from './refactor/domain/endpoints/disable/io'
import { DomainQuotaAction } from './refactor/domain/endpoints/quota/action'
import { DomainQuotaIO } from './refactor/domain/endpoints/quota/io'
import { DomainSignAction } from './refactor/domain/endpoints/sign/action'
import { DomainSignIO } from './refactor/domain/endpoints/sign/io'
import { DomainQuotaService } from './refactor/domain/services/quota'
import { PnpQuotaAction } from './refactor/pnp/endpoints/quota/action'
import { PnpQuotaIO } from './refactor/pnp/endpoints/quota/io'
import { PnpSignAction } from './refactor/pnp/endpoints/sign/action'
import { PnpSignIO } from './refactor/pnp/endpoints/sign/io'
import { PnpQuotaService } from './refactor/pnp/services/quota'
import { getContractKit } from './web3/contracts'

require('events').EventEmitter.defaultMaxListeners = 15

export function startSigner(config: Config, db: Knex, keyProvider: KeyProvider) {
  const logger = rootLogger()

  logger.info('Creating express server')
  const app = express()
  app.use(express.json({ limit: '0.2mb' }), loggerMiddleware)

  app.get(SignerEndpoint.STATUS, (_req, res) => {
    res.status(200).json({
      version: getVersion(),
    })
  })

  app.get(SignerEndpoint.METRICS, (_req, res) => {
    res.send(PromClient.register.metrics())
  })

  // TODO: Clean this up / maybe roll into to Controller class
  const addMeteredSignerEndpoint = (
    endpoint: SignerEndpoint,
    handler: (req: Request, res: Response) => Promise<void>,
    method: 'post' | 'get' = 'post'
  ) =>
    app[method](endpoint, async (req, res) => {
      await callAndMeterLatency(endpoint, handler, req, res)
    })

  async function callAndMeterLatency(
    endpoint: SignerEndpoint,
    handler: (req: Request, res: Response) => Promise<void>,
    req: Request,
    res: Response
  ) {
    const childLogger: Logger = res.locals.logger
    const end = Histograms.responseLatency.labels(endpoint).startTimer()
    const timeoutRes = Symbol()
    await timeout(handler, [req, res], config.timeout, timeoutRes)
      .catch((error: any) => {
        if (error === timeoutRes) {
          Counters.timeouts.inc()
          childLogger.warn(`Timed out after ${config.timeout}ms`)
        }
      })
      .finally(end)
  }

  const kit = getContractKit(config)

  const pnpQuotaService = new PnpQuotaService(db, kit) // TODO(Alec): change accesses over to use this
  const domainQuotaService = new DomainQuotaService(db)

  const pnpQuota = new Controller(
    new PnpQuotaAction(
      config,
      pnpQuotaService,
      new PnpQuotaIO(config.api.phoneNumberPrivacy.enabled, kit)
    )
  )
  const pnpSign = new Controller(
    new PnpSignAction(
      db,
      config,
      pnpQuotaService,
      keyProvider,
      new PnpSignIO(config.api.phoneNumberPrivacy.enabled, kit)
    )
  )
  const domainQuota = new Controller(
    new DomainQuotaAction(config, domainQuotaService, new DomainQuotaIO(config.api.domains.enabled))
  )
  const domainSign = new Controller(
    new DomainSignAction(
      db,
      config,
      domainQuotaService,
      keyProvider,
      new DomainSignIO(config.api.domains.enabled)
    )
  )
  const domainDisable = new Controller(
    new DomainDisableAction(config, new DomainDisableIO(config.api.domains.enabled), db) // TODO: param ordering
  )

  addMeteredSignerEndpoint(SignerEndpoint.PARTIAL_SIGN_MESSAGE, pnpSign.handle.bind(pnpSign))
  addMeteredSignerEndpoint(SignerEndpoint.GET_QUOTA, pnpQuota.handle.bind(pnpQuota))
  addMeteredSignerEndpoint(SignerEndpoint.DOMAIN_QUOTA_STATUS, domainQuota.handle.bind(domainQuota))
  addMeteredSignerEndpoint(SignerEndpoint.DOMAIN_SIGN, domainSign.handle.bind(domainSign))
  addMeteredSignerEndpoint(SignerEndpoint.DISABLE_DOMAIN, domainDisable.handle.bind(domainDisable))

  const sslOptions = getSslOptions(config)
  if (sslOptions) {
    return https.createServer(sslOptions, app)
  } else {
    return app
  }
}

function getSslOptions(config: Config) {
  const logger = rootLogger()
  const { sslKeyPath, sslCertPath } = config.server

  if (!sslKeyPath || !sslCertPath) {
    logger.info('No SSL configs specified')
    return null
  }

  if (!fs.existsSync(sslKeyPath) || !fs.existsSync(sslCertPath)) {
    logger.error('SSL cert files not found')
    return null
  }

  return {
    key: fs.readFileSync(sslKeyPath),
    cert: fs.readFileSync(sslCertPath),
  }
}
