# MOZAI SDK (TypeScript)

Cliente fino, sem dependências, sobre a [API pública da MOZAI](../app/api/public/v1).

## Uso

```ts
import { MozaiClient } from "./mozai-sdk";

const client = new MozaiClient({ apiKey: "mozai_..." }); // gerada em Marketplace > APIs
const { result } = await client.runPrompt("PROMPT_ID", { tema: "vendas" });
console.log(result);
```

Gere a sua chave em `/dashboard/marketplace` (aba "APIs").

## Âmbito

Hoje só cobre o endpoint de execução de Prompts (`runPrompt`). Não está publicado no
registo npm — é distribuído como código-fonte real neste repositório.
