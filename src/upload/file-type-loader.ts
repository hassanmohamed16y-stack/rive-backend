import { importEsm } from '../common/utils/dynamic-import';

// `file-type` v22 is ESM-only and ships types that require `moduleResolution: node16/bundler`
// to resolve via its `exports` map, so we describe the small slice of its API we use here
// instead of importing its type declarations directly.
export type FileTypeResult = { ext: string; mime: string };
export type FileTypeFromBuffer = (buffer: Uint8Array | ArrayBuffer) => Promise<FileTypeResult | undefined>;

let fileTypeFromBufferPromise: Promise<FileTypeFromBuffer> | undefined;

/**
 * Isolated in its own module (rather than inlined in upload.service.ts) so tests can
 * `jest.mock('./file-type-loader')` and avoid ever executing the real dynamic
 * `import()` call, which Jest's CommonJS test environment cannot execute without
 * `--experimental-vm-modules`.
 */
export function loadFileTypeFromBuffer(): Promise<FileTypeFromBuffer> {
  fileTypeFromBufferPromise ??= importEsm<{ fileTypeFromBuffer: FileTypeFromBuffer }>('file-type')
    .then((mod) => mod.fileTypeFromBuffer);
  return fileTypeFromBufferPromise;
}
