import { ScriptProject, DialogueNode, Character } from '@/types/dialogue';

export const mockCharacters: Character[] = [
  { id: 'c1', name: '林晓月', voiceType: '少女/青年女声', color: '#9D6BFF' },
  { id: 'c2', name: '神秘房东', voiceType: '低沉中性', color: '#FF3B5C' },
  { id: 'c3', name: '隔壁邻居', voiceType: '中年男声', color: '#2FD4A6' }
];

const buildNode = (
  id: string,
  characterId: string,
  characterName: string,
  text: string,
  perfType: 'normal' | 'whisper' | 'close' | 'mimic' | 'scream' | 'pause',
  perfLabel: string,
  intensity: number,
  opts: { nextNodeId?: string; choices?: any[]; annotations?: any[] } = {}
): DialogueNode => ({
  id,
  role: characterId,
  character: characterName,
  text,
  performance: { type: perfType, label: perfLabel, intensity },
  nextNodeId: opts.nextNodeId,
  choices: opts.choices,
  annotations: opts.annotations || [],
  recorded: id === 'n1' || id === 'n2'
});

export const mockNodes: Record<string, DialogueNode> = {
  n1: buildNode('n1', 'c1', '林晓月', '（钥匙插入门锁，门发出轻微吱呀声）终于租到这么便宜的房子了……就是楼道有点暗。', 'normal', '假装正常', 3, { nextNodeId: 'n2' }),
  n2: buildNode('n2', 'c2', '神秘房东', '（声音从身后传来，没有脚步声）小姑娘，这房子……晚上别开走廊的灯。', 'whisper', '压低声音', 6, { nextNodeId: 'n3' }),
  n3: buildNode('n3', 'c1', '林晓月', '（转身，空无一人）啊……？您是房东吗？我刚没听见您过来……', 'normal', '假装镇定', 4, {
    choices: [
      { id: 'ch1', text: '追问房东为什么不能开灯', nextNodeId: 'n4a' },
      { id: 'ch2', text: '假装不在意，微笑道别', nextNodeId: 'n4b' }
    ]
  }),
  n4a: buildNode('n4a', 'c2', '神秘房东', '（突然凑近，呼吸冰冷）因为……走廊尽头的镜子，会照出你不认识的自己。', 'close', '突然亲近', 8, { nextNodeId: 'n5a' }),
  n5a: buildNode('n5a', 'c1', '林晓月', '（瞳孔骤缩，声音发颤）什……什么意思？', 'whisper', '压低声音颤抖', 7, { nextNodeId: 'n6' }),
  n4b: buildNode('n4b', 'c1', '林晓月', '（强装轻松）好的，我记住啦～您早点休息！', 'mimic', '模仿开朗', 5, { nextNodeId: 'n5b' }),
  n5b: buildNode('n5b', 'c2', '神秘房东', '（声音从门缝传出，语调变得像她母亲）晓月……连妈的话都不听了吗？', 'mimic', '模仿亲人', 10, { nextNodeId: 'n6' }),
  n6: buildNode('n6', 'c1', '林晓月', '（后背贴紧门板，指甲抠进掌心）这是……什么情况？冷静，林晓月，冷静……', 'pause', '停顿两秒再说', 6, {
    choices: [
      { id: 'ch3', text: '鼓起勇气看向走廊尽头', nextNodeId: 'n7a' },
      { id: 'ch4', text: '立刻锁门拉上窗帘', nextNodeId: 'n7b' }
    ]
  }),
  n7a: buildNode('n7a', 'c1', '林晓月', '（视线缓缓移向走廊尽头——镜子里映着一个穿着红裙子的女孩，正对着她笑）', 'scream', '压抑到极限的尖叫', 10),
  n7b: buildNode('n7b', 'c1', '林晓月', '（哗啦一下拉上窗帘，转身却看见镜中的自己没有动，还在慢慢抬手……）', 'scream', '崩溃尖叫', 9)
};

export const mockScriptProject: ScriptProject = {
  id: 'p1',
  title: '镜中的房客',
  game: '午夜回响',
  scene: '第一章 · 入住',
  characters: mockCharacters,
  nodes: mockNodes,
  startNodeId: 'n1'
};

export const mockAnnotations = [
  {
    id: 'a1',
    dialogueId: 'n2',
    content: '这里像诱导玩家怀疑自己：房东的出现方式有问题，但主角还没意识到严重性，要用"好像没事但哪里不对"的语气',
    author: '李导',
    role: 'director',
    createdAt: Date.now() - 86400000
  },
  {
    id: 'a2',
    dialogueId: 'n4a',
    content: '停顿两秒再说："因为"后面停2秒，"镜子"两字咬字要轻，像怕被什么东西听见',
    author: '李导',
    role: 'director',
    createdAt: Date.now() - 72000000
  },
  {
    id: 'a3',
    dialogueId: 'n5b',
    content: '模仿林晓月母亲的语调，但要有微妙的违和感——尾音上扬10%，正常人不会这样说话',
    author: '张音监',
    role: 'audio',
    createdAt: Date.now() - 36000000
  },
  {
    id: 'a4',
    dialogueId: 'n6',
    content: '这里不能直接尖叫！前半句用呼吸声带过，指甲抠掌心的动作要"听见"，最后冷静是反讽',
    author: '李导',
    role: 'director',
    createdAt: Date.now() - 18000000
  }
];

// 表演提示选项列表
export const performanceOptions = [
  { type: 'normal' as const, label: '假装正常', color: '#2FD4A6' },
  { type: 'whisper' as const, label: '压低声音', color: '#3BA7FF' },
  { type: 'close' as const, label: '突然亲近', color: '#FFC857' },
  { type: 'mimic' as const, label: '像在模仿别人', color: '#C874FF' },
  { type: 'scream' as const, label: '尖叫爆发', color: '#FF3B5C' },
  { type: 'pause' as const, label: '停顿', color: '#FFC857' }
];
