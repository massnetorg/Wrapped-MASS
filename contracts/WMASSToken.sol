// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Capped.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Pausable.sol";

contract WMASSToken is ERC20Capped, ERC20Pausable, Ownable {
    constructor(uint256 cap_) public ERC20("Wrapped MASS", "WMASS") ERC20Capped(cap_) 
    {
        _setupDecimals(8);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function burn(uint256 amount) external onlyOwner {
        _burn(_msgSender(), amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override(ERC20Capped, ERC20Pausable) {
        super._beforeTokenTransfer(from, to, amount);
    }
}