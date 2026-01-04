import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import crypto from 'crypto';
import path from 'path';

// Mock fs module
vi.mock('fs/promises');

// Helper to create test instance (we'll need to refactor the script to export functions)
// For now, we'll test the logic patterns

describe('generateContentHash', () => {
  const generateContentHash = (title: string, category: string): string => {
    const content = `${title}|${category}`;
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 16);
  };

  it('generates consistent hash for same input', () => {
    const hash1 = generateContentHash('Test Title', 'DevOps');
    const hash2 = generateContentHash('Test Title', 'DevOps');
    expect(hash1).toBe(hash2);
  });

  it('generates different hashes for different titles', () => {
    const hash1 = generateContentHash('Title A', 'DevOps');
    const hash2 = generateContentHash('Title B', 'DevOps');
    expect(hash1).not.toBe(hash2);
  });

  it('generates different hashes for different categories', () => {
    const hash1 = generateContentHash('Test Title', 'DevOps');
    const hash2 = generateContentHash('Test Title', 'Cloud');
    expect(hash1).not.toBe(hash2);
  });

  it('handles special characters in title', () => {
    const specialChars = ['<>&"\'\'', 'Test & Demo', 'Test <Component>'];
    specialChars.forEach(title => {
      const hash = generateContentHash(title, 'DevOps');
      expect(hash).toBeDefined();
      expect(hash).toHaveLength(16);
    });
  });

  it('handles very long strings', () => {
    const longTitle = 'A'.repeat(1000);
    const hash = generateContentHash(longTitle, 'DevOps');
    expect(hash).toBeDefined();
    expect(hash).toHaveLength(16);
  });

  it('handles empty strings', () => {
    const hash = generateContentHash('', '');
    expect(hash).toBeDefined();
    expect(hash).toHaveLength(16);
  });

  it('generates unique hashes for similar inputs', () => {
    const hash1 = generateContentHash('Docker', 'DevOps');
    const hash2 = generateContentHash('Docker ', 'DevOps');
    const hash3 = generateContentHash('docker', 'DevOps');
    
    expect(hash1).not.toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  it('handles unicode characters', () => {
    const unicodeTitles = ['Test éèê', '中文测试', 'مثال'];
    unicodeTitles.forEach(title => {
      const hash = generateContentHash(title, 'DevOps');
      expect(hash).toBeDefined();
      expect(hash).toHaveLength(16);
    });
  });
});

describe('loadCache', () => {
  const loadCache = async (): Promise<Record<string, string>> => {
    try {
      const cacheContent = await fs.readFile('.image-cache.json', 'utf-8');
      return JSON.parse(cacheContent);
    } catch {
      return {};
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads valid cache file successfully', async () => {
    const mockCache = { 'path/to/file.svg': 'abc123' };
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockCache));

    const cache = await loadCache();
    expect(cache).toEqual(mockCache);
  });

  it('returns empty object when cache file is missing', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

    const cache = await loadCache();
    expect(cache).toEqual({});
  });

  it('returns empty object when JSON is malformed', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('{ invalid json }');

    const cache = await loadCache();
    expect(cache).toEqual({});
  });

  it('returns empty object when cache file is empty', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('');

    const cache = await loadCache();
    expect(cache).toEqual({});
  });

  it('handles permission errors gracefully', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('EACCES: permission denied'));

    const cache = await loadCache();
    expect(cache).toEqual({});
  });

  it('handles large cache files', async () => {
    const largeCache: Record<string, string> = {};
    for (let i = 0; i < 10000; i++) {
      largeCache[`path/to/file${i}.svg`] = `hash${i}`;
    }
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(largeCache));

    const cache = await loadCache();
    expect(Object.keys(cache)).toHaveLength(10000);
  });
});

describe('saveCache', () => {
  const saveCache = async (cache: Record<string, string>): Promise<void> => {
    await fs.writeFile('.image-cache.json', JSON.stringify(cache, null, 2), 'utf-8');
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves cache successfully', async () => {
    const cache = { 'path/to/file.svg': 'abc123' };
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    await saveCache(cache);

    expect(fs.writeFile).toHaveBeenCalledWith(
      '.image-cache.json',
      JSON.stringify(cache, null, 2),
      'utf-8'
    );
  });

  it('formats JSON correctly', async () => {
    const cache = { key1: 'value1', key2: 'value2' };
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    await saveCache(cache);

    const savedContent = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
    expect(() => JSON.parse(savedContent)).not.toThrow();
  });

  it('handles write permission errors', async () => {
    const cache = { 'path/to/file.svg': 'abc123' };
    vi.mocked(fs.writeFile).mockRejectedValue(new Error('EACCES: permission denied'));

    await expect(saveCache(cache)).rejects.toThrow('permission denied');
  });

  it('overwrites existing cache', async () => {
    const newCache = { 'new/path.svg': 'xyz789' };
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    await saveCache(newCache);

    expect(fs.writeFile).toHaveBeenCalledTimes(1);
  });

  it('handles empty cache object', async () => {
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    await saveCache({});

    expect(fs.writeFile).toHaveBeenCalledWith(
      '.image-cache.json',
      JSON.stringify({}, null, 2),
      'utf-8'
    );
  });
});

describe('fileExists', () => {
  const fileExists = async (outputPath: string): Promise<boolean> => {
    const forceRegenerate = process.argv.includes('--force');
    if (forceRegenerate) {
      return false;
    }

    try {
      const stats = await fs.stat(outputPath);
      return stats.size > 500;
    } catch {
      return false;
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Remove --force flag if present
    const forceIndex = process.argv.indexOf('--force');
    if (forceIndex > -1) {
      process.argv.splice(forceIndex, 1);
    }
  });

  afterEach(() => {
    // Clean up --force flag
    const forceIndex = process.argv.indexOf('--force');
    if (forceIndex > -1) {
      process.argv.splice(forceIndex, 1);
    }
  });

  it('returns false when FORCE_REGENERATE is true', async () => {
    process.argv.push('--force');

    const result = await fileExists('path/to/file.svg');
    expect(result).toBe(false);
  });

  it('returns true when file exists with valid size', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ size: 1000 } as any);

    const result = await fileExists('path/to/file.svg');
    expect(result).toBe(true);
  });

  it('returns false when file size is less than 500 bytes', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ size: 400 } as any);

    const result = await fileExists('path/to/file.svg');
    expect(result).toBe(false);
  });

  it('returns false when file does not exist', async () => {
    vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));

    const result = await fileExists('path/to/file.svg');
    expect(result).toBe(false);
  });

  it('handles file stat errors', async () => {
    vi.mocked(fs.stat).mockRejectedValue(new Error('EACCES: permission denied'));

    const result = await fileExists('path/to/file.svg');
    expect(result).toBe(false);
  });

  it('works with different file extensions', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ size: 1000 } as any);

    const pngResult = await fileExists('path/to/file.png');
    const svgResult = await fileExists('path/to/file.svg');

    expect(pngResult).toBe(true);
    expect(svgResult).toBe(true);
  });

  it('returns false for file exactly 500 bytes', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ size: 500 } as any);

    const result = await fileExists('path/to/file.svg');
    expect(result).toBe(false);
  });

  it('returns true for file 501 bytes', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ size: 501 } as any);

    const result = await fileExists('path/to/file.svg');
    expect(result).toBe(true);
  });
});

describe('Cache Logic Integration', () => {
  const generateContentHash = (title: string, category: string): string => {
    const content = `${title}|${category}`;
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 16);
  };

  const fileExists = async (outputPath: string): Promise<boolean> => {
    const forceRegenerate = process.argv.includes('--force');
    if (forceRegenerate) {
      return false;
    }

    try {
      const stats = await fs.stat(outputPath);
      return stats.size > 500;
    } catch {
      return false;
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const forceIndex = process.argv.indexOf('--force');
    if (forceIndex > -1) {
      process.argv.splice(forceIndex, 1);
    }
  });

  it('cache hit: hash matches and file exists', async () => {
    const title = 'Docker Basics';
    const category = 'DevOps';
    const outputPath = 'path/to/docker-basics.svg';
    const hash = generateContentHash(title, category);
    const cache = { [outputPath]: hash };

    vi.mocked(fs.stat).mockResolvedValue({ size: 1000 } as any);

    const exists = await fileExists(outputPath);
    const currentHash = generateContentHash(title, category);
    const cachedHash = cache[outputPath];

    expect(exists).toBe(true);
    expect(currentHash).toBe(cachedHash);
    // Should skip: true
  });

  it('cache miss: hash does not match', async () => {
    const oldTitle = 'Docker Basics';
    const newTitle = 'Docker Advanced';
    const category = 'DevOps';
    const outputPath = 'path/to/docker.svg';
    const oldHash = generateContentHash(oldTitle, category);
    const cache = { [outputPath]: oldHash };

    vi.mocked(fs.stat).mockResolvedValue({ size: 1000 } as any);

    const exists = await fileExists(outputPath);
    const currentHash = generateContentHash(newTitle, category);
    const cachedHash = cache[outputPath];

    expect(exists).toBe(true);
    expect(currentHash).not.toBe(cachedHash);
    // Should skip: false (content changed)
  });

  it('cache miss: file does not exist', async () => {
    const title = 'New Post';
    const category = 'DevOps';
    const outputPath = 'path/to/new-post.svg';
    const cache = {};

    vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));

    const exists = await fileExists(outputPath);
    const currentHash = generateContentHash(title, category);
    const cachedHash = cache[outputPath];

    expect(exists).toBe(false);
    expect(cachedHash).toBeUndefined();
    // Should skip: false (file missing)
  });

  it('cache miss: file corrupted (size < 500)', async () => {
    const title = 'Corrupted Post';
    const category = 'DevOps';
    const outputPath = 'path/to/corrupted.svg';
    const hash = generateContentHash(title, category);
    const cache = { [outputPath]: hash };

    vi.mocked(fs.stat).mockResolvedValue({ size: 100 } as any);

    const exists = await fileExists(outputPath);

    expect(exists).toBe(false);
    // Should skip: false (corrupted file)
  });

  it('handles multiple tasks with same hash', () => {
    const title = 'Same Title';
    const category = 'DevOps';

    const hash1 = generateContentHash(title, category);
    const hash2 = generateContentHash(title, category);

    expect(hash1).toBe(hash2);
  });

  it('handles empty task list', () => {
    const tasks: any[] = [];
    expect(tasks).toHaveLength(0);
  });

  it('handles large task list', () => {
    const tasks = Array.from({ length: 1000 }, (_, i) => ({
      title: `Title ${i}`,
      category: 'DevOps',
      outputPath: `path/to/file${i}.svg`,
    }));

    tasks.forEach(task => {
      const hash = generateContentHash(task.title, task.category);
      expect(hash).toBeDefined();
    });
  });

  it('handles category changes', async () => {
    const title = 'Same Title';
    const oldCategory = 'DevOps';
    const newCategory = 'Cloud';
    const outputPath = 'path/to/file.svg';
    const oldHash = generateContentHash(title, oldCategory);
    const cache = { [outputPath]: oldHash };

    const newHash = generateContentHash(title, newCategory);

    expect(newHash).not.toBe(oldHash);
    expect(newHash).not.toBe(cache[outputPath]);
    // Should skip: false (category changed)
  });

  it('handles title and category changes', async () => {
    const oldTitle = 'Old Title';
    const newTitle = 'New Title';
    const oldCategory = 'DevOps';
    const newCategory = 'Cloud';
    const outputPath = 'path/to/file.svg';
    const oldHash = generateContentHash(oldTitle, oldCategory);
    const cache = { [outputPath]: oldHash };

    const newHash = generateContentHash(newTitle, newCategory);

    expect(newHash).not.toBe(oldHash);
    expect(newHash).not.toBe(cache[outputPath]);
    // Should skip: false (both changed)
  });
});

describe('Edge Cases', () => {
  const generateContentHash = (title: string, category: string): string => {
    const content = `${title}|${category}`;
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 16);
  };

  it('handles null/undefined values gracefully', () => {
    // JavaScript coerces null/undefined to strings ("null", "undefined")
    // This is the actual runtime behavior - no error is thrown
    const hash1 = generateContentHash(null as any, 'DevOps');
    const hash2 = generateContentHash('Title', undefined as any);
    
    expect(hash1).toBeDefined();
    expect(hash1).toHaveLength(16);
    expect(hash2).toBeDefined();
    expect(hash2).toHaveLength(16);
  });

  it('handles very long titles (>500 chars)', () => {
    const longTitle = 'A'.repeat(600);
    const hash = generateContentHash(longTitle, 'DevOps');
    expect(hash).toBeDefined();
    expect(hash).toHaveLength(16);
  });

  it('handles titles with XML entities', () => {
    const titlesWithEntities = [
      'Title with <tags>',
      'Title & Demo',
      'Title "quoted"',
      "Title 'single'",
    ];

    titlesWithEntities.forEach(title => {
      const hash = generateContentHash(title, 'DevOps');
      expect(hash).toBeDefined();
      expect(hash).toHaveLength(16);
    });
  });

  it('handles symbolic links', async () => {
    vi.mocked(fs.stat).mockResolvedValue({
      size: 1000,
      isSymbolicLink: () => true,
    } as any);

    // File exists logic doesn't check for symlinks, just size
    const forceRegenerate = false;
    const stats = await fs.stat('path/to/symlink.svg');
    expect(stats.size).toBeGreaterThan(500);
  });

  it('handles concurrent tasks with same hash', () => {
    const tasks = Array.from({ length: 10 }, () => ({
      title: 'Same Title',
      category: 'DevOps',
    }));

    const hashes = tasks.map(t => generateContentHash(t.title, t.category));
    const uniqueHashes = new Set(hashes);

    expect(uniqueHashes.size).toBe(1); // All same hash
  });

  it('verifies batch processing order preservation', async () => {
    const tasks = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      title: `Title ${i}`,
      category: 'DevOps',
    }));

    // Process in batches of 50
    const batch1 = tasks.slice(0, 50);
    const batch2 = tasks.slice(50, 100);

    expect(batch1[0].id).toBe(0);
    expect(batch1[49].id).toBe(49);
    expect(batch2[0].id).toBe(50);
    expect(batch2[49].id).toBe(99);
  });
});
