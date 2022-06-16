import { NULL_ADDRESS } from '@celo/base/lib/address'
import getPhoneHash from '@celo/phone-utils/lib/getPhoneHash'
import { CeloContractName } from '@celo/protocol/lib/registry-utils'
import {
  assertLogMatches2,
  assertRevert,
  assertRevertWithReason,
  assumeOwnership,
  timeTravel,
} from '@celo/protocol/lib/test-utils'
import { getDeployedProxiedContract } from '@celo/protocol/lib/web3-utils'
import {
  EscrowContract,
  EscrowInstance,
  MockAttestationsContract,
  MockAttestationsInstance,
  MockERC20TokenContract,
  MockERC20TokenInstance,
  RegistryInstance,
} from 'types'
import { getParsedSignatureOfAddress } from '../../lib/signing-utils'

const Escrow: EscrowContract = artifacts.require('Escrow')
const MockERC20Token: MockERC20TokenContract = artifacts.require('MockERC20Token')
const MockAttestations: MockAttestationsContract = artifacts.require('MockAttestations')

const NULL_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000'
const NULL_ESCROWED_PAYMENT: EscrowedPayment = {
  recipientIdentifier: NULL_BYTES32,
  sender: NULL_ADDRESS,
  token: NULL_ADDRESS,
  value: 0,
  sentIndex: 0,
  receivedIndex: 0,
  timestamp: 0,
  expirySeconds: 0,
  minAttestations: 0,
}
interface EscrowedPayment {
  recipientIdentifier: string
  sender: string
  token: string
  value: number
  sentIndex: number
  receivedIndex: number
  timestamp: number
  expirySeconds: number
  minAttestations: number
}

const getEscrowedPayment = async (
  paymentID: string,
  escrow: EscrowInstance
): Promise<EscrowedPayment> => {
  const payment = await escrow.escrowedPayments(paymentID)
  return {
    recipientIdentifier: payment[0],
    sender: payment[1],
    token: payment[2],
    value: payment[3].toNumber(),
    sentIndex: payment[4].toNumber(),
    receivedIndex: payment[5].toNumber(),
    timestamp: payment[6].toNumber(),
    expirySeconds: payment[7].toNumber(),
    minAttestations: payment[8].toNumber(),
  }
}

contract('Escrow', (accounts: string[]) => {
  let escrow: EscrowInstance
  let mockAttestations: MockAttestationsInstance
  const owner = accounts[0]
  let registry: RegistryInstance

  before(async () => {
    registry = await getDeployedProxiedContract('Registry', artifacts)
    // Take ownership of the registry contract to point it to the mocks
    if ((await registry.owner()) !== owner) {
      // In CI we need to assume ownership, locally using quicktest we don't
      await assumeOwnership(['Registry'], owner)
    }
  })

  beforeEach(async () => {
    escrow = await Escrow.new(true, { from: owner })
    await escrow.initialize()
    mockAttestations = await MockAttestations.new({ from: owner })
    await registry.setAddressFor(CeloContractName.Attestations, mockAttestations.address)
  })

  describe('#initialize()', () => {
    it('should have set the owner', async () => {
      const actualOwner: string = await escrow.owner()
      assert.equal(actualOwner, owner)
    })

    it('should not be callable again', async () => {
      await assertRevert(escrow.initialize())
    })
  })

  describe('tests with tokens', () => {
    let mockERC20Token: MockERC20TokenInstance
    const aValue: number = 10
    const sender: string = accounts[1]
    const receiver: string = accounts[2]

    const aPhoneHash = getPhoneHash('+18005555555')
    const withdrawKeyAddress: string = accounts[3]
    const anotherWithdrawKeyAddress: string = accounts[4]
    const oneDayInSecs: number = 86400

    beforeEach(async () => {
      mockERC20Token = await MockERC20Token.new()
    })

    const mintAndTransfer = async (
      escrowSender: string,
      identifier: string,
      value: number,
      expirySeconds: number,
      paymentId: string,
      minAttestations: number
    ) => {
      await mockERC20Token.mint(escrowSender, value)
      await escrow.transfer(
        identifier,
        mockERC20Token.address,
        value,
        expirySeconds,
        paymentId,
        minAttestations,
        {
          from: escrowSender,
        }
      )
    }

    describe('#transfer()', async () => {
      const transferAndCheckState = async (
        escrowSender: string,
        identifier: string,
        value: number,
        expirySeconds: number,
        paymentId: string,
        minAttestations: number,
        expectedSentPaymentIds: string[],
        expectedReceivedPaymentIds: string[]
      ) => {
        const startingEscrowContractBalance = (
          await mockERC20Token.balanceOf(escrow.address)
        ).toNumber()
        const startingSenderBalance = (await mockERC20Token.balanceOf(escrowSender)).toNumber()

        await escrow.transfer(
          identifier,
          mockERC20Token.address,
          value,
          expirySeconds,
          paymentId,
          minAttestations,
          { from: escrowSender }
        )
        const escrowedPayment = await getEscrowedPayment(paymentId, escrow)
        assert.equal(
          escrowedPayment.value,
          value,
          'incorrect escrowedPayment.value in payment struct'
        )

        assert.equal(
          (await mockERC20Token.balanceOf(escrowSender)).toNumber(),
          startingSenderBalance - value,
          'incorrect final sender balance'
        )
        assert.equal(
          (await mockERC20Token.balanceOf(escrow.address)).toNumber(),
          startingEscrowContractBalance + value,
          'incorrect final Escrow contract balance'
        )

        // Check against expected receivedPaymentIds and sentPaymentIds,
        // and corresponding indices in the payment struct
        const receivedPaymentIds = await escrow.getReceivedPaymentIds(identifier)
        assert.deepEqual(
          receivedPaymentIds,
          expectedReceivedPaymentIds,
          'unexpected receivedPaymentIds'
        )
        assert.equal(
          receivedPaymentIds[escrowedPayment.receivedIndex],
          paymentId,
          "expected paymentId not found at expected index in identifier's received payments list"
        )
        const sentPaymentIds = await escrow.getSentPaymentIds(escrowSender)
        assert.deepEqual(sentPaymentIds, expectedSentPaymentIds, 'unexpected sentPaymentIds')
        assert.equal(
          sentPaymentIds[escrowedPayment.sentIndex],
          paymentId,
          "expected paymentId not found in escrowSender's sent payments list"
        )
      }

      beforeEach(async () => {
        await mockERC20Token.mint(sender, aValue)
      })

      it('should allow users to transfer tokens to any user', async () => {
        await transferAndCheckState(
          sender,
          aPhoneHash,
          aValue,
          oneDayInSecs,
          withdrawKeyAddress,
          0,
          [withdrawKeyAddress],
          [withdrawKeyAddress]
        )
      })

      it('should allow transfer when minAttestations > 0 and identifier is provided', async () => {
        await transferAndCheckState(
          sender,
          aPhoneHash,
          aValue,
          oneDayInSecs,
          withdrawKeyAddress,
          3,
          [withdrawKeyAddress],
          [withdrawKeyAddress]
        )
      })

      it('should allow transfer when no identifier is provided', async () => {
        await transferAndCheckState(
          sender,
          NULL_BYTES32,
          aValue,
          oneDayInSecs,
          withdrawKeyAddress,
          0,
          [withdrawKeyAddress],
          [withdrawKeyAddress]
        )
      })

      it('should allow transfers from same sender with different paymentIds', async () => {
        await mintAndTransfer(
          sender,
          NULL_BYTES32,
          aValue,
          oneDayInSecs,
          anotherWithdrawKeyAddress,
          0
        )
        await transferAndCheckState(
          sender,
          NULL_BYTES32,
          aValue,
          oneDayInSecs,
          withdrawKeyAddress,
          0,
          [anotherWithdrawKeyAddress, withdrawKeyAddress],
          [anotherWithdrawKeyAddress, withdrawKeyAddress]
        )
      })

      it('should emit the Transfer event', async () => {
        const receipt = await escrow.transfer(
          aPhoneHash,
          mockERC20Token.address,
          aValue,
          oneDayInSecs,
          withdrawKeyAddress,
          2,
          {
            from: sender,
          }
        )
        assertLogMatches2(receipt.logs[0], {
          event: 'Transfer',
          args: {
            from: sender,
            identifier: aPhoneHash,
            token: mockERC20Token.address,
            value: aValue,
            paymentId: withdrawKeyAddress,
            minAttestations: 2,
          },
        })
      })

      it('should not allow two transfers with same paymentId', async () => {
        await escrow.transfer(
          aPhoneHash,
          mockERC20Token.address,
          aValue,
          oneDayInSecs,
          withdrawKeyAddress,
          0,
          {
            from: sender,
          }
        )
        await assertRevertWithReason(
          escrow.transfer(
            aPhoneHash,
            mockERC20Token.address,
            aValue,
            oneDayInSecs,
            withdrawKeyAddress,
            0,
            {
              from: sender,
            }
          ),
          'paymentId already used'
        )
      })

      it('should not allow a transfer if token is 0', async () => {
        await assertRevert(
          escrow.transfer(aPhoneHash, NULL_ADDRESS, aValue, oneDayInSecs, withdrawKeyAddress, 0, {
            from: sender,
          })
        )
      })

      it('should not allow a transfer if value is 0', async () => {
        await assertRevert(
          escrow.transfer(
            aPhoneHash,
            mockERC20Token.address,
            0,
            oneDayInSecs,
            withdrawKeyAddress,
            0,
            {
              from: sender,
            }
          )
        )
      })

      it('should not allow a transfer if expirySeconds is 0', async () => {
        await assertRevert(
          escrow.transfer(aPhoneHash, mockERC20Token.address, aValue, 0, withdrawKeyAddress, 0, {
            from: sender,
          })
        )
      })

      it('should not allow a transfer if identifier is empty but minAttestations is > 0', async () => {
        await assertRevertWithReason(
          escrow.transfer(
            NULL_BYTES32,
            mockERC20Token.address,
            aValue,
            oneDayInSecs,
            withdrawKeyAddress,
            1,
            {
              from: sender,
            }
          ),
          "Invalid privacy inputs: Can't require attestations if no identifier"
        )
      })
    })

    const checkStateAfterDeletingPayment = async (
      deletedPaymentId: string,
      deletedPayment: EscrowedPayment,
      escrowSender: string,
      identifier: string,
      expectedSentPaymentIds: string[],
      expectedReceivedPaymentIds: string[]
    ) => {
      const sentPaymentIds = await escrow.getSentPaymentIds(escrowSender)
      const receivedPaymentIds = await escrow.getReceivedPaymentIds(identifier)
      assert.deepEqual(sentPaymentIds, expectedSentPaymentIds, 'unexpected sentPaymentIds')
      assert.deepEqual(
        receivedPaymentIds,
        expectedReceivedPaymentIds,
        'unexpected receivedPaymentIds'
      )
      // Check that indices of last payment structs in previous lists are properly updated
      if (expectedSentPaymentIds.length) {
        const sendersLastPaymentAfterDelete = await getEscrowedPayment(
          expectedSentPaymentIds[expectedSentPaymentIds.length - 1],
          escrow
        )
        assert.equal(
          sendersLastPaymentAfterDelete.sentIndex,
          deletedPayment.sentIndex,
          "sentIndex of last payment in sender's sentPaymentIds not updated properly"
        )
      }
      if (expectedReceivedPaymentIds.length) {
        const receiversLastPaymentAfterDelete = await getEscrowedPayment(
          expectedReceivedPaymentIds[expectedReceivedPaymentIds.length - 1],
          escrow
        )
        assert.equal(
          receiversLastPaymentAfterDelete.receivedIndex,
          deletedPayment.receivedIndex,
          "receivedIndex of last payment in receiver's receivedPaymentIds not updated properly"
        )
      }
      const deletedEscrowedPayment = await getEscrowedPayment(deletedPaymentId, escrow)
      assert.deepEqual(
        deletedEscrowedPayment,
        NULL_ESCROWED_PAYMENT,
        'escrowedPayment not zeroed out'
      )
    }

    describe('#withdraw()', () => {
      const uniquePaymentIDWithdraw = withdrawKeyAddress

      const withdrawAndCheckState = async (
        escrowSender: string,
        escrowReceiver: string,
        identifier: string,
        value: number,
        paymentId: string,
        attestationsToComplete: number,
        expectedSentPaymentIds: string[],
        expectedReceivedPaymentIds: string[]
      ) => {
        const receiverBalanceBefore = (await mockERC20Token.balanceOf(escrowReceiver)).toNumber()
        const escrowContractBalanceBefore = (
          await mockERC20Token.balanceOf(escrow.address)
        ).toNumber()
        const paymentBefore = await getEscrowedPayment(paymentId, escrow)

        // Mock completed attestations
        for (let i = 0; i < attestationsToComplete; i++) {
          await mockAttestations.complete(identifier, 0, NULL_BYTES32, NULL_BYTES32, {
            from: escrowReceiver,
          })
        }
        const parsedSig = await getParsedSignatureOfAddress(web3, escrowReceiver, paymentId)
        await escrow.withdraw(paymentId, parsedSig.v, parsedSig.r, parsedSig.s, {
          from: escrowReceiver,
        })
        assert.equal(
          (await mockERC20Token.balanceOf(escrowReceiver)).toNumber(),
          receiverBalanceBefore + value,
          'incorrect final receiver balance'
        )

        assert.equal(
          (await mockERC20Token.balanceOf(escrow.address)).toNumber(),
          escrowContractBalanceBefore - value,
          'incorrect final Escrow contract balance'
        )

        await checkStateAfterDeletingPayment(
          paymentId,
          paymentBefore,
          escrowSender,
          identifier,
          expectedSentPaymentIds,
          expectedReceivedPaymentIds
        )
      }

      describe('when no payment has been escrowed', () => {
        it('should fail to withdraw funds', async () => {
          const parsedSig = await getParsedSignatureOfAddress(
            web3,
            receiver,
            uniquePaymentIDWithdraw
          )
          await assertRevertWithReason(
            escrow.withdraw(uniquePaymentIDWithdraw, parsedSig.v, parsedSig.r, parsedSig.s, {
              from: receiver,
            }),
            'Invalid withdraw value.'
          )
        })
      })

      describe('when first payment from sender is escrowed without an identifier', () => {
        beforeEach(async () => {
          await mintAndTransfer(
            sender,
            NULL_BYTES32,
            aValue,
            oneDayInSecs,
            uniquePaymentIDWithdraw,
            0
          )
        })

        it('should allow withdrawal with possession of PK and no attestations', async () => {
          await withdrawAndCheckState(
            sender,
            receiver,
            NULL_BYTES32,
            aValue,
            uniquePaymentIDWithdraw,
            0,
            [],
            []
          )
        })

        it('should emit the Withdrawal event', async () => {
          const parsedSig = await getParsedSignatureOfAddress(
            web3,
            receiver,
            uniquePaymentIDWithdraw
          )
          const receipt = await escrow.withdraw(
            uniquePaymentIDWithdraw,
            parsedSig.v,
            parsedSig.r,
            parsedSig.s,
            { from: receiver }
          )
          assertLogMatches2(receipt.logs[0], {
            event: 'Withdrawal',
            args: {
              identifier: NULL_BYTES32,
              to: receiver,
              token: mockERC20Token.address,
              value: aValue,
              paymentId: uniquePaymentIDWithdraw,
            },
          })
        })

        it('should withdraw properly when second payment escrowed with empty identifier', async () => {
          await mintAndTransfer(
            sender,
            NULL_BYTES32,
            aValue,
            oneDayInSecs,
            anotherWithdrawKeyAddress,
            0
          )
          await withdrawAndCheckState(
            sender,
            receiver,
            NULL_BYTES32,
            aValue,
            uniquePaymentIDWithdraw,
            0,
            [anotherWithdrawKeyAddress],
            [anotherWithdrawKeyAddress]
          )
        })
        it("should withdraw properly when sender's second payment has an identifier with attestations", async () => {
          await mintAndTransfer(
            sender,
            aPhoneHash,
            aValue,
            oneDayInSecs,
            anotherWithdrawKeyAddress,
            3
          )
          await withdrawAndCheckState(
            sender,
            receiver,
            NULL_BYTES32,
            aValue,
            uniquePaymentIDWithdraw,
            0,
            [anotherWithdrawKeyAddress],
            []
          )
        })
        it('should not allow withdrawing without a valid signature using the withdraw key', async () => {
          // The signature is invalidated if it's sent from a different address
          const parsedSig = await getParsedSignatureOfAddress(
            web3,
            receiver,
            uniquePaymentIDWithdraw
          )
          await assertRevertWithReason(
            escrow.withdraw(uniquePaymentIDWithdraw, parsedSig.v, parsedSig.r, parsedSig.s, {
              from: sender,
            }),
            'Failed to prove ownership of the withdraw key'
          )
        })
      })

      describe('when first payment is escrowed by a sender for an identifier && minAttestations', () => {
        const minAttestations = 3
        beforeEach(async () => {
          await mintAndTransfer(
            sender,
            aPhoneHash,
            aValue,
            oneDayInSecs,
            uniquePaymentIDWithdraw,
            minAttestations
          )
        })

        it('should allow users to withdraw after completing attestations', async () => {
          await withdrawAndCheckState(
            sender,
            receiver,
            aPhoneHash,
            aValue,
            uniquePaymentIDWithdraw,
            minAttestations,
            [],
            []
          )
        })
        it('should not allow a user to withdraw a payment if they have fewer than minAttestations', async () => {
          await assertRevertWithReason(
            withdrawAndCheckState(
              sender,
              receiver,
              aPhoneHash,
              aValue,
              uniquePaymentIDWithdraw,
              minAttestations - 1,
              [],
              []
            ),
            'This account does not have enough attestations to withdraw this payment.'
          )
        })
        it("should withdraw properly when sender's second payment has an identifier", async () => {
          await mintAndTransfer(
            sender,
            aPhoneHash,
            aValue,
            oneDayInSecs,
            anotherWithdrawKeyAddress,
            0
          )
          await withdrawAndCheckState(
            sender,
            receiver,
            aPhoneHash,
            aValue,
            uniquePaymentIDWithdraw,
            minAttestations,
            [anotherWithdrawKeyAddress],
            [anotherWithdrawKeyAddress]
          )
        })
      })
    })

    describe('#revoke()', () => {
      let uniquePaymentIDRevoke: string
      let parsedSig1: any

      const identifiers = [NULL_BYTES32, aPhoneHash]
      identifiers.forEach((identifier) => {
        describe(`when identifier is ${
          identifier === NULL_BYTES32 ? '' : 'not'
        } empty`, async () => {
          beforeEach(async () => {
            await mintAndTransfer(sender, identifier, aValue, oneDayInSecs, withdrawKeyAddress, 0)
            await mintAndTransfer(
              sender,
              identifier,
              aValue,
              oneDayInSecs,
              anotherWithdrawKeyAddress,
              0
            )

            uniquePaymentIDRevoke = withdrawKeyAddress
            parsedSig1 = await getParsedSignatureOfAddress(web3, receiver, withdrawKeyAddress)
          })

          it('should allow sender to redeem payment after payment has expired', async () => {
            await timeTravel(oneDayInSecs, web3)

            const senderBalanceBefore = (await mockERC20Token.balanceOf(sender)).toNumber()
            const escrowContractBalanceBefore = (
              await mockERC20Token.balanceOf(escrow.address)
            ).toNumber()
            const paymentBefore = await getEscrowedPayment(uniquePaymentIDRevoke, escrow)

            await escrow.revoke(uniquePaymentIDRevoke, { from: sender })

            assert.equal(
              (await mockERC20Token.balanceOf(sender)).toNumber(),
              senderBalanceBefore + aValue,
              'incorrect final sender balance'
            )
            assert.equal(
              (await mockERC20Token.balanceOf(escrow.address)).toNumber(),
              escrowContractBalanceBefore - aValue,
              'incorrect final Escrow contract balance'
            )

            await checkStateAfterDeletingPayment(
              uniquePaymentIDRevoke,
              paymentBefore,
              sender,
              identifier,
              [anotherWithdrawKeyAddress],
              [anotherWithdrawKeyAddress]
            )
          })

          it('should emit the Revocation event', async () => {
            await timeTravel(oneDayInSecs, web3)
            const receipt = await escrow.revoke(uniquePaymentIDRevoke, { from: sender })
            assertLogMatches2(receipt.logs[0], {
              event: 'Revocation',
              args: {
                identifier,
                by: sender,
                token: mockERC20Token.address,
                value: aValue,
                paymentId: withdrawKeyAddress,
              },
            })
          })

          it('should not allow sender to revoke payment after receiver withdraws', async () => {
            await escrow.withdraw(uniquePaymentIDRevoke, parsedSig1.v, parsedSig1.r, parsedSig1.s, {
              from: receiver,
            })
            await assertRevert(escrow.revoke(uniquePaymentIDRevoke, { from: sender }))
          })

          it('should not allow receiver to redeem payment after sender revokes it', async () => {
            await timeTravel(oneDayInSecs, web3)
            await escrow.revoke(uniquePaymentIDRevoke, { from: sender })
            await assertRevert(
              escrow.withdraw(uniquePaymentIDRevoke, parsedSig1.v, parsedSig1.r, parsedSig1.s, {
                from: receiver,
              })
            )
          })

          it('should not allow sender to revoke payment before payment has expired', async () => {
            await assertRevertWithReason(
              escrow.revoke(uniquePaymentIDRevoke, { from: sender }),
              'Transaction not redeemable for sender yet.'
            )
          })

          it('should not allow receiver to use revoke function', async () => {
            await timeTravel(oneDayInSecs, web3)
            await assertRevertWithReason(
              escrow.revoke(uniquePaymentIDRevoke, { from: receiver }),
              'Only sender of payment can attempt to revoke payment.'
            )
          })
        })
      })
    })
  })
})
