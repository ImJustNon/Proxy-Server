import net from "net";
import dgram from "dgram";
import http, { IncomingMessage, RequestListener, Server, ServerResponse } from "http";
import httpProxy from "http-proxy";
import socketIo from "socket.io";
import express, { Application, Request, Response } from "express";
import internal from "stream";

// Define port mappings for TCP, UDP, and HTTP
const mappings = [
    // {
    //     name: "Remote Desktop",
    //     protocols: ['tcp', "udp"], 
    //     host: "nonandchain.thddns.net",
    //     listenPort: 3388, 
    //     targetPort: 4848 
    // },
    // { 
    //     name: "Remote SSH",
    //     protocols: ['tcp', "udp"], 
    //     host: "nonandchain.thddns.net",
    //     listenPort: 22, 
    //     targetPort: 4847 
    // },
    // { 
    //     name: "Immich App",
    //     protocols: ["http"], 
    //     host: "nonandchain.thddns.net",
    //     listenPort: 80, 
    //     targetPort: 4840
    // },
    {
        name: "Discord_Bot_API",
        protocols: ["http"], 
        host: "nonandchain.thddns.net",
        listenPort: 80, 
        targetPort: 4849
    },
    {
        name: "Remote_Desktop",
        protocols: ["tcp", "udp"], 
        host: "nonandchain.thddns.net",
        listenPort: 3389, 
        targetPort: 4848
    }
];

function createSocketIoProxy(name: string, host: string, listenPort: number, targetPort: number){
    const app = express();
    const server = http.createServer(app);
    const proxy = httpProxy.createProxyServer({ target: `http://${host}:${targetPort}`, ws: true });
    server.on('upgrade', (req: IncomingMessage, socket: internal.Duplex, head: Buffer<ArrayBufferLike>) => {
        proxy.ws(req, socket, head, {}, (err: Error) => {
            console.error('WebSocket proxy error:', err.message);
        });
    });
    server.listen(listenPort, () => {
        console.log(`[${name}] UDP server listening on port ${listenPort}, forwarding to ${targetPort}`);
    });
}

// Function to handle HTTP proxying with http-proxy
function createHttpProxy(name: string, host: string, listenPort: number, targetPort: number): void {
    const app: Application = express();
    const server: http.Server = http.createServer(app);
    const proxy: httpProxy = httpProxy.createProxyServer({ 
        target: `http://${host}:${targetPort}`, 
        changeOrigin: true,
        ws: true 
    });


    app.use((req: Request, res: Response) => {
        proxy.web(req, res, {}, (err: Error) => {
            console.error(`HTTP proxy error for port ${listenPort}:`, err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        });
    });

    // const server: Server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
    //     proxy.web(req, res, { 
    //         target: `http://${host}:${targetPort}`, 
    //         ws: true,
    //     }, (err) => {
    //         console.error(`HTTP proxy error for port ${listenPort}:`, err);
    //         res.writeHead(500, { 'Content-Type': 'text/plain' });
    //         res.end('Internal Server Error');
    //     });
    // });

    server.on('upgrade', (req: IncomingMessage, socket: internal.Duplex, head: Buffer<ArrayBufferLike>) => {
        proxy.ws(req, socket, head, {}, (err: Error) => {
            console.error('WebSocket proxy error:', err.message);
        });
    });

    proxy.on('error', (err: Error, req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> | net.Socket) => {
        console.error('Proxy error:', err);
        if (res instanceof ServerResponse) {
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
            }
            res.end('Proxy encountered an error.');
        } 
        else if (res instanceof net.Socket) {
            res.end('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        } 
        else {
            console.error('Unknown response type encountered in proxy error handler.');
        }
    });

    server.listen(listenPort, (): void => {
        console.log(`[${name}] HTTP proxy listening on port ${listenPort}, forwarding to ${targetPort}`);
    });
}

// Function to handle TCP proxying with net
function createTcpProxy(name: string, host: string, listenPort: number, targetPort: number): void {
    // Handle TCP traffic
    const tcpServer: net.Server = net.createServer((clientSocket: net.Socket): void => {
        const forwardSocket: net.Socket = net.createConnection(targetPort, host, (): void => {
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

// Function to handle UDP proxying with dgram
function createUdpProxy(name: string, host: string, listenPort: number, targetPort: number): void {
    // Handle UDP traffic
    const udpServer: dgram.Socket = dgram.createSocket('udp4');

    udpServer.on('message', (msg: Buffer<ArrayBufferLike>, rinfo: dgram.RemoteInfo) => {

        console.log(`[${name}] UDP message received on port ${listenPort}, forwarding to ${targetPort}`);

        udpServer.send(msg, 0, msg.length, targetPort, host, (err: Error | null) => {
            if (err) console.error(`UDP forward error: ${err}`);
        });
    });

    udpServer.bind(listenPort, (): void => {
        console.log(`[${name}] UDP server listening on port ${listenPort}, forwarding to ${targetPort}`);
    });
}



// Start servers for each protocol based on mappings
mappings.forEach(({ name, protocols, host, listenPort, targetPort }: { name: string; protocols: string[]; host: string; listenPort: number, targetPort: number }): void => {
    protocols.forEach((proto: string): void => {
        if (proto === 'tcp') {
            createTcpProxy(name, host, listenPort, targetPort);
        } else if (proto === 'udp') {
            createUdpProxy(name, host, listenPort, targetPort);
        } else if (proto === 'http') {
            // Handle HTTP traffic
            createHttpProxy(name, host, listenPort, targetPort);
        }
    });
});
