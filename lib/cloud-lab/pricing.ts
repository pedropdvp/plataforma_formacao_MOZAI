/**
 * Tabela de preços de REFERÊNCIA (on-demand, Linux, us-east-1) — valores publicados pela AWS,
 * fixados nesta tabela em vez de consultados ao vivo (a API de preços da AWS exige uma conta
 * autenticada e não tem um modo público sem chave). Rotulado explicitamente como "referência"
 * em toda a UI — nunca apresentado como uma cotação em tempo real.
 */
export const EC2_REFERENCE_PRICING_USD_PER_HOUR: Record<string, number> = {
  "t3.micro": 0.0104,
  "t3.small": 0.0208,
  "t3.medium": 0.0416,
  "t3.large": 0.0832,
  "m5.large": 0.096,
  "m5.xlarge": 0.192,
  "c5.large": 0.085,
  "c5.xlarge": 0.17,
  "r5.large": 0.126,
};

export function estimateMonthlyCostUsd(instanceType: string, quantity: number): number | null {
  const hourly = EC2_REFERENCE_PRICING_USD_PER_HOUR[instanceType];
  if (hourly === undefined) return null;
  const HOURS_PER_MONTH = 730;
  return hourly * HOURS_PER_MONTH * quantity;
}
