# NFT Tier Configuration Guide

## Problem: "INACTIVE" Error During Minting

If you encounter an error like `Fail with INACTIVE` when trying to mint an NFT, it means the tier (combination of levelName, yearValue, monthName) has not been configured in the smart contract or is not set to active.

### What are Tiers?

The BotanixAmbassadorNFT contract uses a tier system to control which NFTs can be minted. Each tier is defined by:

- **levelName**: The Discord role/level (e.g., "Botanist", "Hyperion Ambassador")
- **yearValue**: The year (e.g., 2026)
- **monthName**: The month (e.g., "January", "February")

Before users can mint an NFT for a specific tier, the contract owner must:
1. Configure the tier using `configureTier()` or `configureTierBatch()`
2. Set `active: true` to enable minting

### Why This Design?

This design provides several benefits:
- **Control**: The contract owner can control when minting is available for specific months/years
- **Flexibility**: Different tiers can have different max supplies, URIs, or descriptions
- **Safety**: Prevents accidental minting for unconfigured periods

## Solution: Configure Tiers

### Option 1: Use the Configuration Script (Recommended)

We've provided a script to automatically configure all tiers:

```bash
# Make sure you have your environment variables set
# in .env.local or export them:
export BACKEND_PRIVATE_KEY=0x...
export NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=0x...

# Run the configuration script
npm run configure-tiers
```

Or if you need to override environment variables:
```bash
BACKEND_PRIVATE_KEY=0x... NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=0x... npm run configure-tiers
```

The script will:
- ✅ Configure all level × month combinations for current and next year
- ✅ Set all tiers to active (users can mint)
- ✅ Set unlimited max supply (or you can modify the script)
- ✅ Use batch transactions for gas efficiency
- ✅ Skip tiers that are already configured and active

**Important:** You must be the contract owner to run this script!

### Option 2: Manual Configuration via Etherscan/BlockScout

If you prefer to configure tiers manually:

1. Go to your contract on [Botanix Block Explorer](https://botanixscan.io/)
2. Navigate to "Write Contract" tab
3. Connect your wallet (must be the contract owner)
4. Use the `configureTier` function with these parameters:

```solidity
configureTier(
  levelName: "Botanist",           // The Discord role name
  yearValue: 2026,                 // The year
  monthName: "January",            // The month
  name: "Botanist - January 2026", // Display name for the tier
  description: "Botanix Ambassador NFT for Botanist role in January 2026",
  baseURI: "",                     // Optional base URI (leave empty to use mediaURI)
  imageURI: "",                    // Optional image URI (leave empty to use mediaURI)
  active: true,                    // MUST be true to allow minting
  maxSupply: 0                     // 0 = unlimited supply
)
```

5. Repeat for each tier you want to enable

### Option 3: Batch Configuration

For efficiency, you can configure multiple tiers at once using `configureTierBatch()`:

```solidity
configureTierBatch(
  levelNames: ["Botanist", "Botanist", "Botanist"],
  yearValues: [2026, 2026, 2026],
  monthNames: ["January", "February", "March"],
  names: ["Botanist - January 2026", "Botanist - February 2026", "Botanist - March 2026"],
  descriptions: [...],
  baseURIs: ["", "", ""],
  imageURIs: ["", "", ""],
  actives: [true, true, true],
  maxSupplies: [0, 0, 0]
)
```

## Levels (Discord Roles)

The following level names should be used when configuring tiers:

- `Botanist`
- `Hyperion Ambassador`
- `Sequoia Ambassador`
- `Blossom Ambassador`
- `Seedling Ambassador`
- `Sprout`

These must match exactly (case-sensitive) with what the backend sends in the mint signature.

## Month Names

The following month names should be used:

- `January`, `February`, `March`, `April`, `May`, `June`
- `July`, `August`, `September`, `October`, `November`, `December`

These must match exactly (case-sensitive) with what the backend sends in the mint signature.

## Checking Tier Configuration

You can check if a tier is configured by calling `getTierInfo()`:

```solidity
getTierInfo(
  levelName: "Botanist",
  yearValue: 2026,
  monthName: "January"
)
```

This will return:
```solidity
{
  name: string,        // Empty string if not configured
  description: string,
  baseURI: string,
  imageURI: string,
  active: bool,        // MUST be true for minting to work
  maxSupply: uint256,
  currentSupply: uint256
}
```

If `name` is empty or `active` is false, users cannot mint for that tier.

## Troubleshooting

### Error: "INACTIVE"
**Cause:** The tier is not configured or `active: false`

**Solution:** Configure the tier using one of the methods above and ensure `active: true`

### Error: "HAS_TIER"
**Cause:** User already has an NFT for this tier

**Solution:** This is expected behavior. Each user can only have one NFT per tier.

### Error: "MAX_SUP"
**Cause:** The tier has reached its max supply

**Solution:** Either increase `maxSupply` for the tier, or this is intended behavior.

### Error: "REQ_USED"
**Cause:** The request ID has already been used for a mint

**Solution:** Generate a new signature with a fresh request ID.

### Error: "NONCE"
**Cause:** The nonce doesn't match the user's current nonce on-chain

**Solution:** Fetch the current nonce from the contract and use it in the signature.

## Best Practices

1. **Configure in Advance**: Set up tiers before users need them
2. **Automate**: Use the provided script to configure all tiers at once
3. **Monitor**: Keep track of which tiers are active
4. **Update**: Disable tiers (`active: false`) when minting should stop
5. **Gas Efficiency**: Use `configureTierBatch()` to save on gas fees

## Example Workflow

For a typical deployment:

```bash
# 1. Deploy the contract
# (with your signer address as constructor parameter)

# 2. Configure all tiers for current and next year
npm run configure-tiers

# 3. Verify tiers are active
# Check getTierInfo() for your desired tiers

# 4. Users can now mint NFTs
# The frontend will call generate-mint-signature API
# which creates an EIP-712 signature, then users call
# mintWithSignature() on the contract
```

## Contract Functions Reference

### Owner Functions

```solidity
// Configure a single tier
function configureTier(
  string memory levelName,
  uint256 yearValue,
  string memory monthName,
  string memory name,
  string memory description,
  string memory baseURI,
  string memory imageURI,
  bool active,
  uint256 maxSupply
) public onlyOwner

// Configure multiple tiers at once (more gas efficient)
function configureTierBatch(
  string[] memory levelNames,
  uint256[] memory yearValues,
  string[] memory monthNames,
  string[] memory names,
  string[] memory descriptions,
  string[] memory baseURIs,
  string[] memory imageURIs,
  bool[] memory actives,
  uint256[] memory maxSupplies
) public onlyOwner
```

### View Functions

```solidity
// Get tier information
function getTierInfo(
  string memory levelName,
  uint256 yearValue,
  string memory monthName
) public view returns (TierInfo memory)

// Check if user has a tier
function hasUserTier(
  address user,
  string memory levelName,
  uint256 yearValue,
  string memory monthName
) public view returns (bool)
```

### User Functions

```solidity
// Mint a single NFT (requires valid signature)
function mintWithSignature(
  address to,
  string memory metadata,
  string memory mediaURI,
  string memory credentialType,
  string memory issuerName,
  uint256 nonce,
  string memory levelName,
  string memory monthName,
  uint256 yearValue,
  bytes32 requestId,
  bytes memory signature
) public

// Mint multiple NFTs in one transaction (requires valid signatures)
function mintBatchWithSignature(
  BatchMintParams calldata params
) public
```

## Additional Resources

- Smart Contract: `/NFT/NEW_T 712-2s.sol`
- Configuration Script: `/scripts/configure-tiers.ts`
- Backend Signature API: `/pages/api/nft/generate-mint-signature.ts`
- Frontend Component: `/components/SBTMinter.tsx`
