import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./vars";

// Set up the AWS SDK.
const client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * The method on the server that generates a pre-signed URL for a PUT request.
 */
export const createPresignedUrlPUT = ({ key }: { key: string }) => {
  // This function would normally be implemented on your server. Of course, you
  // should make sure the calling user is authenticated, etc.
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn: 3600 });
};

/**
 * The method on the server that generates a pre-signed URL for a GET request.
 */
export const createPresignedUrlGET = ({ key }: { key: string }) => {
  // This function would normally be implemented on your server. Of course, you
  // should make sure the calling user is authenticated, etc.
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn: 3600 });
};
