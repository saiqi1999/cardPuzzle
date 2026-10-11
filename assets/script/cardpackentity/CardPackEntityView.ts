/**
 * 用途：独立绘制CardPackEntity实体，避免入口与事件脚本维护图片尺寸。
 * 职责：保持图片比例并提供点击反馈；顶部常量控制大小与反馈幅度。
 * 运行边界：由 EventManager 创建并注册输入；本脚本不计数、不拖动、不决定掉落。
 * 根节点中心锚点且无旋转；禁用时停止反馈动画，不销毁共享图片。
 */
import { _decorator, Component, UITransform, Sprite, SpriteFrame, tween, Tween, Vec3 } from 'cc';
import type { CardPackEntityData } from './CardPackEntityData';
const { ccclass } = _decorator;
export const PACK_STYLE = { width: 100, pressScale: 0.93, feedbackTime: 0.08 } as const;
const STYLE = PACK_STYLE;
@ccclass('CardPackEntityView')
export class CardPackEntityView extends Component {
    public data!: CardPackEntityData;
    public initialize(data: CardPackEntityData, image: SpriteFrame): void {
        this.data = data;
        const size = this.getComponent(UITransform) || this.addComponent(UITransform);
        size.setAnchorPoint(0.5, 0.5);
        size.setContentSize(STYLE.width, STYLE.width * image.originalSize.height / image.originalSize.width);
        const sprite = this.getComponent(Sprite) || this.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.trim = false; sprite.spriteFrame = image;
    }
    public feedback(): void {
        Tween.stopAllByTarget(this.node); this.node.setScale(1, 1, 1);
        tween(this.node).to(STYLE.feedbackTime, { scale: new Vec3(STYLE.pressScale, STYLE.pressScale, 1) })
            .to(STYLE.feedbackTime, { scale: new Vec3(1, 1, 1) }).start();
    }
    protected onDisable(): void { Tween.stopAllByTarget(this.node); this.node.setScale(1, 1, 1); }
}
