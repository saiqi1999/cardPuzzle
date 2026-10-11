/**
 * 用途：本场景单例事件入口，统一处理开包剧情、卡包/箱子点击与拖动。
 * 职责：前四次有效点击逐张出卡，第五次出箱；按当前位置随机滑出，箱落地后移除卡包。
 * 运行边界：Main 初始化一次，不跨场景、不存档；实体 View 只负责显示和反馈。
 * 使用单指拖动与 UI 距离阈值区分点击；取消输入不出卡，禁用清理监听与动画。
 * 四张卡按 INITIAL_CARD_PACK.cardIds 匹配，点击计数只在成功生成后增加；箱暂不收纳。
 * 线索卡仍按收录→移除→打开指定页处理；NPC 到达不再触发旧开局事件。
 */
import { _decorator, Component, Node, UITransform, SpriteFrame, EventTouch, Vec2, Vec3,
    tween, Tween, isValid, error } from 'cc';
import type { CardManager, CardSpawnRequest } from './card/CardManager';
import type { PuzzleManager } from './puzzle/PuzzleManager';
import type { CardData } from './card/CardData';
import { INITIAL_CARD_PACK } from './cardpackentity/CardPackEntityData';
import { CardPackEntityView } from './cardpackentity/CardPackEntityView';
import { INITIAL_BOX } from './box/BoxData';
import { BoxView } from './box/BoxView';
import { Tooltip } from './util/Tooltip';
const { ccclass } = _decorator;
export const ENTITY_INPUT = { dragThreshold: 6, scatterRatio: 0.3 } as const;
type EntityKind = 'pack' | 'box';
interface EntityState {
    node: Node; kind: EntityKind; touchId: number | null; start: Vec2; offset: Vec3;
    moved: boolean; ready: boolean;
}
@ccclass('EventManager')
export class EventManager extends Component {
    public static instance: EventManager | null = null;
    private cards!: CardManager;
    private handbook!: PuzzleManager;
    private initialCards: CardSpawnRequest[] = [];
    private boxImage!: SpriteFrame;
    private pack: Node | null = null;
    private opened = 0;
    private initialized = false;
    private entities = new Map<Node, EntityState>();
    private collecting = new Set<string>();
    protected onLoad(): void {
        if (EventManager.instance && EventManager.instance !== this) { error('EventManager: 场景中只能有一个实例'); this.destroy(); return; }
        EventManager.instance = this;
    }
    public initialize(cards: CardManager, handbook: PuzzleManager, requests: CardSpawnRequest[],
        packImage: SpriteFrame, boxImage: SpriteFrame): void {
        if (this.initialized) return;
        const ordered = INITIAL_CARD_PACK.cardIds.map(id => requests.find(item => item.data.id === id));
        if (ordered.some(item => !item) || !packImage || !boxImage) { error('EventManager: 缺少四张初始卡或实体图片'); return; }
        this.cards = cards; this.handbook = handbook; this.initialCards = ordered as CardSpawnRequest[];
        this.boxImage = boxImage;
        const board = cards.node.parent?.getComponent(UITransform), root = cards.node.getComponent(UITransform);
        if (!board || !root) { error('EventManager: CardRoot 和桌面需有 UITransform'); return; }
        root.setContentSize(board.width, board.height);
        cards.node.setPosition((0.5 - board.anchorX) * board.width, (0.5 - board.anchorY) * board.height);
        this.pack = this.createEntity(INITIAL_CARD_PACK.id);
        this.pack.addComponent(CardPackEntityView).initialize(INITIAL_CARD_PACK, packImage);
        this.register(this.pack, 'pack'); this.initialized = true;
    }
    private createEntity(name: string): Node {
        const node = new Node(name); node.layer = this.cards.node.layer;
        node.addComponent(UITransform); this.cards.node.addChild(node); return node;
    }
    private register(node: Node, kind: EntityKind): EntityState {
        const state: EntityState = { node, kind, touchId: null, start: new Vec2(), offset: new Vec3(), moved: false, ready: true };
        this.entities.set(node, state); this.listen(state); return state;
    }
    private listen(state: EntityState): void {
        const node = state.node;
        node.on(Node.EventType.TOUCH_START, (event: EventTouch) => this.startDrag(state, event), this);
        node.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => this.moveDrag(state, event), this);
        node.on(Node.EventType.TOUCH_END, (event: EventTouch) => this.endDrag(state, event, false), this);
        node.on(Node.EventType.TOUCH_CANCEL, (event: EventTouch) => this.endDrag(state, event, true), this);
    }
    private local(state: EntityState, event: EventTouch): Vec3 {
        const p = event.getUILocation();
        return state.node.parent!.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(p.x, p.y));
    }
    private startDrag(state: EntityState, event: EventTouch): void {
        event.propagationStopped = true;
        if (!state.ready || state.touchId !== null) return;
        Tooltip.hideAll();
        state.touchId = event.getID(); state.start.set(event.getUILocation()); state.moved = false;
        Vec3.subtract(state.offset, state.node.position, this.local(state, event));
        state.node.setSiblingIndex(state.node.parent!.children.length - 1);
    }
    private moveDrag(state: EntityState, event: EventTouch): void {
        event.propagationStopped = true;
        if (state.touchId !== event.getID()) return;
        if (Vec2.distance(state.start, event.getUILocation()) > ENTITY_INPUT.dragThreshold) state.moved = true;
        if (state.moved) {
            state.node.setPosition(this.local(state, event).add(state.offset)); this.clamp(state.node);
        }
    }
    private endDrag(state: EntityState, event: EventTouch, cancelled: boolean): void {
        event.propagationStopped = true;
        if (state.touchId !== event.getID()) return;
        const clicked = !cancelled && !state.moved && Vec2.distance(state.start, event.getUILocation()) <= ENTITY_INPUT.dragThreshold;
        state.touchId = null;
        if (clicked && state.ready) this.onEntityClick(state);
    }
    private onEntityClick(state: EntityState): void {
        if (state.kind === 'box') {
            state.node.getComponent(BoxView)!.feedback();
            Tooltip.show(state.node, INITIAL_BOX.name, INITIAL_BOX.description);
            this.unschedule(this.hideBoxTooltip); this.scheduleOnce(this.hideBoxTooltip, 2);
            return;
        }
        if (this.opened < this.initialCards.length) {
            const request = this.initialCards[this.opened];
            const root = this.cards.node.getComponent(UITransform)!;
            const position = state.node.position;
            const card = this.cards.createCard(request.art, request.data, {
                from: { x: position.x / root.width, y: position.y / root.height }, scatter: true,
            });
            if (!card) return;
            this.opened++;
            state.node.getComponent(CardPackEntityView)!.feedback();
            // 卡包保持在出卡上方，连续点击时不会被新生成的卡挡住。
            state.node.setSiblingIndex(this.cards.node.children.length - 1);
            return;
        }
        state.ready = false; this.opened++;
        const box = this.createEntity(INITIAL_BOX.id);
        box.addComponent(BoxView).initialize(INITIAL_BOX, this.boxImage);
        box.setPosition(state.node.position); this.clamp(box);
        const boxState = this.register(box, 'box'); boxState.ready = false;
        const destination = this.scatterDestination(box);
        const finish = () => {
            if (!isValid(box, true)) return;
            boxState.ready = true;
            this.removePack();
        };
        if (this.cards.duration === 0) { box.setPosition(destination); finish(); }
        else tween(box).to(this.cards.duration, { position: destination }, { easing: 'quadOut' }).call(finish).start();
    }
    private hideBoxTooltip(): void {
        for (const state of this.entities.values()) if (state.kind === 'box') Tooltip.hide(state.node);
    }
    private scatterDestination(node: Node): Vec3 {
        const root = node.parent!.getComponent(UITransform)!, size = node.getComponent(UITransform)!;
        const limitX = Math.max(0, (root.width - size.width) / 2), limitY = Math.max(0, (root.height - size.height) / 2);
        const angle = Math.random() * Math.PI * 2, dx = Math.cos(angle), dy = Math.sin(angle), p = node.position;
        let distance = this.cards.entranceDistance * ENTITY_INPUT.scatterRatio;
        if (dx > 0) distance = Math.min(distance, (limitX - p.x) / dx);
        else if (dx < 0) distance = Math.min(distance, (-limitX - p.x) / dx);
        if (dy > 0) distance = Math.min(distance, (limitY - p.y) / dy);
        else if (dy < 0) distance = Math.min(distance, (-limitY - p.y) / dy);
        return new Vec3(p.x + dx * distance, p.y + dy * distance);
    }
    private clamp(node: Node): void {
        const board = node.parent!.getComponent(UITransform)!, size = node.getComponent(UITransform)!;
        const x = Math.max(0, (board.width - size.width) / 2), y = Math.max(0, (board.height - size.height) / 2);
        node.setPosition(Math.max(-x, Math.min(x, node.position.x)), Math.max(-y, Math.min(y, node.position.y)));
    }
    private removePack(): void {
        if (!this.pack) return;
        this.pack.targetOff(this); this.entities.delete(this.pack);
        Tween.stopAllByTarget(this.pack); this.pack.destroy(); this.pack = null;
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
    protected onEnable(): void { for (const state of this.entities.values()) this.listen(state); }
    protected onDisable(): void {
        this.unscheduleAllCallbacks(); this.hideBoxTooltip();
        for (const state of this.entities.values()) {
            state.node.targetOff(this); state.touchId = null; Tween.stopAllByTarget(state.node);
            if (state.kind === 'box') state.ready = true;
        }
        // 若在最后一段动画中禁用，保留已生成箱子，结束已用尽的卡包。
        if (this.opened > this.initialCards.length) this.removePack();
    }
    protected onDestroy(): void {
        for (const state of this.entities.values()) { state.node.targetOff(this); Tween.stopAllByTarget(state.node); state.node.destroy(); }
        this.entities.clear(); if (EventManager.instance === this) EventManager.instance = null;
    }
}
