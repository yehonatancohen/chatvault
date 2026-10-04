/** Imports and backup cleanup must never mutate the same local archive concurrently. */
const operations = new Map<string, Promise<unknown>>();
export async function withArchiveOperation<T>(id: string, operation: () => Promise<T>): Promise<T> {
  const previous = operations.get(id) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  operations.set(id, current);
  try { return await current; }
  finally { if (operations.get(id) === current) operations.delete(id); }
}
