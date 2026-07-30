import solc from "solc";

export interface CompileResult {
  success: boolean;
  contractName?: string;
  abi?: any[];
  bytecode?: string;
  errors: string[];
  warnings: string[];
}

/**
 * Compila código Solidity REAL usando o compilador oficial (solc, via WASM em Node.js) —
 * nunca finge uma compilação; erros de sintaxe reais do Solidity aparecem tal como no
 * Remix/Hardhat. Devolve o ABI e o bytecode do primeiro contrato encontrado no ficheiro.
 */
export function compileSolidity(sourceCode: string): CompileResult {
  const input = {
    language: "Solidity",
    sources: { "Contract.sol": { content: sourceCode } },
    settings: {
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  const errors = (output.errors || []).filter((e: any) => e.severity === "error").map((e: any) => e.formattedMessage || e.message);
  const warnings = (output.errors || []).filter((e: any) => e.severity === "warning").map((e: any) => e.formattedMessage || e.message);

  if (errors.length > 0) {
    return { success: false, errors, warnings };
  }

  const contractsInFile = output.contracts?.["Contract.sol"];
  if (!contractsInFile || Object.keys(contractsInFile).length === 0) {
    return { success: false, errors: ["Nenhum contrato encontrado no código fornecido."], warnings };
  }

  const contractName = Object.keys(contractsInFile)[0];
  const contract = contractsInFile[contractName];

  return {
    success: true,
    contractName,
    abi: contract.abi,
    bytecode: "0x" + contract.evm.bytecode.object,
    errors: [],
    warnings,
  };
}
