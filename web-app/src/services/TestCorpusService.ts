import fs from 'fs';
import path from 'path';
import { appLogger } from '../config/logger';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * TestCorpusService - Manages JHOVE test corpus files
 * Downloads once to PVC, which is then mounted read-only into viper instances
 */
class TestCorpusService {
  private readonly corpusDir = '/usr/corpus';  // PVC mount point
  private readonly githubUrl = 'https://github.com/openpreserve/jhove/archive/refs/heads/integration.tar.gz';
  private isDownloading = false;
  private downloadPromise: Promise<void> | null = null;

  /**
   * Ensure corpus cache directory exists
   */
  private async ensureCorpusDir(): Promise<void> {
    if (!fs.existsSync(this.corpusDir)) {
      fs.mkdirSync(this.corpusDir, { recursive: true });
      appLogger.info('Created corpus cache directory', {
        eventType: 'Corpus Service',
        directory: this.corpusDir
      });
    }
  }

  /**
   * Check if corpus is already downloaded
   */
  async isCorpusAvailable(): Promise<boolean> {
    const requiredFolders = ['errors', 'examples', 'regression'];
    
    for (const folder of requiredFolders) {
      const folderPath = path.join(this.corpusDir, folder);
      if (!fs.existsSync(folderPath)) {
        return false;
      }
      
      // Check if folder has files
      const files = fs.readdirSync(folderPath);
      if (files.length === 0) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Download and extract JHOVE test corpus from GitHub
   * This runs once and caches the files in the web-app container
   */
  async downloadCorpus(): Promise<void> {
    // If already downloaded, skip
    if (await this.isCorpusAvailable()) {
      appLogger.info('Test corpus already available in cache', {
        eventType: 'Corpus Service',
        directory: this.corpusDir
      });
      return;
    }

    // If download is already in progress, wait for it
    if (this.isDownloading && this.downloadPromise) {
      appLogger.info('Test corpus download already in progress, waiting...', {
        eventType: 'Corpus Service'
      });
      return this.downloadPromise;
    }

    // Start new download
    this.isDownloading = true;
    this.downloadPromise = this._performDownload();
    
    try {
      await this.downloadPromise;
    } finally {
      this.isDownloading = false;
      this.downloadPromise = null;
    }
  }

  /**
   * Perform the actual download and extraction
   */
  private async _performDownload(): Promise<void> {
    await this.ensureCorpusDir();

    appLogger.info('Downloading JHOVE test corpus from GitHub', {
      eventType: 'Corpus Download',
      url: this.githubUrl,
      destination: this.corpusDir
    });

    const tempDir = '/tmp/corpus-download';
    
    try {
      // Clean up any previous temp directory
      if (fs.existsSync(tempDir)) {
        await execAsync(`rm -rf ${tempDir}`);
      }
      fs.mkdirSync(tempDir, { recursive: true });

      // Download the archive
      appLogger.info('Downloading archive...', { eventType: 'Corpus Download' });
      await execAsync(`cd ${tempDir} && wget -q "${this.githubUrl}" -O jhove.tar.gz`);

      // Extract the corpora folder contents directly (strip-components=3 extracts errors/, examples/, regression/)
      appLogger.info('Extracting corpus files...', { eventType: 'Corpus Download' });
      const extractCmd = [
        `cd ${tempDir}`,
        `tar -xzf jhove.tar.gz jhove-integration/test-root/corpora --strip-components=3`,
        `find . -mindepth 1 -maxdepth 1 -type d -exec mv {} ${this.corpusDir}/ \\;`,
        `rm -f jhove.tar.gz`
      ].join(' && ');
      
      await execAsync(extractCmd);

      // Verify extraction
      if (!await this.isCorpusAvailable()) {
        throw new Error('Corpus extraction failed - required folders not found');
      }

      appLogger.info('Test corpus downloaded and cached successfully', {
        eventType: 'Corpus Download',
        directory: this.corpusDir,
        folders: ['errors', 'examples', 'regression']
      });

    } catch (error) {
      appLogger.error('Failed to download test corpus', {
        eventType: 'Corpus Download Error',
        error: (error as Error).message
      });
      // Clean up partial download
      if (fs.existsSync(this.corpusDir)) {
        await execAsync(`rm -rf ${this.corpusDir}/*`);
      }
      throw error;
    } finally {
      // Clean up temp directory
      if (fs.existsSync(tempDir)) {
        await execAsync(`rm -rf ${tempDir}`).catch(() => {});
      }
    }
  }

  /**
   * Get the path to the cached corpus directory
   */
  getCorpusPath(): string {
    return this.corpusDir;
  }

  /**
   * Get size of cached corpus for monitoring
   */
  async getCorpusSize(): Promise<number> {
    try {
      const { stdout } = await execAsync(`du -sb ${this.corpusDir} | cut -f1`);
      return parseInt(stdout.trim());
    } catch (error) {
      return 0;
    }
  }
}

// Export singleton instance
export const testCorpusService = new TestCorpusService();
