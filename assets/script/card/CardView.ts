/**
 * 用途：集中管理卡牌视觉，避免入口和交互脚本重复维护布局。
 * 职责：按卡牌宽高生成大图、名称、符号与气泡；详情交给共用 Tooltip，响应数据和尺寸更新。
 * 运行边界：挂在带 UITransform 的卡牌根节点上；父节点须为 UI 桌面。
 * 本脚本独占根节点子节点（刷新时重建），不要手动在其下添加持久节点。
 * 卡根节点须中心锚点、无旋转，缩放由本脚本管理；不处理拖动、配方和解谜判定。
 * 阴影：共享运行时柔边纹理，以九宫格绘制在卡面后、画像 Mask 外；无额外资源绑定。
 * 调整入口：CARD_SHADOW 控制阴影，其余为 文件顶部 CARD_SIZE / CARD_LAYOUT / CARD_STYLE / BUBBLE_LAYOUT；运行时调用 setSize。
 * 气泡保持在卡牌上方且尾尖向下；不做屏幕避让，靠近桌面顶边可能超出视野。
 * 宽高比例可改变，但底图会随之拉伸；画像保持比例裁切，符号保持正方形。
 */
import { _decorator, Component, Node, UITransform, Sprite, SpriteFrame, Label, Color, Mask, Layers, Texture2D } from 'cc';
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
    hoverScale: 1.05,
    lineSpacing: 0.016, // 相对卡宽
    textColor: { r: 65, g: 42, b: 34 },
    untranslated: '未破译',
} as const;

// 尺寸/偏移相对卡宽；opacity 为 0~255。纹理仅生成一次，最后一张卡销毁时释放。
export const CARD_SHADOW = {
    textureSize: 64, textureMargin: 16, textureRadius: 8, textureSoftness: 12,
    opacity: 66, dragOpacity: 54,
    spread: 0.055, dragSpread: 0.11,
    offsetX: 0.035, offsetY: -0.045,
    dragOffsetX: 0.075, dragOffsetY: -0.11,
    transitionSeconds: 0.12,
} as const;

export interface CardArt {
    background: SpriteFrame; portrait: SpriteFrame; badge: SpriteFrame;
    tooltip?: SpriteFrame;
    bubble: SpriteFrame; symbols: Record<string, SpriteFrame>;
}
@ccclass('CardView')
export class CardView extends Component {
    private static shadowTexture: Texture2D | null = null;
    private static shadowFrame: SpriteFrame | null = null;
    private static shadowUsers = 0;
    private ownsShadow = false;
    private shadow: Node | null = null;
    private dragging = false;
    private lift = 0;
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
        const scale = value ? CARD_STYLE.hoverScale : 1;
        this.node.setScale(scale, scale, 1);
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
        this.hideTooltip(); this.dragging = false; this.lift = 0; this.updateShadow();
    }
    /** CardDrag 只上报拖起/落下，阴影尺寸和过渡仍由 CardView 管理。 */
    public setDragging(value: boolean): void { this.dragging = value; }
    protected update(dt: number): void {
        const target = this.dragging ? 1 : 0;
        if (this.lift === target) return;
        const step = Math.max(0, dt) / CARD_SHADOW.transitionSeconds;
        this.lift = target > this.lift ? Math.min(target, this.lift + step) : Math.max(target, this.lift - step);
        this.updateShadow();
    }
    private createShadow(): void {
        if (!CardView.shadowFrame) {
            const style = CARD_SHADOW, n = style.textureSize;
            const pixels = new Uint8Array(n * n * 4);
            const half = n / 2 - style.textureMargin;
            for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
                // 圆角矩形的距离场生成柔边；透明边缘不会被九宫格拉伸成硬线。
                const qx = Math.abs(x + 0.5 - n / 2) - half + style.textureRadius;
                const qy = Math.abs(y + 0.5 - n / 2) - half + style.textureRadius;
                const distance = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
                    + Math.min(Math.max(qx, qy), 0) - style.textureRadius;
                const t = Math.max(0, Math.min(1, (distance + style.textureSoftness) / (2 * style.textureSoftness)));
                pixels[(y * n + x) * 4 + 3] = Math.round(255 * (1 - t * t * (3 - 2 * t)));
            }
            const texture = new Texture2D();
            texture.reset({ width: n, height: n, format: Texture2D.PixelFormat.RGBA8888 });
            texture.uploadData(pixels);
            texture.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);
            const frame = new SpriteFrame(); frame.texture = texture; frame.packable = false;
            const inset = style.textureMargin + style.textureRadius;
            frame.insetLeft = frame.insetRight = frame.insetTop = frame.insetBottom = inset;
            CardView.shadowTexture = texture; CardView.shadowFrame = frame;
        }
        if (!this.ownsShadow) { CardView.shadowUsers++; this.ownsShadow = true; }
        this.shadow = this.box(this.node, 'Shadow', this.width, this.height, 0, 0);
        const sprite = this.shadow.addComponent(Sprite);
        sprite.type = Sprite.Type.SLICED; sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = CardView.shadowFrame;
        this.updateShadow();
    }
    private updateShadow(): void {
        if (!this.shadow) return;
        const s = CARD_SHADOW, mix = (a: number, b: number) => a + (b - a) * this.lift;
        const spread = this.width * mix(s.spread, s.dragSpread);
        this.shadow.getComponent(UITransform)!.setContentSize(this.width + (s.textureMargin + spread) * 2, this.height + (s.textureMargin + spread) * 2);
        this.shadow.setPosition(this.width * mix(s.offsetX, s.dragOffsetX), this.width * mix(s.offsetY, s.dragOffsetY));
        this.shadow.getComponent(Sprite)!.color = new Color(0, 0, 0, Math.round(mix(s.opacity, s.dragOpacity)));
    }
    protected onDestroy(): void {
        if (!this.ownsShadow) return;
        this.ownsShadow = false;
        if (--CardView.shadowUsers === 0) {
            CardView.shadowFrame?.destroy(); CardView.shadowTexture?.destroy();
            CardView.shadowFrame = null; CardView.shadowTexture = null;
        }
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
