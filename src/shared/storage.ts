import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "@/shared/env";

export interface Storage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

const LOCAL_ROOT = path.join(process.cwd(), ".local-storage");

/** Writes private uploads to a git-ignored local directory — never under `public/`, so nothing here is ever served directly by Next.js. Default adapter for local dev. */
class LocalStorage implements Storage {
  private resolve(key: string): string {
    const resolved = path.join(LOCAL_ROOT, key);
    if (!resolved.startsWith(LOCAL_ROOT + path.sep)) throw new Error("invalid storage key");
    return resolved;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const filePath = this.resolve(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }
}

/**
 * Not implemented in this MVP — the payment provider follows the same
 * pattern (§10: "fake/local impl only"). Wire an S3-compatible SDK here
 * (put via multipart upload, get/delete via the SDK client, and expose
 * presigned URLs if the app ever needs to hand a signed link to a client)
 * before setting STORAGE_ADAPTER=s3 in any real deployment. See README.
 */
class S3Storage implements Storage {
  constructor() {
    throw new Error(
      "STORAGE_ADAPTER=s3 is not implemented in this MVP. Configure an S3-compatible SDK in src/shared/storage.ts before using it.",
    );
  }
  async put(): Promise<void> {
    throw new Error("not implemented");
  }
  async get(): Promise<Buffer> {
    throw new Error("not implemented");
  }
  async delete(): Promise<void> {
    throw new Error("not implemented");
  }
}

let storage: Storage | null = null;

export function getStorage(): Storage {
  if (!storage) storage = env.STORAGE_ADAPTER === "s3" ? new S3Storage() : new LocalStorage();
  return storage;
}

export function generateResumeStorageKey(userId: string, originalFilename: string): string {
  const ext = path.extname(originalFilename).toLowerCase().replace(/[^a-z0-9.]/g, "");
  return `resumes/${userId}/${randomUUID()}${ext}`;
}

export function generatePhotoStorageKey(userId: string, originalFilename: string): string {
  const ext = path.extname(originalFilename).toLowerCase().replace(/[^a-z0-9.]/g, "");
  return `profile-photos/${userId}/${randomUUID()}${ext}`;
}
