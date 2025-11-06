import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface DiscoveredVault {
  path: string;
  name: string;
  lastModified: Date;
}

export class VaultDiscovery {
  private searchPaths: string[];

  constructor(customPaths?: string[]) {
    this.searchPaths = customPaths || [
      path.join(os.homedir(), 'Documents', 'Obsidian'),
      path.join(os.homedir(), 'Library', 'Mobile Documents', 'iCloud~md~obsidian'),
      path.join(os.homedir(), 'Dropbox', 'Obsidian'),
      os.homedir()
    ];
  }

  async scanForVaults(): Promise<DiscoveredVault[]> {
    const vaults: DiscoveredVault[] = [];

    for (const searchPath of this.searchPaths) {
      try {
        const found = await this.findObsidianVaults(searchPath);
        vaults.push(...found);
      } catch (error) {
        // Path doesn't exist or no permission
        continue;
      }
    }

    return vaults.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  }

  private async findObsidianVaults(dir: string, depth: number = 0): Promise<DiscoveredVault[]> {
    if (depth > 3) return []; // Limit recursion depth

    const vaults: DiscoveredVault[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const entryPath = path.join(dir, entry.name);

        // Check if this directory contains .obsidian
        if (entry.name === '.obsidian') continue;

        const obsidianPath = path.join(entryPath, '.obsidian');
        try {
          await fs.access(obsidianPath);

          // Found a vault
          const stats = await fs.stat(entryPath);
          const appJsonPath = path.join(obsidianPath, 'app.json');

          let vaultName = entry.name;
          try {
            const appJson = await fs.readFile(appJsonPath, 'utf-8');
            const config = JSON.parse(appJson);
            vaultName = config.vaultName || entry.name;
          } catch {
            // app.json doesn't exist or malformed
          }

          vaults.push({
            path: entryPath,
            name: vaultName,
            lastModified: stats.mtime
          });
        } catch {
          // No .obsidian directory, continue searching
          if (depth < 3) {
            const subVaults = await this.findObsidianVaults(entryPath, depth + 1);
            vaults.push(...subVaults);
          }
        }
      }
    } catch (error) {
      // Can't read directory
    }

    return vaults;
  }

  async selectVault(vaults: DiscoveredVault[]): Promise<string | null> {
    if (vaults.length === 0) {
      return null;
    }

    if (vaults.length === 1) {
      return vaults[0].path;
    }

    // Multiple vaults found, return the most recently modified
    return vaults[0].path;
  }
}
