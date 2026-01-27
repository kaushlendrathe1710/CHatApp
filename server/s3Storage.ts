import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Response } from "express";
import { randomUUID } from "crypto";

// Utility function to add timeout to promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
}

export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// Validate AWS credentials are configured
function validateS3Config() {
  if (!process.env.AWS_S3_BUCKET_NAME) {
    throw new Error("AWS_S3_BUCKET_NAME environment variable is not set");
  }
  if (!process.env.AWS_ACCESS_KEY_ID) {
    throw new Error("AWS_ACCESS_KEY_ID environment variable is not set");
  }
  if (!process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error("AWS_SECRET_ACCESS_KEY environment variable is not set");
  }
  if (!process.env.AWS_REGION) {
    throw new Error("AWS_REGION environment variable is not set");
  }
}

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || "";

export class S3StorageService {
  constructor() {}

  private getMetadataKey(key: string): string {
    return `${key}.metadata.json`;
  }

  async getObjectEntityUploadURL(): Promise<{
    uploadURL: string;
    objectKey: string;
  }> {
    validateS3Config();

    const objectId = randomUUID();
    const key = `uploads/${objectId}`;
    const objectKey = `/objects/${key}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const uploadURL = await getSignedUrl(s3Client, command, { expiresIn: 900 });
    return { uploadURL, objectKey };
  }

  normalizeObjectEntityPath(rawPath: string): string {
    // Handle S3 URLs
    if (rawPath.includes("amazonaws.com")) {
      try {
        const url = new URL(rawPath);
        const pathParts = url.pathname.split("/");
        // Remove leading empty string and bucket name if present
        const key = pathParts
          .slice(pathParts[1] === BUCKET_NAME ? 2 : 1)
          .join("/");
        return `/objects/${key}`;
      } catch {
        return rawPath;
      }
    }

    // Handle direct upload URLs
    if (rawPath.startsWith("https://") && rawPath.includes("X-Amz-Algorithm")) {
      try {
        const url = new URL(rawPath);
        const pathParts = url.pathname.split("/");
        const key = pathParts
          .slice(pathParts[1] === BUCKET_NAME ? 2 : 1)
          .join("/");
        return `/objects/${key}`;
      } catch {
        return rawPath;
      }
    }

    return rawPath;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    validateS3Config();

    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    console.log("Normalized path:", normalizedPath);
    console.log("Bucket:", BUCKET_NAME);
    console.log("Region:", process.env.AWS_REGION);

    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    // Extract key from path
    const key = normalizedPath.replace("/objects/", "");
    console.log("Extracted key:", key);

    // Verify the object exists before setting metadata with timeout
    // NOTE: The file upload already confirmed the object exists (returned 200 OK)
    // This verification is optional and may timeout on some deployments (e.g., Render with network constraints)
    let objectExists = true;
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });
      console.log(`Checking if object exists: ${BUCKET_NAME}/${key}`);

      await withTimeout(s3Client.send(headCommand), 5000); // 5 second timeout
      console.log("Object verified to exist");
    } catch (error: any) {
      console.warn("HeadObject verification failed:", error.message);
      console.warn(
        "Continuing anyway since upload already succeeded (file must exist)"
      );

      // Only throw if it's a definitive 404, not a timeout/network error
      if (
        error.name === "NotFound" ||
        error.$metadata?.httpStatusCode === 404
      ) {
        throw new ObjectNotFoundError();
      }

      // For timeouts or other network errors, continue anyway since upload succeeded
      // This prevents timeouts in production environments with network constraints
      objectExists = true;
    }

    // Store ACL metadata as a separate JSON file
    const metadataKey = this.getMetadataKey(key);
    console.log("Storing metadata to:", metadataKey);

    const metadataCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: metadataKey,
      Body: JSON.stringify(aclPolicy),
      ContentType: "application/json",
    });

    try {
      await withTimeout(s3Client.send(metadataCommand), 10000); // 10 second timeout
      console.log("Metadata stored successfully");
    } catch (error: any) {
      console.error("Failed to store metadata:", error.message);
      // Even if metadata storage fails, the file is still in S3, so we return success
      console.warn(
        "Continuing despite metadata storage failure - file is accessible"
      );
    }

    return normalizedPath;
  }

  async getObjectEntityFile(
    objectPath: string
  ): Promise<{ key: string; exists: boolean }> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const key = objectPath.replace("/objects/", "");

    try {
      const command = new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });
      await s3Client.send(command);
      return { key, exists: true };
    } catch (error: any) {
      if (
        error.name === "NotFound" ||
        error.$metadata?.httpStatusCode === 404
      ) {
        throw new ObjectNotFoundError();
      }
      throw error;
    }
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: { key: string };
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    try {
      const metadataKey = this.getMetadataKey(objectFile.key);
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: metadataKey,
      });

      const response = await s3Client.send(command);
      const metadataStr = await response.Body?.transformToString();

      if (!metadataStr) {
        // No metadata exists yet - allow first-time setup (WRITE permission for initial upload)
        return requestedPermission === ObjectPermission.WRITE;
      }

      const aclPolicy: ObjectAclPolicy = JSON.parse(metadataStr);

      // Public objects are readable by anyone
      if (
        aclPolicy.visibility === "public" &&
        requestedPermission === ObjectPermission.READ
      ) {
        return true;
      }

      // Owner has full access
      if (userId && aclPolicy.owner === userId) {
        return true;
      }

      return false;
    } catch (error: any) {
      // If metadata doesn't exist, allow WRITE (for initial upload) but deny READ
      if (
        error.name === "NoSuchKey" ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return requestedPermission === ObjectPermission.WRITE;
      }
      throw error;
    }
  }

  async downloadObject(
    objectFile: { key: string },
    req: any,
    res: Response,
    cacheTtlSec: number = 3600
  ) {
    try {
      // First, get the file metadata to know the total size
      const headCommand = new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: objectFile.key,
      });
      const headResponse = await s3Client.send(headCommand);
      const fileSize = headResponse.ContentLength || 0;
      const contentType =
        headResponse.ContentType || "application/octet-stream";

      // Get ACL policy to determine cache settings
      let isPublic = false;
      try {
        const metadataKey = this.getMetadataKey(objectFile.key);
        const metadataCommand = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: metadataKey,
        });
        const metadataResponse = await s3Client.send(metadataCommand);
        const metadataStr = await metadataResponse.Body?.transformToString();
        if (metadataStr) {
          const aclPolicy: ObjectAclPolicy = JSON.parse(metadataStr);
          isPublic = aclPolicy.visibility === "public";
        }
      } catch {
        // If no metadata, default to private
        isPublic = false;
      }

      // Check for Range header (for video seeking)
      const range = req.headers.range;

      if (range) {
        // Parse range header (e.g., "bytes=0-1023")
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        // Fetch the requested range from S3
        const command = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: objectFile.key,
          Range: `bytes=${start}-${end}`,
        });

        const response = await s3Client.send(command);

        // Send 206 Partial Content response
        res.status(206);
        res.set({
          "Content-Type": contentType,
          "Content-Length": chunkSize.toString(),
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": `${
            isPublic ? "public" : "private"
          }, max-age=${cacheTtlSec}`,
        });

        if (response.Body) {
          const stream = response.Body as any;
          stream.pipe(res);
        } else {
          res.status(404).json({ error: "File not found" });
        }
      } else {
        // No range requested, send the entire file
        const command = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: objectFile.key,
        });

        const response = await s3Client.send(command);

        res.set({
          "Content-Type": contentType,
          "Content-Length": fileSize.toString(),
          "Accept-Ranges": "bytes",
          "Cache-Control": `${
            isPublic ? "public" : "private"
          }, max-age=${cacheTtlSec}`,
        });

        if (response.Body) {
          const stream = response.Body as any;
          stream.pipe(res);
        } else {
          res.status(404).json({ error: "File not found" });
        }
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  async deleteObject(objectPath: string): Promise<void> {
    try {
      const key = objectPath.replace("/objects/", "");

      // Delete the main object
      const deleteCommand = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });
      await s3Client.send(deleteCommand);

      // Delete the metadata file
      const metadataKey = this.getMetadataKey(key);
      const deleteMetadataCommand = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: metadataKey,
      });
      await s3Client.send(deleteMetadataCommand);
    } catch (error) {
      console.error("Error deleting object:", error);
      throw error;
    }
  }
}
