/**
 * File Session Store
 */
import fs from 'node:fs';
import path from 'node:path';

export interface TgSessionStore {
  load(): Promise<string | null>;
  save(session: string): Promise<void>;
}

export class FileSessionStore implements TgSessionStore {
  constructor(private filePath: string) {}

  async load(): Promise<string | null> {
    try {
      return await fs.promises.readFile(this.filePath, 'utf8');
    } catch {
      return null;
    }
  }

  async save(session: string): Promise<void> {
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.promises.writeFile(this.filePath, session, 'utf8');
  }
}
