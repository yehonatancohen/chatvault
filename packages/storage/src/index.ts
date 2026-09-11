export {
  ObjectNotFoundError,
  type LocalFile,
  type PutFileOptions,
  type StorageAdapter,
  type StorageCapabilities,
} from "./adapter.js";
export { MemoryStorageAdapter } from "./memory.js";
export {
  GoogleDriveStorageAdapter,
  type GoogleDriveAdapterOptions,
} from "./google-drive/adapter.js";
export {
  DriveAuthError,
  DriveClient,
  DriveError,
  DRIVE_SCOPE,
  type DriveClientOptions,
  type DriveFetch,
  type FileUploader,
  type DriveRequestInit,
  type DriveResponse,
} from "./google-drive/client.js";
export {
  APP_FOLDER_NAME,
  ensureAppFolder,
  ensureArchiveFolder,
  findAppFolder,
  listArchiveFolders,
} from "./google-drive/folders.js";
export { runLiveDriveContract } from "./google-drive/live-contract.js";
export { isSharedWithAnyone, shareWithAnyone, stopSharing } from "./google-drive/sharing.js";
export {
  offloadMedia,
  pullArchive,
  pushArchive,
  type PushResult,
  type SyncLedger,
  type SyncOptions,
  type SyncProgress,
} from "./sync.js";
export {
  runStorageContract,
  storageContract,
  isContractSkip,
  type ContractCase,
  type ContractResult,
  type ContractStatus,
} from "./contract.js";

/**
 * `runStorageConformance` is deliberately *not* re-exported here.
 *
 * It imports vitest, and this entry point is bundled into the mobile app by Metro — pulling a
 * Node test runner into a Hermes bundle is how an app dies at launch. Test files import it
 * directly from `./conformance.js`; app code wanting the same checks uses `runStorageContract`.
 */
