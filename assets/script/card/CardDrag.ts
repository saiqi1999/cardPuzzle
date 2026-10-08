import { _decorator, Component, Node, EventTouch, UITransform, Vec2, Vec3 } from 'cc';
import { CardView } from './CardView';
const { ccclass } = _decorator;
@ccclass('CardDrag')
export class CardDrag extends Component {
    private touchId: number | null = null;
    private startPoint = new Vec2();
    private offset = new Vec3();
    private moved = false;
    private view!: CardView;
    protected onLoad(): void { this.view = this.getComponent(CardView)!; }
    protected onEnable(): void {
        this.node.on(Node.EventType.TOUCH_START, this.startDrag, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.moveDrag, this);
        this.node.on(Node.EventType.TOUCH_END, this.endDrag, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.cancelDrag, this);
        this.node.on(Node.EventType.MOUSE_ENTER, this.enter, this);
        this.node.on(Node.EventType.MOUSE_LEAVE, this.leave, this);
    }
    protected onDisable(): void { this.node.targetOff(this); this.touchId = null; this.view?.setHovered(false); }
    private enter(): void { this.view.setHovered(true); this.clamp(); }
    private leave(): void { if (this.touchId === null) this.view.setHovered(false); }
    private local(event: EventTouch): Vec3 {
        const p = event.getUILocation();
        return this.node.parent!.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(p.x, p.y, 0));
    }
    private startDrag(event: EventTouch): void {
        if (this.touchId !== null) return;
        this.touchId = event.getID(); this.startPoint.set(event.getUILocation()); this.moved = false;
        Vec3.subtract(this.offset, this.node.position, this.local(event));
        this.node.setSiblingIndex(this.node.parent!.children.length - 1);
        this.view.setHovered(true); event.propagationStopped = true;
    }
    private moveDrag(event: EventTouch): void {
        if (event.getID() !== this.touchId) return;
        if (Vec2.distance(this.startPoint, event.getUILocation()) > 6) this.moved = true;
        if (this.moved) { this.node.setPosition(this.local(event).add(this.offset)); this.clamp(); }
        event.propagationStopped = true;
    }
    private endDrag(event: EventTouch): void {
        if (event.getID() !== this.touchId) return;
        const click = !this.moved && Vec2.distance(this.startPoint, event.getUILocation()) <= 6;
        this.touchId = null; this.view.setHovered(false); this.clamp();
        if (click) this.view.toggleSpeech(); event.propagationStopped = true;
    }
    private cancelDrag(event: EventTouch): void {
        if (event.getID() !== this.touchId) return;
        this.touchId = null; this.view.setHovered(false); this.clamp();
    }
    protected lateUpdate(): void { this.clamp(); }
    private clamp(): void {
        if (!this.node.parent) return;
        const board = this.node.parent.getComponent(UITransform)!;
        const card = this.node.getComponent(UITransform)!;
        const halfW = card.width * this.node.scale.x / 2;
        const halfH = card.height * this.node.scale.y / 2;
        const left = -board.width * board.anchorX + halfW;
        const right = board.width * (1 - board.anchorX) - halfW;
        const bottom = -board.height * board.anchorY + halfH;
        const top = board.height * (1 - board.anchorY) - halfH;
        const p = this.node.position;
        this.node.setPosition(left > right ? (left + right) / 2 : Math.max(left, Math.min(right, p.x)),
            bottom > top ? (bottom + top) / 2 : Math.max(bottom, Math.min(top, p.y)), p.z);
    }
}
