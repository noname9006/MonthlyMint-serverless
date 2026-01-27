// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract BotanixAmbassadorNFTUnlimited is ERC721URIStorage, Ownable {
    using Strings for uint256;
    
    uint256 private _tokenIdCounter;
    
    struct TokenData {
        string metadata;
        string mediaURI;
        string credentialType;
        string issuerName;
        bool revoked;
        uint256 tier;
        string levelName;
        string monthName;
        uint256 yearValue;
        uint256 mintedAt;
        address originalMinter;
    }

    struct MintRecord {
        uint256 tokenId;
        address minter;
        uint256 timestamp;
        bytes32 dataHash;
        bytes32 signatureHash;
    }

    struct TierInfo {
        string name;
        string description;
        string baseURI;
        string imageURI;
        bool active;
        uint256 maxSupply;
        uint256 currentSupply;
    }

    struct BatchMintParams {
        address to;
        string[] metadatas;
        string[] mediaURIs;
        string[] credentialTypes;
        string[] issuerNames;
        uint256 startNonce;
        string[] levelNames;
        string[] monthNames;
        uint256[] yearValues;
        bytes32[] requestIds;
        bytes[] signatures;
    }

    mapping(uint256 => TokenData) public tokenData;
    mapping(address => uint256[]) public userTokens;
    mapping(address => uint256) public nonces;

    mapping(uint256 => MintRecord) public mintRecords;
    mapping(bytes32 => bool) public usedRequestIds;
    mapping(bytes32 => uint256) public requestIdToTokenId;

    mapping(string => mapping(uint256 => mapping(string => TierInfo))) public tiers;

    mapping(address => mapping(uint256 => bool)) public userMintedInBlock;
    mapping(address => uint256) public lastMintTimestamp;
    mapping(address => uint256) public totalMintedByUser;

    mapping(uint256 => string[]) public tokenTags;
    mapping(uint256 => mapping(string => string)) public tokenAttributes;
    mapping(uint256 => address[]) public tokenTransferHistory;

    address public signerAddress;
    bytes32 public immutable DOMAIN_SEPARATOR;

    event SBTMinted(address indexed to, uint256 indexed tokenId, string credentialType, string mediaURI, uint256 tier, string levelName, string monthName, uint256 yearValue);
    event BatchMinted(address indexed to, uint256[] tokenIds, uint256 count);
    event MintRecordCreated(uint256 indexed tokenId, address indexed minter, bytes32 dataHash);
    event RequestIdUsed(bytes32 indexed requestId, address indexed user, uint256 indexed tokenId);
    event TokenTransferred(uint256 indexed tokenId, address indexed from, address indexed to);
    event TierConfigured(string levelName, uint256 indexed yearValue, string monthName, string name);
    event TierSupplyUpdated(string levelName, uint256 yearValue, string monthName, uint256 newSupply);
    event TokenRevoked(uint256 indexed tokenId, string reason);
    event TokenAttributeSet(uint256 indexed tokenId, string key, string value);
    event TokenTagAdded(uint256 indexed tokenId, string tag);

    constructor(address _signerAddress) 
        ERC721("Botanix Ambassador", "BTNX")
        Ownable(msg.sender)
    {
        signerAddress = _signerAddress;
        _tokenIdCounter = 0;

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("Botanix Ambassador")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function setSignerAddress(address _newSigner) external onlyOwner {
        require(_newSigner != address(0), "INV_SIGNER");
        signerAddress = _newSigner;
    }

    // ------------------- Helper functions -------------------
    function _getLevelTier(string memory levelName) internal pure returns (uint256) {
        bytes32 levelHash = keccak256(bytes(levelName));
        
        if (levelHash == keccak256(bytes("Sprout"))) return 0;
        if (levelHash == keccak256(bytes("Seedling Ambassador"))) return 1;
        if (levelHash == keccak256(bytes("Blossom Ambassador"))) return 2;
        if (levelHash == keccak256(bytes("Sequoia Ambassador"))) return 3;
        if (levelHash == keccak256(bytes("Hyperion Ambassador"))) return 4;
        if (levelHash == keccak256(bytes("Botanist"))) return 5;
        
        // Default to 0 for unknown levels
        return 0;
    }

    // ------------------- Tier config -------------------
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
    ) public onlyOwner {
        require(bytes(levelName).length > 0, "LVL_REQ");
        require(bytes(monthName).length > 0, "MTH_REQ");
        require(yearValue >= 2024, "YR_MIN");
        require(bytes(name).length > 0, "NAME_REQ");

        TierInfo storage tier = tiers[levelName][yearValue][monthName];
        tier.name = name;
        tier.description = description;
        tier.baseURI = baseURI;
        tier.imageURI = imageURI;
        tier.active = active;
        tier.maxSupply = maxSupply;

        emit TierConfigured(levelName, yearValue, monthName, name);
    }

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
    ) public onlyOwner {
        require(
            levelNames.length == yearValues.length &&
            yearValues.length == monthNames.length &&
            monthNames.length == names.length &&
            names.length == descriptions.length &&
            descriptions.length == baseURIs.length &&
            baseURIs.length == imageURIs.length &&
            imageURIs.length == actives.length &&
            actives.length == maxSupplies.length,
            "LEN_MISMATCH"
        );

        for (uint256 i = 0; i < levelNames.length; i++) {
            configureTier(
                levelNames[i],
                yearValues[i],
                monthNames[i],
                names[i],
                descriptions[i],
                baseURIs[i],
                imageURIs[i],
                actives[i],
                maxSupplies[i]
            );
        }
    }

    // ------------------- Mint validation -------------------
    function _validateMintParams(
        address to,
        uint256 nonce,
        string memory levelName,
        string memory monthName,
        uint256 yearValue,
        string memory mediaURI,
        bytes32 requestId
    ) internal view {
        require(to != address(0), "ADDR");
        require(nonce == nonces[to], "NONCE");
        require(bytes(levelName).length > 0, "LVL");
        require(bytes(monthName).length > 0, "MTH");
        require(yearValue >= 2024, "YR");
        require(bytes(mediaURI).length > 0, "URI");
        require(!usedRequestIds[requestId], "REQ_USED");
    }

    function _validateBatchMintParams(
        address to,
        uint256 startNonce,
        string[] memory levelNames,
        string[] memory monthNames,
        uint256[] memory yearValues,
        string[] memory mediaURIs,
        bytes32[] memory requestIds
    ) internal view {
        require(to != address(0), "ADDR");
        require(startNonce == nonces[to], "NONCE");
        
        uint256 length = levelNames.length;
        require(length > 0, "EMPTY");
        // No limit on batch size in unlimited version
        require(
            monthNames.length == length &&
            yearValues.length == length &&
            mediaURIs.length == length &&
            requestIds.length == length,
            "LEN_MISMATCH"
        );

        for (uint256 i = 0; i < length; i++) {
            require(bytes(levelNames[i]).length > 0, "LVL");
            require(bytes(monthNames[i]).length > 0, "MTH");
            require(yearValues[i] >= 2024, "YR");
            require(bytes(mediaURIs[i]).length > 0, "URI");
            require(!usedRequestIds[requestIds[i]], "REQ_USED");
        }
    }

    // ------------------- Signature verification (EIP-712) -------------------
    function _verifySignature(
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
    ) internal view {
        bytes32 MINT_TYPEHASH = keccak256(
            "Mint(address to,string metadata,string mediaURI,string credentialType,string issuerName,uint256 nonce,string levelName,string monthName,uint256 yearValue,bytes32 requestId)"
        );

        bytes32 structHash = keccak256(abi.encode(
            MINT_TYPEHASH,
            to,
            keccak256(bytes(metadata)),
            keccak256(bytes(mediaURI)),
            keccak256(bytes(credentialType)),
            keccak256(bytes(issuerName)),
            nonce,
            keccak256(bytes(levelName)),
            keccak256(bytes(monthName)),
            yearValue,
            requestId
        ));

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));

        address recoveredSigner = recoverSigner(digest, signature);
        require(recoveredSigner == signerAddress, "SIG");
    }

    function recoverSigner(bytes32 digest, bytes memory signature) 
        internal 
        pure 
        returns (address) 
    {
        require(signature.length == 65, "SIG_LEN");
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        
        return ecrecover(digest, v, r, s);
    }

    // ------------------- Mint record -------------------
    function _createMintRecord(
        uint256 tokenId,
        address minter,
        string memory metadata,
        string memory mediaURI,
        string memory credentialType,
        string memory issuerName,
        bytes memory signature
    ) internal {
        bytes32 dataHash = keccak256(abi.encodePacked(metadata, mediaURI, credentialType, issuerName, block.timestamp, block.number));
        bytes32 signatureHash = keccak256(signature);

        mintRecords[tokenId] = MintRecord({
            tokenId: tokenId,
            minter: minter,
            timestamp: block.timestamp,
            dataHash: dataHash,
            signatureHash: signatureHash
        });

        emit MintRecordCreated(tokenId, minter, dataHash);
    }

    // ------------------- Mint execution -------------------
    function _executeMint(
        address to,
        uint256 tokenId,
        string memory metadata,
        string memory mediaURI,
        string memory credentialType,
        string memory issuerName,
        string memory levelName,
        string memory monthName,
        uint256 yearValue,
        bytes32 requestId,
        bytes memory signature
    ) internal {
        _tokenIdCounter++;

        uint256 tier = _getLevelTier(levelName);

        tokenData[tokenId] = TokenData({
            metadata: metadata,
            mediaURI: mediaURI,
            credentialType: credentialType,
            issuerName: issuerName,
            revoked: false,
            tier: tier,
            levelName: levelName,
            monthName: monthName,
            yearValue: yearValue,
            mintedAt: block.timestamp,
            originalMinter: to
        });

        usedRequestIds[requestId] = true;
        requestIdToTokenId[requestId] = tokenId;
        userMintedInBlock[to][block.number] = true;
        lastMintTimestamp[to] = block.timestamp;
        totalMintedByUser[to]++;

        TierInfo storage tierInfo = tiers[levelName][yearValue][monthName];
        tierInfo.currentSupply++;
        emit TierSupplyUpdated(levelName, yearValue, monthName, tierInfo.currentSupply);

        _createMintRecord(tokenId, to, metadata, mediaURI, credentialType, issuerName, signature);

        _safeMint(to, tokenId);
        userTokens[to].push(tokenId);
        tokenTransferHistory[tokenId].push(to);
        nonces[to]++;

        emit SBTMinted(to, tokenId, credentialType, mediaURI, tier, levelName, monthName, yearValue);
        emit RequestIdUsed(requestId, to, tokenId);
    }

    // ------------------- Public mint (single) -------------------
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
    ) public {
        _validateMintParams(to, nonce, levelName, monthName, yearValue, mediaURI, requestId);
        _verifySignature(to, metadata, mediaURI, credentialType, issuerName, nonce, levelName, monthName, yearValue, requestId, signature);

        uint256 tokenId = _tokenIdCounter;
        _executeMint(to, tokenId, metadata, mediaURI, credentialType, issuerName, levelName, monthName, yearValue, requestId, signature);
    }

    // ------------------- Public mint (batch) -------------------
    function mintBatchWithSignature(BatchMintParams calldata params) public {
        uint256 length = params.metadatas.length;
        
        require(
            params.credentialTypes.length == length &&
            params.issuerNames.length == length &&
            params.signatures.length == length,
            "LEN_MISMATCH"
        );

        _validateBatchMintParams(params.to, params.startNonce, params.levelNames, params.monthNames, params.yearValues, params.mediaURIs, params.requestIds);

        uint256[] memory tokenIds = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            _verifySignature(
                params.to,
                params.metadatas[i],
                params.mediaURIs[i],
                params.credentialTypes[i],
                params.issuerNames[i],
                params.startNonce + i,
                params.levelNames[i],
                params.monthNames[i],
                params.yearValues[i],
                params.requestIds[i],
                params.signatures[i]
            );

            uint256 tokenId = _tokenIdCounter;
            tokenIds[i] = tokenId;

            _executeMint(
                params.to,
                tokenId,
                params.metadatas[i],
                params.mediaURIs[i],
                params.credentialTypes[i],
                params.issuerNames[i],
                params.levelNames[i],
                params.monthNames[i],
                params.yearValues[i],
                params.requestIds[i],
                params.signatures[i]
            );
        }

        emit BatchMinted(params.to, tokenIds, length);
    }

    // ------------------- Token control -------------------
    function revokeToken(uint256 tokenId, string memory reason) public onlyOwner {
        require(_ownerOf(tokenId) != address(0), "NO_TOKEN");
        tokenData[tokenId].revoked = true;
        emit TokenRevoked(tokenId, reason);
    }

    function setTokenAttribute(uint256 tokenId, string memory key, string memory value) public onlyOwner {
        require(_ownerOf(tokenId) != address(0), "NO_TOKEN");
        tokenAttributes[tokenId][key] = value;
        emit TokenAttributeSet(tokenId, key, value);
    }

    function addTokenTag(uint256 tokenId, string memory tag) public onlyOwner {
        require(_ownerOf(tokenId) != address(0), "NO_TOKEN");
        tokenTags[tokenId].push(tag);
        emit TokenTagAdded(tokenId, tag);
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override(ERC721) returns (address) {
        address from = _ownerOf(tokenId);

        if (from != address(0) && to != address(0)) {
            _updateUserTokensOnTransfer(from, to, tokenId);
            tokenTransferHistory[tokenId].push(to);

            emit TokenTransferred(tokenId, from, to);
        }

        return super._update(to, tokenId, auth);
    }

    function _updateUserTokensOnTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal {
        uint256[] storage fromTokens = userTokens[from];
        for (uint256 i = 0; i < fromTokens.length; i++) {
            if (fromTokens[i] == tokenId) {
                fromTokens[i] = fromTokens[fromTokens.length - 1];
                fromTokens.pop();
                break;
            }
        }

        userTokens[to].push(tokenId);
    }

    // ------------------- Views -------------------
    function isTokenValid(uint256 tokenId) public view returns (bool) {
        return _ownerOf(tokenId) != address(0) && !tokenData[tokenId].revoked;
    }

    function isRequestIdUsed(bytes32 requestId) public view returns (bool) {
        return usedRequestIds[requestId];
    }

    function getTokenIdByRequestId(bytes32 requestId) public view returns (uint256) {
        require(usedRequestIds[requestId], "NO_REQ");
        return requestIdToTokenId[requestId];
    }

    function getUserTokens(address user) public view returns (uint256[] memory) {
        return userTokens[user];
    }

    function getTokenData(uint256 tokenId) public view returns (TokenData memory) {
        require(_ownerOf(tokenId) != address(0), "NO_TOKEN");
        return tokenData[tokenId];
    }

    function getTierInfo(string memory levelName, uint256 yearValue, string memory monthName) public view returns (TierInfo memory) {
        return tiers[levelName][yearValue][monthName];
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(_ownerOf(tokenId) != address(0), "NO_TOKEN");

        TokenData memory data = tokenData[tokenId];
        TierInfo memory tier = tiers[data.levelName][data.yearValue][data.monthName];

        // If tier has a custom baseURI, use it
        if (bytes(tier.baseURI).length > 0) {
            return tier.baseURI;
        }

        // Build metadata JSON on-chain with tier information
        string memory name;
        if (bytes(tier.name).length > 0) {
            // Use tier name if configured
            name = string(abi.encodePacked(
                tier.name,
                " - ",
                data.monthName,
                " ",
                data.yearValue.toString()
            ));
        } else {
            // Fallback to level name if tier not configured
            name = string(abi.encodePacked(
                "Botanix Ambassador - ",
                data.levelName,
                " - ",
                data.monthName,
                " ",
                data.yearValue.toString()
            ));
        }

        string memory description = bytes(tier.description).length > 0 
            ? tier.description 
            : string(abi.encodePacked(data.levelName, ", ", data.monthName, " ", data.yearValue.toString()));

        string memory json = Base64.encode(
			bytes(
				string(
					abi.encodePacked(
					'{"name":"',
					name,
					'","description":"',
					description,
					'","image":"',
					data.mediaURI,
					'","attributes":[',
					'{"trait_type":"Tier","value":"',
					data.tier.toString(),
					'"},',
					'{"trait_type":"Level","value":"',
					data.levelName,
					'"},',
					'{"trait_type":"Month","value":"',
					data.monthName,
					'"},',
					'{"trait_type":"Year","value":"',
					data.yearValue.toString(),
					'"}'
					']}'
            )
        )
    )
);

        return string(abi.encodePacked("data:application/json;base64,", json));
    }
}