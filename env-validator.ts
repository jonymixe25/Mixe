import 'dotenv/config';

// Type definitions for environment variables
export interface EnvironmentConfig {
  geminiApiKey: string | null;
  appUrl: string;
  liveKitUrl: string;
  liveKitApiKey: string;
  liveKitApiSecret: string;
  viteServerUrl: string;
  nodeEnv: string;
}

// Validator utility class
export class EnvValidator {
  private static readonly REQUIRED_VARS = [
    'APP_URL',
    'LIVEKIT_URL',
    'LIVEKIT_API_KEY',
    'LIVEKIT_API_SECRET',
    'VITE_LIVEKIT_URL'
  ];

  private static readonly OPTIONAL_VARS = [
    'GEMINI_API_KEY',
    'NODE_ENV'
  ];

  /**
   * Clean environment variables from common copy-paste issues
   */
  static cleanEnvVar(val: string | undefined): string {
    if (!val) return '';
    
    // Remove control characters and zero-width characters
    let cleaned = val
      .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '')
      .trim();
    
    // Remove surrounding quotes ONLY IF they wrap the entire string
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
        (cleaned.startsWith('"') && cleaned.endsWith('"'))) {
      cleaned = cleaned.substring(1, cleaned.length - 1).trim();
    }
    
    // Handle case where user pasted "KEY=VALUE"
    if (/^[A-Z0-9_]+=[^=]/.test(cleaned)) {
      const firstEq = cleaned.indexOf('=');
      cleaned = cleaned.substring(firstEq + 1).trim();
      
      // Re-check for quotes after splitting KEY=VALUE
      if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
          (cleaned.startsWith('"') && cleaned.endsWith('"'))) {
        cleaned = cleaned.substring(1, cleaned.length - 1).trim();
      }
    }
    
    return cleaned;
  }

  /**
   * Validate LiveKit URL format
   */
  static isValidLiveKitUrl(url: string): boolean {
    try {
      // LiveKit URLs should start with wss:// or ws://
      if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
        return false;
      }
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate LiveKit API Key format
   */
  static isValidLiveKitApiKey(key: string): boolean {
    // LiveKit API keys should start with 'API'
    return key.startsWith('API') && key.length > 5;
  }

  /**
   * Validate app URL format
   */
  static isValidAppUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate all environment variables
   */
  static validate(): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required variables
    for (const varName of this.REQUIRED_VARS) {
      const value = process.env[varName];
      if (!value || !value.trim()) {
        errors.push(`Missing required variable: ${varName}`);
      }
    }

    // Validate specific formats
    const appUrl = this.cleanEnvVar(process.env.APP_URL);
    if (appUrl && !this.isValidAppUrl(appUrl)) {
      errors.push(`Invalid APP_URL format: ${appUrl}`);
    }

    const liveKitUrl = this.cleanEnvVar(process.env.LIVEKIT_URL);
    if (liveKitUrl && !this.isValidLiveKitUrl(liveKitUrl)) {
      errors.push(`Invalid LIVEKIT_URL format: ${liveKitUrl}. Must use wss:// or ws://`);
    }

    const liveKitApiKey = this.cleanEnvVar(process.env.LIVEKIT_API_KEY);
    if (liveKitApiKey && !this.isValidLiveKitApiKey(liveKitApiKey)) {
      warnings.push(`LIVEKIT_API_KEY may be invalid: should start with 'API'. Got: ${liveKitApiKey.substring(0, 10)}...`);
    }

    const liveKitApiSecret = this.cleanEnvVar(process.env.LIVEKIT_API_SECRET);
    if (!liveKitApiSecret) {
      errors.push(`Missing LIVEKIT_API_SECRET`);
    } else if (liveKitApiSecret.length < 20) {
      warnings.push(`LIVEKIT_API_SECRET seems too short (${liveKitApiSecret.length} chars)`);
    }

    // Check GEMINI_API_KEY (optional but warn if missing in production)
    const geminiKey = this.cleanEnvVar(process.env.GEMINI_API_KEY);
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (!geminiKey && nodeEnv === 'production') {
      warnings.push(`GEMINI_API_KEY is not set in production environment`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get validated configuration object
   */
  static getConfig(): EnvironmentConfig {
    const validation = this.validate();

    if (!validation.valid) {
      const errorMsg = validation.errors.join('\n');
      throw new Error(`Invalid environment configuration:\n${errorMsg}`);
    }

    return {
      geminiApiKey: this.cleanEnvVar(process.env.GEMINI_API_KEY) || null,
      appUrl: this.cleanEnvVar(process.env.APP_URL || ''),
      liveKitUrl: this.cleanEnvVar(process.env.LIVEKIT_URL || ''),
      liveKitApiKey: this.cleanEnvVar(process.env.LIVEKIT_API_KEY || ''),
      liveKitApiSecret: this.cleanEnvVar(process.env.LIVEKIT_API_SECRET || ''),
      viteServerUrl: this.cleanEnvVar(process.env.VITE_LIVEKIT_URL || ''),
      nodeEnv: process.env.NODE_ENV || 'development'
    };
  }

  /**
   * Log configuration status (without showing secrets)
   */
  static logStatus(): void {
    const nodeEnv = process.env.NODE_ENV || 'development';
    console.log(`\n[EnvValidator] Environment Status (${nodeEnv})`);
    console.log('─'.repeat(50));

    const validation = this.validate();

    // Show configuration
    const appUrl = this.cleanEnvVar(process.env.APP_URL);
    const liveKitUrl = this.cleanEnvVar(process.env.LIVEKIT_URL);
    const liveKitKey = this.cleanEnvVar(process.env.LIVEKIT_API_KEY);
    const liveKitSecret = this.cleanEnvVar(process.env.LIVEKIT_API_SECRET);
    const geminiKey = this.cleanEnvVar(process.env.GEMINI_API_KEY);

    console.log(`✓ APP_URL: ${appUrl || '(not set)'}`);
    console.log(`✓ LIVEKIT_URL: ${liveKitUrl || '(not set)'}`);
    console.log(`✓ LIVEKIT_API_KEY: ${liveKitKey ? \\`${liveKitKey.substring(0, 6)}...\` : '(not set)'}`);
    console.log(`✓ LIVEKIT_API_SECRET: ${liveKitSecret ? '(configured)' : '(not set)'}`);
    console.log(`✓ GEMINI_API_KEY: ${geminiKey ? '(configured)' : '(not set)'}`);

    if (validation.errors.length > 0) {
      console.log('\n❌ Errors:');
      validation.errors.forEach(err => console.log(`  - ${err}`));
    }

    if (validation.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      validation.warnings.forEach(warn => console.log(`  - ${warn}`));
    }

    if (validation.valid && validation.warnings.length === 0) {
      console.log('\n✅ All environment variables are valid!');
    }

    console.log('─'.repeat(50) + '\n');
  }
}

// Export default instance
export default EnvValidator;