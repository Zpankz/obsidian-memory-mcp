import { VaultDiscovery, DiscoveredVault } from './VaultDiscovery.js';
import { promises as fs } from 'fs';
import * as path from 'path';

describe('VaultDiscovery', () => {
  it('should create VaultDiscovery instance', () => {
    const discovery = new VaultDiscovery();
    expect(discovery).toBeDefined();
  });

  it('should identify .obsidian folders', async () => {
    const testVault = path.join(__dirname, '../../test-fixtures/vault');

    // Create .obsidian directory
    await fs.mkdir(path.join(testVault, '.obsidian'), { recursive: true });
    await fs.writeFile(
      path.join(testVault, '.obsidian', 'app.json'),
      JSON.stringify({ vaultName: 'Test Vault' })
    );

    // Create discovery with limited search paths
    const discovery = new VaultDiscovery([path.join(__dirname, '../../test-fixtures')]);
    const vaults = await discovery.scanForVaults();

    const found = vaults.find(v => v.path.includes('test-fixtures/vault'));
    expect(found).toBeDefined();
    expect(found?.name).toBe('Test Vault');

    // Cleanup
    await fs.rm(path.join(testVault, '.obsidian'), { recursive: true });
  });

  it('should select single vault automatically', async () => {
    const vaults: DiscoveredVault[] = [
      { path: '/path/to/vault', name: 'My Vault', lastModified: new Date() }
    ];

    const discovery = new VaultDiscovery();
    const selected = await discovery.selectVault(vaults);

    expect(selected).toBe('/path/to/vault');
  });
});
