/**
 * 用途：统一创建和调度当前 NPC 卡片，作为卡牌系统入口。
 * 职责：创建卡片；从桌面右边框外移动到右侧四分之一处；入场后打开需求气泡。
 * 运行边界：挂在 Canvas 的 CardRoot 子节点，生成的卡片归该节点所有。
 * 入场期间禁用拖拽；新建卡片会替换上一张；禁用时停止当前动画。
 */
import { _decorator, Component, Node, UITransform, Layers, tween, Tween, Vec3, error } from 'cc';
import { CardData } from './CardData';
import { CardArt, CardView } from './CardView';
import { CardDrag } from './CardDrag';
const { ccclass, property } = _decorator;

@ccclass('CardManager')
export class CardManager extends Component {
    @property
    public duration = 0.5;

    @property
    public xratio = 0.65;

    private card: Node | null = null;

    public createCard(art: CardArt, data: CardData): Node | null {
        const board = this.node.parent?.getComponent(UITransform);
        const root = this.node.getComponent(UITransform);
        if (!board || !root) {
            error('CardManager: CardRoot 需要 UITransform，且直接父节点须为 Canvas 或 UI 桌面。');
            return null;
        }
        if (!Number.isFinite(this.duration) || this.duration < 0) {
            error('CardManager: duration 必须为大于等于零的有限数字。');
            return null;
        }

        this.clearCard();
        this.alignRoot(board, root);

        const card = new Node('NpcCard');
        card.layer = Layers.Enum.UI_2D;
        card.addComponent(UITransform);
        this.node.addChild(card);

        const view = card.addComponent(CardView);
        view.initialize(art, data);
        const drag = card.addComponent(CardDrag);
        drag.enabled = false;
        this.card = card;

        const cardWidth = card.getComponent(UITransform)!.width;
        const startX = board.width / 2 + cardWidth / 2;
        const targetX = board.width * this.xratio;
        card.setPosition(startX, 0);
        tween(card).to(this.duration, { position: new Vec3(targetX, 0, 0) }, { easing: 'quadOut' })
            .call(() => {
                if (!card.isValid || this.card !== card) return;
                drag.enabled = true;
                view.toggleSpeech();
            })
            .start();
        return card;
    }

    public clearCard(): void {
        if (!this.card) return;
        Tween.stopAllByTarget(this.card);
        this.card.destroy();
        this.card = null;
    }

    protected onDisable(): void {
        if (this.card) Tween.stopAllByTarget(this.card);
    }

    private alignRoot(board: UITransform, root: UITransform): void {
        this.node.setPosition((0.5 - board.anchorX) * board.width, (0.5 - board.anchorY) * board.height);
        root.setContentSize(board.width, board.height);
    }
}
