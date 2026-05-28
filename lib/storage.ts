import * as Minio from 'minio'

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
  port: parseInt(process.env.MINIO_PORT ?? '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
})

const BUCKET = process.env.MINIO_BUCKET ?? 'mellyna-media'

export async function ensureBucket() {
  const exists = await minioClient.bucketExists(BUCKET)
  if (!exists) {
    await minioClient.makeBucket(BUCKET)
    await minioClient.setBucketPolicy(
      BUCKET,
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${BUCKET}/*`],
          },
        ],
      })
    )
  }
}

export async function uploadFile(buffer: Buffer, filename: string, mimetype: string): Promise<string> {
  await ensureBucket()
  const key = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  await minioClient.putObject(BUCKET, key, buffer, buffer.length, { 'Content-Type': mimetype })
  const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http'
  return `${protocol}://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${BUCKET}/${key}`
}
