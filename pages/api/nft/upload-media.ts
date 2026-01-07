import type { NextApiRequest, NextApiResponse } from 'next'
import formidable from 'formidable'
import FormData from 'form-data'
import fs from 'fs'
import axios from 'axios'

export const config = {
  api: {
    bodyParser: false,
  },
}

const IPFS_API_URL = process.env.IPFS_API_URL || 'https://ipfs.infura.io:5001'
const IPFS_GATEWAY = process.env.IPFS_GATEWAY || 'https://ipfs.io/ipfs'

async function uploadToIPFS(fileBuffer: Buffer, fileName: string): Promise<string> {
  try {
    const form = new FormData()
    form.append('file', fileBuffer, fileName)

    const response = await axios.post(`${IPFS_API_URL}/api/v0/add`, form, {
      headers: form.getHeaders(),
      timeout: 30000,
    })

    const ipfsHash = response.data.Hash
    return `ipfs://${ipfsHash}`
  } catch (error) {
    console.error('IPFS upload failed:', error)
    throw new Error('Failed to upload media to IPFS')
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Configure formidable - it will still write temp files in serverless,
    // but we clean them up immediately after reading
    const form = formidable({
      maxFileSize: 5 * 1024 * 1024, // 5MB
      // Formidable v3 uses temp directory by default in serverless
      // We'll read and clean up immediately
    })

    const [fields, files] = await form.parse(req)
    
    const fileArray = files.media
    if (!fileArray || fileArray.length === 0) {
      return res.status(400).json({ error: 'No file provided' })
    }

    const file = fileArray[0]
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (file.mimetype && !allowedTypes.includes(file.mimetype)) {
      // Clean up temp file before returning error
      try {
        if (file.filepath) {
          await fs.promises.unlink(file.filepath)
        }
      } catch (cleanupError) {
        console.warn('Could not clean up temporary file:', cleanupError)
      }
      return res.status(400).json({ error: 'Invalid file type. Only images allowed.' })
    }

    // Read file buffer asynchronously (limited to 5MB by formidable config)
    const fileBuffer = await fs.promises.readFile(file.filepath)
    
    // Validate file signature (magic numbers) to ensure it's actually an image
    const fileSignature = fileBuffer.slice(0, 4).toString('hex')
    const validSignatures = [
      'ffd8ffe0', // JPEG
      'ffd8ffe1', // JPEG
      'ffd8ffe2', // JPEG
      '89504e47', // PNG
      '47494638', // GIF
      '52494646', // WEBP (starts with RIFF)
    ]
    
    if (!validSignatures.some(sig => fileSignature.startsWith(sig))) {
      // Clean up temp file before returning error
      try {
        if (file.filepath) {
          await fs.promises.unlink(file.filepath)
        }
      } catch (cleanupError) {
        console.warn('Could not clean up temporary file:', cleanupError)
      }
      return res.status(400).json({ error: 'Invalid image file. File content does not match expected format.' })
    }
    
    const mediaURI = await uploadToIPFS(fileBuffer, file.originalFilename || 'upload')

    // Clean up temporary file immediately after successful upload
    try {
      if (file.filepath) {
        await fs.promises.unlink(file.filepath)
      }
    } catch (cleanupError) {
      // Ignore cleanup errors in serverless environment
      // Vercel automatically cleans /tmp after function execution
      console.warn('Could not clean up temporary file:', cleanupError)
    }

    res.json({
      success: true,
      mediaURI: mediaURI,
      ipfsHash: mediaURI.replace('ipfs://', ''),
      gateway: `${IPFS_GATEWAY}/${mediaURI.replace('ipfs://', '')}`,
    })
  } catch (error) {
    console.error('Media upload error:', error)
    res.status(500).json({ error: 'Media upload failed' })
  }
}
