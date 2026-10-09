/**
 * 用途：把通用按钮输入和具体业务回调解耦。
 * 职责：使用 Cocos Button 的有效点击判定，避免拖出/取消触摸也触发打开。
 * 运行边界：节点需 UITransform；bind 只替换回调，不累计监听；禁用时解绑。
 * 不管理按钮显示、位置或页面状态；业务由调用方提供。
 */
import { _decorator, Component, Button } from 'cc';
const { ccclass } = _decorator;
@ccclass('ButtonClick')
export class ButtonClick extends Component {
    private action: (() => void) | null = null;
    protected onLoad(): void {
        const button = this.getComponent(Button) || this.addComponent(Button);
        button.transition = Button.Transition.NONE;
    }
    public bind(action: () => void): void { this.action = action; }
    private click(): void { this.action?.(); }
    protected onEnable(): void { this.node.on(Button.EventType.CLICK, this.click, this); }
    protected onDisable(): void { this.node.off(Button.EventType.CLICK, this.click, this); }
}
