/**
 * 用途：本场景单例剧情入口，集中决定卡牌事件产生哪些后续行为。
 * 职责：NPC 到达后生成五张初始卡；线索点击按收录→移除→打开指定页执行。
 * 运行边界：由 Main 初始化，不跨场景持久化、不写存档；管理器仅执行业务指令。
 * 卡牌上报 arrived/clicked；按卡牌 ID 去重。依赖类型导入，避免与 CardManager 循环加载。
 */
import { _decorator, Component, error } from 'cc';
import type { CardManager, CardSpawnRequest } from './card/CardManager';
import type { PuzzleManager } from './puzzle/PuzzleManager';
import { CardData, DEMO_CARD } from './card/CardData';
const { ccclass } = _decorator;
@ccclass('EventManager')
export class EventManager extends Component {
    public static instance: EventManager | null = null;
    private cards!: CardManager;
    private handbook!: PuzzleManager;
    private initialCards: CardSpawnRequest[] = [];
    private introTriggered = false;
    private collecting = new Set<string>();
    protected onLoad(): void {
        if (EventManager.instance && EventManager.instance !== this) { error('EventManager: 场景中只能有一个实例'); this.destroy(); return; }
        EventManager.instance = this;
    }
    public initialize(cards: CardManager, handbook: PuzzleManager, initialCards: CardSpawnRequest[]): void {
        this.cards = cards; this.handbook = handbook; this.initialCards = initialCards;
    }
    public onCardEvent(event: 'arrived' | 'clicked', data: CardData): void {
        if (!this.cards || !this.handbook) return;
        if (event === 'arrived' && data.id === DEMO_CARD.id && !this.introTriggered) {
            this.introTriggered = true;
            this.cards.spawnSequence(this.initialCards);
        }
        if (event !== 'clicked' || data.type !== 'clue' || !data.cluePage || !this.cards.hasCard(data.id)
            || this.collecting.has(data.id)) return;
        this.collecting.add(data.id);
        try {
            // 初始化或收录失败时保留桌面卡，不造成线索丢失。
            if (!this.handbook.collectPage(data.cluePage)) return;
            this.cards.removeCard(data.id);
            this.handbook.openPage(data.cluePage.id);
        } finally { this.collecting.delete(data.id); }
    }
    protected onDestroy(): void { if (EventManager.instance === this) EventManager.instance = null; }
}
