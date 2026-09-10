export {
  ObjectNotFoundError,
  type StorageAdapter,
  type StorageCapabilities,
} from "./adapter.js";
export { MemoryStorageAdapter } from "./memory.js";
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
