/**
 * 用途：让小卡与气泡共用详情浮层，避免卡面塞入长文本。
 * 职责：展示名称/正文，自动测量换行高度，默认靠目标右侧，越界时左翻并限位。
 * 运行边界：目标必须在 Canvas 下；每个 Canvas 运行时创建一个浮层，无须挂节点。
 * 只展示调用方提供的信息，不推导译义；不注册输入监听，不抢占拖动和点击。
 * 调用方负责 hover 显隐；拖动/模态开启需隐藏，目标失活或销毁时自动隐藏。
 * UI 须保持无旋转；颜色、宽度、间距集中在 TOOLTIP_STYLE。销毁只释放自建裁片。
 */
import { _decorator, Component, Node, Canvas, UITransform, Label, Sprite, SpriteFrame,
    Graphics, Color, Vec3, isValid } from 'cc';
const { ccclass } = _decorator;
export const TOOLTIP_STYLE = {
    width: 240, padding: 12, gap: 10, edge: 8,
    titleSize: 18, bodySize: 15, lineHeight: 22, titleGap: 8, border: 3,
    text: new Color(65, 42, 34), fill: new Color(218, 200, 191),
} as const;
@ccclass('Tooltip')
export class Tooltip extends Component {
    private static instances = new Set<Tooltip>();
    private owner: Node | null = null;
    private panel!: Node;
    private title!: Label;
    private body!: Label;
    private frame: SpriteFrame | null = null;
    private source: SpriteFrame | null = null;
    public static show(owner: Node, title: string, body: string, background?: SpriteFrame): void {
        let root: Node | null = owner;
        while (root && !root.getComponent(Canvas)) root = root.parent;
        if (!root) return;
        const tooltip = root.getComponent(Tooltip) || root.addComponent(Tooltip);
        tooltip.ensurePanel(); tooltip.owner = owner;
        tooltip.panel.active = true;
        tooltip.panel.setSiblingIndex(root.children.length - 1);
        tooltip.title.string = title; tooltip.body.string = body;
        tooltip.setBackground(background);
        tooltip.layout();
    }
    public static hide(owner: Node): void {
        for (const instance of Tooltip.instances) if (instance.owner === owner) instance.clear();
    }
    public static hideAll(): void { for (const instance of Tooltip.instances) instance.clear(); }
    private clear(): void { this.owner = null; if (this.panel) this.panel.active = false; }
    private ensurePanel(): void {
        if (this.panel) return;
        Tooltip.instances.add(this);
        this.panel = new Node('Tooltip'); this.panel.layer = this.node.layer;
        this.panel.addComponent(UITransform); this.node.addChild(this.panel);
        this.panel.addComponent(Sprite); this.panel.addComponent(Graphics);
        this.title = this.makeLabel('Title', TOOLTIP_STYLE.titleSize);
        this.body = this.makeLabel('Body', TOOLTIP_STYLE.bodySize);
    }
    private makeLabel(name: string, size: number): Label {
        const node = new Node(name); node.layer = this.node.layer; this.panel.addChild(node);
        const transform = node.addComponent(UITransform); transform.setAnchorPoint(0, 1);
        const label = node.addComponent(Label); label.fontSize = size;
        label.lineHeight = TOOLTIP_STYLE.lineHeight; label.color = TOOLTIP_STYLE.text;
        label.horizontalAlign = Label.HorizontalAlign.LEFT; label.verticalAlign = Label.VerticalAlign.TOP;
        label.enableWrapText = true; label.overflow = Label.Overflow.RESIZE_HEIGHT;
        return label;
    }
    private setBackground(source?: SpriteFrame): void {
        const sprite = this.panel.getComponent(Sprite)!;
        if ((source || null) !== this.source) {
            sprite.spriteFrame = null; this.frame?.destroy(); this.frame = null;
            this.source = source || null;
            if (source) {
                this.frame = source.clone();
                this.frame.insetLeft = this.frame.insetRight = TOOLTIP_STYLE.border;
                this.frame.insetTop = this.frame.insetBottom = TOOLTIP_STYLE.border;
            }
        }
        sprite.type = Sprite.Type.SLICED; sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = this.frame; sprite.enabled = !!this.frame;
        this.panel.getComponent(Graphics)!.enabled = !this.frame;
    }
    protected lateUpdate(): void {
        if (!this.owner) return;
        if (!isValid(this.owner, true) || !this.owner.activeInHierarchy) { this.clear(); return; }
        this.layout();
    }
    private layout(): void {
        if (!this.owner) return;
        const style = TOOLTIP_STYLE, canvas = this.node.getComponent(UITransform)!;
        const width = Math.max(style.padding * 2 + 1, Math.min(style.width, canvas.width - style.edge * 2));
        for (const label of [this.title, this.body]) {
            label.node.getComponent(UITransform)!.setContentSize(width - style.padding * 2, 0);
            label.updateRenderData(true);
        }
        const titleHeight = this.title.node.getComponent(UITransform)!.height;
        const height = titleHeight + this.body.node.getComponent(UITransform)!.height + style.padding * 2 + style.titleGap;
        this.panel.getComponent(UITransform)!.setContentSize(width, height);
        this.title.node.setPosition(-width / 2 + style.padding, height / 2 - style.padding);
        this.body.node.setPosition(-width / 2 + style.padding, height / 2 - style.padding - titleHeight - style.titleGap);
        const graphics = this.panel.getComponent(Graphics)!;
        if (graphics.enabled) {
            graphics.clear(); graphics.fillColor = style.fill;
            graphics.rect(-width / 2, -height / 2, width, height); graphics.fill();
        }
        const target = this.owner.getComponent(UITransform)!;
        const rightTop = canvas.convertToNodeSpaceAR(target.convertToWorldSpaceAR(new Vec3(
            target.width * (1 - target.anchorX), target.height * (1 - target.anchorY))));
        const leftBottom = canvas.convertToNodeSpaceAR(target.convertToWorldSpaceAR(new Vec3(
            -target.width * target.anchorX, -target.height * target.anchorY)));
        const left = -canvas.width * canvas.anchorX + style.edge;
        const right = canvas.width * (1 - canvas.anchorX) - style.edge;
        const bottom = -canvas.height * canvas.anchorY + style.edge;
        const top = canvas.height * (1 - canvas.anchorY) - style.edge;
        let x = rightTop.x + style.gap + width / 2;
        if (x + width / 2 > right) x = leftBottom.x - style.gap - width / 2;
        this.panel.setPosition(Math.max(left + width / 2, Math.min(right - width / 2, x)),
            Math.max(bottom + height / 2, Math.min(top - height / 2, rightTop.y - height / 2)));
    }
    protected onDisable(): void { this.clear(); }
    protected onDestroy(): void {
        Tooltip.instances.delete(this); this.frame?.destroy();
        if (isValid(this.panel)) this.panel.destroy();
    }
}
