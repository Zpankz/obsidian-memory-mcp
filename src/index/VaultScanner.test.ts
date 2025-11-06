import { VaultScanner } from './VaultScanner.js';
import * as path from 'path';

describe('VaultScanner', () => {
  it('should create scanner with vault path', async () => {
    const vaultPath = path.join(__dirname, '../../test-fixtures/vault');
    const scanner = await VaultScanner.create(vaultPath);

    expect(scanner).toBeDefined();
    await scanner.close();
  });

  it('should scan entities from vault files', async () => {
    const vaultPath = path.join(__dirname, '../../test-fixtures/vault');
    const scanner = await VaultScanner.create(vaultPath);

    const entity = await scanner.getEntity('VaultNote');
    expect(entity).toBeDefined();
    expect(entity?.name).toBe('VaultNote');

    await scanner.close();
  });
});
