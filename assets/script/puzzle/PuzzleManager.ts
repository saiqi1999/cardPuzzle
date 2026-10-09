/**
 * 用途：统一管理解密手册列表、当前页和展开状态，作为书页系统入口。
 * 职责：创建页面/输入遮挡节点；A/D 循环翻页；书本按钮从中心缩放打开手册，半透明遮罩拦截输入，退出隐藏。
 * 运行边界：挂在 Canvas 的 PuzzleRoot 子节点，所有生成节点归该节点所有。
 * Inspector 绑定背景与符号；初版静态三页、图片留空，不自动解锁或确认人物词义。
 * 仅展开时响应 A/D；Esc 退出并记忆页码；禁用时停止缩放动画并清除键盘监听和模态遮挡。
 */
import { _decorator, Component, Node, SpriteFrame, UITransform, Layers, BlockInputEvents,
    input, Input, EventKeyboard, KeyCode, Graphics, Color, tween, Tween, Vec3, error } from 'cc';
import { PuzzleData } from './PuzzleData';
import { PuzzleView, PUZZLE_LAYOUT, PuzzleArt } from './PuzzleView';
import { PuzzleClick } from './PuzzleClick';
import { BOOK_BUTTON } from '../button/ButtonData';
import { ButtonView } from '../button/ButtonView';
import { ButtonClick } from '../button/ButtonClick';
const { ccclass, property } = _decorator;
// alpha: 0 完全透明，255 完全不透明；只作用于遮罩，书页保持不透明。
export const HANDBOOK_STYLE = { r: 38, g: 30, b: 25, alpha: 128 } as const;
export const HANDBOOK_ANIMATION = { startScale: 0.08, duration: 0.25 } as const;
export const INITIAL_PUZZLES: PuzzleData[] = [
    { id: 'fire-flower', title: '火焰花', symbols: ['alpha_fire', 'alpha_flower'],
        description: '花瓣像火焰一样温热。\n炼金笔记：火焰与花的符号组合，表示火焰花。' },
    { id: 'moon-flower', title: '月露花', symbols: ['alpha_1', 'alpha_flower'],
        description: '月光下绽放，花瓣上凝结着露珠。\n炼金笔记：观察它与火焰花共有的符号。' },
    { id: 'red-root', title: '赤根草', symbols: ['alpha_1', 'alpha_fire'],
        description: '根茎呈赤红色，是药铺常见的炼金植物。\n这些符号组合暂作首版线索示例。' },
];
@ccclass('PuzzleManager')
export class PuzzleManager extends Component {
    @property(SpriteFrame) bookButton: SpriteFrame = null!;
    @property(SpriteFrame) background: SpriteFrame = null!;
    @property([SpriteFrame]) symbols: SpriteFrame[] = [];
    public puzzles: PuzzleData[] = INITIAL_PUZZLES.map(page => ({ ...page, symbols: [...page.symbols] }));
    private page!: Node;
    private blocker!: Node;
    private view!: PuzzleView;
    private click!: PuzzleClick;
    private art!: PuzzleArt;
    private index = 0;
    private expanded = false;
    private button!: Node;
    private buttonView!: ButtonView;
    private boardWidth = 0;
    private boardHeight = 0;

    protected start(): void { this.ensureReady(); }
    public ensureReady(): boolean {
        if (this.page) return true;
        if (!this.bookButton || !this.background || this.symbols.length < 3 || !this.node.parent?.getComponent(UITransform)) {
            error('PuzzleManager: 需要 Canvas 父节点、书本按钮、书页背景和三个符号'); return false;
        }
        this.art = { background: this.background, images: {},
            symbols: { alpha_1: this.symbols[0], alpha_flower: this.symbols[1], alpha_fire: this.symbols[2] } };
        this.blocker = new Node('PuzzleInputBlocker'); this.blocker.layer = Layers.Enum.UI_2D;
        this.blocker.addComponent(Graphics);
        this.blocker.addComponent(UITransform); this.blocker.addComponent(BlockInputEvents);
        this.node.addChild(this.blocker); this.blocker.active = false;
        this.page = new Node('PuzzlePage'); this.page.layer = Layers.Enum.UI_2D;
        this.page.addComponent(UITransform); this.node.addChild(this.page);
        this.view = this.page.addComponent(PuzzleView); this.click = this.page.addComponent(PuzzleClick);
        this.button = new Node(BOOK_BUTTON.id); this.button.layer = Layers.Enum.UI_2D;
        this.button.addComponent(UITransform); this.node.addChild(this.button);
        this.buttonView = this.button.addComponent(ButtonView);
        this.buttonView.initialize(this.bookButton, BOOK_BUTTON);
        this.button.addComponent(ButtonClick).bind(() => this.open());
        this.resize();
        return true;
    }
    protected onEnable(): void { input.on(Input.EventType.KEY_DOWN, this.keyDown, this); }
    protected onDisable(): void {
        input.off(Input.EventType.KEY_DOWN, this.keyDown, this);
        if (this.page) this.close();
    }
    /** 本局内存收录，以页 ID 去重，不写入本地存档。 */
    public collectPage(page: PuzzleData): boolean {
        if (!this.ensureReady()) return false;
        if (!this.puzzles.some(item => item.id === page.id)) this.puzzles.push({ ...page, symbols: [...page.symbols] });
        return true;
    }
    public openPage(id: string): void {
        if (!this.ensureReady()) return;
        const index = this.puzzles.findIndex(page => page.id === id);
        if (index < 0) return;
        this.index = index; this.render(); this.open();
    }
    public open(): void {
        if (!this.page || !this.puzzles.length || this.expanded) return;
        Tween.stopAllByTarget(this.page);
        this.expanded = true;
        this.node.setSiblingIndex(this.node.parent!.children.length - 1);
        this.blocker.active = true; this.page.active = true; this.button.active = false;
        this.page.setPosition(0, 0);
        this.page.setScale(HANDBOOK_ANIMATION.startScale, HANDBOOK_ANIMATION.startScale, 1);
        tween(this.page).to(HANDBOOK_ANIMATION.duration, { scale: new Vec3(1, 1, 1) },
            { easing: 'quadOut' }).start();
    }
    public close(): void {
        if (!this.page) return;
        Tween.stopAllByTarget(this.page);
        this.page.setScale(1, 1, 1);
        this.expanded = false;
        this.page.active = false; this.blocker.active = false; this.button.active = true;
    }
    public turnPage(delta: number): void {
        if (!this.expanded || !this.puzzles.length) return;
        this.index = (this.index + delta % this.puzzles.length + this.puzzles.length) % this.puzzles.length;
        this.render();
    }
    private keyDown(event: EventKeyboard): void {
        if (event.keyCode === KeyCode.KEY_A) this.turnPage(-1);
        else if (event.keyCode === KeyCode.KEY_D) this.turnPage(1);
        else if (event.keyCode === KeyCode.ESCAPE) this.close();
    }
    protected lateUpdate(): void {
        if (!this.page) return;
        const board = this.node.parent!.getComponent(UITransform)!;
        if (board.width !== this.boardWidth || board.height !== this.boardHeight) this.resize();
    }
    private resize(): void {
        const board = this.node.parent!.getComponent(UITransform)!;
        this.boardWidth = board.width; this.boardHeight = board.height;
        this.node.setPosition((0.5 - board.anchorX) * board.width, (0.5 - board.anchorY) * board.height);
        this.node.getComponent(UITransform)!.setContentSize(board.width, board.height);
        this.blocker.getComponent(UITransform)!.setContentSize(board.width, board.height);
        const graphics = this.blocker.getComponent(Graphics)!;
        graphics.clear();
        graphics.fillColor = new Color(HANDBOOK_STYLE.r, HANDBOOK_STYLE.g, HANDBOOK_STYLE.b, HANDBOOK_STYLE.alpha);
        graphics.rect(-board.width / 2, -board.height / 2, board.width, board.height); graphics.fill();
        this.render();
        this.page.setPosition(0, 0);
        this.blocker.active = this.expanded;
        this.buttonView.reposition();
    }
    private render(): void {
        this.page.active = this.expanded && this.puzzles.length > 0;
        if (!this.puzzles.length) return;
        this.index = Math.min(this.index, this.puzzles.length - 1);
        const width = Math.max(1, Math.min(this.boardWidth * PUZZLE_LAYOUT.screenWidth,
            this.boardHeight * PUZZLE_LAYOUT.screenHeight * PUZZLE_LAYOUT.aspect));
        this.view.render(this.puzzles[this.index], this.art, width, this.index, this.puzzles.length);
        this.click.bind(this.view.quitNode, () => this.close());
    }
}
