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
        card.addComponent(UITransform).setContentSize(250, 350);
        this.node.addChild(card); card.setPosition(0, 0);
        card.addComponent(CardView).initialize({ background: this.background, portrait: this.portrait,
            badge: this.badge, bubble: this.bubble,
            symbols: { alpha_1: this.symbols[0], alpha_flower: this.symbols[1], alpha_fire: this.symbols[2] },
        }, DEMO_CARD);
        card.addComponent(CardDrag);
    }
}
