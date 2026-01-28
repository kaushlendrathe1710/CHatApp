/**
 * WebRTC Configuration and Utilities
 *
 * This module provides centralized WebRTC configuration including
 * STUN/TURN servers and reusable peer connection utilities.
 */

export interface ICEServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/**
 * Get ICE servers configuration with both public STUN and configured TURN servers
 * Exported for direct use in SimplePeer configuration
 */
export async function getICEServers(): Promise<ICEServerConfig[]> {
  // Start with public STUN servers for NAT traversal
  const iceServers: ICEServerConfig[] = [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:stun3.l.google.com:19302",
        "stun:stun4.l.google.com:19302",
      ],
    },
  ];

  try {
    // Fetch TURN server credentials from backend
    const response = await fetch("/api/webrtc/ice-servers", {
      credentials: "include",
    });

    if (response.ok) {
      const turnConfig = await response.json();
      if (turnConfig.urls && turnConfig.username && turnConfig.credential) {
        iceServers.push({
          urls: turnConfig.urls,
          username: turnConfig.username,
          credential: turnConfig.credential,
        });
        console.log("[WebRTC] TURN server configured successfully");
      }
    } else {
      console.warn(
        "[WebRTC] TURN server credentials not available, using STUN only"
      );
    }
  } catch (error) {
    console.warn("[WebRTC] Failed to fetch TURN credentials:", error);
  }

  return iceServers;
}

/**
 * Create WebRTC peer connection configuration
 */
export async function createPeerConnectionConfig(): Promise<RTCConfiguration> {
  const iceServers = await getICEServers();

  return {
    iceServers,
    iceCandidatePoolSize: 10,
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
  };
}

/**
 * Simple Peer configuration helper
 * Returns config object compatible with simple-peer library
 */
export async function getSimplePeerConfig(
  initiator: boolean,
  stream?: MediaStream
) {
  const iceServers = await getICEServers();

  return {
    initiator,
    trickle: false, // Wait for all ICE candidates before sending offer/answer
    stream,
    config: {
      iceServers,
      iceCandidatePoolSize: 10,
    },
  };
}

/**
 * Format call duration for display
 */
export function formatCallDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

/**
 * Get audio constraints for high-quality audio calls
 */
export function getAudioConstraints(): MediaStreamConstraints {
  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000,
    },
    video: false,
  };
}

/**
 * Get audio-video constraints for video calls
 */
export function getVideoConstraints(): MediaStreamConstraints {
  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    },
  };
}
