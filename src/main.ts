import BN from 'bn.js';
import Peer from 'peerjs';

import { SMPStateMachine } from './smp';


const localPeerParamName = "localPeer";
const localPeerID = localPeerParamName;
const remotePeerParamName = "remotePeer";
const remotePeerID = remotePeerParamName;
const secretParamName = "secret";
const secretID = secretParamName;
const startButtonID = "startButton";
const connectButtonID = "connectButton";


function getGETParam(q: string): string {
  const t = (window.location.search.match(new RegExp('[?&]' + q + '=([^&]+)')) || [, null])[1];
  if (t === null || t === undefined) {
    return '';
  } else {
    return t;
  }
}

function setTextareaValueWithParam(id: string, paramName: string): HTMLTextAreaElement {
  const element = document.querySelector(`textarea#${id}`) as HTMLTextAreaElement;
  if (element === null) {
    throw new Error(`couldn't get element ${id}`);
  }
  element.value = getGETParam(paramName);
  return element;
}

const localPeerElement = setTextareaValueWithParam(localPeerID, localPeerParamName);
const remotePeerElement = setTextareaValueWithParam(remotePeerID, remotePeerParamName);
const secretElement = setTextareaValueWithParam(secretID, secretParamName);
console.log(secretElement);
const startButton = document.querySelector(`button#${startButtonID}`) as HTMLButtonElement;
const connectButton = document.querySelector(`button#${connectButtonID}`) as HTMLButtonElement;

startButton.onclick = startPeer;
connectButton.onclick = connectRemotePeer;


let localPeer: Peer;
let conn: Peer.DataConnection;
const peerConfig = { debug: 3, host: 'localhost', port: 8000, path: '/myapp'};

function startPeer() {
  localPeer = new Peer(localPeerElement.value, peerConfig);
  localPeer.on('open', onPeerOpen);
  localPeer.on('connection', (conn: Peer.DataConnection) => {
    console.log("received conn");
    conn.on('data', (data) => {
        // Will print 'hi!'
        console.log(data);
    });
    conn.on('open', () => {
        conn.send('hello!');
    });
  });
}

function connectRemotePeer() {
  if (localPeer === null) {
    throw new Error("localPeer hasn't been initialized");
  }
  conn = localPeer.connect(remotePeerElement.value, {reliable:true});
  console.log(`connecting ${remotePeerElement.value}`);
  conn.on('open', () => {
      console.log("opened conn to a");
      conn.send('hi!');
  });
  conn.on('data', (data) => {
      // Will print 'hello!'
      console.log(data);
  });
}

function onPeerOpen(id: string) {
  console.log(`I'm ${id}`);
}


// const alice = new SMPStateMachine(new BN(1));
// console.log("1");
// const bob = new SMPStateMachine(new BN(1));
// console.log("2");
// const msg1 = alice.transit(null); // Initiate SMP
// console.log("3");
// const msg2 = bob.transit(msg1);
// console.log("4");
// const msg3 = alice.transit(msg2);
// console.log("5");
// const msg4 = bob.transit(msg3);
// console.log("6");
// alice.transit(msg4);
// console.log("7");
// const resAlice = alice.getResult();
// const resBob = bob.getResult();
// if (resAlice === null) {
//   throw new Error('result should have been set on Alice side');
// }
// if (resBob === null) {
//   throw new Error('result should have been set on Bob side');
// }
// if (resAlice !== resBob) {
//   throw new Error('Alice and Bob got different results');
// }
// console.log(`result = ${resAlice}`);
console.log("main.ts finished");
export { SMPStateMachine, BN };
