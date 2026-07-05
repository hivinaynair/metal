import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { writeFileSync, existsSync, readFileSync } from "fs";
import { resolve } from "path";

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

const envPath = resolve(process.cwd(), ".env.local");
const varName = process.argv[2] ?? "PAYER_PRIVATE_KEY";
const line = `${varName}=${privateKey}`;

let contents = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

if (contents.includes(`${varName}=`)) {
  contents = contents.replace(new RegExp(`^${varName}=.*`, "m"), line);
} else {
  contents = contents ? `${contents.trimEnd()}\n${line}\n` : `${line}\n`;
}

writeFileSync(envPath, contents);

console.log("Address:", account.address);
