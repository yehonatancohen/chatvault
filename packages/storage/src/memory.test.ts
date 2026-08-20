import { MemoryStorageAdapter } from "./memory.js";
import { runStorageConformance } from "./conformance.js";

runStorageConformance("MemoryStorageAdapter", () => new MemoryStorageAdapter());
