// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PokemonCards} from "../src/PokemonCards.sol";

/// Foundry's cheatcodes, declared here so this repository needs no library.
interface Vm {
    function prank(address) external;
    function deal(address, uint256) external;
    function expectRevert(bytes4) external;
    function startPrank(address) external;
    function stopPrank() external;
}

contract Catcher {
    bytes4 constant OK = 0x150b7a02;

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return OK;
    }
}

contract Deaf {}

contract PokemonCardsTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    PokemonCards cards;
    uint256 constant PRICE = 0.1 ether;
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);

    function setUp() public {
        uint256[] memory list = new uint256[](3);
        list[0] = 1;
        list[1] = 25;
        list[2] = 150;
        cards = new PokemonCards(PRICE, list);
        vm.deal(ALICE, 100 ether);
        vm.deal(BOB, 100 ether);
    }

    function assertEq(uint256 a, uint256 b, string memory what) internal pure {
        require(a == b, what);
    }

    function test_mintGivesTheCardAndTakesThePrice() public {
        vm.prank(ALICE);
        uint256 id = cards.mint{value: PRICE}(25);
        assertEq(id, 2501, "first Pikachu is 2501");
        require(cards.ownerOf(2501) == ALICE, "Alice owns it");
        require(cards.ownsCard(ALICE, 25), "ownsCard says so");
        assertEq(cards.balanceOf(ALICE), 1, "balance");
        assertEq(address(cards).balance, PRICE, "the contract holds the price");
        assertEq(cards.remaining(25), 9, "nine left");
    }

    function test_wrongPriceIsRefused() public {
        vm.prank(ALICE);
        vm.expectRevert(PokemonCards.WrongPrice.selector);
        cards.mint{value: PRICE - 1}(25);

        vm.prank(ALICE);
        vm.expectRevert(PokemonCards.WrongPrice.selector);
        cards.mint{value: PRICE + 1}(25);
    }

    function test_aPokemonNotOnTheSiteCannotBeMinted() public {
        vm.prank(ALICE);
        vm.expectRevert(PokemonCards.UnknownCard.selector);
        cards.mint{value: PRICE}(999);
    }

    function test_oneCopyOfAPokemonPerWallet() public {
        vm.startPrank(ALICE);
        cards.mint{value: PRICE}(25);
        vm.expectRevert(PokemonCards.AlreadyOwned.selector);
        cards.mint{value: PRICE}(25);
        vm.stopPrank();

        // A different Pokemon is fine.
        vm.prank(ALICE);
        cards.mint{value: PRICE}(1);
        assertEq(cards.balanceOf(ALICE), 2, "two different cards");
    }

    function test_tenOfEachPokemonAndNoMore() public {
        for (uint256 i = 0; i < 10; ++i) {
            address who = address(uint160(0x1000 + i));
            vm.deal(who, 1 ether);
            vm.prank(who);
            cards.mint{value: PRICE}(150);
        }
        assertEq(cards.mintedOf(150), 10, "ten minted");
        assertEq(cards.remaining(150), 0, "none left");
        require(cards.ownerOf(15010) == address(uint160(0x1000 + 9)), "tenth token id");

        vm.deal(BOB, 1 ether);
        vm.prank(BOB);
        vm.expectRevert(PokemonCards.SoldOut.selector);
        cards.mint{value: PRICE}(150);
    }

    function test_onlyTheOwnerSetsThePriceAndTakesTheMoney() public {
        vm.prank(ALICE);
        vm.expectRevert(PokemonCards.NotOwner.selector);
        cards.setPrice(1);

        vm.prank(ALICE);
        vm.expectRevert(PokemonCards.NotOwner.selector);
        cards.withdraw(ALICE);

        vm.prank(ALICE);
        cards.mint{value: PRICE}(25);

        cards.setPrice(0.2 ether);
        assertEq(cards.price(), 0.2 ether, "price changed");

        uint256 before = BOB.balance;
        cards.withdraw(BOB);
        assertEq(BOB.balance - before, PRICE, "the mint money went to BOB");
        assertEq(address(cards).balance, 0, "contract emptied");
    }

    function test_ownershipHandsOverEverything() public {
        cards.transferOwnership(BOB);
        require(cards.owner() == BOB, "BOB owns the contract");

        vm.expectRevert(PokemonCards.NotOwner.selector);
        cards.setPrice(1);

        vm.prank(BOB);
        cards.setPrice(0.5 ether);
        assertEq(cards.price(), 0.5 ether, "the new owner sets the price");
    }

    function test_tokenUriFollowsTheBaseAddress() public {
        vm.prank(ALICE);
        cards.mint{value: PRICE}(150);
        require(bytes(cards.tokenURI(15001)).length == 0, "empty until a base is set");

        cards.setBaseURI("https://example.invalid/meta/");
        require(
            keccak256(bytes(cards.tokenURI(15001))) == keccak256("https://example.invalid/meta/150.json"),
            "metadata address"
        );

        vm.expectRevert(PokemonCards.NoToken.selector);
        cards.tokenURI(15002);
    }

    function test_transferKeepsOneCopyPerWallet() public {
        vm.prank(ALICE);
        cards.mint{value: PRICE}(25);
        vm.prank(BOB);
        cards.mint{value: PRICE}(25);

        // BOB already holds a Pikachu, so ALICE cannot send hers to him.
        vm.prank(ALICE);
        vm.expectRevert(PokemonCards.AlreadyOwned.selector);
        cards.transferFrom(ALICE, BOB, 2501);

        address carol = address(0xCA201);
        vm.prank(ALICE);
        cards.transferFrom(ALICE, carol, 2501);
        require(cards.ownerOf(2501) == carol, "carol holds it");
        require(!cards.ownsCard(ALICE, 25), "ALICE no longer does");
        require(cards.ownsCard(carol, 25), "carol does");
    }

    function test_safeTransferChecksTheRecipient() public {
        vm.prank(ALICE);
        cards.mint{value: PRICE}(1);

        Deaf deaf = new Deaf();
        vm.prank(ALICE);
        (bool ok,) = address(cards).call(
            abi.encodeWithSignature("safeTransferFrom(address,address,uint256)", ALICE, address(deaf), 101)
        );
        require(!ok, "a contract that cannot take it is refused");

        Catcher catcher = new Catcher();
        vm.prank(ALICE);
        cards.safeTransferFrom(ALICE, address(catcher), 101);
        require(cards.ownerOf(101) == address(catcher), "a contract that can take it does");
    }

    function test_statusAnswersForTheWholePageAtOnce() public {
        vm.prank(ALICE);
        cards.mint{value: PRICE}(25);
        vm.prank(BOB);
        cards.mint{value: PRICE}(1);

        uint256[] memory ask = new uint256[](3);
        ask[0] = 1;
        ask[1] = 25;
        ask[2] = 150;
        (uint256[] memory minted, bool[] memory owned) = cards.status(ALICE, ask);
        assertEq(minted[0], 1, "one Bulbasaur gone");
        assertEq(minted[1], 1, "one Pikachu gone");
        assertEq(minted[2], 0, "no Mewtwo gone");
        require(!owned[0] && owned[1] && !owned[2], "ALICE holds only the Pikachu");

        (, bool[] memory none) = cards.status(address(0), ask);
        require(!none[0] && !none[1] && !none[2], "a visitor with no wallet owns nothing");
    }

    function test_itSaysItIsAnErc721() public view {
        require(cards.supportsInterface(0x01ffc9a7), "ERC-165");
        require(cards.supportsInterface(0x80ac58cd), "ERC-721");
        require(cards.supportsInterface(0x5b5e139f), "ERC-721 Metadata");
        require(!cards.supportsInterface(0xdeadbeef), "nothing else");
    }

    function test_approvalLetsSomebodyElseMoveIt() public {
        vm.prank(ALICE);
        cards.mint{value: PRICE}(1);
        vm.prank(ALICE);
        cards.approve(BOB, 101);
        require(cards.getApproved(101) == BOB, "BOB is approved");
        vm.prank(BOB);
        cards.transferFrom(ALICE, BOB, 101);
        require(cards.ownerOf(101) == BOB, "BOB took it");
        require(cards.getApproved(101) == address(0), "approval cleared");
    }
}
