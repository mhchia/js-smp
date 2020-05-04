import * as TCP from 'net';

import BN from 'bn.js';

import { Config, defaultConfig } from './config';
import { SMPStateMachine, TypeTLVOrNull } from './smp';
import { TLV } from './dataTypes';
import { FailedToReadData, SMPStateError } from './exceptions';

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

// TODO: Change to Promise
async function waitUntilTrue(conditionChecker: () => boolean): Promise<void> {
  while (!conditionChecker()) {
    await sleep(10);
  }
}

interface ISMPService {
  listen(ip: string, port: number): void;
  close(): void;
  connect(ip: string, port: number): Promise<boolean>;
}

type Connection = { socket: TCP.Socket; result: boolean | null };

// TODO: Change log to logger
class SMPService implements ISMPService {
  listener?: TCP.Server;
  connections: Map<string, Connection>;

  constructor(readonly x: BN, readonly config: Config = defaultConfig) {
    this.connections = new Map();
  }

  listen(ip: string, port: number): void {
    const server = TCP.createServer(this.onClientConnected.bind(this));
    server.listen(port, ip, () => {
      console.log(`SMPService.listen: start listening at ${ip}:${port}`);
    });
    this.listener = server;
  }

  close(): void {
    if (this.listener === undefined) {
      return;
    }
    this.listener.close();
    // TODO: close the existing connections
  }

  async onClientConnected(sock: TCP.Socket): Promise<void> {
    const remoteAddress = sock.remoteAddress + ':' + sock.remotePort;
    console.log(
      `SMPService.onClientConnected: new sock connected: ${remoteAddress}`
    );
    this.connections.set(remoteAddress, { socket: sock, result: null });

    const stateMachine = new SMPStateMachine(this.x, this.config);
    // TODO: Probably move all read/write logic here? This way we don't need locks.

    sock.on('readable', () => {
      this.readProcessReply(sock, stateMachine);
    });
    sock.on('close', function() {
      console.log(
        `SMPService.onClientConnected: connection from ${remoteAddress} closed`
      );
    });
    sock.on('error', function(err) {
      // TODO: Handle `error` properly. It seems we couldn't catch `FailedToReadData` even though
      //  we explicitly catch it everywhere.
      console.log(
        `SMPService.onClientConnected: connection ${remoteAddress} error: ${err.message}`
      );
    });
    // NOTE: No need to handle `end` since `allowHalfOpen=False`
    // TODO: Add `timeout`

    await waitUntilTrue(stateMachine.isFinished.bind(stateMachine));
    const result = stateMachine.getResult();
    this.connections.set(remoteAddress, { socket: sock, result: result });
    console.log(
      `SMPService.onClientConnected: SMP finished with ${remoteAddress}, result=${result}`
    );
    sock.end();
  }

  async connect(ip: string, port: number): Promise<boolean> {
    const sock = new TCP.Socket();
    const stateMachine = new SMPStateMachine(this.x, this.config);

    sock.connect(port, ip, () => {
      const remoteAddress = sock.remoteAddress + ':' + sock.remotePort;
      console.log(`SMPService.connect: connected to ${remoteAddress}`);
      let msg1: TLV | null;
      try {
        msg1 = stateMachine.transit(null);
      } catch (e) {
        if (e instanceof SMPStateError) {
          sock.end();
          return;
        } else {
          throw e;
        }
      }
      // Sanity check
      if (msg1 === null) {
        sock.end();
        throw new Error('msg1 should not be null');
      }
      if (!sock.writable) {
        sock.end();
        throw new Error('socket is not writable');
      }
      sock.write(msg1.serialize());
      // TODO: Probably move all read/write logic here? This way we don't need locks.
    });

    sock.on('readable', () => {
      try {
        this.readProcessReply(sock, stateMachine);
      } catch (e) {
        return;
      }
    });
    sock.on('close', () => {
      console.log('SMPService.connect: connection closed');
    });
    sock.on('error', err => {
      // TODO: Handle `error` properly. It seems we couldn't catch `FailedToReadData` even though
      //  we explicitly catch it everywhere.
      console.log(`SMPService.connect: connection error: ${err.message}`);
    });
    // NOTE: No need to handle `end` since `allowHalfOpen=False`
    // TODO: Add `timeout`

    await waitUntilTrue(stateMachine.isFinished.bind(stateMachine));
    sock.end();
    return stateMachine.getResult();
  }

  readProcessReply(sock: TCP.Socket, stateMachine: SMPStateMachine): void {
    let tlv: TLV;
    try {
      tlv = TLV.readFromSocket(sock);
    } catch (e) {
      if (e instanceof FailedToReadData) {
        sock.destroy(e);
        return;
      } else {
        throw e;
      }
    }
    let replyTLV: TypeTLVOrNull;
    try {
      replyTLV = stateMachine.transit(tlv);
    } catch (e) {
      if (e instanceof SMPStateError) {
        sock.destroy(e);
        return;
      } else {
        throw e;
      }
    }
    if (replyTLV === null) {
      return;
    }
    if (!sock.writable) {
      return;
    }
    sock.write(replyTLV.serialize());
  }
}

export { SMPService, sleep };
