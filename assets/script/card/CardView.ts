/**
 * 用途：集中管理卡牌视觉，避免入口和交互脚本重复维护布局。
 * 职责：按卡牌宽高生成画像、文字、符号与气泡，响应数据和尺寸更新。
 * 运行边界：挂在带 UITransform 的卡牌根节点上；父节点须为 UI 桌面。
 * 本脚本独占根节点子节点（刷新时重建），不要手动在其下添加持久节点。
 * 卡根节点须中心锚点、无旋转，缩放由本脚本管理；不处理拖动、配方和解谜判定。
 * 调整入口：文件顶部 CARD_SIZE / CARD_LAYOUT / CARD_STYLE / BUBBLE_LAYOUT；运行时调用 setSize。
 * 气泡保持在卡牌上方且尾尖向下；不做屏幕避让，靠近桌面顶边可能超出视野。
 * 宽高比例可改变，但底图会随之拉伸；画像保持比例裁切，徽章和符号保持正方形。
 */
import { _decorator, Component, Node, UITransform, Sprite, SpriteFrame, Label, Color, Mask, Layers } from 'cc';
import { CardData } from './CardData';
import { SpeechBubble } from '../util/SpeechBubble';
const { ccclass } = _decorator;

// 唯一默认像素尺寸；Main 不再重复指定卡牌宽高。
export const CARD_SIZE = { width: 70, height: 110 } as const;
// 0.5 = 50%。位置以卡牌中心为原点，x 向右、y 向上。
// x / width 相对卡宽，y / height 相对卡高；字体与正方形图标相对卡宽。
export const CARD_LAYOUT = {
    portrait: { width: 0.792, height: 0.45143, x: 0, y: 0.19429 },
    name: { width: 0.76, height: 0.08, x: 0, y: -0.13857, font: 0.076 },
    badge: { size: 0.096, x: -0.348, y: 0.40571 },
    descriptions: { width: 0.76, height: 0.27, x: 0, y: -0.32, font: 0.072 },
} as const;
// 气泡宽度沿用你的 1.64 倍设置。文本采用独立 UI 像素字号，不受卡牌字体比例影响。
// 内容超出时换行并自动增加主体高度，不缩小符号或译文。
export const BUBBLE_LAYOUT = {
    widthRatio: 2.34,
    minHeightRatio: 0.74,
    cardGapRatio: 0.06,
    pixelScale: 1,
    padding: 2,
    symbolSize: 32,
    translationFontSize: 12,
    translationLineHeight: 12,
    translationLines: 2,
    cellWidth: 40,
    columnGap: 4,
    symbolTranslationGap: 4,
    rowGap: 6,
} as const;
export const CARD_STYLE = {
    hoverScale: 1.05,
    lineSpacing: 0.016, // 相对卡宽
    textColor: { r: 65, g: 42, b: 34 },
    untranslated: '_',
} as const;

export interface CardArt {
    background: SpriteFrame; portrait: SpriteFrame; badge: SpriteFrame;
    bubble: SpriteFrame; symbols: Record<string, SpriteFrame>;
}
@ccclass('CardView')
export class CardView extends Component {
    private bubble: Node | null = null;
    private art: CardArt | null = null;
    private data: CardData | null = null;
    private width: number = CARD_SIZE.width;
    private height: number = CARD_SIZE.height;
    public hovered = false;
    /** 更新布局尺寸；气泡开关和悬停状态保留。非法尺寸立即报错。 */
    public setSize(width: number, height: number): void {
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
            throw new Error('CardView.setSize: 宽高必须为大于零的有限数字');
        }
        this.width = width; this.height = height;
        this.node.getComponent(UITransform)!.setContentSize(width, height);
        if (this.data) this.setData(this.data);
    }
    public initialize(art: CardArt, data: CardData): void {
        this.art = art;
        this.setSize(this.width, this.height);
        this.setData(data);
    }
    public setData(data: CardData): void {
        this.data = data;
        if (!this.art) return;
        const speechVisible = this.bubble?.active ?? false;
        for (const child of [...this.node.children]) { child.removeFromParent(); child.destroy(); }
        const art = this.art;
        const w = this.width, h = this.height;
        const { portrait, name, badge, descriptions } = CARD_LAYOUT;
        this.picture(this.node, 'Background', art.background, w, h, 0, 0);
        const mask = this.box(this.node, 'PortraitMask', w * portrait.width, h * portrait.height,
            w * portrait.x, h * portrait.y);
        mask.addComponent(Mask);
        const ratio = art.portrait.originalSize.width / art.portrait.originalSize.height;
        const portraitWidth = Math.max(w * portrait.width, h * portrait.height * ratio);
        this.picture(mask, 'Portrait', art.portrait, portraitWidth, portraitWidth / ratio, 0, 0);
        this.label(this.node, 'NameLabel', data.name, w * name.width, h * name.height,
            w * name.x, h * name.y, w * name.font);
        this.picture(this.node, 'Badge', art.badge, w * badge.size, w * badge.size,
            w * badge.x, h * badge.y);
        this.label(this.node, 'DescriptionsLabel', data.descriptions,
            w * descriptions.width, h * descriptions.height, w * descriptions.x,
            h * descriptions.y, w * descriptions.font);
        this.createSpeech(data);
        this.bubble.active = speechVisible;
    }
    public setHovered(value: boolean): void {
        this.hovered = value;
        const scale = value ? CARD_STYLE.hoverScale : 1;
        this.node.setScale(scale, scale, 1);
    }
    public toggleSpeech(): void { if (this.bubble) this.bubble.active = !this.bubble.active; }
    private createSpeech(data: CardData): void {
        const layout = BUBBLE_LAYOUT;
        const cellWidth = Math.max(layout.cellWidth, layout.symbolSize);
        const width = Math.max(this.width * layout.widthRatio, cellWidth + layout.padding * 2);
        const columns = Math.max(1, Math.floor((width - layout.padding * 2 + layout.columnGap)
            / (cellWidth + layout.columnGap)));
        const rows = Math.max(1, Math.ceil(data.demandSymbols.length / columns));
        const translationHeight = layout.translationLineHeight * layout.translationLines;
        const cellHeight = layout.symbolSize + layout.symbolTranslationGap + translationHeight;
        const contentHeight = rows * cellHeight + (rows - 1) * layout.rowGap;
        const height = Math.max(this.width * layout.minHeightRatio, contentHeight + layout.padding * 2);
        const result = SpeechBubble.create(this.node, this.art!.bubble,
            { width, height, pixelScale: layout.pixelScale, padding: layout.padding });
        this.bubble = result.node;
        // 尾尖在下方指向说话者；不再翻到卡片下方，保持尾巴方向一致。
        this.bubble.setPosition(0, this.height / 2 + this.height * layout.cardGapRatio);
        data.demandSymbols.forEach((id, index) => {
            const row = Math.floor(index / columns), col = index % columns;
            const count = Math.min(columns, data.demandSymbols.length - row * columns);
            const x = (col - (count - 1) / 2) * (cellWidth + layout.columnGap);
            const top = contentHeight / 2 - row * (cellHeight + layout.rowGap);
            const cell = this.box(result.content, `Word${index}`, cellWidth, cellHeight, x, top - cellHeight / 2);
            this.picture(cell, 'Symbol', this.art!.symbols[id] || this.art!.badge,
                layout.symbolSize, layout.symbolSize, 0, cellHeight / 2 - layout.symbolSize / 2);
            const translation = this.label(cell, 'Translation', data.translations?.[id] || CARD_STYLE.untranslated,
                cellWidth, translationHeight, 0, -cellHeight / 2 + translationHeight / 2, layout.translationFontSize);
            translation.lineHeight = layout.translationLineHeight;
            translation.enableWrapText = true;
            translation.overflow = Label.Overflow.CLAMP;
        });
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
    private label(parent: Node, name: string, text: string, w: number, h: number, x: number, y: number, size: number): Label {
        const node = this.box(parent, name, w, h, x, y); const label = node.addComponent(Label);
        label.string = text; label.fontSize = size; label.lineHeight = size + this.width * CARD_STYLE.lineSpacing;
        label.horizontalAlign = Label.HorizontalAlign.CENTER; label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK; const color = CARD_STYLE.textColor;
        label.color = new Color(color.r, color.g, color.b);
        return label;
    }
}
