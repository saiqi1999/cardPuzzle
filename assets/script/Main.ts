/**
 * 用途：作为场景入口组装首张演示卡，避免视图或交互组件承担游戏启动职责。
 * 职责：校验 Inspector 图片引用，创建卡牌节点并依次初始化 CardView / CardDrag。
 * 运行边界：每个桌面只挂一次，挂在 Canvas 或带 UITransform 的 UI 桌面节点上。
 * 依赖已绑定的卡底、人物、徽章、气泡及三个符号；缺少资源时输出错误并停止创建。
 * 卡牌尺寸由 CardView 顶部 CARD_SIZE 统一控制；本脚本不重复定义尺寸。
 * 当前仅演示单卡，不负责 NPC 调度、经营、解谜、存档或完整游戏状态机。
 */
import { _decorator, Component, Node, SpriteFrame, UITransform, Layers, error } from 'cc';
import { CardView } from './card/CardView';
import { CardDrag } from './card/CardDrag';
import { DEMO_CARD } from './card/CardData';
const { ccclass, property } = _decorator;
@ccclass('Main')
export class Main extends Component {
    @property(SpriteFrame) background: SpriteFrame = null!;
    @property(SpriteFrame) portrait: SpriteFrame = null!;
    @property(SpriteFrame) badge: SpriteFrame = null!;
    @property(SpriteFrame) bubble: SpriteFrame = null!;
    @property([SpriteFrame]) symbols: SpriteFrame[] = [];
    protected start(): void {
        if (!this.background || !this.portrait || !this.badge || !this.bubble || this.symbols.length < 3) {
            error('Main: 请设置卡底、人物、徽章、气泡和三个符号的 SpriteFrame。'); return;
        }
        if (!this.node.getComponent(UITransform)) {
            error('Main 必须挂在 Canvas 或带 UITransform 的桌面节点上。'); return;
        }
        const card = new Node('NpcCard'); card.layer = Layers.Enum.UI_2D;
        card.addComponent(UITransform);
        this.node.addChild(card); card.setPosition(0, 0);
        card.addComponent(CardView).initialize({ background: this.background, portrait: this.portrait,
            badge: this.badge, bubble: this.bubble,
            symbols: { alpha_1: this.symbols[0], alpha_flower: this.symbols[1], alpha_fire: this.symbols[2] },
        }, DEMO_CARD);
        card.addComponent(CardDrag);
    }
}
