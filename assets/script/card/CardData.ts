/**
 * 用途：用纯数据描述卡牌，隔离游戏含义与节点、图片和交互代码。
 * 职责：声明卡牌字段与首张卡牌演示数据；符号 ID 由 CardView 的图片表解析。
 * 运行边界：不依赖 Cocos 生命周期，不挂载节点，不加载资源、不保存进度。
 * DEMO_CARD 只用于原型；正式词义、订单和翻译验证应由业务系统提供。
 */
import type { PuzzleData } from '../puzzle/PuzzleData';
export interface CardData {
    id: string;
    type: 'npc' | 'material' | 'equipment' | 'clue';
    name: string;
    demandSymbols: string[];
    /** 卡面上的人物描述，可用换行分段。 */
    descriptions: string;
    /** 符号 ID -> 玩家当前译义；缺失表示尚未破译。 */
    translations?: Record<string, string>;
    cluePage?: PuzzleData;
}
export const DEMO_CARD: CardData = {
    id: 'visitor-001', type: 'npc', name: '陌生旅人',
    descriptions: '一位远道而来的旅人。\n似乎正在寻求帮助。',
    demandSymbols: ['alpha_1', 'alpha_flower', 'alpha_fire'],
    translations: {},
};

/** 上传的三种植物图片在 Main 中按此顺序绑定；名称沿用本局的炼金植物设定。 */
export const HERB_CARDS: CardData[] = [
    { id: 'herb-fire', type: 'material', name: '火焰花', descriptions: '花瓣温热，适合炼制驱寒药剂。', demandSymbols: [] },
    { id: 'herb-moon', type: 'material', name: '月露花', descriptions: '凝聚清凉露水的药草，常用于净化。', demandSymbols: [] },
    { id: 'herb-root', type: 'material', name: '赤根草', descriptions: '根茎蕴藏活力，是基础炼金素材。', demandSymbols: [] },
];
export const CLUE_CARDS: CardData[] = [
    { id: 'clue-elements', type: 'clue', name: '四种元素', descriptions: '火、水、土、风构成元素世界。点击收录手册。', demandSymbols: [],
      cluePage: { id: 'clue-elements', title: '元素世界', symbols: [], description: '火象征热量与变化；水象征流动与净化；土象征稳定与生长；风象征运动与传播。\n炼金术通过调和这四种元素，改变材料的性质。' } },
    { id: 'clue-awakening', type: 'clue', name: '炼金小屋', descriptions: '你在陌生的小屋醒来。点击收录手册。', demandSymbols: [],
      cluePage: { id: 'clue-awakening', title: '在炼金小屋醒来', symbols: [], description: '你醒来时，发现自己身处一间炼金小屋。桌上散落着药草与笔记。\n眼前的人似乎正在指点你什么，但你还无法理解对方的语言。也许手册中藏着线索。' } },
];
