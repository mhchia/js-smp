import BN from 'bn.js';

import { SMPService } from './service';

const IP = '127.0.0.1';
const PORT = 3000;

async function main() {
  const client = new SMPService(new BN(1));
  const result = await client.connect(IP, PORT);
  console.log("Client:", result);
}

main();
