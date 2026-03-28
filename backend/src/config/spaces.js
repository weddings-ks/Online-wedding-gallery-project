const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const path = require("path");

const bucketName = process.env.DO_SPACES_BUCKET;
const region = process.env.DO_SPACES_REGION || "eu-central-2";
const endpoint = process.env.DO_SPACES_ENDPOINT;
const accessKeyId = process.env.DO_SPACES_KEY;
const secretAccessKey = process.env.DO_SPACES_SECRET;

if (!bucketName || !endpoint || !accessKeyId || !secretAccessKey) {
  throw new Error(
    "Mungon Wasabi config në .env. Kontrollo DO_SPACES_BUCKET, DO_SPACES_ENDPOINT, DO_SPACES_KEY, DO_SPACES_SECRET."
  );
}

const normalizedEndpoint = endpoint.startsWith("http")
  ? endpoint
  : `https://${endpoint}`;

const publicBaseUrl = `https://${bucketName}.${endpoint.replace(
  /^https?:\/\//,
  ""
)}`;

const s3Client = new S3Client({
  region,
  endpoint: normalizedEndpoint,
  forcePathStyle: false,
  credentials: {
    accessKeyId,
    secretAccessKey
  }
});

function sanitizeFileName(name = "file") {
  return name
    .toString()
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+|\.+$/g, "")
    .toLowerCase();
}

function buildSpacesObjectKey({
  tenantId,
  eventId,
  albumId,
  originalName,
  index = 0
}) {
  const extension = path.extname(originalName || "") || "";
  const fileNameWithoutExt = path.basename(originalName || "file", extension);
  const safeBase = sanitizeFileName(fileNameWithoutExt || `file-${index + 1}`);
  const timestamp = Date.now();

  return `wedding-gallery/tenant-${tenantId}/event-${eventId}/album-${albumId}/${timestamp}-${index}-${safeBase}${extension}`;
}

async function uploadBufferToSpaces({
  buffer,
  key,
  mimetype,
  cacheControl = "public, max-age=31536000"
}) {
  if (!buffer || !key) {
    throw new Error("buffer dhe key janë të detyrueshme për upload.");
  }

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: mimetype || "application/octet-stream",
      CacheControl: cacheControl
    })
  );

  return {
    key,
    url: `${publicBaseUrl}/${key}`,
    provider: "wasabi"
  };
}

async function deleteObjectFromSpaces(key) {
  if (!key) return false;

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key
    })
  );

  return true;
}

async function deleteObjectsFromSpaces(keys = []) {
  const validKeys = keys.filter(Boolean);

  if (validKeys.length === 0) return {
    deleted: [],
    errors: []
  };

  if (validKeys.length === 1) {
    await deleteObjectFromSpaces(validKeys[0]);
    return {
      deleted: validKeys,
      errors: []
    };
  }

  const result = await s3Client.send(
    new DeleteObjectsCommand({
      Bucket: bucketName,
      Delete: {
        Objects: validKeys.map((Key) => ({ Key })),
        Quiet: false
      }
    })
  );

  return {
    deleted: (result.Deleted || []).map((item) => item.Key),
    errors: result.Errors || []
  };
}

async function generateSignedUrl(key, expiresIn = 60 * 60) {
  if (!key) return null;

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

async function listObjectsByPrefix(prefix) {
  if (!prefix) return [];

  const result = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix
    })
  );

  return result.Contents || [];
}

async function deleteFolderByPrefix(prefix) {
  if (!prefix) {
    return {
      deleted: [],
      errors: []
    };
  }

  const objects = await listObjectsByPrefix(prefix);
  const keys = objects.map((item) => item.Key).filter(Boolean);

  if (keys.length === 0) {
    return {
      deleted: [],
      errors: []
    };
  }

  return deleteObjectsFromSpaces(keys);
}

module.exports = {
  s3Client,
  bucketName,
  publicBaseUrl,
  uploadBufferToSpaces,
  deleteObjectFromSpaces,
  deleteObjectsFromSpaces,
  deleteFolderByPrefix,
  buildSpacesObjectKey,
  generateSignedUrl,
  listObjectsByPrefix
};