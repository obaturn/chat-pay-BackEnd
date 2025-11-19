/**
 * Sui Blockchain Utilities
 * Helper functions for Sui blockchain interactions
 */

/**
 * Format SUI amount to smallest unit (MIST)
 * @param {number} amount - Amount in SUI
 * @returns {string} Amount in MIST
 */
const formatSuiAmount = (amount) => {
  return (BigInt(Math.floor(amount * 1000000000))).toString();
};

/**
 * Format MIST amount to SUI
 * @param {string|number} mistAmount - Amount in MIST
 * @returns {number} Amount in SUI
 */
const formatMistToSui = (mistAmount) => {
  return Number(BigInt(mistAmount) / BigInt(1000000000));
};

/**
 * Validate Sui address
 * @param {string} address - Sui address
 * @returns {boolean} Is valid address
 */
const isValidSuiAddress = (address) => {
  // Sui addresses are 32 bytes, hex encoded with 0x prefix
  const suiAddressRegex = /^0x[a-fA-F0-9]{64}$/;
  return suiAddressRegex.test(address);
};

/**
 * Shorten Sui address for display
 * @param {string} address - Full Sui address
 * @param {number} chars - Characters to show at start and end
 * @returns {string} Shortened address
 */
const shortenSuiAddress = (address, chars = 6) => {
  if (!address || address.length < chars * 2 + 2) {
    return address;
  }

  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
};

/**
 * Generate a random Sui address (for testing)
 * @returns {string} Random Sui address
 */
const generateRandomSuiAddress = () => {
  const randomBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    randomBytes[i] = Math.floor(Math.random() * 256);
  }

  const hex = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return `0x${hex}`;
};

/**
 * Check if transaction hash is valid
 * @param {string} txHash - Transaction hash
 * @returns {boolean} Is valid hash
 */
const isValidTransactionHash = (txHash) => {
  // Sui transaction hashes are hex encoded
  const txHashRegex = /^0x[a-fA-F0-9]{64}$/;
  return txHashRegex.test(txHash);
};

/**
 * Get Sui explorer URL for transaction
 * @param {string} txHash - Transaction hash
 * @param {string} network - Network (mainnet, testnet, devnet)
 * @returns {string} Explorer URL
 */
const getSuiExplorerUrl = (txHash, network = 'testnet') => {
  const baseUrls = {
    mainnet: 'https://suiexplorer.com',
    testnet: 'https://testnet.suivision.xyz',
    devnet: 'https://devnet.suivision.xyz'
  };

  const baseUrl = baseUrls[network] || baseUrls.testnet;
  return `${baseUrl}/txblock/${txHash}`;
};

/**
 * Get Sui faucet URL for test tokens
 * @param {string} network - Network
 * @returns {string} Faucet URL
 */
const getSuiFaucetUrl = (network = 'testnet') => {
  const faucetUrls = {
    testnet: 'https://faucet.testnet.sui.io',
    devnet: 'https://faucet.devnet.sui.io'
  };

  return faucetUrls[network] || faucetUrls.testnet;
};

/**
 * Calculate transaction fee estimate
 * @param {number} complexity - Transaction complexity (1-10)
 * @returns {number} Estimated fee in SUI
 */
const estimateTransactionFee = (complexity = 5) => {
  // Base fee for simple transactions
  const baseFee = 0.001; // 0.001 SUI

  // Adjust based on complexity
  const complexityMultiplier = Math.max(0.5, Math.min(2, complexity / 5));

  return baseFee * complexityMultiplier;
};

/**
 * Format currency amount with proper decimals
 * @param {number} amount - Amount
 * @param {string} currency - Currency code
 * @returns {string} Formatted amount
 */
const formatCurrencyAmount = (amount, currency) => {
  const decimals = {
    SUI: 9,
    USDC: 6,
    NGN: 2,
    USD: 2
  };

  const decimalPlaces = decimals[currency] || 2;
  return amount.toFixed(decimalPlaces);
};

/**
 * Convert between currencies (mock implementation)
 * @param {number} amount - Amount to convert
 * @param {string} fromCurrency - Source currency
 * @param {string} toCurrency - Target currency
 * @returns {number} Converted amount
 */
const convertCurrency = (amount, fromCurrency, toCurrency) => {
  // Mock exchange rates (in production, use real API)
  const rates = {
    SUI: { USD: 1.50, NGN: 1500, USDC: 1.50 },
    USDC: { SUI: 0.67, USD: 1.00, NGN: 1000 },
    USD: { SUI: 0.67, USDC: 1.00, NGN: 1000 },
    NGN: { SUI: 0.00067, USDC: 0.001, USD: 0.001 }
  };

  if (fromCurrency === toCurrency) {
    return amount;
  }

  const rate = rates[fromCurrency]?.[toCurrency];
  return rate ? amount * rate : amount;
};

module.exports = {
  formatSuiAmount,
  formatMistToSui,
  isValidSuiAddress,
  shortenSuiAddress,
  generateRandomSuiAddress,
  isValidTransactionHash,
  getSuiExplorerUrl,
  getSuiFaucetUrl,
  estimateTransactionFee,
  formatCurrencyAmount,
  convertCurrency
};