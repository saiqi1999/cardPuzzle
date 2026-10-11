/**
 * 用途：集中管理卡牌视觉，避免入口和交互脚本重复维护布局。
 * 职责：按卡牌宽高生成大图、名称、符号与气泡；详情交给共用 Tooltip，响应数据和尺寸更新。
 * 运行边界：挂在带 UITransform 的卡牌根节点上；父节点须为 UI 桌面。
 * 本脚本独占根节点子节点（刷新时重建），不要手动在其下添加持久节点。
 * 卡根节点须中心锚点、无旋转，缩放由本脚本管理；不处理拖动、配方和解谜判定。
 * 阴影：使用 Main 传入的 shadowbar 图片，以九宫格绘制在卡牌底边、画像 Mask 外。
 * 调整入口：CARD_SHADOW 控制阴影，其余为 文件顶部 CARD_SIZE / CARD_LAYOUT / CARD_STYLE / BUBBLE_LAYOUT；运行时调用 setSize。
 * 气泡保持在卡牌上方且尾尖向下；不做屏幕避让，靠近桌面顶边可能超出视野。
 * 宽高比例可改变，但底图会随之拉伸；画像保持比例裁切，符号保持正方形。
 */
import { _decorator, Component, Node, UITransform, Sprite, SpriteFrame, Label, Color, Mask, Layers } from 'cc';
import { CardData } from './CardData';
import { EventManager } from '../EventManager';
import { Tooltip } from '../util/Tooltip';
import { SpeechBubble } from '../util/SpeechBubble';
const { ccclass } = _decorator;

// 唯一默认像素尺寸；Main 不再重复指定卡牌宽高。
export const CARD_SIZE = { width: 70, height: 110 } as const;
// 0.5 = 50%。位置以卡牌中心为原点，x 向右、y 向上。
// x / width 相对卡宽，y / height 相对卡高；字体与正方形图标相对卡宽。
export const CARD_LAYOUT = {
    portrait: { width: 0.92, height: 0.76, x: 0, y: -0.04 },
    name: { width: 0.86, height: 0.14, x: 0, y: 0.40, font: 0.11 },
} as const;
// 气泡宽度沿用你的 1.64 倍设置。文本采用独立 UI 像素字号，不受卡牌字体比例影响。
// 内容超出时换行并自动增加主体高度；译文仅在 Tooltip 展示。
export const BUBBLE_LAYOUT = {
    widthRatio: 2.34,
    minHeightRatio: 0.74,
    cardGapRatio: 0.06,
    pixelScale: 1,
    padding: 2,
    symbolSize: 32,
    cellWidth: 40,
    columnGap: 4,
    rowGap: 6,
} as const;
export const CARD_STYLE = {
    hoverScale: 1.03,
    hoverDuration: 0.12, // 卡面与阴影共用根节点缩放和同一过渡时间
    lineSpacing: 0.016, // 相对卡宽
    textColor: { r: 65, g: 42, b: 34 },
    untranslated: '未破译',
} as const;

// 宽度相对卡宽，厚度与底边偏移也相对卡宽；透明度为 0~255。
// 72×2 的 shadowbar 两端各保留 2 像素，仅拉伸中部；图片本身保持不变。
export const CARD_SHADOW = {
    widthRatio: 1,
    heightRatio: 0.04,
    flatScaleY: 1.00, hoverScaleY: 1.03, dragScaleY: 1.06, // 相对平放厚度；拖拽优先
    overlapRatio: 0.01, // 阴影顶边藏入卡面少许，避免底边出现缝隙。
    opacity: 150,
    capPixels: 2,
} as const;

export interface CardArt {
    background: SpriteFrame; portrait: SpriteFrame; badge: SpriteFrame;
    tooltip?: SpriteFrame;
    shadow?: SpriteFrame;
    bubble: SpriteFrame; symbols: Record<string, SpriteFrame>;
}
@ccclass('CardView')
export class CardView extends Component {
    private shadowFrame: SpriteFrame | null = null;
    private shadow: Node | null = null;
    private dragging = false;
    private lift = 0;
    private shadowScaleY: number = CARD_SHADOW.flatScaleY;
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
        this.hideTooltip();
        this.data = data;
        if (!this.art) return;
        const speechVisible = this.bubble?.active ?? false;
        for (const child of [...this.node.children]) { child.removeFromParent(); child.destroy(); }
        this.bubble = null;
        this.shadow = null;
        const art = this.art;
        const w = this.width, h = this.height;
        const { portrait, name } = CARD_LAYOUT;
        this.createShadow();
        this.picture(this.node, 'Background', art.background, w, h, 0, 0);
        const mask = this.box(this.node, 'PortraitMask', w * portrait.width, h * portrait.height,
            w * portrait.x, h * portrait.y);
        mask.addComponent(Mask);
        const ratio = art.portrait.originalSize.width / art.portrait.originalSize.height;
        const portraitWidth = data.type === 'npc' ? Math.max(w * portrait.width, h * portrait.height * ratio)
            : Math.min(w * portrait.width, h * portrait.height * ratio);
        this.picture(mask, 'Portrait', art.portrait, portraitWidth, portraitWidth / ratio, 0, 0);
        this.label(this.node, 'NameLabel', data.name, w * name.width, h * name.height,
            w * name.x, h * name.y, w * name.font);
        if (data.type === 'npc') { this.createSpeech(data); this.bubble!.active = speechVisible; }
    }
    public setHovered(value: boolean): void {
        this.hovered = value;
        if (value && this.data) {
            const types = { npc: '人物', material: '素材', equipment: '设备', clue: '线索' };
            Tooltip.show(this.node, this.data.name, `${types[this.data.type]}\n${this.data.descriptions}`, this.art?.tooltip);
        } else this.hideTooltip();
    }
    public hideTooltip(): void {
        Tooltip.hide(this.node);
        if (this.bubble) Tooltip.hide(this.bubble);
    }
    protected onDisable(): void {
        this.hideTooltip(); this.dragging = false; this.hovered = false; this.lift = 0; this.shadowScaleY = CARD_SHADOW.flatScaleY; this.node.setScale(1, 1, 1); this.updateShadow();
    }
    /** CardDrag 只上报拖起/落下，阴影尺寸和过渡仍由 CardView 管理。 */
    public setDragging(value: boolean): void { this.dragging = value; }
    protected update(dt: number): void {
        const target = this.dragging || this.hovered ? 1 : 0;
        const shadowTarget = this.dragging ? CARD_SHADOW.dragScaleY
            : this.hovered ? CARD_SHADOW.hoverScaleY : CARD_SHADOW.flatScaleY;
        if (this.lift === target && this.shadowScaleY === shadowTarget) return;
        const step = Math.max(0, dt) / CARD_STYLE.hoverDuration;
        this.lift = target > this.lift ? Math.min(target, this.lift + step) : Math.max(target, this.lift - step);
        const shadowStep = step * (CARD_SHADOW.dragScaleY - CARD_SHADOW.flatScaleY);
        this.shadowScaleY = shadowTarget > this.shadowScaleY
            ? Math.min(shadowTarget, this.shadowScaleY + shadowStep)
            : Math.max(shadowTarget, this.shadowScaleY - shadowStep);
        // 保留原卡牌缩放和阴影定位，仅将阴影厚度拆为平放/悬停/拖拽三档。
        const scale = 1 + (CARD_STYLE.hoverScale - 1) * this.lift;
        this.node.setScale(scale, scale, 1);
        this.updateShadow();
    }
    private createShadow(): void {
        // 只释放自建 SpriteFrame，不销毁 Main 所引用的源图或纹理。
        this.shadowFrame?.destroy(); this.shadowFrame = null;
        if (!this.art?.shadow) return;
        const frame = this.art.shadow.clone();
        const cap = Math.min(CARD_SHADOW.capPixels, (frame.rect.width - 1) / 2);
        frame.insetLeft = frame.insetRight = Math.max(0, cap);
        frame.insetTop = frame.insetBottom = 0;
        this.shadowFrame = frame;
        this.shadow = this.box(this.node, 'Shadow', this.width, 1, 0, 0);
        this.shadow.getComponent(UITransform)!.setAnchorPoint(0.5, 1);
        const sprite = this.shadow.addComponent(Sprite);
        sprite.type = Sprite.Type.SLICED; sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = frame;
        this.updateShadow();
    }
    private updateShadow(): void {
        if (!this.shadow) return;
        const s = CARD_SHADOW;
        this.shadow.getComponent(UITransform)!.setContentSize(
            this.width * s.widthRatio,
            this.width * s.heightRatio * this.shadowScaleY);
        this.shadow.setPosition(0, -this.height / 2 + this.width * s.overlapRatio);
        this.shadow.getComponent(Sprite)!.color = new Color(0, 0, 0, s.opacity);
    }

    protected onDestroy(): void {
        this.shadowFrame?.destroy(); this.shadowFrame = null;
    }
    public handleClick(): void {
        if (!this.data) return;
        if (this.data.type === 'npc') this.toggleSpeech();
        EventManager.instance?.onCardEvent('clicked', this.data);
    }
    public toggleSpeech(): void { this.hideTooltip(); if (this.bubble) this.bubble.active = !this.bubble.active; }
    private createSpeech(data: CardData): void {
        const layout = BUBBLE_LAYOUT;
        const cellWidth = Math.max(layout.cellWidth, layout.symbolSize);
        const width = Math.max(this.width * layout.widthRatio, cellWidth + layout.padding * 2);
        const columns = Math.max(1, Math.floor((width - layout.padding * 2 + layout.columnGap)
            / (cellWidth + layout.columnGap)));
        const rows = Math.max(1, Math.ceil(data.demandSymbols.length / columns));
        const cellHeight = layout.symbolSize;
        const contentHeight = rows * cellHeight + (rows - 1) * layout.rowGap;
        const height = Math.max(this.width * layout.minHeightRatio, contentHeight + layout.padding * 2);
        const result = SpeechBubble.create(this.node, this.art!.bubble,
            { width, height, pixelScale: layout.pixelScale, padding: layout.padding });
        this.bubble = result.node;
        this.bubble.on(Node.EventType.MOUSE_ENTER, () => {
            Tooltip.show(result.node, '需求译文', data.demandSymbols.map((id, i) =>
                `${i + 1}. ${data.translations?.[id] || CARD_STYLE.untranslated}`).join('\n'), this.art?.tooltip);
        });
        this.bubble.on(Node.EventType.MOUSE_LEAVE, () => Tooltip.hide(result.node));
        // 气泡输入不冒泡给卡牌，防止查看译文时触发拖动或切换气泡。
        for (const type of [Node.EventType.TOUCH_START, Node.EventType.TOUCH_MOVE,
            Node.EventType.TOUCH_END, Node.EventType.TOUCH_CANCEL]) {
            this.bubble.on(type, (event: { propagationStopped: boolean }) => { event.propagationStopped = true; });
        }
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
