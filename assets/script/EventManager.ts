/**
 * 用途：统一处理手动 header 卡包事件与线索收录。
 * 职责：转发卡包 hover/click 信号；线索按收录→移除→打开指定页执行。
 * 运行边界：Main 初始化本场景单例；不自动创建卡包，不处理购买、掉落或存档。
 * 卡包信号从本组件节点发出，订阅 HEADER_PACK_EVENTS；节点归场景所有，不由此销毁。
 */
import { _decorator, Component, Node, error } from 'cc';
import type { CardManager } from './card/CardManager';
import type { PuzzleManager } from './puzzle/PuzzleManager';
import type { CardData } from './card/CardData';
import type { CardPackEntityData } from './cardpackentity/CardPackEntityData';
const { ccclass } = _decorator;
export const HEADER_PACK_EVENTS = { click: 'header-pack-click', hover: 'header-pack-hover' } as const;
@ccclass('EventManager')
export class EventManager extends Component {
    public static instance: EventManager | null = null;
    private cards!: CardManager;
    private handbook!: PuzzleManager;
    private collecting = new Set<string>();
    protected onLoad(): void {
        if (EventManager.instance && EventManager.instance !== this) { error('EventManager: 场景中只能有一个实例'); this.destroy(); return; }
        EventManager.instance = this;
    }
    public initialize(cards: CardManager, handbook: PuzzleManager): void {
        this.cards = cards; this.handbook = handbook;
    }
    public onPackClick(data: CardPackEntityData, source: Node): void {
        this.node.emit(HEADER_PACK_EVENTS.click, data, source);
    }
    public onPackHover(data: CardPackEntityData, source: Node, hovered: boolean): void {
        this.node.emit(HEADER_PACK_EVENTS.hover, data, source, hovered);
    }
    public onCardEvent(event: 'arrived' | 'clicked', data: CardData): void {
        if (!this.cards || !this.handbook) return;
        if (event !== 'clicked' || data.type !== 'clue' || !data.cluePage || !this.cards.hasCard(data.id)
            || this.collecting.has(data.id)) return;
        this.collecting.add(data.id);
        try {
            if (!this.handbook.collectPage(data.cluePage)) return;
            this.cards.removeCard(data.id); this.handbook.openPage(data.cluePage.id);
        } finally { this.collecting.delete(data.id); }
    }
    protected onDestroy(): void { if (EventManager.instance === this) EventManager.instance = null; }
}
