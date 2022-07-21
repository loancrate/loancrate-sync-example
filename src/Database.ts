export interface Database<T> {
  size: Promise<number>;
  read(id: string): Promise<T | undefined>;
  write(id: string, value: T): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface SingletonDatabase<T> {
  read(): Promise<T | undefined>;
  write(value: T): Promise<void>;
  delete(): Promise<void>;
}

export class SingletonDatabaseWrapper<T> implements SingletonDatabase<T> {
  public constructor(
    private readonly base: Database<T>,
    private readonly id: string
  ) {}

  public async read(): Promise<T | undefined> {
    return await this.base.read(this.id);
  }

  public async write(value: T): Promise<void> {
    await this.base.write(this.id, value);
  }

  public async delete(): Promise<void> {
    await this.base.delete(this.id);
  }
}
