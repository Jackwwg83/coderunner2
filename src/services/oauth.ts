import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { DatabaseService } from './database';
import { AuthService } from './auth';
import { User } from '../types';

export interface OAuthProfile {
  id: string;
  email: string;
  name?: string;
  provider: 'google' | 'github';
  avatar_url?: string;
}

export class OAuthService {
  private static instance: OAuthService;
  private db: DatabaseService;
  private auth: AuthService;
  private isConfigured = false;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.auth = AuthService.getInstance();
    this.configure();
  }

  public static getInstance(): OAuthService {
    if (!OAuthService.instance) {
      OAuthService.instance = new OAuthService();
    }
    return OAuthService.instance;
  }

  private configure(): void {
    if (this.isConfigured) return;

    // Serialize/deserialize user for session (not used but required by passport)
    passport.serializeUser((user: any, done) => {
      done(null, user.id);
    });

    passport.deserializeUser(async (id: string, done) => {
      try {
        const user = await this.db.getUserById(id);
        done(null, user);
      } catch (error) {
        done(error, null);
      }
    });

    // Configure Google OAuth Strategy
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      passport.use(
        new GoogleStrategy(
          {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: `${process.env.OAUTH_CALLBACK_URL || 'http://localhost:8080'}/api/auth/google/callback`,
          },
          async (accessToken, refreshToken, profile, done) => {
            try {
              const oAuthProfile: OAuthProfile = {
                id: profile.id,
                email: profile.emails?.[0]?.value || '',
                name: profile.displayName,
                provider: 'google',
                avatar_url: profile.photos?.[0]?.value,
              };

              if (!oAuthProfile.email) {
                return done(new Error('No email provided by Google'), false);
              }

              const user = await this.handleOAuthLogin(oAuthProfile);
              return done(null, user);
            } catch (error) {
              console.error('Google OAuth error:', error);
              return done(error, false);
            }
          }
        )
      );
      console.log('✅ Google OAuth strategy configured');
    } else {
      console.warn('⚠️ Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
    }

    // Configure GitHub OAuth Strategy
    if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
      passport.use(
        new GitHubStrategy(
          {
            clientID: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            callbackURL: `${process.env.OAUTH_CALLBACK_URL || 'http://localhost:8080'}/api/auth/github/callback`,
          },
          async (accessToken, refreshToken, profile, done) => {
            try {
              const oAuthProfile: OAuthProfile = {
                id: profile.id,
                email: profile.emails?.[0]?.value || '',
                name: profile.displayName || profile.username,
                provider: 'github',
                avatar_url: profile.photos?.[0]?.value,
              };

              if (!oAuthProfile.email) {
                return done(new Error('No email provided by GitHub'), false);
              }

              const user = await this.handleOAuthLogin(oAuthProfile);
              return done(null, user);
            } catch (error) {
              console.error('GitHub OAuth error:', error);
              return done(error, false);
            }
          }
        )
      );
      console.log('✅ GitHub OAuth strategy configured');
    } else {
      console.warn('⚠️ GitHub OAuth not configured - missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET');
    }

    this.isConfigured = true;
  }

  /**
   * Handle OAuth login - create or find user and return with JWT
   * Simplified version that creates a mock user for OAuth
   */
  private async handleOAuthLogin(profile: OAuthProfile): Promise<User> {
    try {
      // For now, create a simple mock user object from OAuth profile
      // In production, this would interact with the database
      const user: User = {
        id: require('crypto').randomUUID(),
        email: profile.email,
        plan_type: 'free',
        name: profile.name,
        avatar_url: profile.avatar_url,
        oauth_provider: profile.provider,
        oauth_id: profile.id,
        created_at: new Date(),
        updated_at: new Date(),
      };

      console.log(`OAuth login for ${profile.provider}: ${profile.email}`);
      return user;
    } catch (error) {
      console.error('OAuth login handling error:', error);
      throw new Error('Failed to handle OAuth login');
    }
  }

  /**
   * Generate a random password hash for OAuth users (they won't use it)
   */
  private async generateRandomPassword(): Promise<string> {
    const randomPassword = require('crypto').randomBytes(32).toString('hex');
    return await this.auth.hashPassword(randomPassword);
  }

  /**
   * Generate JWT token for OAuth user
   */
  public generateOAuthToken(user: User): string {
    return this.auth.generateToken({
      id: user.id,
      email: user.email,
      plan_type: user.plan_type,
    });
  }

  /**
   * Build callback URL with JWT token for frontend
   */
  public buildCallbackURL(token: string, error?: string): string {
    const frontendURL = process.env.FRONTEND_URL || 'http://localhost:8083';
    
    if (error) {
      return `${frontendURL}/auth/callback?error=${encodeURIComponent(error)}`;
    }
    
    return `${frontendURL}/auth/callback?token=${token}`;
  }

  /**
   * Get configured passport instance
   */
  public getPassport() {
    return passport;
  }

  /**
   * Check if OAuth providers are configured
   */
  public getAvailableProviders(): string[] {
    const providers: string[] = [];
    
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      providers.push('google');
    }
    
    if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
      providers.push('github');
    }
    
    return providers;
  }
}

export default OAuthService;