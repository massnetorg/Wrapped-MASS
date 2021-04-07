// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract WMASSAirdrop is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct UserInfo {
        uint256 amount; // How many LP or WMASS tokens the user has provided.
        uint256 rewardDebt;
        //
        // We do some fancy math here. Basically, any point in time, the amount of WMASSs
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accWMASSPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accWMASSPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    struct PoolInfo {
        address lpToken; // Address of LP or WMASS token contract.
        uint256 allocPoint;
        uint256 lastRewardBlock;
        uint256 accWMASSPerShare;
        uint256 wmassAmount; // Total amount of deposited WMASSs.
    }

    address public wmass;
    uint256 public wmassPerBlock;

    // Info of each pool.
    PoolInfo[] public poolInfos;
    mapping(address => uint256) public lpTokenRegistry;

    // Info of each user that stakes LP tokens.
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    mapping(address => uint256) public realizedReward;

    // Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint = 0;
    // The block number when wmass mining starts.
    uint256 public startBlock;
    // The block number when wmass mining end.
    uint256 public endBlock;
    // Airdrop period.
    uint256 public period;
    // Remaining airdrop amount.
    uint256 public remainingAmount = 0;

    event NewAirdrop(
        address indexed user,
        uint256 amount,
        uint256 start,
        uint256 per
    );
    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event Claim(address indexed user, uint256 amount);
    event WithdrawRemaining(address indexed user, uint256 amount);

    constructor(address _wmass, uint256 _period) public {
        wmass = _wmass;
        period = _period;
    }

    // ============ Modifiers ============

    modifier lpTokenExist(address _lpToken) {
        require(lpTokenRegistry[_lpToken] > 0, "Airdrop: LP token not exist");
        _;
    }

    modifier lpTokenNotExist(address _lpToken) {
        require(
            lpTokenRegistry[_lpToken] == 0,
            "Airdrop: LP token already exist"
        );
        _;
    }

    // ============ Helper ============

    function poolLength() external view returns (uint256) {
        return poolInfos.length;
    }

    function getPid(address _lpToken)
        public
        view
        lpTokenExist(_lpToken)
        returns (uint256)
    {
        return lpTokenRegistry[_lpToken] - 1;
    }

    function getUserLpBalance(address _lpToken, address _user)
        public
        view
        returns (uint256)
    {
        uint256 pid = getPid(_lpToken);
        return userInfo[pid][_user].amount;
    }

    // ============ Ownable ============

    function setPeriod(uint256 _newPeriod) public onlyOwner {
        require(_newPeriod > 0, "Airdrop: non-positive new period");
        period = _newPeriod;
    }

    function newAirdrop(
        uint256 _wmassAmount,
        uint256 _newPerBlock,
        uint256 _startBlock
    ) public onlyOwner {
        require(
            block.number > endBlock && _startBlock >= endBlock,
            "Airdrop: last airdrop not over yet"
        );
        massUpdatePools();

        uint256 balBefore = IERC20(wmass).balanceOf(address(this));
        IERC20(wmass).safeTransferFrom(msg.sender, address(this), _wmassAmount);
        uint256 balAfter = IERC20(wmass).balanceOf(address(this));
        require(
            balAfter.sub(balBefore) == _wmassAmount,
            "Airdrop: unexpected balance"
        );

        uint256 newRemaining = remainingAmount.add(_wmassAmount);
        require(
            _wmassAmount > 0 && (period * _newPerBlock) <= newRemaining,
            "Airdrop: too small amount"
        );

        remainingAmount = newRemaining;
        wmassPerBlock = _newPerBlock;
        startBlock = _startBlock;
        endBlock = _startBlock.add(period);
        updatePoolLastRewardBlock(_startBlock);
        emit NewAirdrop(msg.sender, _wmassAmount, _startBlock, _newPerBlock);
    }

    function updatePoolLastRewardBlock(uint256 _lastRewardBlock) private {
        uint256 length = poolInfos.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            PoolInfo storage pool = poolInfos[pid];
            pool.lastRewardBlock = _lastRewardBlock;
        }
    }

    function addLpToken(
        address _lpToken,
        uint256 _allocPoint
    ) public lpTokenNotExist(_lpToken) onlyOwner {
        require(_lpToken != address(0), "Airdrop: zero address not allowed");
        
        massUpdatePools();

        uint256 lastRewardBlock =
            block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfos.push(
            PoolInfo({
                lpToken: _lpToken,
                allocPoint: _allocPoint,
                lastRewardBlock: lastRewardBlock,
                accWMASSPerShare: 0,
                wmassAmount: 0
            })
        );
        lpTokenRegistry[_lpToken] = poolInfos.length;
    }

    function setLpToken(
        address _lpToken,
        uint256 _allocPoint
    ) public onlyOwner {
        massUpdatePools();
        
        uint256 pid = getPid(_lpToken);
        totalAllocPoint = totalAllocPoint.sub(poolInfos[pid].allocPoint).add(
            _allocPoint
        );
        poolInfos[pid].allocPoint = _allocPoint;
    }

    function withdrawRemaining() external onlyOwner {
        require(block.number > endBlock, "Airdrop: airdrop not over yet");
        if (remainingAmount == 0) {
            return;
        }
        massUpdatePools();
        uint256 amt = remainingAmount;
        if (amt > 0) {
            remainingAmount = 0;
            IERC20(wmass).transfer(_msgSender(), amt);
            emit WithdrawRemaining(_msgSender(), amt);
        }
    }

    // ============ View Rewards ============

    function getPendingReward(address _lpToken, address _user)
        external
        view
        returns (uint256)
    {
        uint256 pid = getPid(_lpToken);
        PoolInfo storage pool = poolInfos[pid];
        UserInfo storage user = userInfo[pid][_user];
        uint256 accWMASSPerShare = pool.accWMASSPerShare;
        uint256 lpSupply;
        if (pool.lpToken == wmass) {
            lpSupply = pool.wmassAmount;
        } else {
            lpSupply = IERC20(pool.lpToken).balanceOf(address(this));
        }
        uint256 number = block.number > endBlock ? endBlock : block.number;
        if (number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 wmassReward =
                number
                    .sub(pool.lastRewardBlock)
                    .mul(wmassPerBlock)
                    .mul(pool.allocPoint)
                    .div(totalAllocPoint);
            accWMASSPerShare = accWMASSPerShare.add(
                wmassReward.mul(1e12).div(lpSupply)
            );
        }
        return user.amount.mul(accWMASSPerShare).div(1e12).sub(user.rewardDebt);
    }

    function getRealizedReward(address _user) external view returns (uint256) {
        return realizedReward[_user];
    }

    function getRemainingAmount() external view returns (uint256) {
        uint256 number = block.number > endBlock ? endBlock : block.number;
        uint256 remaining = remainingAmount;
        for (uint256 pid = 0; pid < poolInfos.length; ++pid) {
            PoolInfo storage pool = poolInfos[pid];
            if (number <= pool.lastRewardBlock || pool.allocPoint == 0) {
                continue;
            }
            uint256 lpSupply;
            if (pool.lpToken == wmass) {
                lpSupply = pool.wmassAmount;
            } else {
                lpSupply = IERC20(pool.lpToken).balanceOf(address(this));
            }
            if (lpSupply == 0) {
                continue;
            }
            uint256 wmassReward =
                number
                    .sub(pool.lastRewardBlock)
                    .mul(wmassPerBlock)
                    .mul(pool.allocPoint)
                    .div(totalAllocPoint);
            remaining = remaining.sub(wmassReward);
        }
        return remaining;
    }

    // ============ Update Pools ============

    // Update reward variables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfos.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfos[_pid];
        uint256 number = block.number > endBlock ? endBlock : block.number;
        if (number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply;
        if (pool.lpToken == wmass) {
            lpSupply = pool.wmassAmount;
        } else {
            lpSupply = IERC20(pool.lpToken).balanceOf(address(this));
        }
        if (lpSupply == 0) {
            pool.lastRewardBlock = number;
            return;
        }
        uint256 wmassReward =
            number
                .sub(pool.lastRewardBlock)
                .mul(wmassPerBlock)
                .mul(pool.allocPoint)
                .div(totalAllocPoint);
        remainingAmount = remainingAmount.sub(wmassReward);
        pool.accWMASSPerShare = pool.accWMASSPerShare.add(
            wmassReward.mul(1e12).div(lpSupply)
        );
        pool.lastRewardBlock = number;
    }

    // ============ Deposit & Withdraw & Claim ============

    function deposit(address _lpToken, uint256 _amount) public {
        uint256 pid = getPid(_lpToken);
        PoolInfo storage pool = poolInfos[pid];
        UserInfo storage user = userInfo[pid][msg.sender];
        updatePool(pid);
        if (user.amount > 0) {
            uint256 pendingAmount =
                user.amount.mul(pool.accWMASSPerShare).div(1e12).sub(
                    user.rewardDebt
                );
            if (pendingAmount > 0) {
                safeWMASSTransfer(msg.sender, pendingAmount, pool.wmassAmount);
            }
        }
        if (_amount > 0) {
            IERC20(pool.lpToken).safeTransferFrom(
                address(msg.sender),
                address(this),
                _amount
            );
            user.amount = user.amount.add(_amount);
            if (pool.lpToken == wmass) {
                pool.wmassAmount = pool.wmassAmount.add(_amount);
            }
        }
        user.rewardDebt = user.amount.mul(pool.accWMASSPerShare).div(1e12);
        emit Deposit(msg.sender, pid, _amount);
    }

    function withdraw(address _lpToken, uint256 _amount) public {
        uint256 pid = getPid(_lpToken);
        PoolInfo storage pool = poolInfos[pid];
        UserInfo storage user = userInfo[pid][msg.sender];
        require(user.amount >= _amount, "Withdraw Too Much");
        updatePool(pid);
        uint256 pendingAmount =
            user.amount.mul(pool.accWMASSPerShare).div(1e12).sub(
                user.rewardDebt
            );
        if (pendingAmount > 0) {
            safeWMASSTransfer(msg.sender, pendingAmount, pool.wmassAmount);
        }
        if (_amount > 0) {
            user.amount = user.amount.sub(_amount);
            if (pool.lpToken == wmass) {
                pool.wmassAmount = pool.wmassAmount.sub(_amount);
            }
            IERC20(pool.lpToken).safeTransfer(address(msg.sender), _amount);
        }
        user.rewardDebt = user.amount.mul(pool.accWMASSPerShare).div(1e12);
        emit Withdraw(msg.sender, pid, _amount);
    }

    function withdrawAll(address _lpToken) public {
        uint256 balance = getUserLpBalance(_lpToken, msg.sender);
        withdraw(_lpToken, balance);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(address _lpToken) public {
        uint256 pid = getPid(_lpToken);
        PoolInfo storage pool = poolInfos[pid];
        UserInfo storage user = userInfo[pid][msg.sender];
        uint256 amount = user.amount;
        user.amount = 0;
        user.rewardDebt = 0;
        if (pool.lpToken == wmass) {
            pool.wmassAmount = pool.wmassAmount.sub(amount);
        }
        IERC20(pool.lpToken).safeTransfer(address(msg.sender), amount);
    }

    function claim(address _lpToken) public {
        uint256 pid = getPid(_lpToken);
        if (
            userInfo[pid][msg.sender].amount == 0 ||
            poolInfos[pid].allocPoint == 0
        ) {
            return; // save gas
        }
        PoolInfo storage pool = poolInfos[pid];
        UserInfo storage user = userInfo[pid][msg.sender];
        updatePool(pid);
        uint256 pendingAmount =
            user.amount.mul(pool.accWMASSPerShare).div(1e12).sub(
                user.rewardDebt
            );
        user.rewardDebt = user.amount.mul(pool.accWMASSPerShare).div(1e12);
        if (pendingAmount > 0) {
            safeWMASSTransfer(msg.sender, pendingAmount, pool.wmassAmount);
        }
    }

    function claimAll() public {
        uint256 length = poolInfos.length;
        uint256 pendingAmount = 0;
        uint256 totalPoolWMASSAmount = 0;
        for (uint256 pid = 0; pid < length; ++pid) {
            if (
                userInfo[pid][msg.sender].amount == 0 ||
                poolInfos[pid].allocPoint == 0
            ) {
                continue; // save gas
            }
            PoolInfo storage pool = poolInfos[pid];
            UserInfo storage user = userInfo[pid][msg.sender];
            updatePool(pid);
            pendingAmount = pendingAmount.add(
                user.amount.mul(pool.accWMASSPerShare).div(1e12).sub(
                    user.rewardDebt
                )
            );
            totalPoolWMASSAmount = totalPoolWMASSAmount.add(pool.wmassAmount);
            user.rewardDebt = user.amount.mul(pool.accWMASSPerShare).div(1e12);
        }
        if (pendingAmount > 0) {
            safeWMASSTransfer(msg.sender, pendingAmount, totalPoolWMASSAmount);
        }
    }

    // Safe WMASS transfer function, just in case if rounding error causes pool to not have enough WMASS.
    function safeWMASSTransfer(
        address _to,
        uint256 _amount,
        uint256 _poolWMASSAmount
    ) internal {
        uint256 wmassBalance = IERC20(wmass).balanceOf(address(this));
        wmassBalance = wmassBalance.sub(_poolWMASSAmount);
        if (_amount > wmassBalance) {
            _amount = wmassBalance;
        }
        IERC20(wmass).transfer(_to, _amount);
        realizedReward[_to] = realizedReward[_to].add(_amount);
        emit Claim(_to, _amount);
    }
}
