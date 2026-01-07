const express = require('express');
const ethers = require('ethers');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const app = express();
app.use(express.json());

// Your backend wallet (signs approvals)
const BACKEND_PRIVATE_KEY = process.env.BACKEND_PRIVATE_KEY;
const wallet = new ethers.Wallet(BACKEND_PRIVATE_KEY);

// IPFS configuration
const IPFS_API_URL = process.env.IPFS_API_URL || 'https://ipfs.infura.io:5001';
const IPFS_GATEWAY = process.env.IPFS_GATEWAY || 'https://ipfs.io/ipfs';

// Database to store whitelisted users
const whitelistedUsers = new Map(); // discordId -> { walletAddress, approved }

// Discord OAuth callback
app.post('/auth/discord/callback', async (req, res) => {
    try {
        const { code, userWalletAddress } = req.body;
        
        // Exchange code for Discord access token
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', {
            client_id: process.env.DISCORD_CLIENT_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: process.env.DISCORD_REDIRECT_URI
        });
        
        const accessToken = tokenResponse.data.access_token;
        
        // Get user's guild member info
        const memberResponse = await axios.get(
            `https://discord.com/api/users/@me/guilds/${process.env.DISCORD_GUILD_ID}/member`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        
        const userId = memberResponse.data.user.id;
        const roles = memberResponse.data.roles;
        
        // Check if user has required role
        const approvedRoles = process.env.APPROVED_DISCORD_ROLES.split(',');
        const hasApprovedRole = roles.some(role => approvedRoles.includes(role));
        
        if (!hasApprovedRole) {
            return res.status(403).json({ error: 'You do not have the required Discord role' });
        }
        
        // Store in database
        whitelistedUsers.set(userId, {
            walletAddress: userWalletAddress,
            approved: true,
            approvedAt: new Date()
        });
        
        res.json({ 
            success: true, 
            message: 'You are whitelisted! You can now mint your SBT.'
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

// Upload media to IPFS
async function uploadToIPFS(fileBuffer, fileName) {
    try {
        const form = new FormData();
        form.append('file', fileBuffer, fileName);
        
        const response = await axios.post(`${IPFS_API_URL}/api/v0/add`, form, {
            headers: form.getHeaders(),
            timeout: 30000
        });
        
        const ipfsHash = response.data.Hash;
        return `ipfs://${ipfsHash}`;
    } catch (error) {
        console.error('IPFS upload failed:', error);
        throw new Error('Failed to upload media to IPFS');
    }
}

// Handle file upload endpoint
app.post('/upload-media', async (req, res) => {
    try {
        if (!req.files || !req.files.media) {
            return res.status(400).json({ error: 'No file provided' });
        }
        
        const file = req.files.media;
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        
        if (!allowedTypes.includes(file.mimetype)) {
            return res.status(400).json({ error: 'Invalid file type. Only images allowed.' });
        }
        
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            return res.status(400).json({ error: 'File too large. Max 5MB.' });
        }
        
        const mediaURI = await uploadToIPFS(file.data, file.name);
        
        res.json({
            success: true,
            mediaURI: mediaURI,
            ipfsHash: mediaURI.replace('ipfs://', ''),
            gateway: `${IPFS_GATEWAY}/${mediaURI.replace('ipfs://', '')}`
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Media upload failed' });
    }
});

// Generate signature for minting
app.post('/generate-mint-signature', async (req, res) => {
    try {
        const { userWalletAddress, metadata, mediaURI, credentialType, issuerName, level } = req.body;
        
        // Verify user is whitelisted
        let isWhitelisted = false;
        for (let [userId, userData] of whitelistedUsers) {
            if (userData.walletAddress.toLowerCase() === userWalletAddress.toLowerCase()) {
                isWhitelisted = true;
                break;
            }
        }
        
        if (!isWhitelisted) {
            return res.status(403).json({ error: 'Not whitelisted' });
        }
        
        if (!mediaURI || !mediaURI.startsWith('ipfs://')) {
            return res.status(400).json({ error: 'Valid IPFS media URI required' });
        }
        
        // Get current nonce for the user from the contract
        const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
        const RPC_URL = process.env.RPC_URL;
        
        const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
        const contract = new ethers.Contract(
            CONTRACT_ADDRESS,
            ['function nonces(address) view returns (uint256)'],
            provider
        );
        
        let nonce;
        try {
            nonce = await contract.nonces(userWalletAddress);
        } catch (error) {
            console.error('Failed to fetch nonce:', error);
            return res.status(500).json({ error: 'Failed to fetch nonce from contract' });
        }
        
        // Create message to sign (must match contract logic with nonce)
        const messageHash = ethers.utils.solidityKeccak256(
            ['address', 'string', 'string', 'string', 'string', 'uint256', 'uint256'],
            [userWalletAddress, metadata, mediaURI, credentialType, issuerName, nonce, level]
        );
        
        // Sign with backend wallet
        const signature = await wallet.signMessage(ethers.utils.arrayify(messageHash));
        
        res.json({
            success: true,
            signature: signature,
            userWalletAddress: userWalletAddress,
            metadata: metadata,
            mediaURI: mediaURI,
            credentialType: credentialType,
            issuerName: issuerName,
            level: level
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Signature generation failed' });
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));