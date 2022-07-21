import { PathLike } from "fs";
import { mkdir, readdir, readFile, writeFile, rm } from "fs/promises";
import LruCache from "lru-cache";
import path from "path";
import {
  Database,
  SingletonDatabase,
  SingletonDatabaseWrapper,
} from "./Database.js";
import { isNodeError } from "./util.js";

export interface JsonFileDatabaseConfig<T> {
  dataPath: string;
  cacheOptions: LruCache.Options<string, T>;
}

export class JsonFileDatabase<T> implements Database<T> {
  private readonly dataPath: string;
  private readonly cache: LruCache<string, T>;

  public constructor(config: JsonFileDatabaseConfig<T>) {
    this.dataPath = config.dataPath;
    this.cache = new LruCache(config.cacheOptions);
  }

  private getPath(id: string): string {
    return path.join(this.dataPath, `${id}.json`);
  }

  public get size(): Promise<number> {
    return getFileCount(this.dataPath);
  }

  public async read(id: string): Promise<T | undefined> {
    let value = this.cache.get(id);
    if (value == null) {
      let str;
      try {
        str = await readFile(this.getPath(id), { encoding: "utf8" });
      } catch (err) {
        if (isNodeError(err) && err.code === "ENOENT") return undefined;
        throw err;
      }
      value = JSON.parse(str) as T;
      this.cache.set(id, value);
    }
    return value;
  }

  public async write(id: string, value: T): Promise<void> {
    if (!this.cache.size) {
      await mkdir(this.dataPath, { recursive: true });
    }
    await writeFile(this.getPath(id), JSON.stringify(value, undefined, 2));
    this.cache.set(id, value);
  }

  public async delete(id: string): Promise<void> {
    await rm(this.getPath(id), { force: true });
    this.cache.delete(id);
  }
}

async function getFileCount(path: PathLike): Promise<number> {
  const entries = await readdir(path, { withFileTypes: true });
  return entries.reduce((count, entry) => count + (entry.isFile() ? 1 : 0), 0);
}

export type JsonFileSingletonDatabaseConfig<T> = Omit<
  JsonFileDatabaseConfig<T>,
  "cacheOptions"
> & {
  id: string;
};

export function getJsonFileSingletonDatabase<T>(
  config: JsonFileSingletonDatabaseConfig<T>
): SingletonDatabase<T> {
  const { id, ...rest } = config;
  return new SingletonDatabaseWrapper<T>(
    new JsonFileDatabase<T>({ ...rest, cacheOptions: { max: 1 } }),
    id
  );
}
