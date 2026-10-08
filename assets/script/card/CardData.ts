/**
 * 用途：用纯数据描述卡牌，隔离游戏含义与节点、图片和交互代码。
 * 职责：声明卡牌字段与首张卡牌演示数据；符号 ID 由 CardView 的图片表解析。
 * 运行边界：不依赖 Cocos 生命周期，不挂载节点，不加载资源、不保存进度。
 * DEMO_CARD 只用于原型；正式词义、订单和翻译验证应由业务系统提供。
 */
export interface CardData {
    id: string;
    type: 'npc' | 'material' | 'facility';
    name: string;
    demandSymbols: string[];
    /** 卡面上的人物描述，可用换行分段。 */
    descriptions: string;
    /** 符号 ID -> 玩家当前译义；缺失表示尚未破译。 */
    translations?: Record<string, string>;
}
export const DEMO_CARD: CardData = {
    id: 'visitor-001', type: 'npc', name: '陌生旅人',
    descriptions: '一位远道而来的旅人。\n似乎正在寻求帮助。',
    demandSymbols: ['alpha_1', 'alpha_flower', 'alpha_fire'],
    translations: {},
};
