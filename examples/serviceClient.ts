import BN from 'bn.js';

import { SMPService } from '../src/service';

const IP = '127.0.0.1';
const PORT = 3000;

// TODO: Receive `ip`, `port`, and `secret` from args.
async function main() {
  const client = new SMPService(new BN(1));
  const result = await client.connect(IP, PORT);
  console.log("Client:", result);
}
main();
