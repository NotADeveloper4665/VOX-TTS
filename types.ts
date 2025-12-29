export type VoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

export const AVAILABLE_VOICES: { name: VoiceName; gender: 'Male' | 'Female'; description: string }[] = [
  { name: 'Puck', gender: 'Male', description: 'Energetic and youthful' },
  { name: 'Charon', gender: 'Male', description: 'Deep and authoritative' },
  { name: 'Kore', gender: 'Female', description: 'Calm and soothing' },
  { name: 'Fenrir', gender: 'Male', description: 'Gruff and intense' },
  { name: 'Zephyr', gender: 'Female', description: 'Bright and airy' },
];

export interface AudioState {
  buffer: AudioBuffer | null;
  isPlaying: boolean;
  duration: number;
}
