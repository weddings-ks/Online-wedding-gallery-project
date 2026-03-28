const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { s3Client } = require("../config/spaces");

async function deleteSpacesObject(key) {
  if (!key || typeof key !== "string") {
    return;
  }

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: key
    })
  );
}

module.exports = {
  deleteSpacesObject
};