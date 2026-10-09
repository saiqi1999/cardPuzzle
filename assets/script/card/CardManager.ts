/**
 * 用途：管理本局多张卡牌的创建、入场、移除，不包含剧情判断。
 * 职责：按相对起终点移动；完成时向 EventManager 上报；支持按间隔连续生成。
 * 运行边界：挂在 CardRoot，父节点为 UI 桌面。相对坐标中心(0,0)，边缘±0.5。
 * Inspector 只有入场距离(UI单位)、移动时间(秒)、生成间隔(秒)；未指定起点时随机方位。
 * 禁用即取消排队及入场动画，现有卡恢复拖动，但不伪造到达事件；销毁时清理所有卡。
 */
import { _decorator, Component, Node, UITransform, Layers, tween, Tween, Vec3, error } from 'cc';
import { CardData } from './CardData';
import { CardArt, CardView } from './CardView';
import { CardDrag } from './CardDrag';
import { EventManager } from '../EventManager';
const { ccclass, property } = _decorator;
export interface CardSpawnOptions { from?: { x: number; y: number }; to?: { x: number; y: number }; }
export interface CardSpawnRequest { art: CardArt; data: CardData; options?: CardSpawnOptions; }
@ccclass('CardManager')
export class CardManager extends Component {
    @property({ tooltip: '随机起点距终点的距离，UI单位' }) public entranceDistance = 700;
    @property({ tooltip: '入场移动时间，秒' }) public duration = 0.5;
    @property({ tooltip: '连续生成两张卡之间的间隔，秒' }) public spawnInterval = 0.2;
    private cards = new Map<string, Node>();
    public createCard(art: CardArt, data: CardData, options: CardSpawnOptions = {}): Node | null {
        const board = this.node.parent?.getComponent(UITransform), root = this.node.getComponent(UITransform);
        if (!board || !root || ![this.duration, this.entranceDistance, this.spawnInterval].every(v => Number.isFinite(v) && v >= 0)) {
            error('CardManager: 请检查桌面 UITransform 及非负的距离/时间/间隔'); return null;
        }
        if (this.cards.has(data.id)) return this.cards.get(data.id)!;
        this.node.setPosition((0.5 - board.anchorX) * board.width, (0.5 - board.anchorY) * board.height);
        root.setContentSize(board.width, board.height);
        const target = options.to || { x: 0, y: 0 };
        if (![target.x, target.y, ...(options.from ? [options.from.x, options.from.y] : [])].every(Number.isFinite)) {
            error('CardManager: 相对位置必须为有限数字'); return null;
        }
        const card = new Node(data.id); card.layer = Layers.Enum.UI_2D;
        card.addComponent(UITransform); this.node.addChild(card);
        const view = card.addComponent(CardView); view.initialize(art, data);
        const drag = card.addComponent(CardDrag); drag.enabled = false;
        this.cards.set(data.id, card);
        const end = new Vec3(target.x * root.width, target.y * root.height, 0);
        const angle = Math.random() * Math.PI * 2;
        const begin = options.from ? new Vec3(options.from.x * root.width, options.from.y * root.height, 0)
            : new Vec3(end.x + Math.cos(angle) * this.entranceDistance, end.y + Math.sin(angle) * this.entranceDistance, 0);
        card.setPosition(begin);
        const complete = () => {
            if (!card.isValid || this.cards.get(data.id) !== card) return;
            drag.enabled = true;
            if (data.type === 'npc') view.toggleSpeech();
            EventManager.instance?.onCardEvent('arrived', data);
        };
        if (this.duration === 0) { card.setPosition(end); complete(); }
        else tween(card).to(this.duration, { position: end }, { easing: 'quadOut' }).call(complete).start();
        return card;
    }
    public spawnSequence(requests: CardSpawnRequest[]): void {
        if (!Number.isFinite(this.spawnInterval) || this.spawnInterval < 0) return;
        requests.forEach((request, i) => {
            const spawn = () => this.createCard(request.art, request.data, request.options);
            if (i === 0) spawn(); else this.scheduleOnce(spawn, i * this.spawnInterval);
        });
    }
    public hasCard(id: string): boolean { return this.cards.has(id); }
    public removeCard(id: string): boolean {
        const card = this.cards.get(id); if (!card) return false;
        this.cards.delete(id); Tween.stopAllByTarget(card); card.removeFromParent(); card.destroy(); return true;
    }
    public clearCard(): void { this.unscheduleAllCallbacks(); for (const id of [...this.cards.keys()]) this.removeCard(id); }
    protected onDisable(): void {
        this.unscheduleAllCallbacks();
        for (const card of this.cards.values()) { Tween.stopAllByTarget(card); card.getComponent(CardDrag)!.enabled = true; }
    }
    protected onDestroy(): void { this.clearCard(); }
}
