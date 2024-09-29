/*
Ethereum = 1
Sepolia 테스트 네트워크 = 11155111
*/
const Network = 11155111;

(async () => {
})();
var WalletAddress = "";
var WalletBalance = "";
var TokenBalance = "";

async function checkAndSwitchNetwork() {
    try {
        const currentNetwork = await window.ethereum.request({ method: 'net_version' });
        if (currentNetwork != Network.toString()) {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${Network.toString(16)}` }] // 이더리움은 0x1
            });
            alert("네트워크를 'Sepolia' 테스트 네트워크로 변경합니다.");
            return true;
        }
        return false;
    } catch (error) {
        console.error(`네트워크 전환 중 오류 발생: ${error.message}`);
        alert(`네트워크 전환 중 오류 발생: ${error.message}`);
        return false;
    }
}

async function connectWallet() {
    try {
        if (window.ethereum) {
            const networkSwitched = await checkAndSwitchNetwork();
            if (networkSwitched || window.ethereum.networkVersion == Network.toString()) {
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                if (accounts.length === 0) {
                    throw new Error("No accounts found");
                }

                userAccount = accounts[0];
                WalletAddress = userAccount;

                // HTML 업데이트
                document.getElementById("walletAddress").innerText = `연결된 지갑 주소: ${userAccount}`;
                const walletButton = document.querySelector(".btn-connect-wallet");
                walletButton.innerText = "지갑 새로고침";
                walletButton.onclick = refreshWallet;

                // 지갑 연결 후 정보를 자동으로 가져옴
                await updateWalletInfo();
            }
        } else {
            throw new Error("Ethereum provider is not available");
        }
    } catch (error) {
        console.error(`지갑 연결 실패: ${error.message}`);
        alert(`지갑 연결 실패: ${error.message}`);
    }
}

async function refreshWallet() {
    await connectWallet();
}

// 지갑 정보 업데이트
async function updateWalletInfo() {
    await checkEtherBalance();
    await checkTokenBalance(WalletAddress);
    await updateStakingInfo();
    await updateEstimatedRewards();
    await updateAdminDashboard();
}

async function checkEtherBalance() {
    try {
        window.web3 = new Web3(window.ethereum);

        const etherBalance = await web3.eth.getBalance(WalletAddress);
        const adjustedEtherBalance = web3.utils.fromWei(etherBalance, 'ether');
        document.getElementById("walletBalance").innerText = `이더리움 잔고: ${adjustedEtherBalance} ETH`;
    } catch (error) {
        console.error(`이더리움 잔고 확인 오류: ${error.message}`);
        alert(`이더리움 잔고 확인 오류: ${error.message}`);
    }
}

async function checkTokenBalance(address) {
    try {
        const tokenContract = new web3.eth.Contract(ABI20, ADDRESS20); // $SABU 토큰 컨트랙트 인스턴스 생성
        const balance = await tokenContract.methods.balanceOf(address).call();
        const adjustedBalance = web3.utils.fromWei(balance, 'ether');
        document.getElementById("tokenBalance").innerText = `${adjustedBalance} $SABU`;
    } catch (error) {
        console.error(`토큰 잔고 확인 오류: ${error.message}`);
        alert(`토큰 잔고 확인 오류: ${error.message}`);
    }
}

// SABU 토큰 메타마스크 추가
async function TokenAdd() {
    try {
        // Step 1: 네트워크가 Sepolia 테스트 네트워크인지 확인 및 전환
        const networkSwitched = await checkAndSwitchNetwork();
        if (!networkSwitched && window.ethereum.networkVersion != Network.toString()) {
            alert("메타마스크 네트워크가 Sepolia로 설정되지 않았습니다.");
            return;
        }

        // Step 2: 네트워크가 Sepolia일 때 메타마스크에 토큰 추가
        const tokenAddress = "0x40E3E8f853C5F9fb2A9fE865092769F749e37Cc5"; // SABU 토큰 주소
        const tokenSymbol = "SABU";
        const tokenDecimals = 18;

        const wasAdded = await ethereum.request({
            method: 'wallet_watchAsset',
            params: {
                type: 'ERC20',
                options: {
                    address: tokenAddress,
                    symbol: tokenSymbol,
                    decimals: tokenDecimals,
                },
            },
        });

        if (wasAdded) {
            console.log('SABU 토큰이 메타마스크에 추가되었습니다.');
        } else {
            console.log('SABU 토큰 추가가 거부되었습니다.');
        }
    } catch (error) {
        console.error(`토큰 추가 실패: ${error.message}`);
        alert(`토큰 추가 실패: ${error.message}`);
    }
}

async function checkBalance() {
    try {
        await window.ethereum.send('eth_requestAccounts');
        window.web3 = new Web3(window.ethereum);
        contract = new web3.eth.Contract(ABI20, ADDRESS20);
        const address = document.getElementById("balanceAddress").value;
        const balance = await contract.methods.balanceOf(address).call();
        const adjustebalanceOf = balance / 10 ** 18; // 발행량을 10^18로 나눔

        if (!web3.utils.isAddress(address)) {
            throw new Error("유효하지 않은 주소입니다.");
        }

        document.getElementById("balanceResult").innerText = `잔고: ${adjustebalanceOf} PALT`;
    } catch (error) {
        console.error(error);
        document.getElementById("balanceResult").innerText = `에러: ${error.message}`;
    }
}

async function mint() {
    try {
        // Metamask에 연결된 지갑 요청
        await window.ethereum.send('eth_requestAccounts');
        window.web3 = new Web3(window.ethereum);
        const contract = new web3.eth.Contract(ABI20, ADDRESS20);

        // 민팅할 수량과 수신자 주소를 가져옴
        const toAddress = document.getElementById("mintAddress").value.trim();
        const amount = web3.utils.toWei(document.getElementById("mintAmount").value, 'ether');
        const adjusteAmount = amount / 10 ** 18; // 발행량을 10^18로 나눔

        if (!web3.utils.isAddress(toAddress)) {
            throw new Error("유효하지 않은 주소입니다.");
        }

        // 민팅 트랜잭션 실행
        await contract.methods.mint(toAddress, amount).send({ from: ethereum.selectedAddress });

        document.getElementById("MintResult").innerText = "민트 성공!";
        alert(`민트가 성공적으로 완료되었습니다! 민팅된 수량: ${adjusteAmount} 개`);
    } catch (error) {
        console.error(error);
        document.getElementById("MintResult").innerText = `에러: ${error.message}`;
    }
}

// 스테이킹 정보 업데이트
async function updateStakingInfo() {
    try {
        const sabuStakingContract = new web3.eth.Contract(STAKEABI, STAKEADDRESS); // 스테이킹 컨트랙트 인스턴스 생성

        // TOTAL DEPOSITED
        const totalDeposited = await sabuStakingContract.methods.stakedBalanceOf(WalletAddress).call();
        document.getElementById("depositedBalance").innerText = `${web3.utils.fromWei(totalDeposited, 'ether')} $SABU`;

        // REWARDS RECEIVED (CLAIMED)
        const rewardsReceived = await sabuStakingContract.methods.unclaimedRewards(WalletAddress).call();
        document.getElementById("rewardsReceived").innerText = `${web3.utils.fromWei(rewardsReceived, 'ether')} $SABU`;

        // UNCLAIMED REWARDS
        const unclaimedRewards = await sabuStakingContract.methods.unclaimedRewards(WalletAddress).call();
        document.getElementById("unclaimedRewards").innerText = `${web3.utils.fromWei(unclaimedRewards, 'ether')} $SABU`;

        // TOTAL DEPOSITED (DASHBOARD)
        document.getElementById("totalDeposited").innerText = `${web3.utils.fromWei(totalDeposited, 'ether')} $SABU`;
    } catch (error) {
        console.error(`스테이킹 정보 업데이트 실패: ${error.message}`);
        alert(`스테이킹 정보 업데이트 실패: ${error.message}`);
    }
}

// 디파짓 (Deposit) 함수
async function depositTokens() {
    const depositAmount = document.getElementById('depositAmount').value;
    const amountInWei = web3.utils.toWei(depositAmount, 'ether');

    try {
        const sabuTokenContract = new web3.eth.Contract(ABI20, ADDRESS20); // $SABU 토큰 컨트랙트 인스턴스 생성
        const sabuStakingContract = new web3.eth.Contract(STAKEABI, STAKEADDRESS); // 스테이킹 컨트랙트 인스턴스 생성

        // Step 1: 먼저 토큰에 대한 'approve' 호출
        const allowance = await sabuTokenContract.methods.allowance(userAccount, STAKEADDRESS).call();

        if (allowance < amountInWei) {
            // 토큰 승인 과정 (스마트 계약이 $SABU 토큰을 사용할 수 있도록 권한 부여)
            await sabuTokenContract.methods.approve(STAKEADDRESS, amountInWei).send({ from: userAccount });
            alert(`디파짓을 위한 ${depositAmount} $SABU 토큰 승인이 완료되었습니다.`);
        } else {
            console.log("이미 충분한 allowance가 설정되어 있습니다.");
        }

        // Step 2: 디파짓 실행
        await sabuStakingContract.methods.deposit(amountInWei).send({ from: userAccount });
        alert("디파짓 성공");

        // 업데이트된 스테이킹 정보 자동 업데이트
        await updateWalletInfo();

    } catch (error) {
        console.error(`디파짓 실패: ${error.message}`);
        alert(`디파짓 실패: ${error.message}`);
    }
}

// 보상 청구 (Claim Rewards)
async function claimRewards() {
    try {
        const sabuStakingContract = new web3.eth.Contract(STAKEABI, STAKEADDRESS);
        await sabuStakingContract.methods.claimRewards().send({ from: userAccount });
        alert("보상 청구 성공");
    } catch (error) {
        console.error(error);
    }
}

// 24시간 예상 보상 업데이트 함수
async function updateEstimatedRewards() {
    try {
        const timeInSeconds = 86400; // 24시간 (86400초)
        const sabuStakingContract = new web3.eth.Contract(STAKEABI, STAKEADDRESS);

        // 스마트 컨트랙트에서 예상 보상 계산 (24시간 동안의 보상)
        const estimatedReward = await sabuStakingContract.methods.estimatedRewards(WalletAddress, timeInSeconds).call();
        const adjustedReward = web3.utils.fromWei(estimatedReward, 'ether');

        // HTML에 예상 보상 업데이트
        document.getElementById("estimatedRewards").innerText = adjustedReward;
    } catch (error) {
        console.error(`예상 보상 계산 실패: ${error.message}`);
    }
}

// 출금 (Withdraw)
async function withdrawTokens() {
    const withdrawAmount = document.getElementById('withdrawAmount').value;
    const amountInWei = web3.utils.toWei(withdrawAmount, 'ether');

    try {
        const sabuStakingContract = new web3.eth.Contract(STAKEABI, STAKEADDRESS);
        await sabuStakingContract.methods.withdraw(amountInWei).send({ from: userAccount });
        alert("출금 성공");
    } catch (error) {
        console.error(error);
    }
}

// 전체 출금 (Withdraw All)
async function withdrawAllTokens() {
    try {
        const sabuStakingContract = new web3.eth.Contract(STAKEABI, STAKEADDRESS);
        await sabuStakingContract.methods.withdrawAll().send({ from: userAccount });
        alert("전체 출금 성공");
    } catch (error) {
        console.error(error);
    }
}

// Max 버튼 설정 (최대값 설정)
function setMaxDeposit() {
    document.getElementById('depositAmount').value = document.getElementById('tokenBalance').innerText.split(' ')[0];
}

// 관리자 페이지 함수들

// 관리자 보상 풀 충전 함수
async function fundRewardPool() {
    const rewardAmount = document.getElementById('rewardAmount').value;
    const amountInWei = web3.utils.toWei(rewardAmount, 'ether');

    try {
        const sabuTokenContract = new web3.eth.Contract(ABI20, ADDRESS20);  // $SABU 토큰 컨트랙트 인스턴스 생성
        const sabuStakingContract = new web3.eth.Contract(STAKEABI, STAKEADDRESS);  // 스테이킹 컨트랙트 인스턴스 생성

        // Step 1: 먼저 토큰에 대한 'approve' 호출
        const allowance = await sabuTokenContract.methods.allowance(userAccount, STAKEADDRESS).call();

        if (allowance < amountInWei) {
            // 토큰 승인 과정 (스마트 계약이 $SABU 토큰을 사용할 수 있도록 권한 부여)
            await sabuTokenContract.methods.approve(STAKEADDRESS, amountInWei).send({ from: userAccount });
            alert(`관리자가 ${rewardAmount} $SABU에 대한 승인이 완료되었습니다.`);
        } else {
            console.log("이미 충분한 allowance가 설정되어 있습니다.");
        }

        // Step 2: 보상 풀에 자금 충전
        await sabuStakingContract.methods.fundRewardPool(amountInWei).send({ from: userAccount });
        document.getElementById('adminResult').innerText = `Reward pool funded with ${rewardAmount} $SABU successfully!`;
        alert("보상 풀 충전이 성공적으로 완료되었습니다.");

    } catch (error) {
        console.error(`보상 풀 충전 실패: ${error.message}`);
        document.getElementById('adminResult').innerText = `Error: ${error.message}`;
    }
}

// 관리자 페이지 정보 업데이트 함수
async function updateAdminDashboard() {
    try {
        const sabuStakingContract = new web3.eth.Contract(STAKEABI, STAKEADDRESS);

        // 1. 전체 관리자가 입금한 보상 개수
        const totalFundedRewards = await sabuStakingContract.methods.totalFundedRewards().call();
        document.getElementById("totalFundedRewards").innerText = web3.utils.fromWei(totalFundedRewards, 'ether') + " $SABU";

        // 2. 사용자가 출금한 전체 보상 개수
        const totalClaimedRewards = await sabuStakingContract.methods.totalClaimedRewards().call();
        document.getElementById("totalClaimedRewards").innerText = web3.utils.fromWei(totalClaimedRewards, 'ether') + " $SABU";

        // 3. 전체 디파짓된 토큰 개수
        const totalStakedTokens = await sabuStakingContract.methods.totalStakedTokens().call();
        document.getElementById("totalStakedTokens").innerText = web3.utils.fromWei(totalStakedTokens, 'ether') + " $SABU";

        // 4. 지급됐지만 출금되지 않은 전체 보상 개수
        const totalUnclaimedRewards = await sabuStakingContract.methods.totalUnclaimedRewards().call();
        document.getElementById("totalUnclaimedRewards").innerText = web3.utils.fromWei(totalUnclaimedRewards, 'ether') + " $SABU";
    } catch (error) {
        console.error(`관리자 대시보드 업데이트 실패: ${error.message}`);
    }
}

// 관리자 대시보드를 주기적으로 업데이트
setInterval(updateAdminDashboard, 30000); // 30초마다 업데이트
