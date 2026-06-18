export type PerformanceType = 
  | 'normal'    // 假装正常
  | 'whisper'   // 压低声音
  | 'close'     // 突然亲近
  | 'mimic'     // 像在模仿别人
  | 'scream'    // 尖叫爆发
  | 'pause';    // 停顿

export interface PerformanceHint {
  type: PerformanceType;
  label: string;
  intensity: number; // 1-10 情绪强度
}

export interface BranchChoice {
  id: string;
  text: string;
  nextNodeId: string;
}

export interface Annotation {
  id: string;
  dialogueId: string;
  content: string;
  author: string;
  role: string;
  createdAt: number;
}

export interface DialogueNode {
  id: string;
  role: string;
  character: string;
  text: string;
  performance: PerformanceHint;
  choices?: BranchChoice[];
  nextNodeId?: string;
  annotations?: Annotation[];
  recorded?: boolean;
  duration?: number;
  lastRecordedAt?: number;
}

export interface PersistState {
  project: ScriptProject;
  currentCharacterId: string;
  rehearsalNodeId: string;
}

export interface Character {
  id: string;
  name: string;
  voiceType: string;
  color: string;
}

export interface ScriptProject {
  id: string;
  title: string;
  game: string;
  scene: string;
  characters: Character[];
  nodes: Record<string, DialogueNode>;
  startNodeId: string;
}

export interface EmotionPoint {
  index: number;
  value: number;
  label: string;
  type: PerformanceType;
}
