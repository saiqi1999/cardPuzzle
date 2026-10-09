/**
 * 用途：统一按钮显示、定位和悬停反馈，便于复用。
 * 职责：按配置创建等比图标，固定在父 UI 右下角；尺寸/边距在 ButtonData 调整。
 * 运行边界：同节点需 UITransform；父节点需 UITransform；独占图标子节点。
 * 只负责视觉，不执行业务；使用未旋转的 UI 节点，悬停只放大图标，不改变点击区域。
 */
import { _decorator, Component, Node, Sprite, SpriteFrame, UITransform, Layers } from 'cc';
import { ButtonData } from './ButtonData';
const { ccclass } = _decorator;
@ccclass('ButtonView')
export class ButtonView extends Component {
    private data!: ButtonData;
    private icon!: Node;
    public initialize(frame: SpriteFrame, data: ButtonData): void {
        this.data = data;
        this.node.getComponent(UITransform)!.setContentSize(data.width, data.height);
        this.icon = new Node('Icon'); this.icon.layer = Layers.Enum.UI_2D;
        const ratio = Math.min(data.width / frame.originalSize.width, data.height / frame.originalSize.height);
        this.icon.addComponent(UITransform).setContentSize(frame.originalSize.width * ratio, frame.originalSize.height * ratio);
        const sprite = this.icon.addComponent(Sprite); sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.trim = false; sprite.spriteFrame = frame; this.node.addChild(this.icon); this.reposition();
    }
    public reposition(): void {
        if (!this.data) return;
        const parent = this.node.parent!.getComponent(UITransform)!;
        this.node.setPosition((1 - parent.anchorX) * parent.width - this.data.margin - this.data.width / 2,
            -parent.anchorY * parent.height + this.data.margin + this.data.height / 2);
    }
    private enter(): void { if (this.icon) this.icon.setScale(this.data.hoverScale, this.data.hoverScale, 1); }
    private leave(): void { this.icon?.setScale(1, 1, 1); }
    protected onEnable(): void {
        this.node.on(Node.EventType.MOUSE_ENTER, this.enter, this);
        this.node.on(Node.EventType.MOUSE_LEAVE, this.leave, this);
    }
    protected onDisable(): void { this.node.targetOff(this); this.leave(); }
}
