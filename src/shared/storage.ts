import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
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
 * S3-compatible adapter (AWS S3, Cloudflare R2, etc. — pick via S3_ENDPOINT;
 * leave it empty for AWS). The bucket must be private: objects are only ever
 * streamed back through authenticated app routes, never linked publicly.
 */
class S3Storage implements Storage {
  private client: S3Client;
  private bucket: string;

  constructor() {
    if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
      throw new Error("STORAGE_ADAPTER=s3 requires S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.");
    }
    this.bucket = env.S3_BUCKET;
    this.client = new S3Client({
      region: env.S3_REGION || "auto",
      endpoint: env.S3_ENDPOINT || undefined,
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
    });
  }

  async put(key: string, data: Buffer): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data }));
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!res.Body) throw new Error("storage object has no body");
    return Buffer.from(await res.Body.transformToByteArray());
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
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
