/**
 * 用途：让手动添加到 header 的卡包图片具备 hover 和点击反馈。
 * 职责：读取 Inspector 数据，动画反馈，并把 hover/click 上报 EventManager。
 * 运行边界：同节点需有 UITransform、Sprite；图片、尺寸和位置由编辑器设置。
 * 不生成或拖动节点、不改父节点与尺寸；保留编辑器初始缩放。不要同时挂 Button。
 * 单指移动超过阈值或取消不算点击；禁用时恢复缩放并移除监听。
 */
import { _decorator, Component, Node, UITransform, Sprite, EventTouch, Vec2, Vec3, tween, Tween } from 'cc';
import type { CardPackEntityData } from './CardPackEntityData';
import { EventManager } from '../EventManager';
import { Tooltip } from '../util/Tooltip';
const { ccclass, property, requireComponent } = _decorator;
export const PACK_STYLE = { hoverScale: 1.05, pressScale: 0.95, duration: 0.1, clickThreshold: 6 } as const;
@ccclass('CardPackEntityView')
@requireComponent(UITransform)
@requireComponent(Sprite)
export class CardPackEntityView extends Component {
    @property({ tooltip: '卡包入口 ID；复制节点后请设为不同 ID' }) packId = 'basic-pack';
    @property packName = '卡包';
    @property({ multiline: true }) description = '';
    private baseScale = new Vec3(1, 1, 1);
    private hovered = false;
    private touchId: number | null = null;
    private startPoint = new Vec2();
    private moved = false;
    public get data(): CardPackEntityData {
        return { id: this.packId, name: this.packName, description: this.description };
    }
    protected onLoad(): void { this.baseScale.set(this.node.scale); }
    protected onEnable(): void {
        this.node.on(Node.EventType.MOUSE_ENTER, this.enter, this);
        this.node.on(Node.EventType.MOUSE_LEAVE, this.leave, this);
        this.node.on(Node.EventType.TOUCH_START, this.press, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.move, this);
        this.node.on(Node.EventType.TOUCH_END, this.release, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.cancel, this);
    }
    private animate(): void {
        const ratio = this.touchId !== null && !this.moved ? PACK_STYLE.pressScale : this.hovered ? PACK_STYLE.hoverScale : 1;
        Tween.stopAllByTarget(this.node);
        tween(this.node).to(PACK_STYLE.duration, { scale: new Vec3(
            this.baseScale.x * ratio, this.baseScale.y * ratio, this.baseScale.z) }).start();
    }
    private enter(): void {
        this.hovered = true; this.animate();
        if (this.description) Tooltip.show(this.node, this.packName, this.description);
        EventManager.instance?.onPackHover(this.data, this.node, true);
    }
    private leave(): void {
        this.hovered = false; this.animate(); Tooltip.hide(this.node);
        EventManager.instance?.onPackHover(this.data, this.node, false);
    }
    private press(event: EventTouch): void {
        event.propagationStopped = true;
        if (this.touchId !== null) return;
        this.touchId = event.getID(); this.startPoint.set(event.getUILocation()); this.moved = false;
        Tooltip.hide(this.node); this.animate();
    }
    private move(event: EventTouch): void {
        event.propagationStopped = true;
        if (event.getID() !== this.touchId) return;
        if (Vec2.distance(this.startPoint, event.getUILocation()) > PACK_STYLE.clickThreshold) {
            this.moved = true; this.animate();
        }
    }
    private release(event: EventTouch): void {
        event.propagationStopped = true;
        if (event.getID() !== this.touchId) return;
        const click = !this.moved && Vec2.distance(this.startPoint, event.getUILocation()) <= PACK_STYLE.clickThreshold;
        this.touchId = null; this.animate();
        if (click) EventManager.instance?.onPackClick(this.data, this.node);
    }
    private cancel(event: EventTouch): void {
        event.propagationStopped = true;
        if (event.getID() !== this.touchId) return;
        this.touchId = null; this.animate();
    }
    protected onDisable(): void {
        if (this.hovered) EventManager.instance?.onPackHover(this.data, this.node, false);
        this.node.targetOff(this); Tween.stopAllByTarget(this.node);
        this.node.setScale(this.baseScale); this.hovered = false; this.touchId = null;
        Tooltip.hide(this.node);
    }
}
