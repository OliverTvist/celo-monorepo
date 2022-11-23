import { PhoneNumberUtils } from '@celo/phone-utils'
import { normalizeAddressWith0x, privateKeyToAddress } from '@celo/utils/lib/address'
import { getBlindedPhoneNumber } from './utils'

export const mockAccount = '0x0000000000000000000000000000000000007E57'
export const mockPhoneNumber = '+14155556666'
export const mockContractAddress = '0x000000000000000000000000000000000000CE10'

export const PRIVATE_KEY1 = '535029bfb19fe5440dbd549b88fbf5ee847b059485e4eafc2a3e3bdfbf9b31ac'
export const ACCOUNT_ADDRESS1 = normalizeAddressWith0x(privateKeyToAddress(PRIVATE_KEY1))
export const PRIVATE_KEY2 = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890fdeccc'
export const ACCOUNT_ADDRESS2 = privateKeyToAddress(PRIVATE_KEY2)
export const PRIVATE_KEY3 = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890fffff1d'
export const ACCOUNT_ADDRESS3 = normalizeAddressWith0x(privateKeyToAddress(PRIVATE_KEY3))
export const PHONE_NUMBER = '+15555555555'
export const IDENTIFIER = PhoneNumberUtils.getPhoneHash(PHONE_NUMBER)
export const BLINDING_FACTOR = Buffer.from('0IsBvRfkBrkKCIW6HV0/T1zrzjQSe8wRyU3PKojCnww=', 'base64')
export const BLINDED_PHONE_NUMBER = getBlindedPhoneNumber(PHONE_NUMBER, BLINDING_FACTOR)
export const DEK_PUBLIC_KEY = '0x026063780c81991c032fb4fa7485c6607b7542e048ef85d08516fe5c4482360e4b'
export const DEK_PRIVATE_KEY = '0xc2bbdabb440141efed205497a41d5fb6114e0435fd541e368dc628a8e086bfee'

// Public keys are expected to be in base64
export const PNP_DEV_ODIS_PUBLIC_KEY =
  'HzMTasAppwLrBBCWvZ7wncnDaN3lKpcoZr3q/wiW+FlrdKt639cxi7o4UnWZdoQA30S8q2a884Q8F6LOg4vNWouhY0wYMU/wVlp8dpkFuKj7onqGv0xssi34nhut/iuB'
export const PNP_DEV_SIGNER_PRIVATE_KEY =
  '00000000dd0005bf4de5f2f052174f5cf58dae1af1d556c7f7f85d6fb3656e1d0f10720f'
export const PNP_DEV_ODIS_POLYNOMIAL =
  '01000000000000001f33136ac029a702eb041096bd9ef09dc9c368dde52a972866bdeaff0896f8596b74ab7adfd7318bba38527599768400df44bcab66bcf3843c17a2ce838bcd5a8ba1634c18314ff0565a7c769905b8a8fba27a86bf4c6cb22df89e1badfe2b81'

// Public keys are expected to be in base64
export const DOMAINS_DEV_ODIS_PUBLIC_KEY =
  'CyJK6fkM0ZRILiW0h85LFev4BbMcLH1RBX5I9BNDgwX5jM74kv8+FjFZuJ1C4P0ADU1fuPGXXQg+wAGCclUD+BCza6ItIxSYmwsZ4ie1Iw1/pdTcwPJJlXwYwcDo+LKA'
export const DOMAINS_DEV_SIGNER_PRIVATE_KEY =
  '01000000f0c2d6231c9ed833da9478cbfd6e4970fcd893e156973862f6d286e7e1f6d904'
export const DOMAINS_DEV_ODIS_POLYNOMIAL =
  '01000000000000000b224ae9f90cd194482e25b487ce4b15ebf805b31c2c7d51057e48f413438305f98ccef892ff3e163159b89d42e0fd000d4d5fb8f1975d083ec00182725503f810b36ba22d2314989b0b19e227b5230d7fa5d4dcc0f249957c18c1c0e8f8b280'

// Generated with 2/3 ratio

export const PNP_THRESHOLD_DEV_PUBKEY_V1 =
  '61aeuHAdgxoKn/5d8yXu0qx/VpPHWMAqrVgEAJ/MpC7Oc/f1YLPiN7YKaw9eDWUBUWs4sPn6IN2UTGbt95jP6nO8IymD4IhbBONjLcElsq1jwTZ2cjuTHV9obSyDFl2B'
export const PNP_THRESHOLD_DEV_PK_SHARE_1_V1 =
  '000000000e7e1a2fad3b54deb2b1b32cf4c7b084842d50bbb5c6143b9d9577d16e050f03'
export const PNP_THRESHOLD_DEV_PK_SHARE_2_V1 =
  '01000000e43f10f7778e238e1ed58d5fad9363d7439d2b5a8eeda6073d68ba87c0b10011'
export const PNP_THRESHOLD_DEV_PK_SHARE_3_V1 =
  '02000000b90106bf4261e13389f867c267e86bd0015dcf9c48c784738695d0a3b3f8460c'
export const PNP_THRESHOLD_DEV_POLYNOMIAL_V1 =
  '0200000000000000eb569eb8701d831a0a9ffe5df325eed2ac7f5693c758c02aad5804009fcca42ece73f7f560b3e237b60a6b0f5e0d6501516b38b0f9fa20dd944c66edf798cfea73bc232983e0885b04e3632dc125b2ad63c13676723b931d5f686d2c83165d817aaff1f84d0b008ad218eff19db698f343168cf931ba8347640123a2f826f62b66ff084273f494d4647758e9a9f889009d573705824a0e74e1f49ed234462058e53bbb4fef370b55f78da89df070c661782a84239b8c7623d09e34b9f91f7781'

// Note: The pubkey doesn't change with a resharing, so normally the different key versions would have the same pubkey.
// We generated these key versions independently (not through resharing), since that is sufficient to test the key rotation logic

export const PNP_THRESHOLD_DEV_PUBKEY_V2 =
  '2ckOWP3qphyao1R4s8VHbVRdenGcFsgskQh5eCMqAwAziJzQAZ6Wo9CFD30YhhoA6B91QFIQaqfDvdblNeOtMDsmIKTDFtxZjg+cZZtQzrCTLU2owWEEb8RPJc8F3ekA'
export const PNP_THRESHOLD_DEV_PK_SHARE_1_V2 =
  '0000000087c722e1338395b942d8332328795a46c718baeb8fef9e5c63111d495469c50e'
export const PNP_THRESHOLD_DEV_PK_SHARE_2_V2 =
  '01000000e4efa9b60743f8188a68d35663d877143ad1726931eaa9af168fc86472eafd0d'
export const PNP_THRESHOLD_DEV_PK_SHARE_3_V2 =
  '020000004118318cdb025b78d1f8728a9e3795e2ac892be7d2e4b402ca0c7480906b360d'
export const PNP_THRESHOLD_DEV_POLYNOMIAL_V2 =
  '0200000000000000d9c90e58fdeaa61c9aa35478b3c5476d545d7a719c16c82c91087978232a030033889cd0019e96a3d0850f7d18861a00e81f754052106aa7c3bdd6e535e3ad303b2620a4c316dc598e0f9c659b50ceb0932d4da8c161046fc44f25cf05dde900ebf6f83c5cb94288347ebf437e99fbb7a7eaf0c9873467352c1a9113f5fc0974d96cbf25462def50c39224da757ed300ce12e0fa8c6e73387cb43c69764bed41d0a0c55981642650b07fad1107a27b27fc8c552da3edd64494e8acc4de9a2600'

export const PNP_THRESHOLD_DEV_PUBKEY_V3 =
  '5o9Y516dvzZLy7E/SfOSm2kVh02t1rU1tkJrk55/HjhRSZtyHRgAOnbnvKJvQjAA1OE70LsYlrKK8PGNVOp7cVdrFbm9xbkew+BU6hdO473qierDOF4SjKQNToyh5UOB'
export const PNP_THRESHOLD_DEV_PK_SHARE_1_V3 =
  '000000005b2c8089ead28a08233b6b16b2341542453523445950cfbd9bd2f1d09c8eee0c'
export const PNP_THRESHOLD_DEV_PK_SHARE_2_V3 =
  '01000000f6c10aa979a0c33a3af5b03c37ffdf1d4a8517a5f9e6058e1d863337eeb59904'
export const PNP_THRESHOLD_DEV_PK_SHARE_3_V3 =
  '02000000925795c808ee0d7752aff632bb40555350854362b8caf0bef5dea1379e42f00e'
export const PNP_THRESHOLD_DEV_POLYNOMIAL_V3 =
  '0200000000000000e68f58e75e9dbf364bcbb13f49f3929b6915874dadd6b535b6426b939e7f1e3851499b721d18003a76e7bca26f423000d4e13bd0bb1896b28af0f18d54ea7b71576b15b9bdc5b91ec3e054ea174ee3bdea89eac3385e128ca40d4e8ca1e543813fae8439a057f8c17d4538afecf038624e552a8c226c9f82bfb7a072cff28fb7d26ab45801b67db270cec8037b8d7e016b1b78f7997160bd4ed1b54ab5d6be7663935992cd9c59ceb17010eccd708a9762df616c1fe45a220be634e21ba87581'

export const PNP_THRESHOLD_DEV_POLYNOMIALS = [
  PNP_THRESHOLD_DEV_POLYNOMIAL_V1,
  PNP_THRESHOLD_DEV_POLYNOMIAL_V2,
  PNP_THRESHOLD_DEV_POLYNOMIAL_V3,
]

export const PNP_THRESHOLD_DEV_PUBKEYS = [
  PNP_THRESHOLD_DEV_PUBKEY_V1,
  PNP_THRESHOLD_DEV_PUBKEY_V2,
  PNP_THRESHOLD_DEV_PUBKEY_V3,
]

export const DOMAINS_THRESHOLD_DEV_PUBKEY_V1 =
  'zaetF6aXkBAkVwoUosuyQ8xiK2tKM9/zKrTPKbxoDoO7p6DSwbetk5uEICK+PjcAG4pGGY81jaUPSsPqlwIDfOy+RxJ2O+5ZPDM4I+b70MSYZYrsZ6qPxg+xtqLb9AOA'
export const DOMAINS_THRESHOLD_DEV_PK_SHARE_1_V1 =
  '010000000c63d9615b2ff0746562c0b438286544f029698a4205cd8b8f93afaa5b793211'
export const DOMAINS_THRESHOLD_DEV_PK_SHARE_2_V1 =
  '020000001b63b2c531070b176f56042da68923c5859b9f82181559646b58445976de5f08'
export const DOMAINS_THRESHOLD_DEV_PK_SHARE_3_V1 =
  '030000002b638b29085f37c3794a487512628c9f1cbd0dd70c72999d9dc205a2efa83812'
export const DOMAINS_THRESHOLD_DEV_POLYNOMIAL_V1 =
  '0200000000000000cda7ad17a697901024570a14a2cbb243cc622b6b4a33dff32ab4cf29bc680e83bba7a0d2c1b7ad939b842022be3e37001b8a46198f358da50f4ac3ea9702037cecbe4712763bee593c333823e6fbd0c498658aec67aa8fc60fb1b6a2dbf403804e71a1bb1f51f2186f579048cb224f8993295e699ea14552506418df6fcf019ffe6f89253d6122cc97b8f8c5785674006c821ca2d596e4c0d75aba2b03e8ba082e002d24ebe5c48956ef96b8ac85f96c9c7929e8facac50b74b3aac792ad5d00'

export const DOMAINS_THRESHOLD_DEV_PUBKEY_V2 =
  'rc9WQhFQn64w9FzlbVgyZi8Cd/bep+l3MtzPOWMInRQ3XoJMDSJ15SzBgE6M6JEAr58f9m2zZi6TMEcogbg3hHp37MUoybowzbGeed9jWqCWGQ0VBMFMaJLR8exNdtkA'
export const DOMAINS_THRESHOLD_DEV_PK_SHARE_1_V2 =
  '01000000a8070976747d9bb1fe56d822a57252ce3ddd5a8acef7e3ed94aeb52a16da4d04'
export const DOMAINS_THRESHOLD_DEV_PK_SHARE_2_V2 =
  '020000003d8495ff96deb0109216d575bc0f6ff364466e830ecb4d0e860d869ef8b82e0b'
export const DOMAINS_THRESHOLD_DEV_PK_SHARE_3_V2 =
  '03000000d2002289b93fc66f25d6d1c8d3ac8b188caf817c4e9eb72e776c5612db970f12'
export const DOMAINS_THRESHOLD_DEV_POLYNOMIAL_V2 =
  '0200000000000000adcf564211509fae30f45ce56d5832662f0277f6dea7e97732dccf3963089d14375e824c0d2275e52cc1804e8ce89100af9f1ff66db3662e9330472881b837847a77ecc528c9ba30cdb19e79df635aa096190d1504c14c6892d1f1ec4d76d900c32eadf29b938d0466e566b527c798434931c6c2afd84fdd34aa5d620b15d19b6b1d59f9fa0c81150bf62d316a1b8f000708a46bd4c807cab0a60e9692e1efe74084ae1503172377e39600b8fd88b4885ee55adae7bb21993909da127d3c0c81'

export const DOMAINS_THRESHOLD_DEV_PUBKEY_V3 =
  'OGHVPM0uXSduGBKQNyyGBr7IHXZQbnG9WopBhw5m0nddsmcoQP30/IBGCB0JGOsAemcw/mP43ueJxw7PPo/m+7JhFyu8cX7F61ULbmHAFd84wneZJf42U42rWSoC+IeB'
export const DOMAINS_THRESHOLD_DEV_PK_SHARE_1_V3 =
  '0100000030c5c6ae0959c96ccc3a31c73b1b603b9b448ccfc80dba2e496d31295caee40e'
export const DOMAINS_THRESHOLD_DEV_PK_SHARE_2_V3 =
  '02000000768eb3c42a126abaa80eb8cae14006f2a98cdd175d40984ad84e881c7bf7da0d'
export const DOMAINS_THRESHOLD_DEV_PK_SHARE_3_V3 =
  '03000000bc57a0da4bcb0a0885e23ece8766aca8b8d42e60f17276666730df0f9a40d10c'
export const DOMAINS_THRESHOLD_DEV_POLYNOMIAL_V3 =
  '02000000000000003861d53ccd2e5d276e181290372c8606bec81d76506e71bd5a8a41870e66d2775db2672840fdf4fc8046081d0918eb007a6730fe63f8dee789c70ecf3e8fe6fbb261172bbc717ec5eb550b6e61c015df38c2779925fe36538dab592a02f887817f62a8f350751888132fca7dd7ff06731102483340145ff1571229884b06bfbfb25636e4bc6ad5dc294a09e45f7171012d042d5be90537c3f0eb70d51c7f7a6c09cee7af8c4af1750afde124a47a98330073af8c9011ab8a1571bc8ee958e200'

export const DOMAINS_THRESHOLD_DEV_PUBKEY_V4 =
  'iRyLg54DDNq2c1TUAbsnc2VB5BwjBjBjJCysj6NO/Fmuki3LHjaSOscbNTQtZkIBTjBTALBDPzJAr1hDFebQTFHfg7oNaFUiEKC7P7Mhd0X9BJWNV8MEm+ZG4DymrAgA'
export const DOMAINS_THRESHOLD_DEV_PK_SHARE_1_V4 =
  '0100000044d1155eb821064919ef3b35625aa3595e2f0285d23181997836c6b18c661901'
export const DOMAINS_THRESHOLD_DEV_PK_SHARE_2_V4 =
  '02000000b02c15e2769896f6c8b9bd2e3be1ddcac753683e2b991ac7c12531334122ee00'
export const DOMAINS_THRESHOLD_DEV_PK_SHARE_3_V4 =
  '030000001c881466350f27a478843f281468183c3178cef78300b4f40a159cb4f5ddc200'
export const DOMAINS_THRESHOLD_DEV_POLYNOMIAL_V4 =
  '0200000000000000891c8b839e030cdab67354d401bb27736541e41c23063063242cac8fa34efc59ae922dcb1e36923ac71b35342d6642014e305300b0433f3240af584315e6d04c51df83ba0d68552210a0bb3fb3217745fd04958d57c3049be646e03ca6ac08004a8cd44dd5f648a0f3cba05024829e25c79e603193fd7cdedce1cf400bf828bea0aee6b6b792c8efb6771713e6a30e01c8f8f981445a4455ee425a676133f8a095850245d32ce4765d83fc672a87c7116295c4b4927c51aec38b944260ea0200'

export const DOMAINS_THRESHOLD_DEV_POLYNOMIALS = [
  DOMAINS_THRESHOLD_DEV_POLYNOMIAL_V1,
  DOMAINS_THRESHOLD_DEV_POLYNOMIAL_V2,
  DOMAINS_THRESHOLD_DEV_POLYNOMIAL_V3,
  DOMAINS_THRESHOLD_DEV_POLYNOMIAL_V4,
]

export const DOMAINS_THRESHOLD_DEV_PUBKEYS = [
  DOMAINS_THRESHOLD_DEV_PUBKEY_V1,
  DOMAINS_THRESHOLD_DEV_PUBKEY_V2,
  DOMAINS_THRESHOLD_DEV_PUBKEY_V3,
  DOMAINS_THRESHOLD_DEV_PUBKEY_V4,
]
