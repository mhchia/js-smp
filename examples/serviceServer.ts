import BN from 'bn.js';

import { SMPService } from '../src/service';

const IP = '127.0.0.1';
const PORT = 3000;

// TODO: Receive `ip`, `port`, and `secret` from args.
async function main() {
  const server = new SMPService(new BN(1));
  // TODO: Handle Ctrl-C, which calls `close`.
  server.listen(IP, PORT);
}

main();

