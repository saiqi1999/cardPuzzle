/**
 * 用途：组装本局资源与系统，启动中央卡包；剧情衔接交给 EventManager。
 * 职责：校验资源、初始化单例事件管理器、配置四张掉落卡与卡包/箱子图片。
 * 运行边界：Canvas 上只挂一次；草药按火焰花/月露花/赤根草顺序绑定。
 * 不用等待时长推断动画结束；Inspector 的动画配置属于 CardManager。
 */
import { _decorator, Component, SpriteFrame, error } from 'cc';
import { DEMO_CARD, HERB_CARDS } from './card/CardData';
import { CardManager, CardSpawnRequest } from './card/CardManager';
import { CardArt } from './card/CardView';
import { PuzzleManager } from './puzzle/PuzzleManager';
import { EventManager } from './EventManager';
const { ccclass, property } = _decorator;
@ccclass('Main')
export class Main extends Component {
    @property(CardManager) cardManager: CardManager = null!;
    @property(PuzzleManager) puzzleManager: PuzzleManager = null!;
    @property(SpriteFrame) cardPackImage: SpriteFrame = null!;
    @property(SpriteFrame) boxImage: SpriteFrame = null!;
    @property(SpriteFrame) tooltipBackground: SpriteFrame = null!;
    @property(SpriteFrame) background: SpriteFrame = null!;
    @property(SpriteFrame) portrait: SpriteFrame = null!;
    @property(SpriteFrame) badge: SpriteFrame = null!;
    @property(SpriteFrame) bubble: SpriteFrame = null!;
    @property([SpriteFrame]) symbols: SpriteFrame[] = [];
    @property([SpriteFrame]) herbImages: SpriteFrame[] = [];
    @property(SpriteFrame) clueBackground: SpriteFrame = null!;
    protected start(): void {
        if (!this.cardPackImage || !this.boxImage || !this.cardManager || !this.puzzleManager || !this.background || !this.portrait || !this.badge
            || !this.bubble || this.symbols.length < 3 || !this.symbols.slice(0, 3).every(Boolean)
            || this.herbImages.length < 3 || !this.herbImages.slice(0, 3).every(Boolean) || !this.clueBackground) {
            error('Main: 请绑定卡牌/手册管理器、卡牌素材、三个符号、三种草药图片、线索底图、卡包与箱子图片'); return;
        }
        if (!this.puzzleManager.ensureReady()) return;
        const art: CardArt = { tooltip: this.tooltipBackground, background: this.background, portrait: this.portrait, badge: this.badge, bubble: this.bubble,
            symbols: { alpha_1: this.symbols[0], alpha_flower: this.symbols[1], alpha_fire: this.symbols[2] } };
        const center = { from: { x: 0, y: 0 }, scatter: true };
        const requests: CardSpawnRequest[] = HERB_CARDS.map((data, i) => ({ data,
            art: { ...art, portrait: this.herbImages[i] }, options: center }));
        requests.unshift({ data: DEMO_CARD, art, options: center });
        const events = EventManager.instance || this.node.addComponent(EventManager);
        events.initialize(this.cardManager, this.puzzleManager, requests, this.cardPackImage, this.boxImage);
    }
}
