/**
 * 用途：隔离书页点击输入，避免 View 与 Manager 混入事件细节。
 * 职责：退出热区点击请求关闭手册，并阻止事件冒泡。
 * 运行边界：由 Manager 在 View.render 后 bind；不直接移动节点或修改页码。
 * 根节点和退出区都须有 UITransform；禁用/销毁时解绑，重复 bind 不叠加监听。
 */
import { _decorator, Component, Node, EventTouch } from 'cc';
const { ccclass } = _decorator;
@ccclass('PuzzleClick')
export class PuzzleClick extends Component {
    private quit: Node | null = null;

    private closeAction: (() => void) | null = null;
    public bind(quit: Node, close: () => void): void {
        this.unbind(); this.quit = quit; this.closeAction = close;
        quit.on(Node.EventType.TOUCH_END, this.close, this);
    }
    private close(event: EventTouch): void { event.propagationStopped = true; this.closeAction?.(); }
    private unbind(): void { this.node.targetOff(this); this.quit?.targetOff(this); }
    protected onDisable(): void { this.unbind(); }
    protected onEnable(): void {
        if (this.quit && this.closeAction) this.bind(this.quit, this.closeAction);
    }
    protected onDestroy(): void { this.unbind(); }
}
