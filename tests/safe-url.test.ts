import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isBlockedAddress, parsePublicUrl } from "@/lib/safe-url";

const rejectionOf = (raw: string) => {
  const parsed = parsePublicUrl(raw);
  return "rejection" in parsed ? parsed.rejection : null;
};

describe("isBlockedAddress", () => {
  it("recusa loopback, redes privadas e link-local", () => {
    const blocked = [
      "127.0.0.1",
      "0.0.0.0",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "::1",
      "::",
      "fc00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
    ];
    for (const address of blocked) assert.ok(isBlockedAddress(address), address);
  });

  it("aceita endereços públicos", () => {
    const allowed = ["8.8.8.8", "1.1.1.1", "172.32.0.1", "192.169.0.1", "2606:4700::1111", "::ffff:8.8.8.8"];
    for (const address of allowed) assert.ok(!isBlockedAddress(address), address);
  });

  it("um nome não é um endereço", () => {
    assert.ok(!isBlockedAddress("exemplo.pt"));
  });
});

describe("parsePublicUrl", () => {
  it("aceita http e https públicos", () => {
    assert.ok("url" in parsePublicUrl("https://www.mozai.education/artigo"));
    assert.ok("url" in parsePublicUrl("http://exemplo.pt:80/"));
  });

  it("recusa outros protocolos", () => {
    for (const raw of ["file:///etc/passwd", "ftp://exemplo.pt", "javascript:alert(1)"]) {
      assert.equal(rejectionOf(raw), "protocolo", raw);
    }
  });

  it("recusa portas fora da web, que servem para sondar serviços internos", () => {
    assert.equal(rejectionOf("http://exemplo.pt:8080/"), "porta");
    assert.equal(rejectionOf("https://exemplo.pt:27017/"), "porta");
  });

  it("recusa credenciais no endereço", () => {
    assert.equal(rejectionOf("https://utilizador:segredo@exemplo.pt/"), "credenciais");
  });

  it("recusa a rede interna, por nome ou por endereço", () => {
    const internos = [
      "http://localhost/",
      "http://servidor.local/",
      "http://metadata.google.internal/",
      "http://169.254.169.254/latest/meta-data/",
      "http://[::1]/",
      "http://10.0.0.5/",
    ];
    for (const raw of internos) assert.equal(rejectionOf(raw), "endereco-interno", raw);
  });

  it("recusa texto que não é um endereço", () => {
    assert.equal(rejectionOf("nem por sombras"), "invalido");
  });
});
