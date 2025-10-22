import { ClobClient } from "@polymarket/clob-client";
const METAKEY = "1d82dcd40d785270d69c1775745e10d91d3283f8cb87f790dfea6b9b2f467e72"; // Replace with yours
import { Wallet } from "ethers";

const privateKeyHex = "0x" + METAKEY;
const POLYMARKET_HOST = "https://clob.polymarket.com";

const signer = new Wallet(privateKeyHex);

const client = new ClobClient(POLYMARKET_HOST, 137, signer);

async function generateKey() {
  const key = await client.createApiKey();
  console.log("Your API Key:", key);
}

generateKey().catch(console.error);
