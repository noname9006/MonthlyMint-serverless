// ABI for BotanixAmbassadorNFT contract (NEW_T 712-2s.sol)
export const SBT_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "_signerAddress", "type": "address" }
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
      { "indexed": false, "internalType": "string", "name": "mediaURI", "type": "string" },
      { "indexed": false, "internalType": "uint256", "name": "tier", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "levelName", "type": "string" },
      { "indexed": false, "internalType": "string", "name": "monthName", "type": "string" },
      { "indexed": false, "internalType": "uint256", "name": "yearValue", "type": "uint256" }
    ],
    "name": "SBTMinted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "to", "type": "address" },
      { "indexed": false, "internalType": "uint256[]", "name": "tokenIds", "type": "uint256[]" },
      { "indexed": false, "internalType": "uint256", "name": "count", "type": "uint256" }
    ],
    "name": "BatchMinted",
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
      { "internalType": "string", "name": "levelName", "type": "string" },
      { "internalType": "string", "name": "monthName", "type": "string" },
      { "internalType": "uint256", "name": "yearValue", "type": "uint256" },
      { "internalType": "bytes32", "name": "requestId", "type": "bytes32" },
      { "internalType": "bytes", "name": "signature", "type": "bytes" }
    ],
    "name": "mintWithSignature",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          { "internalType": "address", "name": "to", "type": "address" },
          { "internalType": "string[]", "name": "metadatas", "type": "string[]" },
          { "internalType": "string[]", "name": "mediaURIs", "type": "string[]" },
          { "internalType": "string[]", "name": "credentialTypes", "type": "string[]" },
          { "internalType": "string[]", "name": "issuerNames", "type": "string[]" },
          { "internalType": "uint256", "name": "startNonce", "type": "uint256" },
          { "internalType": "string[]", "name": "levelNames", "type": "string[]" },
          { "internalType": "string[]", "name": "monthNames", "type": "string[]" },
          { "internalType": "uint256[]", "name": "yearValues", "type": "uint256[]" },
          { "internalType": "bytes32[]", "name": "requestIds", "type": "bytes32[]" },
          { "internalType": "bytes[]", "name": "signatures", "type": "bytes[]" }
        ],
        "internalType": "struct BotanixAmbassadorNFT.BatchMintParams",
        "name": "params",
        "type": "tuple"
      }
    ],
    "name": "mintBatchWithSignature",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "internalType": "string", "name": "reason", "type": "string" }
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
      { "internalType": "address", "name": "user", "type": "address" },
      { "internalType": "string", "name": "levelName", "type": "string" },
      { "internalType": "uint256", "name": "yearValue", "type": "uint256" },
      { "internalType": "string", "name": "monthName", "type": "string" }
    ],
    "name": "hasUserTier",
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
    "inputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "name": "tokenData",
    "outputs": [
      { "internalType": "string", "name": "metadata", "type": "string" },
      { "internalType": "string", "name": "mediaURI", "type": "string" },
      { "internalType": "string", "name": "credentialType", "type": "string" },
      { "internalType": "string", "name": "issuerName", "type": "string" },
      { "internalType": "bool", "name": "revoked", "type": "bool" },
      { "internalType": "string", "name": "levelName", "type": "string" },
      { "internalType": "string", "name": "monthName", "type": "string" },
      { "internalType": "uint256", "name": "yearValue", "type": "uint256" },
      { "internalType": "uint256", "name": "mintedAt", "type": "uint256" },
      { "internalType": "address", "name": "originalMinter", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "user", "type": "address" }
    ],
    "name": "getUserTokens",
    "outputs": [
      { "internalType": "uint256[]", "name": "", "type": "uint256[]" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "getTokenData",
    "outputs": [
      {
        "components": [
          { "internalType": "string", "name": "metadata", "type": "string" },
          { "internalType": "string", "name": "mediaURI", "type": "string" },
          { "internalType": "string", "name": "credentialType", "type": "string" },
          { "internalType": "string", "name": "issuerName", "type": "string" },
          { "internalType": "bool", "name": "revoked", "type": "bool" },
          { "internalType": "string", "name": "levelName", "type": "string" },
          { "internalType": "string", "name": "monthName", "type": "string" },
          { "internalType": "uint256", "name": "yearValue", "type": "uint256" },
          { "internalType": "uint256", "name": "mintedAt", "type": "uint256" },
          { "internalType": "address", "name": "originalMinter", "type": "address" }
        ],
        "internalType": "struct BotanixAmbassadorNFT.TokenData",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "levelName", "type": "string" },
      { "internalType": "uint256", "name": "yearValue", "type": "uint256" },
      { "internalType": "string", "name": "monthName", "type": "string" }
    ],
    "name": "getTierInfo",
    "outputs": [
      {
        "components": [
          { "internalType": "string", "name": "name", "type": "string" },
          { "internalType": "string", "name": "description", "type": "string" },
          { "internalType": "string", "name": "baseURI", "type": "string" },
          { "internalType": "string", "name": "imageURI", "type": "string" },
          { "internalType": "bool", "name": "active", "type": "bool" },
          { "internalType": "uint256", "name": "maxSupply", "type": "uint256" },
          { "internalType": "uint256", "name": "currentSupply", "type": "uint256" }
        ],
        "internalType": "struct BotanixAmbassadorNFT.TierInfo",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "requestId", "type": "bytes32" }
    ],
    "name": "isRequestIdUsed",
    "outputs": [
      { "internalType": "bool", "name": "", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const
