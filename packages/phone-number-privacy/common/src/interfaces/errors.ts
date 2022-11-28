export enum ErrorMessage {
  UNKNOWN_ERROR = `CELO_ODIS_ERR_00 Something went wrong`,
  DATABASE_UPDATE_FAILURE = `CELO_ODIS_ERR_01 DB_ERR Failed to update database entry`,
  DATABASE_INSERT_FAILURE = `CELO_ODIS_ERR_02 DB_ERR Failed to insert database entry`,
  DATABASE_GET_FAILURE = `CELO_ODIS_ERR_03 DB_ERR Failed to get database entry`,
  KEY_FETCH_ERROR = `CELO_ODIS_ERR_04 INIT_ERR Failed to retrieve key from keystore`,
  SIGNATURE_COMPUTATION_FAILURE = `CELO_ODIS_ERR_05 SIG_ERR Failed to compute BLS signature`,
  VERIFY_PARITAL_SIGNATURE_ERROR = `CELO_ODIS_ERR_06 SIG_ERR BLS partial signature verification Failure`,
  NOT_ENOUGH_PARTIAL_SIGNATURES = `CELO_ODIS_ERR_07 SIG_ERR Not enough partial signatures`,
  INCONSISTENT_SIGNER_RESPONSES = `CELO_ODIS_ERR_08 SIG_ERR Inconsistent responses from signers`,
  SIGNER_REQUEST_ERROR = `CELO_ODIS_ERR_09 SIG_ERR Failure in signer request`,
  TIMEOUT_FROM_SIGNER = `CELO_ODIS_ERR_10 SIG_ERR Timeout from signer`,
  FULL_NODE_ERROR = `CELO_ODIS_ERR_11 NODE_ERR Failed to read on-chain state`,
  FAILURE_TO_STORE_REQUEST = `CELO_ODIS_ERR_12 DB_ERR Failed to store partial sig request`,
  FAILURE_TO_INCREMENT_QUERY_COUNT = `CELO_ODIS_ERR_13 DB_ERR Failed to increment user query count`,
  DOMAIN_ALREADY_DISABLED_FAILURE = `CELO_ODIS_ERR_14 DB_ERR Domain is already disabled`,
  UNSUPPORTED_DOMAIN = `CELO_ODIS_ERR_15 DOMAIN Domain type is not supported`,
  SIGNER_DISABLE_DOMAIN_FAILURE = `CELO_ODIS_ERR_16 DOMAIN Failed to disable domain on a signer`,
  THRESHOLD_DISABLE_DOMAIN_FAILURE = `CELO_ODIS_ERR_17 DOMAIN Failed to disable domain on a threshold of signers`,
  SIGNER_DOMAIN_QUOTA_STATUS_FAILURE = `CELO_ODIS_ERR_18 DOMAIN Failed to get domain status from signer`,
  THRESHOLD_DOMAIN_QUOTA_STATUS_FAILURE = `CELO_ODIS_ERR_19 DOMAIN Failed to get domain quota status from a threshold of signers`,
  INVALID_KEY_VERSION_RESPONSE = `CELO_ODIS_ERR_20 SIG_ERR Signer response key version header is invalid`,
  INVALID_SIGNER_RESPONSE = `CELO_ODIS_ERR_21 SIG_ERR Signer response body is invalid`,
  SIGNER_RESPONSE_FAILED_WITH_OK_STATUS = `CELO_ODIS_ERR_22 SIG_ERR Signer response failed with 200 status`,
  THRESHOLD_PNP_QUOTA_STATUS_FAILURE = `CELO_ODIS_ERR_23 SIG_ERR Failed to get PNP quota status from a threshold of signers`,
  FAILURE_TO_GET_PERFORMED_QUERY_COUNT = `CELO_ODIS_ERR_24 DB_ERR Failed to read performedQueryCount from signer db`,
  FAILURE_TO_GET_TOTAL_QUOTA = `CELO_ODIS_ERR_25 NODE_ERR Failed to read on-chain state to calculate total quota`,
  FAILURE_TO_GET_BLOCK_NUMBER = `CELO_ODIS_ERR_26 NODE_ERR Failed to read block number from full node`,
  FAILURE_TO_GET_DEK = `CELO_ODIS_ERR_26 NODE_ERR Failed to read user's DEK from full-node`,
  FAILING_OPEN = `CELO_ODIS_ERR_27 NODE_ERR Failing open on full-node error`,
  FAILING_CLOSED = `CELO_ODIS_ERR_28 NODE_ERR Failing closed on full-node error`,
  CAUGHT_ERROR_IN_ENDPOINT_HANDLER = `CELO_ODIS_ERR_29 Caught error in outer endpoint handler`,
  ERROR_AFTER_RESPONSE_SENT = `CELO_ODIS_ERR_30 Error in endpoint thrown after response was already sent`,
  SIGNATURE_AGGREGATION_FAILURE = 'CELO_ODIS_ERR_31 SIG_ERR Failed to blind aggregate signature shares',
}

export enum WarningMessage {
  INVALID_INPUT = `CELO_ODIS_WARN_01 BAD_INPUT Invalid input parameters`,
  UNAUTHENTICATED_USER = `CELO_ODIS_WARN_02 BAD_INPUT Missing or invalid authentication`,
  EXCEEDED_QUOTA = `CELO_ODIS_WARN_03 QUOTA Requester exceeded service query quota`,
  DUPLICATE_REQUEST_TO_GET_PARTIAL_SIG = `CELO_ODIS_WARN_06 BAD_INPUT Attempt to replay partial signature request`,
  INCONSISTENT_SIGNER_BLOCK_NUMBERS = `CELO_ODIS_WARN_07 SIGNER Discrepancy found in signers latest block number that exceeds threshold`,
  INCONSISTENT_SIGNER_QUOTA_MEASUREMENTS = `CELO_ODIS_WARN_08 SIGNER Discrepancy found in signers quota measurements`,
  MISSING_SESSION_ID = `CELO_ODIS_WARN_09 BAD_INPUT Client did not provide sessionID in request`,
  CANCELLED_REQUEST_TO_SIGNER = `CELO_ODIS_WARN_09 SIGNER Cancelled request to signer`,
  INVALID_USER_PHONE_NUMBER_SIGNATURE = `CELO_ODIS_WARN_10 BAD_INPUT User phone number signature is invalid`,
  UNKNOWN_DOMAIN = `CELO_ODIS_WARN_11 BAD_INPUT Provided domain name and version is not recognized`,
  DISABLED_DOMAIN = `CELO_ODIS_WARN_12 BAD_INPUT Provided domain is disabled`,
  INVALID_KEY_VERSION_REQUEST = `CELO_ODIS_WARN_13 BAD_INPUT Request key version header is invalid`,
  API_UNAVAILABLE = `CELO_ODIS_WARN_14 BAD_INPUT API is unavailable`,
  INCONSISTENT_SIGNER_DOMAIN_DISABLED_STATES = `CELO_ODIS_WARN_15 SIGNER Discrepency found in signer domain disabled states`,
  INVALID_AUTH_SIGNATURE = `CELO_ODIS_WARN_12 BAD_INPUT Authorization signature was incorrectly generated. Request will be rejected in a future version.`,
  INVALID_NONCE = `CELO_ODIS_WARN_13 BAD_INPUT SequentialDelayDomain nonce check failed on Signer request`,
  SIGNER_RESPONSE_DISCREPANCIES = `CELO_ODIS_WARN_14 SIGNER Discrepancies detected in signer responses`,
  INCONSISTENT_SIGNER_QUERY_MEASUREMENTS = `CELO_ODIS_WARN_15 SIGNER Discrepancy found in signers performed query count measurements`,
}

export type ErrorType = ErrorMessage | WarningMessage
