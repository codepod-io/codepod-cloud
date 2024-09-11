import { commandOptions, createClient } from "redis";

import AWS, {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
// import { env } from "./vars";

const env = {
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_REGION: process.env.AWS_REGION,
  S3_BUCKET: process.env.S3_BUCKET,
};

// Initialize the S3 client
const s3 = new S3Client({
  region: env.AWS_REGION,
  // credentials: {
  //   accessKeyId: env.AWS_ACCESS_KEY_ID,
  //   secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  // },
});

const redisClient = createClient({
  // url: process.env.REDIS_URL, // Example: "redis://localhost:6379"
  // redis service is redis-service:6379
  url: "redis://redis-service:6379",
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));

// FIXME await
// await
redisClient.connect().then(() => {
  console.log("Redis client connected");
});

// ------------------
// S3

async function handleSaveBlobToS3({
  repoId,
  yDocBlob,
}: {
  repoId: string;
  yDocBlob: Buffer;
}) {
  console.log("save blob to S3", repoId, yDocBlob.length);

  // Define S3 bucket and key
  const bucketName = env.S3_BUCKET;
  const key = `yblob/${repoId}.blob`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: yDocBlob,
    ContentLength: yDocBlob.length,
  });

  await s3.send(command);

  console.log("Blob successfully uploaded to S3");
}

async function loadBlobFromS3(repoId: string) {
  console.log("load blob from S3", repoId);

  // Define S3 bucket and key
  const bucketName = env.S3_BUCKET;
  const key = `yblob/${repoId}.blob`;

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  const { Body } = await s3.send(command);

  const streamToBuffer = async (stream) => {
    const chunks: any[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  };

  return await streamToBuffer(Body);
}

// ------------------
// Redis

export async function handleSaveBlobToRedis({
  repoId,
  yDocBlob,
}: {
  repoId: string;
  yDocBlob: Buffer;
}) {
  console.log("save blob to Redis", repoId, yDocBlob.length);

  // Store the blob in Redis with a TTL (e.g., 30 minutes)
  const base64Blob = yDocBlob.toString("base64");
  await redisClient.set(repoId, base64Blob, {
    EX: 1800, // expire in 30 minutes
  });
  // Track the updated repoId in a Redis set for future flush
  await redisClient.sAdd("flushToS3Queue", repoId); // Use a set to avoid duplicate entries
}

export async function loadBlobFromCache(
  repoId: string
): Promise<Buffer | null> {
  console.log("load blob from Redis", repoId);

  // Try to get the blob from Redis
  // const yDocBlob = await redisClient.hGetAll(commandOptions({ returnBuffers: true }), repoId);
  // redisClient.hGet(commandOptions({ returnBuffers: true }))
  const base64Blob = await redisClient.get(repoId);

  if (base64Blob) {
    console.log("Blob found in Redis");
    return Buffer.from(base64Blob, "base64");
  } else {
    console.log("Blob not found in Redis, loading from S3");
    try {
      const yDocBlob = await loadBlobFromS3(repoId);
      await redisClient.set(repoId, yDocBlob.toString("base64"), { EX: 1800 });
      return yDocBlob;
    } catch (error) {
      //   if the no such key error
      if (error instanceof S3ServiceException && error.name === "NoSuchKey") {
        console.log("Blob not found in S3");
        return null;
      } else {
        throw error;
      }
    }
  }
}

// ------------------
// Flush worker

export async function listKeysToFlush() {
  const repoIds = await redisClient.sMembers("flushToS3Queue");
  console.log("keys to flush", repoIds);
}

export async function doFlush() {
  // Get all repo IDs that need to be flushed
  const repoIds = await redisClient.sMembers("flushToS3Queue");

  console.log("flushUpdatedBlobsToS3", repoIds);

  for (const repoId of repoIds) {
    try {
      console.log(`Flushing blob for ${repoId} to S3`);

      // Load the blob from Redis
      const base64Blob = await redisClient.get(repoId);
      if (!base64Blob) {
        console.error(`Blob not found in Redis for repoId: ${repoId}`);
        await redisClient.sRem("flushToS3Queue", repoId);
        continue;
      }

      // Convert Base64 string back to Buffer
      const yDocBlob = Buffer.from(base64Blob, "base64");

      // Upload the blob to S3
      await handleSaveBlobToS3({ repoId, yDocBlob });

      // Remove the processed repoId from the queue
      await redisClient.sRem("flushToS3Queue", repoId);
      console.log(
        `Successfully flushed and removed ${repoId} from the flush queue.`
      );
    } catch (error) {
      console.error(`Error flushing ${repoId} to S3:`, error);
    }
  }
}
