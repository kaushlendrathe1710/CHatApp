import defaultSound from '@assets/notification_sounds/default.mp3';
import chimeSound from '@assets/notification_sounds/chime.mp3';
import bellSound from '@assets/notification_sounds/bell.mp3';
import popSound from '@assets/notification_sounds/pop.mp3';
import swooshSound from '@assets/notification_sounds/swoosh.mp3';

export type NotificationSoundType = 'default' | 'chime' | 'bell' | 'pop' | 'swoosh';

export interface NotificationSoundSettings {
  enabled: boolean;
  soundType: NotificationSoundType;
  volume: number; // 0-100
}

// Notification sound definitions using bundled local audio files
// Sounds sourced from Mixkit (free license) and bundled locally for security
const NOTIFICATION_SOUNDS: Record<NotificationSoundType, string> = {
  default: defaultSound, // Subtle notification
  chime: chimeSound, // Pleasant chime
  bell: bellSound, // Bell ding
  pop: popSound, // Pop sound
  swoosh: swooshSound, // Swoosh
};

class NotificationSoundManager {
  private audioCache: Map<NotificationSoundType, HTMLAudioElement> = new Map();
  private settings: NotificationSoundSettings = {
    enabled: false, // Start disabled until hydrated with validated settings
    soundType: 'default',
    volume: 70,
  };
  private hydrated: boolean = false; // Guard against using stale/unvalidated settings

  constructor() {
    // Preload all sounds for faster playback
    this.preloadSounds();
  }

  private preloadSounds() {
    Object.entries(NOTIFICATION_SOUNDS).forEach(([type, url]) => {
      const audio = new Audio(url);
      audio.preload = 'auto';
      audio.volume = this.settings.volume / 100;
      this.audioCache.set(type as NotificationSoundType, audio);
    });
  }

  updateSettings(settings: Partial<NotificationSoundSettings>) {
    this.settings = { ...this.settings, ...settings };
    
    // Update volume for all cached audio elements
    if (settings.volume !== undefined) {
      this.audioCache.forEach((audio) => {
        audio.volume = this.settings.volume / 100;
      });
    }
  }

  // Reset manager to neutral state (called on auth change)
  reset() {
    console.log('[NotificationSound] Resetting manager to neutral state');
    
    // Clear audio cache
    this.audioCache.forEach((audio) => {
      audio.pause();
      audio.src = '';
    });
    this.audioCache.clear();
    
    // Reset to neutral defaults
    this.settings = {
      enabled: false, // Disabled until hydrated with validated settings
      soundType: 'default',
      volume: 70,
    };
    this.hydrated = false; // Mark as not hydrated
    
    // Reload sounds with neutral volume
    this.preloadSounds();
  }

  // Hydrate manager with validated settings (called after successful fetch with userId validation)
  // This sets the hydrated flag to true, enabling SSE playback
  hydrate(settings: NotificationSoundSettings) {
    console.log('[NotificationSound] Hydrating with validated settings:', settings);
    this.settings = { ...settings };
    this.hydrated = true;
    
    // Update volume for all cached audio elements
    this.audioCache.forEach((audio) => {
      audio.volume = this.settings.volume / 100;
    });
  }

  // Prime local settings for UI display without enabling SSE playback
  // Used for optimistic updates that haven't been validated by server yet
  primeLocal(settings: Partial<NotificationSoundSettings>) {
    console.log('[NotificationSound] Priming local settings (not hydrated):', settings);
    this.settings = { ...this.settings, ...settings };
    
    // Update volume for all cached audio elements
    if (settings.volume !== undefined) {
      this.audioCache.forEach((audio) => {
        audio.volume = this.settings.volume / 100;
      });
    }
    // Note: hydrated flag is NOT set to true - SSE playback remains gated
  }

  async play(customType?: NotificationSoundType): Promise<void> {
    // Guard: Don't play if not hydrated with validated settings
    if (!this.hydrated) {
      console.log('[NotificationSound] Playback blocked - manager not hydrated with validated settings');
      return;
    }
    
    if (!this.settings.enabled) {
      console.log('[NotificationSound] Sound disabled by user settings');
      return;
    }

    const soundType = customType || this.settings.soundType;
    let audio = this.audioCache.get(soundType);

    if (!audio) {
      // Fallback: create new audio if not cached
      const url = NOTIFICATION_SOUNDS[soundType];
      audio = new Audio(url);
      audio.volume = this.settings.volume / 100;
      this.audioCache.set(soundType, audio);
    }

    try {
      // Reset to beginning if already playing
      audio.currentTime = 0;
      await audio.play();
      console.log(`[NotificationSound] Played ${soundType} sound at volume ${this.settings.volume}`);
    } catch (error: any) {
      console.error('[NotificationSound] Error playing sound:', error);
      
      // If autoplay is blocked, log it
      if (error.name === 'NotAllowedError') {
        console.warn('[NotificationSound] Autoplay blocked by browser. User interaction required.');
      }
    }
  }

  // Test sound playback - bypasses the enabled check for previewing sounds
  async testSound(soundType: NotificationSoundType, volume?: number): Promise<void> {
    // Create a new uncached Audio instance for testing to avoid mutating live settings
    const url = NOTIFICATION_SOUNDS[soundType];
    const testAudio = new Audio(url);
    
    // Use custom volume if provided, otherwise use current setting
    const testVolume = volume !== undefined ? volume / 100 : this.settings.volume / 100;
    testAudio.volume = testVolume;

    try {
      await testAudio.play();
      console.log(`[NotificationSound] Test played ${soundType} sound at volume ${Math.round(testVolume * 100)}`);
    } catch (error: any) {
      console.error('[NotificationSound] Error playing test sound:', error);
      
      // If autoplay is blocked, log it
      if (error.name === 'NotAllowedError') {
        console.warn('[NotificationSound] Autoplay blocked by browser. User interaction required.');
      }
    }
  }

  // Get available sounds for UI
  getAvailableSounds(): { value: NotificationSoundType; label: string }[] {
    return [
      { value: 'default', label: 'Default' },
      { value: 'chime', label: 'Chime' },
      { value: 'bell', label: 'Bell' },
      { value: 'pop', label: 'Pop' },
      { value: 'swoosh', label: 'Swoosh' },
    ];
  }

  getSettings(): NotificationSoundSettings {
    return { ...this.settings };
  }
}

// Export a singleton instance
export const notificationSoundManager = new NotificationSoundManager();
