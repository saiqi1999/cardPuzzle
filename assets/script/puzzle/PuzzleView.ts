/**
 * 用途：集中维护书页视觉和比例布局，方便与卡牌一样从顶部配置调整。
 * 职责：创建图片、标题、说明、退出位置，刷新页码及标题中的符号图片。
 * 运行边界：独占根节点子节点；中心锚点、UI_2D；由 Manager 调用 render。
 * 不监听输入、不管理页序、不执行位移动画；刷新后 Click 须重新绑定退出节点。
 */
import { _decorator, Component, Node, UITransform, Sprite, SpriteFrame, Label, Color, Layers } from 'cc';
import { PuzzleData } from './PuzzleData';
const { ccclass } = _decorator;
export const PUZZLE_LAYOUT = {
    width: 560, aspect: 112 / 77, screenWidth: 0.9, screenHeight: 0.8,
    image: { x: -0.30, y: 0.20, width: 0.27, height: 0.40 },
    title: { x: 0.17, y: 0.29, width: 0.52, height: 0.26, font: 0.039 },
    symbol: { size: 0.05, step: 0.057 },
    description: { x: 0, y: -0.20, width: 0.83, height: 0.34, font: 0.033 },
    quit: { x: 0.45, y: 0.423, size: 0.09 },
    footer: { y: -0.43, width: 0.8, height: 0.06, font: 0.024 },
    tab: { y: 0.45, width: 0.70, height: 0.07, font: 0.025 },
    lineHeightRatio: 1.3,
    color: { r: 65, g: 42, b: 34 },
} as const;
export interface PuzzleArt {
    background: SpriteFrame;
    symbols: Record<string, SpriteFrame>;
    images: Record<string, SpriteFrame>;
}
@ccclass('PuzzleView')
export class PuzzleView extends Component {
    public quitNode!: Node;
    private tab!: Node;
    public render(data: PuzzleData, art: PuzzleArt, width: number, index: number, count: number): void {
        for (const child of [...this.node.children]) { child.removeFromParent(); child.destroy(); }
        const h = width / PUZZLE_LAYOUT.aspect, l = PUZZLE_LAYOUT;
        this.node.getComponent(UITransform)!.setContentSize(width, h);
        this.picture(this.node, 'Background', art.background, width, h, 0, 0);
        const slot = this.box(this.node, 'Image', width * l.image.width, h * l.image.height,
            width * l.image.x, h * l.image.y);
        const image = data.imageKey ? art.images[data.imageKey] : null;
        if (image) {
            const scale = Math.min(width * l.image.width / image.originalSize.width,
                h * l.image.height / image.originalSize.height);
            this.picture(slot, 'ImageContent', image, image.originalSize.width * scale,
                image.originalSize.height * scale, 0, 0);
        }
        const title = this.box(this.node, 'Title', width * l.title.width, h * l.title.height,
            width * l.title.x, h * l.title.y);
        const font = width * l.title.font;
        const nameWidth = data.title.length * font * 1.1;
        const step = width * l.symbol.step;
        const totalWidth = nameWidth + (data.symbols.length + 2) * step;
        const left = -totalWidth / 2;
        this.text(title, 'PlantName', data.title, nameWidth, h * l.title.height,
            left + nameWidth / 2, 0, font);
        const symbols = this.box(title, 'AlchemySymbols', (data.symbols.length + 2) * step,
            width * l.symbol.size, left + nameWidth + (data.symbols.length + 2) * step / 2, 0);
        const half = (data.symbols.length + 1) * step / 2;
        this.text(symbols, 'LeftParenthesis', '（', step, width * l.symbol.size, -half, 0, font);
        data.symbols.forEach((id, i) => {
            const frame = art.symbols[id];
            const x = (i - (data.symbols.length - 1) / 2) * step;
            if (frame) this.picture(symbols, id, frame, width * l.symbol.size, width * l.symbol.size, x, 0);
            else this.text(symbols, id, '？', step, width * l.symbol.size, x, 0, font);
        });
        this.text(symbols, 'RightParenthesis', '）', step, width * l.symbol.size, half, 0, font);
        this.text(this.node, 'Description', data.description, width * l.description.width, h * l.description.height,
            width * l.description.x, h * l.description.y, width * l.description.font);
        this.quitNode = this.box(this.node, 'Quit', width * l.quit.size, width * l.quit.size,
            width * l.quit.x, h * l.quit.y); // 使用背景图已有的 X，透明热区扩大点击范围。
        this.text(this.node, 'PageNumber', `A ←   ${index + 1} / ${count}   → D`, width * l.footer.width,
            h * l.footer.height, 0, h * l.footer.y, width * l.footer.font);
        this.tab = this.text(this.node, 'OpenHint', '解密手册 · 点击展开', width * l.tab.width,
            h * l.tab.height, 0, h * l.tab.y, width * l.tab.font).node;
    }
    public setExpanded(expanded: boolean): void { this.tab.active = !expanded; this.quitNode.active = expanded; }
    private box(parent: Node, name: string, w: number, h: number, x: number, y: number): Node {
        const node = new Node(name); node.layer = Layers.Enum.UI_2D;
        node.addComponent(UITransform).setContentSize(w, h); parent.addChild(node); node.setPosition(x, y); return node;
    }
    private picture(parent: Node, name: string, frame: SpriteFrame, w: number, h: number, x: number, y: number): void {
        const n = this.box(parent, name, w, h, x, y); const s = n.addComponent(Sprite);
        s.sizeMode = Sprite.SizeMode.CUSTOM; s.trim = false; s.spriteFrame = frame;
    }
    private text(parent: Node, name: string, text: string, w: number, h: number, x: number, y: number, font: number): Label {
        const label = this.box(parent, name, w, h, x, y).addComponent(Label);
        label.string = text; label.fontSize = font; label.lineHeight = font * PUZZLE_LAYOUT.lineHeightRatio;
        label.horizontalAlign = Label.HorizontalAlign.CENTER; label.verticalAlign = Label.VerticalAlign.CENTER;
        label.enableWrapText = true; label.overflow = Label.Overflow.SHRINK;
        const c = PUZZLE_LAYOUT.color; label.color = new Color(c.r, c.g, c.b); return label;
    }
}
