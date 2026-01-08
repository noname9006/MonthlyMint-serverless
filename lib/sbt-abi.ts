// ABI for ComplexSoulboundToken contract
export const SBT_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "_signerAddress", "type": "address" },
      { "internalType": "string", "name": "_baseURI", "type": "string" },
      { "internalType": "string", "name": "_defaultMediaURI", "type": "string" }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "to", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "credentialType", "type": "string" },
      { "indexed": false, "internalType": "string", "name": "mediaURI", "type": "string" }
    ],
    "name": "SBTMinted",
    "type": "event"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "string", "name": "metadata", "type": "string" },
      { "internalType": "string", "name": "mediaURI", "type": "string" },
      { "internalType": "string", "name": "credentialType", "type": "string" },
      { "internalType": "string", "name": "issuerName", "type": "string" },
      { "internalType": "uint256", "name": "nonce", "type": "uint256" },
      { "internalType": "uint256", "name": "level", "type": "uint256" },
      { "internalType": "bytes", "name": "signature", "type": "bytes" }
    ],
    "name": "mintWithSignature",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "revokeToken",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "isTokenValid",
    "outputs": [
      { "internalType": "bool", "name": "", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "tokenURI",
    "outputs": [
      { "internalType": "string", "name": "", "type": "string" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "", "type": "address" }
    ],
    "name": "hasSBT",
    "outputs": [
      { "internalType": "bool", "name": "", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "", "type": "address" }
    ],
    "name": "nonces",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "defaultMediaURI",
    "outputs": [
      { "internalType": "string", "name": "", "type": "string" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "name": "tokenData",
    "outputs": [
      { "internalType": "string", "name": "metadata", "type": "string" },
      { "internalType": "string", "name": "mediaURI", "type": "string" },
      { "internalType": "string", "name": "credentialType", "type": "string" },
      { "internalType": "string", "name": "issuerName", "type": "string" },
      { "internalType": "uint256", "name": "mintedAt", "type": "uint256" },
      { "internalType": "bool", "name": "revoked", "type": "bool" },
      { "internalType": "uint256", "name": "level", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const
