import { WebSocket, WebSocketServer } from "ws";
import { env as envar } from "process";
import { log } from "./log.ts";

const port = parseInt(envar.PORT || "7001");
const host = envar.HOST || "0.0.0.0";
const wss = new WebSocketServer({ port, host });
log.info(`WebSocket server listening at wss://${host}:${port}`);

const waitingQueue: WebSocket[] = [];
const connectionMap: Map<WebSocket, WebSocket> = new Map<WebSocket, WebSocket>();

type ClientMessage =
    { type: "offer", offer: RTCSessionDescriptionInit }
    | { type: "answer", answer: RTCSessionDescriptionInit }
    | { type: "ice-candidate", candidate: RTCIceCandidateInit }
    | { type: "ping" }
    | { type: "pong" }
    | { type: "server-ping" };

type WithRelay<T> = T & { relay: true };

type RelayedClientMessage = WithRelay<ClientMessage>;

type ServerMessage =
    { type: "waiting" }
    | { type: "paired", initiator: boolean }
    | { type: "peer-disconnected" }
    | { type: "error", message: string }
    | RelayedClientMessage;

const jsonMessage = {
    waiting: () => JSON.stringify({ type: "waiting" }),
    paired: (arg: boolean) => JSON.stringify({ type: "paired", initiator: arg }),
    peerDisconnected: () => JSON.stringify({ type: "peer-disconnected" }),
    offer: (arg: RTCSessionDescriptionInit) => JSON.stringify({ relay: true, type: "offer", offer: arg }),
    answer: (arg: RTCSessionDescriptionInit) => JSON.stringify({ relay: true, type: "answer", answer: arg }),
    iceCandidate: (arg: RTCIceCandidateInit) => JSON.stringify({ relay: true, type: "ice-candidate", candidate: arg }),
    ping: () => JSON.stringify({ type: "ping", relay: true }),
    pong: () => JSON.stringify({ type: "pong", relay: true }),
    error: (arg: string) => JSON.stringify({ type: "error", message: arg })
};

wss.on("connection", (socket: WebSocket) => {
    log.debug("New client connected");
    if (waitingQueue.length > 0) pair(waitingQueue.shift()!, socket);
    else {
        waitingQueue.push(socket);
        socket.send(jsonMessage.waiting());
        log.info("No sockets available to pair, adding to wait queue");
    }

    initializeSocketHandlers(socket);   
});

function initializeSocketHandlers(socket: WebSocket) {
    socket.on("message", (data: WebSocket.RawData) => {
    let message: unknown;
    try { message = JSON.parse(data.toString()); }
    catch (err) {
        socket.send(jsonMessage.error("Malformed JSON " + err));
        return;
    }

    // scope `message` to ClientMessage 
    if (!isClientMessage(message)) {
        socket.send(jsonMessage.error("Invalid message format"));
        return;
    }

    const peer = connectionMap.get(socket);
    if (message.type !== "server-ping" && (peer === undefined || peer.readyState !== WebSocket.OPEN)) {
        log.warn("Tried to relay without a valid peer", `peer ${peer?.readyState ?? "undefined"}`);
        return;
    }

    switch (message.type) {
        case "offer":
            peer!.send(jsonMessage.offer(message.offer));
            log.debug("Relaying offer message from client");
            break;
        case "answer":
            peer!.send(jsonMessage.answer(message.answer));
            log.debug("Relaying answer message from client");
            break;
        case "ice-candidate":
            peer!.send(jsonMessage.iceCandidate(message.candidate));
            log.debug("Relaying ice-candidate message from client");
            break;
        case "ping":
            peer!.send(jsonMessage.ping());
            break;
        case "server-ping":
            socket.send(JSON.stringify({ type: "server-pong" }));
            break;
        case "pong":
            peer!.send(jsonMessage.pong());
            break;
        default:
            socket.send(jsonMessage.error(`Unknown message type: ${data.toString()}`));
            log.error("Received unknown message type from client:", message);
        }
    });

    socket.on("close", () => {
        log.info("Client disconnected.");
        dispose(socket)
    });

    socket.on("error", (err: Error) => {
        log.error("Error occurred in WebSocket connection:", err);
        socket.send(jsonMessage.error("Error occurred in WebSocket: " + err.message));
        dispose(socket);
    });
}

function dispose(socket: WebSocket) {
    log.info("Disposing of socket")
    let peer = connectionMap.get(socket);
    if (!peer) {
        let index = waitingQueue.indexOf(socket);
        if (index !== -1) waitingQueue.splice(index, 1);
    } else {
        peer.send(jsonMessage.peerDisconnected());
        connectionMap.delete(socket);
    }
}

function pair(a: WebSocket, b: WebSocket): void {
    connectionMap.set(a, b);
    connectionMap.set(b, a);
    a.send(jsonMessage.paired(true));
    b.send(jsonMessage.paired(false));
    log.debug("Paired two clients");
}

function isClientMessage(message: any): message is ClientMessage {
    if (message == null || typeof message !== "object") return false;

    switch (message.type) {

        case "offer":
            return typeof message.offer === "object"
                && typeof message.offer.type === "string"
                && message.offer.type === "offer"
                && typeof message.offer.sdp === "string";
        case "answer":
            return typeof message.answer === "object"
                && typeof message.answer.type === "string"
                && message.answer.type === "answer"
                && typeof message.answer.sdp == "string";
        case "ice-candidate":
            return typeof message.candidate === "object"
                && typeof message.candidate.candidate === "string";
        case "ping":
        case "pong":
        case "server-ping":
            return true;
        default:
            return false;
    }
}