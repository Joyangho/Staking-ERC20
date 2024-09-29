// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract SabuStaking is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // $SABU ERC20 컨트랙트 주소 고정
    IERC20 public immutable sabuToken = IERC20(0x40E3E8f853C5F9fb2A9fE865092769F749e37Cc5);

    uint256 public constant rewardRatePerMinute = 380260000000; // 20% APY 분당 지급률 설정 0.2/525,600분 * 10 ** 18
    uint256 public totalStaked;
    uint256 public rewardPool; // 관리자가 충전한 보상 풀
    uint256 public totalFundedRewards; // 관리자가 지금까지 충전한 전체 리워드
    uint256 public totalClaimedRewards; // 사용자가 출금한 전체 리워드
    address[] public stakerAddresses;
    mapping(address => bool) public isStaker;

    struct StakeInfo {
        uint256 amount;        // 스테이킹한 토큰 수량
        uint256 rewardDebt;    // 보상 부채 (사용자가 수령하지 않은 리워드)
        uint256 lastUpdated;   // 마지막으로 업데이트된 시간
    }

    mapping(address => StakeInfo) public stakers;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardFunded(uint256 amount);  // 관리자가 보상 풀에 예치할 때 이벤트 발생

    constructor(address initialOwner) Ownable(initialOwner) {}

    // 관리자가 보상 풀을 충전하는 함수
    function fundRewardPool(uint256 _amount) external onlyOwner {
        require(_amount > 0, "Amount must be greater than 0");
        sabuToken.transferFrom(msg.sender, address(this), _amount);
        rewardPool = rewardPool.add(_amount);
        totalFundedRewards = totalFundedRewards.add(_amount); // 총 관리자가 충전한 리워드 증가
        emit RewardFunded(_amount);
    }

    // 사용자가 스테이킹을 위해 충전하는 함수
    function deposit(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");

        StakeInfo storage user = stakers[msg.sender];

        // 새로 스테이킹하는 사용자의 경우 주소 배열에 추가
        if (user.amount == 0 && !isStaker[msg.sender]) {
            stakerAddresses.push(msg.sender); // 사용자가 처음 스테이킹하는 경우에만 추가
            isStaker[msg.sender] = true; // 주소 중복 방지용 플래그
        }

        // 리워드 업데이트
        if (user.amount > 0) {
            user.rewardDebt = user.rewardDebt.add(_calculateReward(msg.sender));
        }

        uint256 allowance = sabuToken.allowance(msg.sender, address(this));
        require(allowance >= _amount, "Insufficient allowance. Please approve tokens first.");

        sabuToken.transferFrom(msg.sender, address(this), _amount);
        user.amount = user.amount.add(_amount);
        user.lastUpdated = block.timestamp;

        totalStaked = totalStaked.add(_amount);

        emit Deposited(msg.sender, _amount);
    }

    // 출금(Withdraw) 함수
    function withdraw(uint256 _amount) external nonReentrant {
        StakeInfo storage user = stakers[msg.sender];
        require(user.amount >= _amount, "Insufficient staked amount");

        // 기존 보상 업데이트
        user.rewardDebt = user.rewardDebt.add(_calculateReward(msg.sender));

        // 스테이킹된 금액에서 출금
        user.amount = user.amount.sub(_amount);
        user.lastUpdated = block.timestamp;

        sabuToken.transfer(msg.sender, _amount);
        totalStaked = totalStaked.sub(_amount);

        emit Withdrawn(msg.sender, _amount);
    }

    // 전체 출금 (스테이킹 + 리워드) 함수 (디파짓에 대해서만 보상 지급)
    function withdrawAll() external nonReentrant {
        StakeInfo storage user = stakers[msg.sender];
        require(user.amount > 0, "No staked tokens to withdraw");

        // 기존 보상 업데이트 (오직 디파짓된 금액에 대해서만 계산)
        uint256 reward = _calculateReward(msg.sender);
        uint256 totalAmount = user.amount.add(reward);

        // 보상 풀 확인
        require(rewardPool >= reward, "Not enough rewards in pool");

        // 보상 풀에서 차감
        rewardPool = rewardPool.sub(reward);

        // 스테이킹 금액과 리워드 모두 출금
        uint256 stakedAmount = user.amount;
        user.amount = 0; // 사용자의 스테이킹 금액 초기화
        user.rewardDebt = 0; // 보상 부채 초기화
        user.lastUpdated = block.timestamp;

        totalStaked = totalStaked.sub(stakedAmount);

        // 사용자에게 토큰 전송 (스테이킹 금액 + 보상)
        sabuToken.transfer(msg.sender, totalAmount);

        emit Withdrawn(msg.sender, stakedAmount);
        emit RewardsClaimed(msg.sender, reward);
    }

    // 리워드 청구(Claim Rewards) 함수
    function claimRewards() external nonReentrant {
        StakeInfo storage user = stakers[msg.sender];
        uint256 reward = _calculateReward(msg.sender);

        require(reward > 0, "No rewards available");
        require(rewardPool >= reward, "Not enough rewards in pool");

        rewardPool = rewardPool.sub(reward);
        totalClaimedRewards = totalClaimedRewards.add(reward); // 사용자가 청구한 전체 리워드 증가
        user.rewardDebt = 0;
        user.lastUpdated = block.timestamp;

        sabuToken.transfer(msg.sender, reward);
        emit RewardsClaimed(msg.sender, reward);
    }

    // 미지급된 리워드 함수
    function totalUnclaimedRewards() external view returns (uint256) {
        uint256 totalUnclaimed = 0;
    
        // 스테이커 배열을 순회하며 모든 사용자의 미청구 보상을 계산
        for (uint256 i = 0; i < stakerAddresses.length; i++) {
            address staker = stakerAddresses[i];
            totalUnclaimed = totalUnclaimed.add(_calculateReward(staker));
        }
        return totalUnclaimed;
    }

    // 사용자의 총 리워드를 계산하는 내부 함수 (디파짓 금액에 대해서만 보상 지급)
    function _calculateReward(address _user) internal view returns (uint256) {
        StakeInfo storage user = stakers[_user];

        uint256 timeStaked = block.timestamp.sub(user.lastUpdated);

        // 1분이 경과한 경우에만 보상 계산
        if (timeStaked < 60) {
            return user.rewardDebt; // 1분이 경과하지 않았으면 이전 보상 부채만 반환
        }

        uint256 reward = user.amount.mul(rewardRatePerMinute).mul(timeStaked).div(60).div(1e18);
        return reward.add(user.rewardDebt);
    }


    // 사용자가 24시간 동안 얻을 예상 리워드 반환
    function estimatedRewards(address _user, uint256 timeInSeconds) external view returns (uint256) {
        StakeInfo storage user = stakers[_user];
        uint256 reward = user.amount.mul(rewardRatePerMinute).mul(timeInSeconds).div(60).div(1e18);
        return reward;
    }

    // 사용자의 스테이킹 잔고 조회 (Read 함수)
    function stakedBalanceOf(address _user) external view returns (uint256) {
        return stakers[_user].amount;
    }

    // 사용자의 수령하지 않은 리워드 조회 (Read 함수)
    function unclaimedRewards(address _user) external view returns (uint256) {
        return _calculateReward(_user);
    }

    // 전체 스테이킹된 토큰 조회 (Read 함수)
    function totalStakedTokens() external view returns (uint256) {
        return totalStaked;
    }
}
