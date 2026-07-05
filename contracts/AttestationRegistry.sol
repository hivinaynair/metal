// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AttestationRegistry {
    enum IdentityStatus { NotFound, Verified, Flagged }
    enum Decision { Approved, Rejected }

    event Attested(
        bytes32 indexed paymentHash,
        address indexed payer,
        uint256 amountUsdc,
        IdentityStatus identityStatus,
        Decision decision,
        uint256 timestamp
    );

    function attest(
        bytes32 paymentHash,
        address payer,
        uint256 amountUsdc,
        IdentityStatus identityStatus,
        Decision decision
    ) external {
        emit Attested(paymentHash, payer, amountUsdc, identityStatus, decision, block.timestamp);
    }
}
