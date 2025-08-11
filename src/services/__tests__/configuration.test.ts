import { ConfigurationService } from '../configuration';
import { EncryptionService } from '../encryption';
import { createDatabasePool } from '../../config/database';

// Mock the database for testing
jest.mock('../../config/database');

describe('ConfigurationService', () => {
  let configService: ConfigurationService;
  let encryptionService: EncryptionService;
  
  beforeEach(() => {
    configService = ConfigurationService.getInstance();
    encryptionService = EncryptionService.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should create singleton instance', () => {
      const instance1 = ConfigurationService.getInstance();
      const instance2 = ConfigurationService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should initialize successfully', async () => {
      // Mock the initialization
      const initializeSpy = jest.spyOn(encryptionService, 'initialize').mockResolvedValue();
      
      await configService.initialize('test-user-id');
      
      expect(initializeSpy).toHaveBeenCalledWith('test-user-id');
    });
  });

  describe('Template Management', () => {
    it('should have template management methods', () => {
      expect(typeof configService.getTemplates).toBe('function');
      expect(typeof configService.getTemplateById).toBe('function');
      expect(typeof configService.applyTemplate).toBe('function');
    });
  });

  describe('Configuration Management', () => {
    it('should have configuration management methods', () => {
      expect(typeof configService.createConfiguration).toBe('function');
      expect(typeof configService.getProjectConfigurations).toBe('function');
      expect(typeof configService.getConfigurationById).toBe('function');
    });

    it('should have variable management methods', () => {
      expect(typeof configService.setVariable).toBe('function');
      expect(typeof configService.deleteVariable).toBe('function');
      expect(typeof configService.getConfigurationVariables).toBe('function');
    });
  });

  describe('Deployment Integration', () => {
    it('should have deployment-related methods', () => {
      expect(typeof configService.getConfigurationForDeployment).toBe('function');
      expect(typeof configService.reloadConfiguration).toBe('function');
      expect(typeof configService.exportConfiguration).toBe('function');
    });
  });

  describe('Audit and Security', () => {
    it('should have audit methods', () => {
      expect(typeof configService.getAuditLogs).toBe('function');
    });
  });
});

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;

  beforeEach(() => {
    encryptionService = EncryptionService.getInstance();
  });

  describe('Service Initialization', () => {
    it('should create singleton instance', () => {
      const instance1 = EncryptionService.getInstance();
      const instance2 = EncryptionService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Encryption Methods', () => {
    it('should have encryption methods', () => {
      expect(typeof encryptionService.encrypt).toBe('function');
      expect(typeof encryptionService.decrypt).toBe('function');
      expect(typeof encryptionService.generateKey).toBe('function');
    });

    it('should have utility methods', () => {
      expect(typeof encryptionService.hash).toBe('function');
      expect(typeof encryptionService.verifyHash).toBe('function');
      expect(typeof encryptionService.maskValue).toBe('function');
      expect(typeof encryptionService.generateSecret).toBe('function');
    });

    it('should mask values correctly', () => {
      expect(encryptionService.maskValue('password123')).toBe('pa*******23');
      expect(encryptionService.maskValue('abc')).toBe('***');
      expect(encryptionService.maskValue('')).toBe('');
    });

    it('should generate secrets of correct length', () => {
      const secret32 = encryptionService.generateSecret(32);
      const secret16 = encryptionService.generateSecret(16);
      
      expect(secret32).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(secret16).toHaveLength(32); // 16 bytes = 32 hex chars
    });

    it('should detect encrypted data format', () => {
      const plaintext = 'not encrypted';
      const base64Data = Buffer.from('test:test:encrypted').toString('base64');
      
      expect(encryptionService.isEncrypted(plaintext)).toBe(false);
      expect(encryptionService.isEncrypted(base64Data)).toBe(false); // Wrong format
    });
  });

  describe('Key Management', () => {
    it('should have key management methods', () => {
      expect(typeof encryptionService.generateKey).toBe('function');
      expect(typeof encryptionService.rotateKey).toBe('function');
      expect(typeof encryptionService.getEncryptionKey).toBe('function');
    });
  });
});