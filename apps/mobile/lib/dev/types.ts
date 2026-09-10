/**
 * Shared shapes for the dev checks, so one screen can render both suites.
 *
 * `ContractResultLike` is structurally `@chatvault/storage`'s `ContractResult`. It is declared
 * rather than imported so that the pipeline check does not have to pretend to be a storage
 * adapter contract; the storage suite's results satisfy this by construction.
 */

export type { ContractResult as ContractResultLike } from "@chatvault/storage";

export { encodeUtf8, InMemoryMediaSource } from "@chatvault/core";
