/**
 * 用途：作为场景入口创建首张演示卡，避免视图或交互组件承担游戏启动职责。
 * 职责：校验 Inspector 引用，将卡牌资源与数据交给 CardManager。
 * 运行边界：每个桌面只挂一次，挂在 Canvas 或带 UITransform 的 UI 桌面节点上。
 * 依赖已绑定的 CardRoot Manager、卡底、人物、徽章、气泡及三个符号。
 * 卡牌尺寸由 CardView 顶部 CARD_SIZE 统一控制；本脚本不重复定义尺寸。
 * 当前仅演示单卡，不负责 NPC 调度、经营、解谜、存档或完整游戏状态机。
 */
import { _decorator, Component, SpriteFrame, error } from 'cc';
import { DEMO_CARD } from './card/CardData';
import { CardManager } from './card/CardManager';
const { ccclass, property } = _decorator;
@ccclass('Main')
export class Main extends Component {
    @property(CardManager) cardManager: CardManager = null!;
    @property(SpriteFrame) background: SpriteFrame = null!;
    @property(SpriteFrame) portrait: SpriteFrame = null!;
    @property(SpriteFrame) badge: SpriteFrame = null!;
    @property(SpriteFrame) bubble: SpriteFrame = null!;
    @property([SpriteFrame]) symbols: SpriteFrame[] = [];
    protected start(): void {
        if (!this.cardManager || !this.background || !this.portrait || !this.badge
            || !this.bubble || this.symbols.length < 3) {
            error('Main: 请设置 CardManager、卡底、人物、徽章、气泡和三个符号的 SpriteFrame。');
            return;
        }
        this.cardManager.createCard({ background: this.background, portrait: this.portrait,
            badge: this.badge, bubble: this.bubble,
            symbols: { alpha_1: this.symbols[0], alpha_flower: this.symbols[1], alpha_fire: this.symbols[2] },
        }, DEMO_CARD);
    }
}
