/**
 * A file on the phone as a `RandomAccess` (`zip-reader.ts`), so an export zip is read in place
 * rather than loaded whole. Device-only: `expo-file-system` is a native module.
 *
 * `FileHandle.readBytes` is synchronous, so setting the offset and reading happen in one turn of
 * the JS thread and concurrent reads cannot interleave between the two.
 */

import type { File } from "expo-file-system";
import type { RandomAccess } from "./zip-reader";

export function openRandomAccess(file: File): RandomAccess & { close(): void } {
  const handle = file.open();
  const size = handle.size ?? file.size ?? 0;
  let open = true;
  return {
    size,
    read(offset, length) {
      handle.offset = offset;
      return Promise.resolve(handle.readBytes(length));
    },
    close() {
      if (open) handle.close();
      open = false;
    },
  };
}
