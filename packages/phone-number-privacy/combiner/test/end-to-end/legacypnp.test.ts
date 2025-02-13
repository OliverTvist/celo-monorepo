import { newKit } from '@celo/contractkit'
import { OdisUtils } from '@celo/identity'
import { PhoneNumberHashDetails } from '@celo/identity/lib/odis/phone-number-identifier'
import {
  ErrorMessages,
  getOdisPnpRequestAuth,
  WalletKeySigner,
} from '@celo/identity/lib/odis/query'
import {
  AuthenticationMethod,
  CombinerEndpoint,
  LegacySignMessageRequest,
  SignMessageResponseSchema,
  SignMessageResponseSuccess,
  TestUtils,
} from '@celo/phone-number-privacy-common'
import { randomBytes } from 'crypto'
import 'isomorphic-fetch'
import { getCombinerVersion } from '../../src'
import {
  ACCOUNT_ADDRESS,
  ACCOUNT_ADDRESS_NO_QUOTA,
  DEFAULT_FORNO_URL,
  dekAuthSigner,
  PHONE_NUMBER,
  SERVICE_CONTEXT,
  walletAuthSigner,
} from './resources'

require('dotenv').config()

jest.setTimeout(60000)

const { getBlindedPhoneNumber } = TestUtils.Utils

const expectedPhoneHash = '0x0e87c82690efb29b260d7129b9ded5ed313560997863eb5505ff7bcb5315af7a'
const expectedPepper = 'ekgnxF0UwzEii'
const expectedUnblindedSignature =
  'tbrOhZqiuMCwFOCki+ndnDpgTrkTjELvy/UDa85+VIvD3F3Fosp++6n2IDfgHdOA'

const combinerUrl = process.env.ODIS_COMBINER_SERVICE_URL
const fullNodeUrl = process.env.ODIS_BLOCKCHAIN_PROVIDER

const expectedVersion = getCombinerVersion()

describe(`Running against service deployed at ${combinerUrl} w/ blockchain provider ${fullNodeUrl}`, () => {
  it('Service is deployed at correct version', async () => {
    const response = await fetch(combinerUrl + CombinerEndpoint.STATUS, {
      method: 'GET',
    })
    const body = await response.json()
    // This checks against local package.json version, change if necessary
    expect(body.version).toBe(expectedVersion)
  })

  describe(`${CombinerEndpoint.LEGACY_PNP_SIGN}`, () => {
    it('Should succeed when authenticated with WALLET_KEY', async () => {
      const res = await OdisUtils.PhoneNumberIdentifier.getPhoneNumberIdentifier(
        PHONE_NUMBER,
        ACCOUNT_ADDRESS,
        walletAuthSigner,
        SERVICE_CONTEXT,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        CombinerEndpoint.LEGACY_PNP_SIGN
      )
      expect(res).toStrictEqual<PhoneNumberHashDetails>({
        e164Number: PHONE_NUMBER,
        phoneHash: expectedPhoneHash,
        pepper: expectedPepper,
        unblindedSignature: expectedUnblindedSignature,
      })
    })

    it('Should succeed when authenticated with DEK', async () => {
      const res = await OdisUtils.PhoneNumberIdentifier.getPhoneNumberIdentifier(
        PHONE_NUMBER,
        ACCOUNT_ADDRESS,
        dekAuthSigner(0),
        SERVICE_CONTEXT,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        CombinerEndpoint.LEGACY_PNP_SIGN
      )
      expect(res).toStrictEqual<PhoneNumberHashDetails>({
        e164Number: PHONE_NUMBER,
        phoneHash: expectedPhoneHash,
        pepper: expectedPepper,
        unblindedSignature: expectedUnblindedSignature,
      })
    })

    it('Should succeed on repeated valid requests', async () => {
      const res1 = await OdisUtils.PhoneNumberIdentifier.getPhoneNumberIdentifier(
        PHONE_NUMBER,
        ACCOUNT_ADDRESS,
        dekAuthSigner(0),
        SERVICE_CONTEXT,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        CombinerEndpoint.LEGACY_PNP_SIGN
      )
      expect(res1).toStrictEqual<PhoneNumberHashDetails>({
        e164Number: PHONE_NUMBER,
        phoneHash: expectedPhoneHash,
        pepper: expectedPepper,
        unblindedSignature: expectedUnblindedSignature,
      })
      const res2 = await OdisUtils.PhoneNumberIdentifier.getPhoneNumberIdentifier(
        PHONE_NUMBER,
        ACCOUNT_ADDRESS,
        dekAuthSigner(0),
        SERVICE_CONTEXT,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        CombinerEndpoint.LEGACY_PNP_SIGN
      )
      expect(res2).toStrictEqual<PhoneNumberHashDetails>(res1)
    })

    it('Should increment performedQueryCount on success', async () => {
      const req: LegacySignMessageRequest = {
        account: ACCOUNT_ADDRESS,
        blindedQueryPhoneNumber: getBlindedPhoneNumber(PHONE_NUMBER, randomBytes(32)),
        authenticationMethod: dekAuthSigner(0).authenticationMethod,
      }
      const res1 = (await OdisUtils.Query.queryOdis(
        req,
        SERVICE_CONTEXT,
        CombinerEndpoint.LEGACY_PNP_SIGN,
        SignMessageResponseSchema,
        {
          Authorization: await getOdisPnpRequestAuth(req, dekAuthSigner(0)),
        }
      )) as SignMessageResponseSuccess
      expect(res1.success).toBe(true)
      const req2 = req
      req2.blindedQueryPhoneNumber = getBlindedPhoneNumber(PHONE_NUMBER, randomBytes(32))
      const res2 = (await OdisUtils.Query.queryOdis(
        req2,
        SERVICE_CONTEXT,
        CombinerEndpoint.LEGACY_PNP_SIGN,
        SignMessageResponseSchema,
        {
          Authorization: await getOdisPnpRequestAuth(req, dekAuthSigner(0)),
        }
      )) as SignMessageResponseSuccess

      expect(res2.success).toBe(true)
      // There may be warnings but that's ok
      expect(res2).toMatchObject<SignMessageResponseSuccess>({
        success: true,
        version: expectedVersion,
        signature: res2.signature,
        performedQueryCount: res1.performedQueryCount + 1,
        totalQuota: res1.totalQuota,
        blockNumber: res2.blockNumber,
      })
    })

    it('Should not increment performedQueryCount on replayed request when using DEK auth', async () => {
      const req: LegacySignMessageRequest = {
        account: ACCOUNT_ADDRESS,
        blindedQueryPhoneNumber: getBlindedPhoneNumber(PHONE_NUMBER, randomBytes(32)),
        authenticationMethod: dekAuthSigner(0).authenticationMethod,
      }
      const res1 = (await OdisUtils.Query.queryOdis(
        req,
        SERVICE_CONTEXT,
        CombinerEndpoint.LEGACY_PNP_SIGN,
        SignMessageResponseSchema,
        {
          Authorization: await getOdisPnpRequestAuth(req, dekAuthSigner(0)),
        }
      )) as SignMessageResponseSuccess
      expect(res1.success).toBe(true)
      const res2 = (await OdisUtils.Query.queryOdis(
        req,
        SERVICE_CONTEXT,
        CombinerEndpoint.LEGACY_PNP_SIGN,
        SignMessageResponseSchema,
        {
          Authorization: await getOdisPnpRequestAuth(req, dekAuthSigner(0)),
        }
      )) as SignMessageResponseSuccess
      expect(res2.success).toBe(true)
      // There may be warnings but that's ok
      expect(res2).toMatchObject<SignMessageResponseSuccess>({
        success: true,
        version: expectedVersion,
        signature: res2.signature,
        performedQueryCount: res1.performedQueryCount,
        totalQuota: res1.totalQuota,
        blockNumber: res2.blockNumber,
      })
    })

    for (let i = 1; i <= 2; i++) {
      it(`Should succeed on valid request with key version header ${i}`, async () => {
        const res = await OdisUtils.PhoneNumberIdentifier.getPhoneNumberIdentifier(
          PHONE_NUMBER,
          ACCOUNT_ADDRESS,
          dekAuthSigner(0),
          SERVICE_CONTEXT,
          undefined,
          undefined,
          undefined,
          undefined,
          i,
          CombinerEndpoint.LEGACY_PNP_SIGN
        )
        expect(res).toStrictEqual<PhoneNumberHashDetails>({
          e164Number: PHONE_NUMBER,
          phoneHash: expectedPhoneHash,
          pepper: expectedPepper,
          unblindedSignature: expectedUnblindedSignature,
        })
      })
    }

    it(`Should succeed on invalid key version`, async () => {
      const res = await OdisUtils.PhoneNumberIdentifier.getPhoneNumberIdentifier(
        PHONE_NUMBER,
        ACCOUNT_ADDRESS,
        dekAuthSigner(0),
        SERVICE_CONTEXT,
        undefined,
        undefined,
        undefined,
        undefined,
        1.5,
        CombinerEndpoint.LEGACY_PNP_SIGN
      )
      expect(res).toStrictEqual<PhoneNumberHashDetails>({
        e164Number: PHONE_NUMBER,
        phoneHash: expectedPhoneHash,
        pepper: expectedPepper,
        unblindedSignature: expectedUnblindedSignature,
      })
    })

    it(`Should reject to throw ${ErrorMessages.ODIS_INPUT_ERROR} on unsupported key version`, async () => {
      await expect(
        OdisUtils.PhoneNumberIdentifier.getPhoneNumberIdentifier(
          PHONE_NUMBER,
          ACCOUNT_ADDRESS,
          dekAuthSigner(0),
          SERVICE_CONTEXT,
          undefined,
          undefined,
          undefined,
          undefined,
          10,
          CombinerEndpoint.LEGACY_PNP_SIGN
        )
      ).rejects.toThrow(ErrorMessages.ODIS_INPUT_ERROR)
    })

    it(`Should reject to throw ${ErrorMessages.ODIS_INPUT_ERROR} on invalid address`, async () => {
      await expect(
        OdisUtils.PhoneNumberIdentifier.getPhoneNumberIdentifier(
          PHONE_NUMBER,
          'not an address',
          dekAuthSigner(0),
          SERVICE_CONTEXT,
          undefined,
          undefined,
          undefined,
          undefined,
          1,
          CombinerEndpoint.LEGACY_PNP_SIGN
        )
      ).rejects.toThrow(ErrorMessages.ODIS_INPUT_ERROR)
    })

    it(`Should reject to throw ${ErrorMessages.ODIS_INPUT_ERROR} on invalid phone number`, async () => {
      await expect(
        OdisUtils.PhoneNumberIdentifier.getPhoneNumberIdentifier(
          'not a phone number',
          ACCOUNT_ADDRESS,
          dekAuthSigner(0),
          SERVICE_CONTEXT,
          undefined,
          undefined,
          undefined,
          undefined,
          1,
          CombinerEndpoint.LEGACY_PNP_SIGN
        )
      ).rejects.toThrow('Invalid phone number: not a phone number')
    })

    it(`Should reject to throw 'unknown account' with invalid WALLET_KEY auth`, async () => {
      const badWalletAuthSigner: WalletKeySigner = {
        authenticationMethod: AuthenticationMethod.WALLET_KEY,
        contractKit: newKit(DEFAULT_FORNO_URL), // doesn't have any private keys
      }
      await expect(
        OdisUtils.PhoneNumberIdentifier.getPhoneNumberIdentifier(
          PHONE_NUMBER,
          ACCOUNT_ADDRESS,
          badWalletAuthSigner,
          SERVICE_CONTEXT,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          CombinerEndpoint.LEGACY_PNP_SIGN
        )
      ).rejects.toThrow('unknown account')
    })

    it(`Should reject to throw ${ErrorMessages.ODIS_AUTH_ERROR} with invalid WALLET_KEY auth`, async () => {
      const req: LegacySignMessageRequest = {
        account: ACCOUNT_ADDRESS,
        blindedQueryPhoneNumber: getBlindedPhoneNumber(PHONE_NUMBER, randomBytes(32)),
        authenticationMethod: walletAuthSigner.authenticationMethod,
      }
      await expect(
        OdisUtils.Query.queryOdis(
          req,
          SERVICE_CONTEXT,
          CombinerEndpoint.LEGACY_PNP_SIGN,
          SignMessageResponseSchema,
          {
            Authorization: await walletAuthSigner.contractKit.connection.sign(
              JSON.stringify(req),
              ACCOUNT_ADDRESS_NO_QUOTA
            ),
          }
        )
      ).rejects.toThrow(ErrorMessages.ODIS_AUTH_ERROR)
    })

    it(`Should reject to throw ${ErrorMessages.ODIS_AUTH_ERROR} with invalid DEK auth`, async () => {
      await expect(
        OdisUtils.PhoneNumberIdentifier.getPhoneNumberIdentifier(
          PHONE_NUMBER,
          ACCOUNT_ADDRESS,
          dekAuthSigner(1),
          SERVICE_CONTEXT,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          CombinerEndpoint.LEGACY_PNP_SIGN
        )
      ).rejects.toThrow(ErrorMessages.ODIS_AUTH_ERROR)
    })

    it(`Should reject to throw ${ErrorMessages.ODIS_QUOTA_ERROR} when account has no quota`, async () => {
      await expect(
        OdisUtils.PhoneNumberIdentifier.getPhoneNumberIdentifier(
          PHONE_NUMBER,
          ACCOUNT_ADDRESS_NO_QUOTA,
          dekAuthSigner(0),
          SERVICE_CONTEXT,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          CombinerEndpoint.LEGACY_PNP_SIGN
        )
      ).rejects.toThrow(ErrorMessages.ODIS_QUOTA_ERROR)
    })
  })
})
