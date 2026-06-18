// Saves content to files on disk via the extension host.
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export async function run({ values, input }) {
  const filename = String(values.filename || 'output.txt')
  const dir = String(values.directory || os.homedir())
  const content = typeof input === 'string' ? input : JSON.stringify(input, null, 2)
  const fullPath = path.join(dir, filename)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, content, 'utf-8')
  return { saved: true, path: fullPath, bytes: Buffer.byteLength(content, 'utf-8') }
}
