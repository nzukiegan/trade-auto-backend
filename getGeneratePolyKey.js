import { ClobClient } from "@polymarket/clob-client";
import dotenv from "dotenv";
dotenv.config();

const METAKEY = process.env.METAKEY;
import { Wallet } from "ethers";

const privateKeyHex = METAKEY;
const POLYMARKET_HOST = "https://clob.polymarket.com";

const signer = new Wallet(privateKeyHex);
const client = new ClobClient(POLYMARKET_HOST, 137, signer);

async function getExistingKey() {
  const keys = await client.deriveApiKey();
  console.log("Existing API Keys:", keys);
}

getExistingKey().catch(console.error);