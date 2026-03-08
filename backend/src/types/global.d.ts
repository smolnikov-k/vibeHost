// Node.js globals
declare var console: {
  log(...args: any[]): void;
  error(...args: any[]): void;
  warn(...args: any[]): void;
  info(...args: any[]): void;
};
declare var process: { env: Record<string, string | undefined> };
declare var __dirname: string;
declare var __filename: string;
declare var setInterval: (callback: (...args: any[]) => void, ms: number) => any;
declare var clearInterval: (id: any) => void;
declare var setTimeout: (callback: (...args: any[]) => void, ms: number) => any;
declare var clearTimeout: (id: any) => void;
declare class Buffer {
  static from(data: any, encoding?: string): Buffer;
  toString(encoding?: string): string;
  length: number;
}
declare class URLSearchParams {
  constructor(init?: string | Record<string, string>);
  get(name: string): string | null;
  set(name: string, value: string): void;
  toString(): string;
}
declare namespace Express {
  interface Request {}
}
declare namespace NodeJS {
  interface Process { env: Record<string, string | undefined>; }
}

declare module 'fs' {
  interface Stats { isDirectory(): boolean; isFile(): boolean; size: number; mtime: Date; }
  interface Dirent { name: string; isDirectory(): boolean; isFile(): boolean; }
  export function existsSync(p: string): boolean;
  export function mkdirSync(p: string, options?: { recursive?: boolean }): string | undefined;
  export function readFileSync(p: string, encoding?: string): any;
  export function writeFileSync(p: string, data: any): void;
  export function renameSync(oldPath: string, newPath: string): void;
  export function unlinkSync(p: string): void;
  export function rmSync(p: string, options?: { recursive?: boolean; force?: boolean }): void;
  export function readdirSync(p: string, options?: { withFileTypes?: boolean }): any[];
  export function statSync(p: string): Stats;
  export function cpSync(src: string, dest: string, options?: { recursive?: boolean }): void;
  export function createReadStream(p: string): any;
  export function createWriteStream(p: string): any;
  export function symlinkSync(target: string, p: string): void;
  export function copyFileSync(src: string, dest: string): void;
}

declare module 'path' {
  export const sep: string;
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
  export function dirname(p: string): string;
  export function basename(p: string, ext?: string): string;
  export function extname(p: string): string;
  export function normalize(p: string): string;
  export function relative(from: string, to: string): string;
}

declare module 'crypto' {
  interface Hash { update(data: any): Hash; digest(encoding: string): string; }
  export function randomBytes(size: number): { toString(encoding: string): string };
  export function createHash(algorithm: string): Hash;
  export function createHmac(algorithm: string, key: string): Hash;
  export function randomUUID(): string;
  export function timingSafeEqual(a: Buffer, b: Buffer): boolean;
}

declare module 'child_process' {
  export function exec(command: string, options?: any, callback?: (error: any, stdout: string, stderr: string) => void): any;
  export function execSync(command: string, options?: any): Buffer | string;
  export function spawnSync(command: string, args?: string[], options?: any): {
    status: number | null;
    stdout: Buffer | null;
    stderr: Buffer | null;
  };
}

declare module 'util' {
  export function promisify<T extends (...args: any[]) => any>(fn: T): (...args: any[]) => Promise<any>;
}

declare module 'stream' {
  export class Readable {}
  export class Writable {}
}

declare module 'http' {
  export class IncomingMessage {}
  export class ServerResponse {}
}

declare module 'express' {
  interface Request {
    body: any;
    params: Record<string, string>;
    query: Record<string, string | undefined>;
    headers: Record<string, string | undefined>;
    file?: { path: string; size: number; originalname: string; mimetype: string; filename: string };
    ip?: string;
    originalUrl: string;
    path: string;
    method: string;
    socket: { remoteAddress?: string };
    on(event: string, listener: (...args: any[]) => void): void;
  }
  interface Response {
    status(code: number): Response;
    json(body: any): void;
    send(body?: any): void;
    sendFile(path: string): void;
    set(field: string, value: string): Response;
    setHeader(field: string, value: string): Response;
    removeHeader(name: string): void;
    header(field: string, value: string): Response;
    redirect(url: string): void;
    download(path: string, filename?: string): void;
    write(chunk: string | Buffer): boolean;
    end(): void;
    headersSent: boolean;
  }
  interface NextFunction { (err?: any): void; }
  interface Router {
    get(path: string, ...handlers: any[]): Router;
    post(path: string, ...handlers: any[]): Router;
    put(path: string, ...handlers: any[]): Router;
    delete(path: string, ...handlers: any[]): Router;
    patch(path: string, ...handlers: any[]): Router;
    use(...handlers: any[]): Router;
  }
  interface Application extends Router {
    set(setting: string, val: any): Application;
    listen(port: number, callback?: () => void): any;
  }
  function express(): Application;
  namespace express {
    function json(options?: object): any;
    function urlencoded(options?: object): any;
    function Router(): Router;
    type Request = import('express').Request;
    type Response = import('express').Response;
    type NextFunction = import('express').NextFunction;
  }
  export function Router(): Router;
  export { Request, Response, NextFunction };
  export default express;
}

declare module 'express-rate-limit' {
  function rateLimit(options: any): any;
  export default rateLimit;
}

declare module 'cors' {
  function cors(options?: any): any;
  export default cors;
}

declare module 'helmet' {
  function helmet(options?: any): any;
  export default helmet;
}

declare module 'bcrypt' {
  export function hash(data: string, saltOrRounds: number): Promise<string>;
  export function compare(data: string, encrypted: string): Promise<boolean>;
}

declare module 'jsonwebtoken' {
  export function sign(payload: any, secret: string, options?: any): string;
  export function verify(token: string, secret: string, options?: any): any;
}

declare module 'multer' {
  namespace multer {
    function diskStorage(options: { destination: any; filename: any }): any;
  }
  function multer(options?: any): any;
  export default multer;
}

declare module 'adm-zip' {
  class AdmZip {
    constructor(filePath?: string);
    getEntries(): Array<{
      entryName: string;
      isDirectory: boolean;
      header: { size: number; compressedSize: number };
      getData(): Buffer;
    }>;
    extractAllTo(targetPath: string, overwrite?: boolean): void;
  }
  export default AdmZip;
}

declare module 'winston' {
  const winston: any;
  export default winston;
}

declare module 'dns' {
  export function resolve(hostname: string, rrtype: string, callback: (err: any, addresses: string[]) => void): void;
  export function resolveTxt(hostname: string, callback: (err: any, addresses: string[][]) => void): void;
  export function resolveCname(hostname: string, callback: (err: any, addresses: string[]) => void): void;
  export const promises: {
    resolve4(hostname: string): Promise<string[]>;
    resolveCname(hostname: string): Promise<string[]>;
    resolveTxt(hostname: string): Promise<string[][]>;
    resolve(hostname: string, rrtype: string): Promise<string[]>;
  };
}

declare namespace Express {
  namespace Multer {
    interface File { path: string; size: number; originalname: string; mimetype: string; }
  }
}

declare namespace multer {
  type FileFilterCallback = (error: Error | null, acceptFile?: boolean) => void;
}
