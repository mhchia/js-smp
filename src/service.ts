import * as TCP from 'net';

import BN from 'bn.js';

import { Config, defaultConfig } from './config';
import { SMPStateMachine, TypeTLVOrNull } from './smp';
import { TLV } from './msgs';
import { FailedToReadData, SMPStateError } from "./exceptions";

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

interface ISMPService {
  listen(ip: string, port: number): void;
  connect(ip: string, port: number): Promise<boolean>;
}

// TODO: Change log to logger
class SMPService implements ISMPService {
  listener?: TCP.Server;

  constructor(readonly x: BN, readonly config: Config = defaultConfig) {}

  listen(ip: string, port: number): void {
    const server = TCP.createServer(this.onClientConnected.bind(this));
    server.listen(port, ip, () => {
      console.log(`SMPService.listen: start listening at ${ip}:${port}`);
    });
    this.listener = server;
  }

  async onClientConnected(sock: TCP.Socket): Promise<void> {
    const remoteAddress = sock.remoteAddress + ':' + sock.remotePort;
    console.log(
      'SMPService.onClientConnected: new sock connected: %s',
      remoteAddress
    );

    const stateMachine = new SMPStateMachine(this.x, this.config);

    sock.on('readable', function() {
      console.log(`SMPService.onClientConnected.readable: new data from ${ remoteAddress}`);
      // TODO: Do we need a lock here, to avoid another entrance before `TLV.readFromSocket`
      //  finishes?
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
      console.log(
        `SMPService.onClientConnected.readable: read tlv: type=${tlv.type}, value=${tlv.value}`
      );

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
      console.log(
        `SMPService.onClientConnected.connect: wrote tlv: type=${replyTLV.type}, value=${replyTLV.value}`
      );
    });
    sock.on('close', function() {
      console.log('SMPService.onClientConnected.close: connection from %s closed', remoteAddress);
    });
    sock.on('error', function(err) {
      console.log(
        'SMPService.onClientConnected.error: connection %s error: %s',
        remoteAddress,
        err.message
      );
    });
    while (!stateMachine.isFinished()) {
      console.log("SMPService.onClientConnected: in while");
      await sleep(100);
    }
    const result = stateMachine.getResult();
    console.log(`SMPService.onClientConnected: result=${result}`)
  }

  async connect(ip: string, port: number): Promise<boolean> {
    const sock = new TCP.Socket();
    const stateMachine = new SMPStateMachine(this.x, this.config);

    sock.connect(port, ip, () => {
      const address = sock.address();
      if (typeof address === 'string') {
        console.log(`SMPService.connect: connected to ${address}:${port}`);
      } else {
        console.log(
          `SMPService.connect: connected to ${address.address}:${port}`
        );
      }
      const msg1 = stateMachine.transit(null);
      // Sanity check
      if (msg1 === null) {
        throw new Error('msg1 should not be null');
      }
      console.log("SMPService.connect: sock.write=", msg1.serialize())
      sock.write(msg1.serialize());
      console.log(
        `SMPService.connect: wrote tlv: type=${msg1.type}, value=${msg1.value}`
      );
    });

    sock.on('readable', () => {
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
      console.log(
        `SMPService.connect.readable: read tlv: type=${tlv.type}, value=${tlv.value}`
      );
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
      console.log(
        `SMPService.connect: wrote tlv: type=${replyTLV.type}, value=${replyTLV.value}`
      );
    });

    sock.on('close', () => {
      console.log('SMPService.connect: Client closed');
    });

    sock.on('error', err => {
      console.error(err);
    });

    while (!stateMachine.isFinished()) {
      console.log("in while");
      await sleep(100);
    }
    return stateMachine.getResult();
  }
}

export { SMPService, sleep };
