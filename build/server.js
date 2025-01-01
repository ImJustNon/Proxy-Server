"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const net_1 = __importDefault(require("net"));
const dgram_1 = __importDefault(require("dgram"));
const http_1 = __importDefault(require("http"));
const http_proxy_1 = __importDefault(require("http-proxy"));
const mappings = [
    {
        name: "Immich App",
        protocols: ["http"],
        host: "nonandchain.thddns.net",
        listenPort: 80,
        targetPort: 4840
    },
];
function createHttpProxy(name, host, listenPort, targetPort) {
    const proxy = http_proxy_1.default.createProxyServer({});
    const server = http_1.default.createServer((req, res) => {
        proxy.web(req, res, {
            target: `http://${host}:${targetPort}`
        }, (err) => {
            console.error(`HTTP proxy error for port ${listenPort}:`, err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        });
    });
    server.listen(listenPort, () => {
        console.log(`[${name}] HTTP proxy listening on port ${listenPort}, forwarding to ${targetPort}`);
    });
}
function createTcpProxy(name, host, listenPort, targetPort) {
    const tcpServer = net_1.default.createServer((clientSocket) => {
        const forwardSocket = net_1.default.createConnection(targetPort, host, () => {
            console.log(`[${name}] TCP connection forwarded: ${listenPort} -> ${targetPort}`);
        });
        clientSocket.pipe(forwardSocket);
        forwardSocket.pipe(clientSocket);
        clientSocket.on('end', () => forwardSocket.end());
        forwardSocket.on('end', () => clientSocket.end());
        clientSocket.on('error', (err) => console.error(`TCP error on port ${listenPort}:`, err));
        forwardSocket.on('error', (err) => console.error(`TCP forward error on port ${targetPort}:`, err));
    });
    tcpServer.listen(listenPort, () => {
        console.log(`[${name}] TCP server listening on port ${listenPort}, forwarding to ${targetPort}`);
    });
}
function createUdpProxy(name, host, listenPort, targetPort) {
    const udpServer = dgram_1.default.createSocket('udp4');
    udpServer.on('message', (msg, rinfo) => {
        console.log(`[${name}] UDP message received on port ${listenPort}, forwarding to ${targetPort}`);
        udpServer.send(msg, 0, msg.length, targetPort, host, (err) => {
            if (err)
                console.error(`UDP forward error: ${err}`);
        });
    });
    udpServer.bind(listenPort, () => {
        console.log(`[${name}] UDP server listening on port ${listenPort}, forwarding to ${targetPort}`);
    });
}
mappings.forEach(({ name, protocols, host, listenPort, targetPort }) => {
    protocols.forEach((proto) => {
        if (proto === 'tcp') {
            createTcpProxy(name, host, listenPort, targetPort);
        }
        else if (proto === 'udp') {
            createUdpProxy(name, host, listenPort, targetPort);
        }
        else if (proto === 'http') {
            createHttpProxy(name, host, listenPort, targetPort);
        }
    });
});
//# sourceMappingURL=server.js.map