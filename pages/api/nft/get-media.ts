import type { NextApiRequest, NextApiResponse } from 'next'
import { getMediaStorage } from '@/lib/db'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { levelName, year, monthName } = req.body

  if (!levelName || !year || !monthName) {
    return res.status(400).json({ error: 'levelName, year, and monthName are required' })
  }

  try {
    const mediaStorage = await getMediaStorage(levelName, year, monthName)
    
    if (mediaStorage && mediaStorage.ipfs_cid) {
      // Convert CID to ipfs:// URI for consistency
      const ipfsUri = mediaStorage.ipfs_cid.startsWith('ipfs://') 
        ? mediaStorage.ipfs_cid 
        : `ipfs://${mediaStorage.ipfs_cid}`
      
      return res.json({
        success: true,
        ipfsCid: mediaStorage.ipfs_cid,
        ipfsUri: ipfsUri
      })
    }
    
    // No media found in database
    return res.json({
      success: false,
      error: 'Media not found for the specified level, year, and month'
    })
  } catch (error) {
    console.error('Error fetching media:', error)
    return res.status(500).json({ error: 'Failed to fetch media' })
  }
}
