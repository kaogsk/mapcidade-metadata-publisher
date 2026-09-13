/**
 * Túnel SSH local — porta do comportamento do sshtunnel (Python):
 * abre um listener TCP em 127.0.0.1:<porta aleatória> e encaminha cada
 * conexão via forwardOut até o Postgres remoto. Ordem de autenticação:
 * chave privada → senha → agente SSH.
 */
import { createServer, type Server, type Socket } from "node:net";
import { readFileSync, existsSync } from "node:fs";
import { Client, type ConnectConfig } from "ssh2";
import type { SshInput } from "../schemas.js";

export interface SshTunnel {
  localHost: string;
  localPort: number;
  close(): Promise<void>;
}

function authAttempts(cfg: SshInput): ConnectConfig[] {
  const base: ConnectConfig = {
    host: cfg.host,
    port: cfg.port,
    username: cfg.user,
    readyTimeout: 20_000,
  };
  const attempts: ConnectConfig[] = [];
  if (cfg.privateKeyPath && existsSync(cfg.privateKeyPath)) {
    attempts.push({ ...base, privateKey: readFileSync(cfg.privateKeyPath) });
  }
  if (cfg.password) {
    attempts.push({ ...base, password: cfg.password });
  }
  if (process.env.SSH_AUTH_SOCK) {
    attempts.push({ ...base, agent: process.env.SSH_AUTH_SOCK });
  }
  if (attempts.length === 0) {
    attempts.push(base);
  }
  return attempts;
}

function connectSsh(cfg: ConnectConfig): Promise<Client> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    client
      .once("ready", () => resolve(client))
      .once("error", (err) => reject(err))
      .connect(cfg);
  });
}

export async function openTunnel(cfg: SshInput): Promise<SshTunnel> {
  let ssh: Client | null = null;
  let lastError: unknown = new Error("Nenhuma forma de autenticação SSH disponível");
  for (const attempt of authAttempts(cfg)) {
    try {
      ssh = await connectSsh(attempt);
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (!ssh) {
    throw new Error(`Falha ao estabelecer túnel SSH: ${String(lastError)}`);
  }
  const sshClient = ssh;

  const sockets = new Set<Socket>();
  const server: Server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    sshClient.forwardOut(
      socket.remoteAddress ?? "127.0.0.1",
      socket.remotePort ?? 0,
      cfg.remoteHost,
      cfg.remotePort,
      (err, stream) => {
        if (err) {
          socket.destroy();
          return;
        }
        socket.pipe(stream).pipe(socket);
        stream.on("error", () => socket.destroy());
        socket.on("error", () => stream.destroy());
      },
    );
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    sshClient.end();
    throw new Error("Falha ao abrir listener local do túnel SSH");
  }

  return {
    localHost: "127.0.0.1",
    localPort: address.port,
    close: () =>
      new Promise<void>((resolve) => {
        for (const s of sockets) s.destroy();
        server.close(() => {
          sshClient.end();
          resolve();
        });
      }),
  };
}
