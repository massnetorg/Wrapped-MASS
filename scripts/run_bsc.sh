#!/usr/bin/env bash

NETWORK_BSC_TESTNET="bsc_testnet"
NETWORK_BSC_MAINNET="bsc_mainnet"

DEPLOY_WMASSTOKEN=0
DEPLOY_WMASSAIRDROP=1

inputPrivateKey(){
    [ $1 ] || { echo "One argument required"; exit 1; }
    while true; do
        read -sp 'Wallet Private Key: ' pk
        echo
        [ -z "$pk" ] && echo "  error: empty private key" || { eval $1='$pk'; break; }
    done
}

# $1 return var
# $2 tips
input(){
    while true; do
        read -p "$2: " v
        [ -z "$v" ] && echo "  error: empty" || { eval $1='$v'; break; }
    done
}

# $1 return var
# $2 tips
# $3 yes value
# $4 no value
yesOrNo(){
    while true; do
        read -p "$2? (Y/N): " yn
        case $yn in
            [Yy]* ) eval $1='$3'; break;;
            [Nn]* ) eval $1='$4'; break;;
            * ) echo "  error: input yes or no";;
        esac
    done
}

# ===================[WMASSToken]====================
deployWMASSToken(){
    clear
    echo "[WMASSToken]>deploy"

    inputPrivateKey PK
    yesOrNo NETWORK "Use Testnet" $NETWORK_BSC_TESTNET $NETWORK_BSC_MAINNET
    input CAP "Capped supply(WMASS, integer)"

    echo
    echo "  ============== Deploy Params =============="
    echo "    Network:           $NETWORK"
    echo "    Capped Supply:     $CAP   WMASS"
    echo "  ==========================================="

    while true; do
        read -p 'Confirm? (Y/N):' yn
        case $yn in
            [Yy]* ) privatekey=$PK truffle migrate --network $NETWORK --reset $DEPLOY_WMASSTOKEN $CAP; break;;
            [Nn]* ) break;;
            * ) echo "error: please input yes or no";;
        esac
    done
}

mintWMASSToken(){
    clear
    echo "[WMASSToken]>mint"

    inputPrivateKey PK
    yesOrNo NETWORK "Use Testnet" $NETWORK_BSC_TESTNET $NETWORK_BSC_MAINNET
    input WMASS "WMASSToken Address"
    input USER "Mint To"
    input AMOUNT "Amount(WMASS, integer)"

    echo
    echo "  ====================== Mint Params ===================="
    echo "    Network:              $NETWORK"
    echo "    WMASSToken Address:   $WMASS"
    echo "    Mint To:              $USER"
    echo "    Amount:               $AMOUNT   WMASS"
    echo "  ======================================================="

    while true; do
        read -p 'Confirm? (Y/N):' yn
        case $yn in
            [Yy]* ) privatekey=$PK truffle exec interactions/token_mint.js --network $NETWORK $WMASS $USER $AMOUNT; break;;
            [Nn]* ) break;;
            * ) echo "error: please input yes or no";;
        esac
    done
}

contractWMASSToken(){
    clear
    echo "[WMASSToken]"
    echo "\t 1   - Deploy a new WMASS token. !!! Do not re-deploy this if not necessary."
    echo "\t 2   - Mint WMASS to specified account."
    echo "\t q,Q - go back."
    echo

    while true; do
        read -p "What to do?: " n
        case $n in
            1 ) deployWMASSToken; 
                break;;
            2 ) mintWMASSToken;
                break;;
            [Qq] ) return 1;;
            * ) ;;
        esac
    done
}

# ===================[WMASSAirdrop]====================
deployWMASSAirdrop(){
    clear
    echo "[WMASSAirdrop]>deploy"

    inputPrivateKey PK
    yesOrNo NETWORK "Use Testnet" $NETWORK_BSC_TESTNET $NETWORK_BSC_MAINNET
    input WMASS "WMASSToken Address"
    input PERIOD "Period(blocks, 3s each block)"

    echo
    echo "  =================== Deploy Params ==================="
    echo "    Network:              $NETWORK"
    echo "    WMASSToken Address:   $WMASS"
    echo "    Period:               $PERIOD blocks(3s each)"
    echo "  ====================================================="

    while true; do
        read -p 'Confirm? (Y/N):' yn
        case $yn in
            [Yy]* ) privatekey=$PK truffle migrate --network $NETWORK --reset $DEPLOY_WMASSAIRDROP $WMASS $PERIOD; break;;
            [Nn]* ) break;;
            * ) echo "error: please input yes or no";;
        esac
    done
}

newAirdrop(){
    clear
    echo "[WMASSAirdrop]>newAirdrop"

    inputPrivateKey PK
    yesOrNo NETWORK "Use Testnet" $NETWORK_BSC_TESTNET $NETWORK_BSC_MAINNET
    input AIRDROPADDRESS "WMASSAirdrop Address"
    input AMOUNT "Total Reward Amount(WMASS, integer)"
    input PERBLOCK "Reward Per Block(MAXWELL, integer)"
    input STARTBLOCK "Start Block"

    echo
    echo "  ======================= New Params ===================="
    echo "    Network:               $NETWORK"
    echo "    WMASSAirdrop Address:  $AIRDROPADDRESS"
    echo "    Total Reward Amount:   $AMOUNT  WMASS"
    echo "    Reward Per Block:      $PERBLOCK  MAXWELL(i.e., 10^-8 WMASS)"
    echo "    Start Block:           $STARTBLOCK"
    echo "  ======================================================="

    while true; do
        read -p 'Confirm? (Y/N):' yn
        case $yn in
            [Yy]* ) privatekey=$PK truffle exec interactions/airdrop_new.js --network $NETWORK $AIRDROPADDRESS $AMOUNT $PERBLOCK $STARTBLOCK; break;;
            [Nn]* ) break;;
            * ) echo "error: please input yes or no";;
        esac
    done
}

manageLPToken(){
    clear
    echo "[WMASSAirdrop]>${1}LpToken"

    inputPrivateKey PK
    yesOrNo NETWORK "Use Testnet" $NETWORK_BSC_TESTNET $NETWORK_BSC_MAINNET
    input AIRDROPADDRESS "WMASSAirdrop Address"
    input LPADDRESS "LP Address"
    input ALLOCPOINT "Alloc Point(integer)"

    echo
    echo "  ================ ${1} LP Token Params ==============="
    echo "    Network:               $NETWORK"
    echo "    WMASSAirdrop Address:  $AIRDROPADDRESS"
    echo "    LP Address:            $LPADDRESS"
    echo "    Alloc Point:           $ALLOCPOINT"
    echo "  ====================================================="

    while true; do
        read -p 'Confirm? (Y/N):' yn
        case $yn in
            [Yy]* ) privatekey=$PK truffle exec interactions/airdrop_lpmgr.js --network $NETWORK $AIRDROPADDRESS $1 $LPADDRESS $ALLOCPOINT; break;;
            [Nn]* ) break;;
            * ) echo "error: please input yes or no";;
        esac
    done
}

contractWMASSAirdrop(){
    clear
    echo "[WMASSAirdrop]"
    echo "\t 1   - Deploy a new staking pool. !!! Do not re-deploy this if not necessary."
    echo "\t 2   - Start a new mining round after the previous one expired."
    echo "\t 3   - Add a new LP token into the pool."
    echo "\t 4   - Set LP token's alloc point to new value."
    echo "\t q,Q - go back."
    echo

    while true; do
        read -p "What to do?: " n
        case $n in
            1 ) deployWMASSAirdrop; 
                break;;
            2 ) newAirdrop;
                break;;
            3 ) manageLPToken "add";
                break;;
            4 ) manageLPToken "set";
                break;;
            [Qq] ) return 1;;
            * ) ;;
        esac
    done
}

# ===================Main====================
tipContracts(){
    clear
    echo "Contracts:"
    echo "\t 1   - [WMASSToken]        BEP20 WMASS token."
    echo "\t 2   - [WMASSAirdrop]      Stake LP token to earn WMASS."
    echo "\t q,Q - exit"
    echo
}

tipContracts
while true; do
    read -p "Choose: " n
    case $n in
        1 ) contractWMASSToken;
            [ $? == 1 ] && tipContracts || break;;
        2 ) contractWMASSAirdrop;
            [ $? == 1 ] && tipContracts || break;;
        q ) clear; exit 0;;
        * ) ;;
    esac
done