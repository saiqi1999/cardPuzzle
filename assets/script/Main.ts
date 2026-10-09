/**
 * 用途：组装本局资源与系统，启动第一张 NPC 卡；剧情衔接交给 EventManager。
 * 职责：校验资源、初始化单例事件管理器、配置五张后续卡并生成 NPC。
 * 运行边界：Canvas 上只挂一次；草药按火焰花/月露花/赤根草顺序绑定。
 * 不用等待时长推断动画结束；Inspector 的动画配置属于 CardManager。
 */
import { _decorator, Component, SpriteFrame, error } from 'cc';
import { DEMO_CARD, HERB_CARDS, CLUE_CARDS } from './card/CardData';
import { CardManager, CardSpawnRequest } from './card/CardManager';
import { CardArt } from './card/CardView';
import { PuzzleManager } from './puzzle/PuzzleManager';
import { EventManager } from './EventManager';
const { ccclass, property } = _decorator;
@ccclass('Main')
export class Main extends Component {
    @property(CardManager) cardManager: CardManager = null!;
    @property(PuzzleManager) puzzleManager: PuzzleManager = null!;
    @property(SpriteFrame) background: SpriteFrame = null!;
    @property(SpriteFrame) portrait: SpriteFrame = null!;
    @property(SpriteFrame) badge: SpriteFrame = null!;
    @property(SpriteFrame) bubble: SpriteFrame = null!;
    @property([SpriteFrame]) symbols: SpriteFrame[] = [];
    @property([SpriteFrame]) herbImages: SpriteFrame[] = [];
    @property(SpriteFrame) clueBackground: SpriteFrame = null!;
    protected start(): void {
        if (!this.cardManager || !this.puzzleManager || !this.background || !this.portrait || !this.badge
            || !this.bubble || this.symbols.length < 3 || !this.symbols.slice(0, 3).every(Boolean)
            || this.herbImages.length < 3 || !this.herbImages.slice(0, 3).every(Boolean) || !this.clueBackground) {
            error('Main: 请绑定卡牌/手册管理器、卡牌素材、三个符号、三种草药图片和线索底图'); return;
        }
        if (!this.puzzleManager.ensureReady()) return;
        const art: CardArt = { background: this.background, portrait: this.portrait, badge: this.badge, bubble: this.bubble,
            symbols: { alpha_1: this.symbols[0], alpha_flower: this.symbols[1], alpha_fire: this.symbols[2] } };
        const center = { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } };
        const requests: CardSpawnRequest[] = HERB_CARDS.map((data, i) => ({ data,
            art: { ...art, portrait: this.herbImages[i] }, options: center }));
        requests.push(...CLUE_CARDS.map(data => ({ data, art: { ...art, background: this.clueBackground }, options: center })));
        const events = EventManager.instance || this.node.addComponent(EventManager);
        events.initialize(this.cardManager, this.puzzleManager, requests);
        this.cardManager.createCard(art, DEMO_CARD, { to: { x: 0, y: 0 } });
    }
}
