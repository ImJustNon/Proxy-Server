"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const net_1 = __importDefault(require("net"));
const dgram_1 = __importDefault(require("dgram"));
const http_1 = __importStar(require("http"));
const http_proxy_1 = __importDefault(require("http-proxy"));
const express_1 = __importDefault(require("express"));
const mappings = [
    {
        name: "Immich App",
        protocols: ["http"],
        host: "nonandchain.thddns.net",
        listenPort: 80,
        targetPort: 4840
    },
];
function createSocketIoProxy(name, host, listenPort, targetPort) {
    const app = (0, express_1.default)();
    const server = http_1.default.createServer(app);
    const proxy = http_proxy_1.default.createProxyServer({ target: `http://${host}:${targetPort}`, ws: true });
    server.on('upgrade', (req, socket, head) => {
        proxy.ws(req, socket, head, {}, (err) => {
            console.error('WebSocket proxy error:', err.message);
        });
    });
    server.listen(listenPort, () => {
        console.log(`[${name}] UDP server listening on port ${listenPort}, forwarding to ${targetPort}`);
    });
}
function createHttpProxy(name, host, listenPort, targetPort) {
    const app = (0, express_1.default)();
    const server = http_1.default.createServer(app);
    const proxy = http_proxy_1.default.createProxyServer({
        target: `http://${host}:${targetPort}`,
        changeOrigin: true,
        ws: true
    });
    app.use((req, res) => {
        proxy.web(req, res, {}, (err) => {
            console.error(`HTTP proxy error for port ${listenPort}:`, err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        });
    });
    server.on('upgrade', (req, socket, head) => {
        proxy.ws(req, socket, head, {}, (err) => {
            console.error('WebSocket proxy error:', err.message);
        });
    });
    proxy.on('error', (err, req, res) => {
        console.error('Proxy error:', err);
        if (res instanceof http_1.ServerResponse) {
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
            }
            res.end('Proxy encountered an error.');
        }
        else if (res instanceof net_1.default.Socket) {
            res.end('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        }
        else {
            console.error('Unknown response type encountered in proxy error handler.');
        }
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