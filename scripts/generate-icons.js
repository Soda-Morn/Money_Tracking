import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const sizes = [192, 512]

async function generateIcons() {
  for (const size of sizes) {
    const svgPath = join(__dirname, `../public/icons/icon-${size}.svg`)
    const pngPath = join(__dirname, `../public/icons/icon-${size}.png`)

    const svgBuffer = readFileSync(svgPath)

    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(pngPath)

    console.log(`Generated icon-${size}.png`)
  }

  console.log('All icons generated successfully!')
}

generateIcons().catch(console.error)
