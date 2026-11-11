/**
 * CarChain Web3 & Smart Contract Interface
 * Integrates MetaMask & Ethers.js with VehicleRegistry and CarChainEscrow contracts.
 */

(function () {
  const HARDHAT_CHAIN_ID = 31337;
  const SEPOLIA_CHAIN_ID = 11155111;

  let currentAccount = null;
  let currentChainId = null;
  let ethersProvider = null;
  let ethersSigner = null;

  const CarChainWeb3 = {
    isMetaMaskInstalled: () => {
      return typeof window.ethereum !== 'undefined' && Boolean(window.ethereum.isMetaMask);
    },

    getCurrentAccount: () => currentAccount,
    getCurrentChainId: () => currentChainId,

    /**
     * Connect user's MetaMask wallet
     */
    connectWallet: async function () {
      if (!this.isMetaMaskInstalled()) {
        throw new Error('MetaMask is not installed. Please install MetaMask or use simulated escrow.');
      }

      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts selected in MetaMask.');
        }

        currentAccount = accounts[0];
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        currentChainId = parseInt(chainIdHex, 16);

        if (window.ethers) {
          ethersProvider = new window.ethers.BrowserProvider(window.ethereum);
          ethersSigner = await ethersProvider.getSigner();
        }

        // Notify UI
        window.dispatchEvent(
          new CustomEvent('walletConnected', {
            detail: { account: currentAccount, chainId: currentChainId },
          })
        );

        return {
          account: currentAccount,
          chainId: currentChainId,
        };
      } catch (err) {
        console.error('MetaMask connection failed:', err);
        throw err;
      }
    },

    /**
     * Get ethers provider & signer
     */
    getSigner: async function () {
      if (!ethersSigner) {
        if (!this.isMetaMaskInstalled() || !window.ethers) {
          throw new Error('Web3 provider or ethers.js not available.');
        }
        ethersProvider = new window.ethers.BrowserProvider(window.ethereum);
        ethersSigner = await ethersProvider.getSigner();
      }
      return ethersSigner;
    },

    /**
     * Get Contract instance for VehicleRegistry
     */
    getVehicleRegistryContract: async function () {
      const signer = await this.getSigner();
      const addresses = window.CarChainContracts || {};
      const abis = window.CarChainABIs || {};

      const address = addresses.VehicleRegistry;
      const abi = abis.VehicleRegistry;

      if (!address || !abi) {
        throw new Error('VehicleRegistry contract configuration or ABI not loaded.');
      }

      return new window.ethers.Contract(address, abi, signer);
    },

    /**
     * Get Contract instance for CarChainEscrow
     */
    getEscrowContract: async function () {
      const signer = await this.getSigner();
      const addresses = window.CarChainContracts || {};
      const abis = window.CarChainABIs || {};

      const address = addresses.CarChainEscrow;
      const abi = abis.CarChainEscrow;

      if (!address || !abi) {
        throw new Error('CarChainEscrow contract configuration or ABI not loaded.');
      }

      return new window.ethers.Contract(address, abi, signer);
    },

    /**
     * Mint a Digital Vehicle Passport NFT on-chain
     */
    mintPassportOnChain: async function (recipientAddress, vin, initialMileage, tokenURI) {
      const contract = await this.getVehicleRegistryContract();
      const tx = await contract.mintPassport(
        recipientAddress,
        vin,
        tokenURI || `https://carchain.dev/api/vehicles/vin/${vin}`,
        initialMileage
      );
      const receipt = await tx.wait();

      // Find PassportMinted event to obtain tokenId
      let tokenId = null;
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed && parsed.name === 'PassportMinted') {
            tokenId = parsed.args[0].toString();
            break;
          }
        } catch {
          // Non-matching log
        }
      }

      return {
        txHash: receipt.hash,
        tokenId: tokenId || '1',
      };
    },

    /**
     * Deposit purchase payment into CarChainEscrow contract
     */
    depositEscrowOnChain: async function (tokenId, vin, sellerAddress, ethAmount) {
      const contract = await this.getEscrowContract();
      const parsedValue = window.ethers.parseEther(String(ethAmount));

      const tx = await contract.createAndFundEscrow(
        tokenId || 0,
        vin,
        sellerAddress,
        { value: parsedValue }
      );
      const receipt = await tx.wait();

      let orderId = null;
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed && parsed.name === 'EscrowCreated') {
            orderId = parsed.args[0].toString();
            break;
          }
        } catch {
          // Skip
        }
      }

      return {
        txHash: receipt.hash,
        orderId: orderId || '1',
      };
    },

    /**
     * Buyer confirms vehicle handover on-chain
     */
    confirmHandoverOnChain: async function (orderId) {
      const contract = await this.getEscrowContract();
      const tx = await contract.confirmHandover(orderId);
      const receipt = await tx.wait();
      return { txHash: receipt.hash };
    },

    /**
     * Switch network to Sepolia or Hardhat Localhost
     */
    switchNetwork: async function (targetChainId) {
      if (!this.isMetaMaskInstalled()) return;
      const targetHex = '0x' + targetChainId.toString(16);
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: targetHex }],
        });
      } catch (switchError) {
        // If error code 4902, chain not added yet
        console.warn('Network switch error:', switchError);
      }
    },
  };

  // Listen to MetaMask account / chain changes
  if (typeof window !== 'undefined' && window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
      currentAccount = accounts[0] || null;
      window.dispatchEvent(new CustomEvent('walletAccountChanged', { detail: { account: currentAccount } }));
    });

    window.ethereum.on('chainChanged', (chainIdHex) => {
      currentChainId = parseInt(chainIdHex, 16);
      window.dispatchEvent(new CustomEvent('walletChainChanged', { detail: { chainId: currentChainId } }));
    });
  }

  window.CarChainWeb3 = CarChainWeb3;
})();
