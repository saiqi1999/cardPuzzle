/**
 * 用途：将 speech_bubble.png 拼接素材表组装为可独立调整宽高的气泡，避免拉伸多个尾巴。
 * 职责：裁取九宫格边框/填充和一个朝下尾巴，提供已留内边距的 content 节点。
 * 运行边界：只支持当前 64×64 素材布局；源 SpriteFrame 不可旋转或动态合图。
 * 根节点底部中心为原点（即尾尖），说话者在下方；正文由调用方加入 content。
 * 宽高为气泡主体尺寸，不含尾巴；边线与尾巴仅随 pixelScale 缩放，不随宽高变形。
 * 不负责文字、点击、屏幕避让。挂件销毁时释放自身裁片，不销毁源图和纹理。
 */
import { _decorator, Component, Node, UITransform, Sprite, SpriteFrame, Rect, Size, Vec2, Layers } from 'cc';
const { ccclass } = _decorator;
// 原图坐标，左上角原点。底边取没有尾巴的区域；尾巴单独覆盖底边开口。
export const BUBBLE_ATLAS = {
    width: 64, height: 64,
    topLeft: [1, 1, 1, 1], top: [2, 1, 1, 1], topRight: [62, 1, 1, 1],
    left: [1, 2, 1, 1], fill: [2, 2, 1, 1], right: [62, 2, 1, 1],
    bottomLeft: [1, 43, 1, 1], bottom: [16, 43, 1, 1], bottomRight: [62, 43, 1, 1],
    tail: [7, 43, 5, 5],
} as const;
export interface SpeechBubbleOptions {
    width: number;
    height: number;
    pixelScale: number;
    padding: number;
}
export interface SpeechBubbleResult {
    node: Node;
    content: Node;
    width: number;
    height: number;
}
@ccclass('SpeechBubble')
export class SpeechBubble extends Component {
    private slices: SpriteFrame[] = [];
    public static create(parent: Node, source: SpriteFrame, options: SpeechBubbleOptions): SpeechBubbleResult {
        const { width, height, pixelScale: border, padding } = options;
        if (![width, height, border, padding].every(Number.isFinite) || border <= 0 || padding < border
            || width <= 2 * padding || height <= 2 * padding || width < BUBBLE_ATLAS.tail[2] * border) {
            throw new Error('SpeechBubble: 尺寸需容纳边框、内边距和尾巴');
        }
        if (source.rotated || source.originalSize.width !== BUBBLE_ATLAS.width
            || source.originalSize.height !== BUBBLE_ATLAS.height) {
            throw new Error('SpeechBubble: 需要未旋转的 64×64 气泡素材');
        }
        const tailHeight = (BUBBLE_ATLAS.tail[3] - 1) * border;
        const root = new Node('SpeechBubble'); root.layer = Layers.Enum.UI_2D;
        const transform = root.addComponent(UITransform);
        transform.setContentSize(width, height + tailHeight); transform.setAnchorPoint(0.5, 0);
        parent.addChild(root);
        const renderer = root.addComponent(SpeechBubble);
        const xs = [-width / 2, -width / 2 + border, width / 2 - border];
        const ys = [tailHeight + height - border, tailHeight + border, tailHeight];
        const widths = [border, width - 2 * border, border];
        const heights = [border, height - 2 * border, border];
        const tiles = [BUBBLE_ATLAS.topLeft, BUBBLE_ATLAS.top, BUBBLE_ATLAS.topRight,
            BUBBLE_ATLAS.left, BUBBLE_ATLAS.fill, BUBBLE_ATLAS.right,
            BUBBLE_ATLAS.bottomLeft, BUBBLE_ATLAS.bottom, BUBBLE_ATLAS.bottomRight];
        tiles.forEach((rect, index) => {
            const col = index % 3, row = Math.floor(index / 3);
            renderer.patch(source, rect, xs[col], ys[row], widths[col], heights[row], `Body${index}`);
        });
        renderer.patch(source, BUBBLE_ATLAS.tail, -BUBBLE_ATLAS.tail[2] * border / 2, 0,
            BUBBLE_ATLAS.tail[2] * border, BUBBLE_ATLAS.tail[3] * border, 'Tail');
        const content = new Node('Content'); content.layer = Layers.Enum.UI_2D;
        content.addComponent(UITransform).setContentSize(width - padding * 2, height - padding * 2);
        root.addChild(content); content.setPosition(0, tailHeight + height / 2);
        return { node: root, content, width, height: height + tailHeight };
    }
    private patch(source: SpriteFrame, crop: readonly number[], x: number, y: number,
        width: number, height: number, name: string): void {
        // 从 trim 信息还原素材表原点；不假定导入后 rect 起点是 (0,0)。
        const originX = source.rect.x - (source.originalSize.width - source.rect.width) / 2 - source.offset.x;
        const originY = source.rect.y - (source.originalSize.height - source.rect.height) / 2 + source.offset.y;
        const frame = new SpriteFrame(); frame.texture = source.texture;
        frame.rect = new Rect(originX + crop[0], originY + crop[1], crop[2], crop[3]);
        frame.originalSize = new Size(crop[2], crop[3]); frame.offset = new Vec2();
        frame.packable = false; this.slices.push(frame);
        const node = new Node(name); node.layer = Layers.Enum.UI_2D;
        const transform = node.addComponent(UITransform); transform.setAnchorPoint(0, 0);
        transform.setContentSize(width, height); this.node.addChild(node); node.setPosition(x, y);
        const sprite = node.addComponent(Sprite); sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = frame;
    }
    protected onDestroy(): void {
        for (const frame of this.slices) frame.destroy();
        this.slices.length = 0;
    }
}
