// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PokemonCards
/// @notice The mint behind the Pokemon card site. One fixed price in MON for every
///         card, ten copies of each Pokemon ever, and one copy per wallet per Pokemon.
///         A token's id is `pokedex * 100 + edition`, so 2504 is the fourth Pikachu.
/// @dev A complete ERC-721 (165, 721, 721Metadata) written for this job with no
///      dependencies. Nothing here is upgradeable and nothing here can mint for free.
contract PokemonCards {
    // ---------------------------------------------------------------- errors
    error NotOwner();
    error WrongPrice();
    error UnknownCard();
    error SoldOut();
    error AlreadyOwned();
    error NoToken();
    error NotAllowed();
    error BadRecipient();
    error ZeroAddress();
    error SendFailed();

    // ---------------------------------------------------------------- events
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event Minted(address indexed to, uint256 indexed pokedex, uint256 indexed tokenId, uint256 paid);
    event PriceChanged(uint256 price);
    event OwnershipTransferred(address indexed from, address indexed to);

    // ---------------------------------------------------------------- state
    string public constant name = "Pokemon Cards on Monad";
    string public constant symbol = "PKCARD";

    /// @notice How many of each Pokemon can ever be minted.
    uint256 public constant EDITIONS = 10;

    /// @notice What one mint costs, in wei of MON. The owner may change it.
    uint256 public price;

    /// @notice Who may change the price, the card list and the metadata address,
    ///         and who may withdraw what the mints paid.
    address public owner;

    /// @notice Prefix for tokenURI; the owner sets it to where the metadata is served.
    string public baseURI;

    /// @dev One bit per Pokedex number, 256 to a word, so the whole card list
    ///      costs one storage slot instead of one each.
    mapping(uint256 => uint256) private _cardBits;

    /// @notice How many of a Pokemon have been minted, out of EDITIONS.
    mapping(uint256 => uint256) public mintedOf;

    /// @notice Whether a wallet already holds a copy of a Pokemon.
    mapping(address => mapping(uint256 => bool)) public ownsCard;

    mapping(uint256 => address) private _ownerOf;
    mapping(address => uint256) private _balanceOf;
    mapping(uint256 => address) private _approved;
    mapping(address => mapping(address => bool)) private _operator;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @param startPrice what one mint costs, in wei of MON
    /// @param pokedexNumbers the Pokemon this contract will mint
    constructor(uint256 startPrice, uint256[] memory pokedexNumbers) {
        owner = msg.sender;
        price = startPrice;
        emit OwnershipTransferred(address(0), msg.sender);
        emit PriceChanged(startPrice);
        for (uint256 i = 0; i < pokedexNumbers.length; ++i) {
            uint256 p = pokedexNumbers[i];
            _cardBits[p >> 8] |= uint256(1) << (p & 0xff);
        }
    }

    // ---------------------------------------------------------------- minting

    /// @notice Mint one copy of a Pokemon to the caller, paying exactly `price`.
    /// @param pokedex the Pokemon's number, as on the cards
    /// @return tokenId the token minted, `pokedex * 100 + edition`
    function mint(uint256 pokedex) external payable returns (uint256 tokenId) {
        if (msg.value != price) revert WrongPrice();
        if (!cardExists(pokedex)) revert UnknownCard();
        uint256 sold = mintedOf[pokedex];
        if (sold >= EDITIONS) revert SoldOut();
        if (ownsCard[msg.sender][pokedex]) revert AlreadyOwned();

        unchecked {
            mintedOf[pokedex] = sold + 1;
            tokenId = pokedex * 100 + sold + 1;
            _balanceOf[msg.sender] += 1;
        }
        ownsCard[msg.sender][pokedex] = true;
        _ownerOf[tokenId] = msg.sender;

        emit Transfer(address(0), msg.sender, tokenId);
        emit Minted(msg.sender, pokedex, tokenId, msg.value);
    }

    /// @notice Whether this contract will mint a Pokemon at all.
    function cardExists(uint256 pokedex) public view returns (bool) {
        return _cardBits[pokedex >> 8] & (uint256(1) << (pokedex & 0xff)) != 0;
    }

    /// @notice How many copies of a Pokemon are left, of EDITIONS.
    function remaining(uint256 pokedex) external view returns (uint256) {
        if (!cardExists(pokedex)) return 0;
        return EDITIONS - mintedOf[pokedex];
    }

    /// @notice Everything the card page needs about a list of Pokemon, in one call:
    ///         how many of each are minted, and whether `who` already holds one.
    /// @dev The page reads this through the visitor's own wallet, so it never needs
    ///      an RPC of its own.
    function status(address who, uint256[] calldata pokedex)
        external
        view
        returns (uint256[] memory minted, bool[] memory owned)
    {
        uint256 n = pokedex.length;
        minted = new uint256[](n);
        owned = new bool[](n);
        for (uint256 i = 0; i < n; ++i) {
            minted[i] = mintedOf[pokedex[i]];
            owned[i] = who != address(0) && ownsCard[who][pokedex[i]];
        }
    }

    /// @notice The Pokemon a token is a copy of.
    function pokedexOf(uint256 tokenId) public pure returns (uint256) {
        return tokenId / 100;
    }

    // ---------------------------------------------------------------- owner

    function setPrice(uint256 newPrice) external onlyOwner {
        price = newPrice;
        emit PriceChanged(newPrice);
    }

    function setCard(uint256 pokedex, bool exists) external onlyOwner {
        uint256 bit = uint256(1) << (pokedex & 0xff);
        if (exists) {
            _cardBits[pokedex >> 8] |= bit;
        } else {
            _cardBits[pokedex >> 8] &= ~bit;
        }
    }

    function setBaseURI(string calldata uri) external onlyOwner {
        baseURI = uri;
    }

    function withdraw(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        (bool ok,) = to.call{value: address(this).balance}("");
        if (!ok) revert SendFailed();
    }

    function transferOwnership(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, to);
        owner = to;
    }

    // ---------------------------------------------------------------- ERC-721

    function balanceOf(address who) external view returns (uint256) {
        if (who == address(0)) revert ZeroAddress();
        return _balanceOf[who];
    }

    function ownerOf(uint256 tokenId) public view returns (address holder) {
        holder = _ownerOf[tokenId];
        if (holder == address(0)) revert NoToken();
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        ownerOf(tokenId);
        return bytes(baseURI).length == 0 ? "" : string.concat(baseURI, _decimal(pokedexOf(tokenId)), ".json");
    }

    function approve(address to, uint256 tokenId) external {
        address holder = ownerOf(tokenId);
        if (msg.sender != holder && !_operator[holder][msg.sender]) revert NotAllowed();
        _approved[tokenId] = to;
        emit Approval(holder, to, tokenId);
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        ownerOf(tokenId);
        return _approved[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) external {
        _operator[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address holder, address operator) external view returns (bool) {
        return _operator[holder][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        address holder = ownerOf(tokenId);
        if (holder != from) revert NotAllowed();
        if (to == address(0)) revert ZeroAddress();
        if (msg.sender != holder && msg.sender != _approved[tokenId] && !_operator[holder][msg.sender]) {
            revert NotAllowed();
        }

        // A wallet holds at most one copy of a Pokemon, and that stays true on a transfer.
        uint256 pokedex = pokedexOf(tokenId);
        if (ownsCard[to][pokedex]) revert AlreadyOwned();
        ownsCard[from][pokedex] = false;
        ownsCard[to][pokedex] = true;

        delete _approved[tokenId];
        unchecked {
            _balanceOf[from] -= 1;
            _balanceOf[to] += 1;
        }
        _ownerOf[tokenId] = to;
        emit Transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public {
        transferFrom(from, to, tokenId);
        if (to.code.length != 0) {
            bytes4 got = IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data);
            if (got != IERC721Receiver.onERC721Received.selector) revert BadRecipient();
        }
    }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == 0x01ffc9a7 // ERC-165
            || id == 0x80ac58cd // ERC-721
            || id == 0x5b5e139f; // ERC-721 Metadata
    }

    // ---------------------------------------------------------------- helper

    function _decimal(uint256 v) private pure returns (string memory) {
        if (v == 0) return "0";
        uint256 digits;
        for (uint256 n = v; n != 0; n /= 10) ++digits;
        bytes memory out = new bytes(digits);
        for (uint256 n = v; n != 0; n /= 10) out[--digits] = bytes1(uint8(48 + (n % 10)));
        return string(out);
    }
}

interface IERC721Receiver {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data)
        external
        returns (bytes4);
}
