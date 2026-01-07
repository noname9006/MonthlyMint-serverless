import { useAccount, useContractWrite } from 'wagmi';
import { useState } from 'react';

function SBTMinter() {
    const { address } = useAccount();
    const [signature, setSignature] = useState(null);
    const [metadata, setMetadata] = useState('student');
    const [mediaFile, setMediaFile] = useState(null);
    const [mediaURI, setMediaURI] = useState('');
    const [credentialType, setCredentialType] = useState('Education');
    const [issuerName, setIssuerName] = useState('');
    const [level, setLevel] = useState(1);
    const [loading, setLoading] = useState(false);
    
    const { write: mintWithSignature } = useContractWrite({
        address: process.env.REACT_APP_CONTRACT_ADDRESS,
        abi: SBT_ABI,
        functionName: 'mintWithSignature'
    });
    
    const handleDiscordLogin = () => {
        const clientId = process.env.REACT_APP_DISCORD_CLIENT_ID;
        const redirectUri = encodeURIComponent(process.env.REACT_APP_DISCORD_REDIRECT_URI);
        
        window.location.href = 
            `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20guilds.members.read`;
    };
    
    const handleMediaUpload = async (file) => {
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('media', file);
            
            const response = await fetch('/upload-media', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const data = await response.json();
                setMediaURI(data.mediaURI);
                setMediaFile(file.name);
                alert(`Media uploaded! IPFS: ${data.ipfsHash}`);
            } else {
                const error = await response.json();
                alert(`Upload failed: ${error.error}`);
            }
        } catch (error) {
            alert('Media upload failed');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };
    
    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            handleMediaUpload(file);
        }
    };
    
    const handleGetSignature = async () => {
        if (!mediaURI) {
            alert('Please upload media first');
            return;
        }
        
        setLoading(true);
        try {
            const response = await fetch('/generate-mint-signature', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userWalletAddress: address,
                    metadata: metadata,
                    mediaURI: mediaURI,
                    credentialType: credentialType,
                    issuerName: issuerName,
                    level: parseInt(level)
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                setSignature(data.signature);
                alert('Signature ready! Click Mint to complete.');
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            alert('Failed to get signature');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };
    
    const handleMint = () => {
        if (!signature) {
            alert('Get signature first');
            return;
        }
        
        mintWithSignature({
            args: [
                address,
                metadata,
                mediaURI,
                credentialType,
                issuerName,
                parseInt(level),
                signature
            ]
        });
    };
    
    return (
        <div style={{ padding: '20px', fontFamily: 'Arial' }}>
            <h2>SBT Minter with IPFS Media</h2>
            
            <button onClick={handleDiscordLogin}>Login with Discord</button>
            
            <div style={{ marginTop: '20px' }}>
                <h3>Upload Media (IPFS)</h3>
                <input 
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    disabled={loading}
                />
                {mediaFile && <p>✓ Uploaded: {mediaFile}</p>}
                {mediaURI && <p>IPFS URI: {mediaURI}</p>}
            </div>
            
            <div style={{ marginTop: '20px' }}>
                <h3>Token Details</h3>
                <input 
                    value={metadata} 
                    onChange={(e) => setMetadata(e.target.value)}
                    placeholder="Metadata"
                />
                <input 
                    value={credentialType} 
                    onChange={(e) => setCredentialType(e.target.value)}
                    placeholder="Credential Type"
                />
                <input 
                    value={issuerName} 
                    onChange={(e) => setIssuerName(e.target.value)}
                    placeholder="Issuer Name"
                />
                <select value={level} onChange={(e) => setLevel(e.target.value)}>
                    <option value="1">Level 1</option>
                    <option value="2">Level 2</option>
                    <option value="3">Level 3</option>
                    <option value="4">Level 4</option>
                    <option value="5">Level 5</option>
                </select>
            </div>
            
            <button 
                onClick={handleGetSignature} 
                disabled={loading || !mediaURI}
                style={{ marginTop: '20px' }}
            >
                {loading ? 'Loading...' : 'Get Signature'}
            </button>
            
            <button 
                onClick={handleMint} 
                disabled={!signature}
                style={{ marginLeft: '10px' }}
            >
                Mint SBT
            </button>
        </div>
    );
}

export default SBTMinter;