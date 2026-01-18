// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract BotanistTokenEIP712 is ERC721URIStorage, Ownable {
    using Strings for uint256;
    
    uint256 private _tokenIdCounter;
    
    struct TokenData {
        string metadata;
        string mediaURI;
        string credentialType;
        string issuerName;
        bool revoked;
        string levelName;
        string monthName;
        uint256 year;
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

    mapping(uint256 => TokenData) public tokenData;
    mapping(address => uint256[]) public userTokens;
    mapping(address => uint256) public nonces;

    mapping(uint256 => MintRecord) public mintRecords;
    mapping(bytes32 => bool) public usedRequestIds;
    mapping(bytes32 => uint256) public requestIdToTokenId;

    mapping(string => mapping(uint256 => mapping(string => TierInfo))) public tiers;
    mapping(address => mapping(string => mapping(uint256 => mapping(string => bool)))) public userHasTier;

    mapping(address => mapping(uint256 => bool)) public userMintedInBlock;
    mapping(address => uint256) public lastMintTimestamp;
    mapping(address => uint256) public totalMintedByUser;

    mapping(uint256 => string[]) public tokenTags;
    mapping(uint256 => mapping(string => string)) public tokenAttributes;
    mapping(uint256 => address[]) public tokenTransferHistory;

    address public signerAddress;
    bytes32 public immutable DOMAIN_SEPARATOR;

    event SBTMinted(address indexed to, uint256 indexed tokenId, string credentialType, string mediaURI, string levelName, string monthName, uint256 year);
    event BatchMinted(address indexed to, uint256[] tokenIds, uint256 count);
    event MintRecordCreated(uint256 indexed tokenId, address indexed minter, bytes32 dataHash);
    event RequestIdUsed(bytes32 indexed requestId, address indexed user, uint256 indexed tokenId);
    event TokenTransferred(uint256 indexed tokenId, address indexed from, address indexed to);
    event TierConfigured(string levelName, uint256 indexed year, string monthName, string name);
    event TierSupplyUpdated(string levelName, uint256 year, string monthName, uint256 newSupply);
    event TokenRevoked(uint256 indexed tokenId, string reason);
    event TokenAttributeSet(uint256 indexed tokenId, string key, string value);
    event TokenTagAdded(uint256 indexed tokenId, string tag);

    constructor(address _signerAddress) 
        ERC721("Botanist Collection", "BTN")
        Ownable(msg.sender)
    {
        signerAddress = _signerAddress;
        _tokenIdCounter = 0;

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("Botanist Collection")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function setSignerAddress(address _newSigner) external onlyOwner {
        require(_newSigner != address(0), "Invalid signer");
        signerAddress = _newSigner;
    }

    // ------------------- Tier config -------------------
    function configureTier(
        string memory levelName,
        uint256 year,
        string memory monthName,
        string memory name,
        string memory description,
        string memory baseURI,
        string memory imageURI,
        bool active,
        uint256 maxSupply
    ) public onlyOwner {
        require(bytes(levelName).length > 0, "Level name required");
        require(bytes(monthName).length > 0, "Month name required");
        require(year >= 2024, "Year must be >= 2024");
        require(bytes(name).length > 0, "Tier name required");

        TierInfo storage tier = tiers[levelName][year][monthName];
        tier.name = name;
        tier.description = description;
        tier.baseURI = baseURI;
        tier.imageURI = imageURI;
        tier.active = active;
        tier.maxSupply = maxSupply;

        emit TierConfigured(levelName, year, monthName, name);
    }

    function configureTierBatch(
        string[] memory levelNames,
        uint256[] memory years,
        string[] memory monthNames,
        string[] memory names,
        string[] memory descriptions,
        string[] memory baseURIs,
        string[] memory imageURIs,
        bool[] memory actives,
        uint256[] memory maxSupplies
    ) public onlyOwner {
        require(
            levelNames.length == years.length &&
            years.length == monthNames.length &&
            monthNames.length == names.length &&
            names.length == descriptions.length &&
            descriptions.length == baseURIs.length &&
            baseURIs.length == imageURIs.length &&
            imageURIs.length == actives.length &&
            actives.length == maxSupplies.length,
            "Array length mismatch"
        );

        for (uint256 i = 0; i < levelNames.length; i++) {
            configureTier(
                levelNames[i],
                years[i],
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
        uint256 year,
        string memory mediaURI,
        bytes32 requestId
    ) internal view {
        require(to != address(0), "Invalid address");
        require(nonce == nonces[to], "Invalid nonce");
        require(bytes(levelName).length > 0, "Level name required");
        require(bytes(monthName).length > 0, "Month name required");
        require(year >= 2024, "Year must be >= 2024");
        require(bytes(mediaURI).length > 0, "Media URI required");
        require(!usedRequestIds[requestId], "Request ID already used");

        TierInfo storage tier = tiers[levelName][year][monthName];
        require(tier.active, "Tier not active");
        require(!userHasTier[to][levelName][year][monthName], "User already has this tier");

        if (tier.maxSupply > 0) {
            require(tier.currentSupply < tier.maxSupply, "Tier supply exhausted");
        }
    }

    function _validateBatchMintParams(
        address to,
        uint256 startNonce,
        string[] memory levelNames,
        string[] memory monthNames,
        uint256[] memory years,
        string[] memory mediaURIs,
        bytes32[] memory requestIds
    ) internal view {
        require(to != address(0), "Invalid address");
        require(startNonce == nonces[to], "Invalid nonce");
        
        uint256 length = levelNames.length;
        require(length > 0, "Empty batch");
        require(length <= 20, "Batch too large");
        require(
            monthNames.length == length &&
            years.length == length &&
            mediaURIs.length == length &&
            requestIds.length == length,
            "Array length mismatch"
        );

        for (uint256 i = 0; i < length; i++) {
            require(bytes(levelNames[i]).length > 0, "Level name required");
            require(bytes(monthNames[i]).length > 0, "Month name required");
            require(years[i] >= 2024, "Year must be >= 2024");
            require(bytes(mediaURIs[i]).length > 0, "Media URI required");
            require(!usedRequestIds[requestIds[i]], "Request ID already used");

            TierInfo storage tier = tiers[levelNames[i]][years[i]][monthNames[i]];
            require(tier.active, "Tier not active");
            require(!userHasTier[to][levelNames[i]][years[i]][monthNames[i]], "User already has this tier");

            if (tier.maxSupply > 0) {
                require(tier.currentSupply < tier.maxSupply, "Tier supply exhausted");
            }
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
        uint256 year,
        bytes32 requestId,
        bytes memory signature
    ) internal view {
        bytes32 MINT_TYPEHASH = keccak256(
            "Mint(address to,string metadata,string mediaURI,string credentialType,string issuerName,uint256 nonce,string levelName,string monthName,uint256 year,bytes32 requestId)"
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
            year,
            requestId
        ));

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));

        address recoveredSigner = recoverSigner(digest, signature);
        require(recoveredSigner == signerAddress, "Invalid signature");
    }

    function recoverSigner(bytes32 digest, bytes memory signature) 
        internal 
        pure 
        returns (address) 
    {
        require(signature.length == 65, "Invalid signature length");
        
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
        uint256 year,
        bytes32 requestId,
        bytes memory signature
    ) internal {
        _tokenIdCounter++;

        tokenData[tokenId] = TokenData({
            metadata: metadata,
            mediaURI: mediaURI,
            credentialType: credentialType,
            issuerName: issuerName,
            revoked: false,
            levelName: levelName,
            monthName: monthName,
            year: year,
            mintedAt: block.timestamp,
            originalMinter: to
        });

        userHasTier[to][levelName][year][monthName] = true;
        usedRequestIds[requestId] = true;
        requestIdToTokenId[requestId] = tokenId;
        userMintedInBlock[to][block.number] = true;
        lastMintTimestamp[to] = block.timestamp;
        totalMintedByUser[to]++;

        TierInfo storage tier = tiers[levelName][year][monthName];
        tier.currentSupply++;
        emit TierSupplyUpdated(levelName, year, monthName, tier.currentSupply);

        _createMintRecord(tokenId, to, metadata, mediaURI, credentialType, issuerName, signature);

        _safeMint(to, tokenId);
        userTokens[to].push(tokenId);
        tokenTransferHistory[tokenId].push(to);
        nonces[to]++;

        emit SBTMinted(to, tokenId, credentialType, mediaURI, levelName, monthName, year);
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
        uint256 year,
        bytes32 requestId,
        bytes memory signature
    ) public {
        _validateMintParams(to, nonce, levelName, monthName, year, mediaURI, requestId);
        _verifySignature(to, metadata, mediaURI, credentialType, issuerName, nonce, levelName, monthName, year, requestId, signature);

        uint256 tokenId = _tokenIdCounter;
        _executeMint(to, tokenId, metadata, mediaURI, credentialType, issuerName, levelName, monthName, year, requestId, signature);
    }

    // ------------------- Public mint (batch) -------------------
    function mintBatchWithSignature(
        address to,
        string[] memory metadatas,
        string[] memory mediaURIs,
        string[] memory credentialTypes,
        string[] memory issuerNames,
        uint256 startNonce,
        string[] memory levelNames,
        string[] memory monthNames,
        uint256[] memory years,
        bytes32[] memory requestIds,
        bytes[] memory signatures
    ) public {
        uint256 length = metadatas.length;
        
        require(
            credentialTypes.length == length &&
            issuerNames.length == length &&
            signatures.length == length,
            "Array length mismatch"
        );

        _validateBatchMintParams(to, startNonce, levelNames, monthNames, years, mediaURIs, requestIds);

        uint256[] memory tokenIds = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            _verifySignature(
                to,
                metadatas[i],
                mediaURIs[i],
                credentialTypes[i],
                issuerNames[i],
                startNonce + i,
                levelNames[i],
                monthNames[i],
                years[i],
                requestIds[i],
                signatures[i]
            );

            uint256 tokenId = _tokenIdCounter;
            tokenIds[i] = tokenId;

            _executeMint(
                to,
                tokenId,
                metadatas[i],
                mediaURIs[i],
                credentialTypes[i],
                issuerNames[i],
                levelNames[i],
                monthNames[i],
                years[i],
                requestIds[i],
                signatures[i]
            );
        }

        emit BatchMinted(to, tokenIds, length);
    }

    // ------------------- Token control -------------------
    function revokeToken(uint256 tokenId, string memory reason) public onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Token doesn't exist");
        tokenData[tokenId].revoked = true;
        emit TokenRevoked(tokenId, reason);
    }

    function setTokenAttribute(uint256 tokenId, string memory key, string memory value) public onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Token doesn't exist");
        tokenAttributes[tokenId][key] = value;
        emit TokenAttributeSet(tokenId, key, value);
    }

    function addTokenTag(uint256 tokenId, string memory tag) public onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Token doesn't exist");
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
            TokenData memory data = tokenData[tokenId];

            userHasTier[from][data.levelName][data.year][data.monthName] = false;
            userHasTier[to][data.levelName][data.year][data.monthName] = true;

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
        require(usedRequestIds[requestId], "Request ID not used");
        return requestIdToTokenId[requestId];
    }

    function hasUserTier(
        address user,
        string memory levelName,
        uint256 year,
        string memory monthName
    ) public view returns (bool) {
        return userHasTier[user][levelName][year][monthName];
    }

    function getUserTokens(address user) public view returns (uint256[] memory) {
        return userTokens[user];
    }

    function getTokenData(uint256 tokenId) public view returns (TokenData memory) {
        require(_ownerOf(tokenId) != address(0), "Token doesn't exist");
        return tokenData[tokenId];
    }

    function getMintRecord(uint256 tokenId) public view returns (MintRecord memory) {
        require(_ownerOf(tokenId) != address(0), "Token doesn't exist");
        return mintRecords[tokenId];
    }

    function getTierInfo(string memory levelName, uint256 year, string memory monthName) public view returns (TierInfo memory) {
        return tiers[levelName][year][monthName];
    }

    function getTokenAttribute(uint256 tokenId, string memory key) public view returns (string memory) {
        return tokenAttributes[tokenId][key];
    }

    function getTokenTags(uint256 tokenId) public view returns (string[] memory) {
        return tokenTags[tokenId];
    }

    function getTokenTransferHistory(uint256 tokenId) public view returns (address[] memory) {
        return tokenTransferHistory[tokenId];
    }

    function getUserMintStats(address user) public view returns (
        uint256 totalMinted,
        uint256 lastMint,
        uint256 currentNonce
    ) {
        return (
            totalMintedByUser[user],
            lastMintTimestamp[user],
            nonces[user]
        );
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(_ownerOf(tokenId) != address(0), "Token doesn't exist");

        TokenData memory data = tokenData[tokenId];
        TierInfo memory tier = tiers[data.levelName][data.year][data.monthName];

        if (bytes(tier.baseURI).length > 0) {
            return tier.baseURI;
        }

        return data.mediaURI;
    }
}