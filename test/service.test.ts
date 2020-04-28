import { SMPService } from '../src/service';
import BN from 'bn.js';

const IP = '127.0.0.1';
const PORT = 3000;
const TIMEOUT = 30000; // 30000 ms, since this test is relative slow.

// FIXME: Logs are still emitted after tests finishes.
describe('test smp service', () => {
  test(
    'same secrets',
    async () => {
      const server = new SMPService(new BN(1));
      server.listen(IP, PORT);
      const client = new SMPService(new BN(1));
      const result = await client.connect(IP, PORT);
      server.close();
      expect(result).toBeTruthy();
    },
    TIMEOUT
  );

  test(
    'different secrets',
    async () => {
      const server = new SMPService(new BN(1));
      server.listen(IP, PORT);
      const client = new SMPService(new BN(2));
      const result = await client.connect(IP, PORT);
      server.close();
      expect(result).toBeFalsy();
    },
    TIMEOUT
  );
});
