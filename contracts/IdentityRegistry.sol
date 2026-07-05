// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract IdentityRegistry {
    struct AgentProfile {
        string name;
        string metadataUri;
        uint256 registeredAt;
        bool exists;
    }

    mapping(address => AgentProfile) private profiles;

    event AgentRegistered(address indexed agent, string name, uint256 registeredAt);

    function register(address agent, string calldata name, string calldata metadataUri) external {
        profiles[agent] = AgentProfile(name, metadataUri, block.timestamp, true);
        emit AgentRegistered(agent, name, block.timestamp);
    }

    function lookup(address agent) external view returns (AgentProfile memory) {
        return profiles[agent];
    }
}
