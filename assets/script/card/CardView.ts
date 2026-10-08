import { _decorator, Component, Node, UITransform, Sprite, SpriteFrame, Label, Color, Mask, Layers } from 'cc';
import { CardData } from './CardData';
const { ccclass } = _decorator;
export interface CardArt {
    background: SpriteFrame; portrait: SpriteFrame; badge: SpriteFrame;
    bubble: SpriteFrame; symbols: Record<string, SpriteFrame>;
}
@ccclass('CardView')
export class CardView extends Component {
    private bubble: Node | null = null;
    private art: CardArt | null = null;
    public hovered = false;
    public initialize(art: CardArt, data: CardData): void {
        this.art = art;
        this.node.getComponent(UITransform)!.setContentSize(250, 350);
        this.setData(data);
    }
    public setData(data: CardData): void {
        if (!this.art) return;
        for (const child of [...this.node.children]) { child.removeFromParent(); child.destroy(); }
        const art = this.art;
        this.picture(this.node, 'Background', art.background, 250, 350, 0, 0);
        // Inset avoids the frame, top-left badge and name ribbon.
        const mask = this.box(this.node, 'PortraitMask', 198, 158, 0, 68);
        mask.addComponent(Mask); // Default rectangular mask.
        const ratio = art.portrait.originalSize.width / art.portrait.originalSize.height;
        const width = Math.max(198, 158 * ratio);
        this.picture(mask, 'Portrait', art.portrait, width, width / ratio, 0, 0);
        this.label(this.node, 'NameLabel', data.name, 190, 28, 0, -52, 19);
        this.picture(this.node, 'Badge', art.badge, 24, 24, -87, 142);
        this.symbols(this.node, data.demandSymbols, -100);
        this.label(this.node, 'TranslationLabel', data.translation || '尚未破译', 190, 26, 0, -140, 16);
        this.bubble = this.box(this.node, 'SpeechBubble', 160, 160, 0, 245);
        this.picture(this.bubble, 'Background', art.bubble, 160, 160, 0, 0);
        this.symbols(this.bubble, data.demandSymbols, 15);
        this.bubble.active = false;
    }
    public setHovered(value: boolean): void {
        this.hovered = value;
        this.node.setScale(value ? 1.05 : 1, value ? 1.05 : 1, 1);
    }
    public toggleSpeech(): void { if (this.bubble) this.bubble.active = !this.bubble.active; }
    protected lateUpdate(): void {
        if (!this.bubble?.active || !this.node.parent) return;
        const board = this.node.parent.getComponent(UITransform)!;
        const top = (1 - board.anchorY) * board.height;
        const above = this.node.position.y + 325 * this.node.scale.y <= top;
        this.bubble.setPosition(0, above ? 245 : -245);
    }
    private symbols(parent: Node, ids: string[], y: number): void {
        const row = this.box(parent, 'Symbols', 190, 32, 0, y);
        const size = ids.length <= 4 ? 32 : 16;
        ids.forEach((id, i) => this.picture(row, id, this.art!.symbols[id] || this.art!.badge,
            size, size, (i - (ids.length - 1) / 2) * (size + 8), 0));
    }
    private box(parent: Node, name: string, width: number, height: number, x: number, y: number): Node {
        const node = new Node(name); node.layer = Layers.Enum.UI_2D;
        node.addComponent(UITransform).setContentSize(width, height);
        parent.addChild(node); node.setPosition(x, y); return node;
    }
    private picture(parent: Node, name: string, frame: SpriteFrame, w: number, h: number, x: number, y: number): void {
        const node = this.box(parent, name, w, h, x, y);
        const sprite = node.addComponent(Sprite); sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.trim = false; sprite.spriteFrame = frame;
    }
    private label(parent: Node, name: string, text: string, w: number, h: number, x: number, y: number, size: number): void {
        const node = this.box(parent, name, w, h, x, y); const label = node.addComponent(Label);
        label.string = text; label.fontSize = size; label.lineHeight = size + 4;
        label.horizontalAlign = Label.HorizontalAlign.CENTER; label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK; label.color = new Color(65, 42, 34);
    }
}
