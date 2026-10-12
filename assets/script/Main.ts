/**
 * 用途：初始化场景系统，手动 header 卡包的视觉和输入由 CardPackEntityView 管理。
 * 职责：连接卡牌管理器与手册，不自动生成中央卡包、卡牌或其他实体。
 * 运行边界：Canvas 上挂一次；原卡牌美术字段保留以兼容已有场景绑定，供后续生成逻辑使用。
 * header 子节点由用户编辑；本脚本不改节点层级，不校验尚未使用的掉落资源。
 */
import { _decorator, Component, SpriteFrame, error } from 'cc';
import { CardManager } from './card/CardManager';
import { PuzzleManager } from './puzzle/PuzzleManager';
import { EventManager } from './EventManager';
const { ccclass, property } = _decorator;
@ccclass('Main')
export class Main extends Component {
    @property(CardManager) cardManager: CardManager = null!;
    @property(PuzzleManager) puzzleManager: PuzzleManager = null!;
    @property(SpriteFrame) shadowImage: SpriteFrame = null!;
    @property(SpriteFrame) tooltipBackground: SpriteFrame = null!;
    @property(SpriteFrame) background: SpriteFrame = null!;
    @property(SpriteFrame) portrait: SpriteFrame = null!;
    @property(SpriteFrame) badge: SpriteFrame = null!;
    @property(SpriteFrame) bubble: SpriteFrame = null!;
    @property([SpriteFrame]) symbols: SpriteFrame[] = [];
    @property([SpriteFrame]) herbImages: SpriteFrame[] = [];
    @property(SpriteFrame) clueBackground: SpriteFrame = null!;
    protected onLoad(): void {
        if (!this.cardManager || !this.puzzleManager) { error('Main: 请绑定 CardManager 和 PuzzleManager'); return; }
        const events = EventManager.instance || this.node.addComponent(EventManager);
        events.initialize(this.cardManager, this.puzzleManager);
    }
}
