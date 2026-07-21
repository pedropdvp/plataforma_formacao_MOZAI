import "./load-env";
import { seedSecurityData } from "../lib/seeder";

async function run() {
  console.log("A semear papéis (roles) e permissões no MongoDB...");
  await seedSecurityData("pedropdvp@gmail.com");
  console.log("Sementeira de segurança concluída com sucesso!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Erro ao semear segurança:", err);
  process.exit(1);
});
