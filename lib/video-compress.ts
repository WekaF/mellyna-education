import ffmpegStatic from 'ffmpeg-static'
import { spawn } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeFile, readFile, unlink } from 'fs/promises'
import { randomUUID } from 'crypto'
import fs from 'fs'

function getFfmpegPath(): string {
  if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
    return ffmpegStatic
  }
  return 'ffmpeg'
}

export async function compressVideo(
  inputBuffer: Buffer,
  originalName: string
): Promise<{ buffer: Buffer; filename: string }> {
  const id = randomUUID()
  const ext = originalName.split('.').pop() || 'mp4'
  const inputPath = join(tmpdir(), `${id}-in.${ext}`)
  const outputPath = join(tmpdir(), `${id}-out.mp4`)

  await writeFile(inputPath, inputBuffer)

  const ffmpegPath = getFfmpegPath()

  try {
    await new Promise<void>((resolve, reject) => {
      const args = [
        '-i', inputPath,
        '-vcodec', 'libx264',
        '-crf', '28',
        '-preset', 'fast',
        '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease',
        '-acodec', 'aac',
        '-b:a', '96k',
        '-movflags', '+faststart',
        '-y',
        outputPath,
      ]
      const proc = spawn(ffmpegPath, args)
      const timeout = setTimeout(() => {
        proc.kill('SIGKILL')
        reject(new Error('ffmpeg timeout after 8 minutes'))
      }, 8 * 60 * 1000)
      proc.on('close', (code) => {
        clearTimeout(timeout)
        if (code === 0) resolve()
        else reject(new Error(`ffmpeg exited with code ${code}`))
      })
      proc.on('error', (e) => {
        clearTimeout(timeout)
        reject(e)
      })
    })

    const compressed = await readFile(outputPath)
    const baseName = originalName.replace(/\.[^.]+$/, '')
    return { buffer: compressed, filename: `${baseName}.mp4` }
  } finally {
    await Promise.allSettled([unlink(inputPath), unlink(outputPath)])
  }
}
