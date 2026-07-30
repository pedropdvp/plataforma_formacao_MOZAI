/**
 * Rede real usada pelo Blockchain Lab: a testnet pública Sepolia (Ethereum), via um RPC
 * público gratuito (sem chave própria). Deliberadamente NUNCA mainnet — evita qualquer risco
 * de perda de fundos reais; os alunos usam ETH de teste, obtido em faucets públicos.
 */
export const BLOCKCHAIN_LAB_NETWORK = {
  name: "Sepolia (testnet)",
  chainId: 11155111,
  rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
  explorerTxUrl: (hash: string) => `https://sepolia.etherscan.io/tx/${hash}`,
  explorerAddressUrl: (address: string) => `https://sepolia.etherscan.io/address/${address}`,
  faucetUrl: "https://sepoliafaucet.com",
};
