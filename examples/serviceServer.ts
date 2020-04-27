import BN from 'bn.js';

import { SMPService } from './service';

const IP = '127.0.0.1';
const PORT = 3000;

async function main() {
  const server = new SMPService(new BN(1));
  server.listen(IP, PORT);
}

main();

