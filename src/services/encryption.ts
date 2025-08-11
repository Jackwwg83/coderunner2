import * as crypto from 'crypto';
import { Pool } from 'pg';
import { createDatabasePool } from '../config/database';

/**
 * Encryption Service for securing sensitive configuration data
 * Uses AES-256-GCM with key rotation capability
 */
export class EncryptionService {
  private static instance: EncryptionService;
  private pool: Pool;
  private algorithm = 'aes-256-gcm';
  private keyCache = new Map<string, Buffer>();

  private constructor() {
    this.pool = createDatabasePool();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Get active encryption key with fallback to environment
   */
  async getEncryptionKey(): Promise<Buffer> {
    try {
      // Try to get key from database first
      const result = await this.pool.query(
        'SELECT key_data FROM encryption_keys WHERE is_active = true ORDER BY created_at DESC LIMIT 1'
      );

      if (result.rows.length > 0) {
        // Return the most recent active key
        return result.rows[0].key_data;
      }
    } catch (error) {
      console.warn('Failed to retrieve key from database, using fallback');
    }

    // Fallback to environment variable
    const envKey = process.env.ENCRYPTION_MASTER_KEY;
    if (!envKey) {
      throw new Error('No encryption key available');
    }

    return Buffer.from(envKey, 'hex');
  }

  /**
   * Generate a new encryption key
   */
  generateKey(): Buffer {
    return crypto.randomBytes(32); // 256 bits for AES-256
  }

  /**
   * Store encryption key in database
   */
  async storeEncryptionKey(keyId: string, keyData: Buffer, userId?: string): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO encryption_keys (key_id, key_data, is_active, created_by) 
         VALUES ($1, $2, true, $3)`,
        [keyId, keyData, userId || null]
      );

      // Cache the key
      this.keyCache.set(keyId, keyData);
    } catch (error) {
      throw new Error(`Failed to store encryption key: ${error.message}`);
    }
  }

  /**
   * Encrypt sensitive data
   */
  async encrypt(plaintext: string): Promise<string> {
    try {
      const key = await this.getEncryptionKey();
      const iv = crypto.randomBytes(16); // 128-bit IV for GCM
      const cipher = crypto.createCipher('aes-256-gcm', key);
      cipher.setAAD(iv);
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // For now, just use simple combination without auth tag
      const combined = iv.toString('hex') + ':' + encrypted;
      
      return Buffer.from(combined).toString('base64');
    } catch (error: any) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt sensitive data
   */
  async decrypt(encryptedData: string): Promise<string> {
    try {
      const key = await this.getEncryptionKey();
      const combined = Buffer.from(encryptedData, 'base64').toString();
      const parts = combined.split(':');
      
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipher('aes-256-gcm', key);
      decipher.setAAD(iv);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error: any) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Hash data for non-reversible storage (like passwords)
   */
  async hash(data: string): Promise<string> {
    const salt = crypto.randomBytes(16);
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(data, salt, 100000, 64, 'sha512', (err, derivedKey) => {
        if (err) reject(err);
        resolve(salt.toString('hex') + ':' + derivedKey.toString('hex'));
      });
    });
  }

  /**
   * Verify hashed data
   */
  async verifyHash(data: string, hash: string): Promise<boolean> {
    const parts = hash.split(':');
    if (parts.length !== 2) {
      return false;
    }

    const salt = Buffer.from(parts[0], 'hex');
    const storedHash = parts[1];

    return new Promise((resolve, reject) => {
      crypto.pbkdf2(data, salt, 100000, 64, 'sha512', (err, derivedKey) => {
        if (err) reject(err);
        resolve(storedHash === derivedKey.toString('hex'));
      });
    });
  }

  /**
   * Rotate encryption keys (for security compliance)
   */
  async rotateKey(userId: string): Promise<string> {
    try {
      // Generate new key
      const newKey = this.generateKey();
      const keyId = `key-${Date.now()}`;

      // Deactivate old keys
      await this.pool.query(
        'UPDATE encryption_keys SET is_active = false WHERE is_active = true'
      );

      // Store new key
      await this.storeEncryptionKey(keyId, newKey, userId);

      // Clear key cache to force refresh
      this.keyCache.clear();

      console.log(`Encryption key rotated successfully: ${keyId}`);
      return keyId;
    } catch (error) {
      throw new Error(`Key rotation failed: ${error.message}`);
    }
  }

  /**
   * Initialize encryption system with default key if none exists
   */
  async initialize(userId?: string): Promise<void> {
    try {
      // Check if any active keys exist
      const result = await this.pool.query(
        'SELECT COUNT(*) as count FROM encryption_keys WHERE is_active = true'
      );

      if (result.rows[0].count === '0') {
        // No active keys, create initial key
        const initialKey = this.generateKey();
        const keyId = `initial-key-${Date.now()}`;
        
        await this.storeEncryptionKey(keyId, initialKey, userId);
        console.log(`Encryption service initialized with key: ${keyId}`);
      } else {
        console.log('Encryption service already initialized');
      }
    } catch (error) {
      console.warn('Failed to initialize encryption service:', error.message);
      // Continue without database keys, will fall back to env var
    }
  }

  /**
   * Check if data appears to be encrypted
   */
  isEncrypted(data: string): boolean {
    try {
      // Check if it looks like base64 encoded data with our format
      const decoded = Buffer.from(data, 'base64').toString();
      const parts = decoded.split(':');
      return parts.length === 3 && parts[0].length === 32; // 16 bytes = 32 hex chars for IV
    } catch {
      return false;
    }
  }

  /**
   * Safely mask sensitive values for display
   */
  maskValue(value: string, maskChar: string = '*'): string {
    if (!value) return '';
    
    if (value.length <= 4) {
      return maskChar.repeat(value.length);
    }
    
    // Show first 2 and last 2 characters
    return value.substring(0, 2) + maskChar.repeat(value.length - 4) + value.substring(value.length - 2);
  }

  /**
   * Generate secure random string for secrets
   */
  generateSecret(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Cleanup - close database connections
   */
  async cleanup(): Promise<void> {
    await this.pool.end();
    this.keyCache.clear();
  }
}

export default EncryptionService;