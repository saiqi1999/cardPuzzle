/**
 * 用途：统一管理解密手册列表、当前页和展开状态，作为书页系统入口。
 * 职责：创建页面/输入遮挡节点；A/D 循环翻页；从底部露边位置动画移到中央并收回。
 * 运行边界：挂在 Canvas 的 PuzzleRoot 子节点，所有生成节点归该节点所有。
 * Inspector 绑定背景与符号；初版静态三页、图片留空，不自动解锁或确认人物词义。
 * 仅展开且动画结束时响应 A/D；动画中忽略重复操作；禁用时取消 tween 和键盘监听。
 */
import { _decorator, Component, Node, SpriteFrame, UITransform, Layers, BlockInputEvents,
    input, Input, EventKeyboard, KeyCode, tween, Tween, Vec3, error } from 'cc';
import { PuzzleData } from './PuzzleData';
import { PuzzleView, PUZZLE_LAYOUT, PuzzleArt } from './PuzzleView';
import { PuzzleClick } from './PuzzleClick';
const { ccclass, property } = _decorator;
export const PUZZLE_MOTION = { duration: 0.3, peekRatio: 0.12 } as const;
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
    @property(SpriteFrame) background: SpriteFrame = null!;
    @property([SpriteFrame]) symbols: SpriteFrame[] = [];
    public puzzles: PuzzleData[] = INITIAL_PUZZLES;
    private page!: Node;
    private blocker!: Node;
    private view!: PuzzleView;
    private click!: PuzzleClick;
    private art!: PuzzleArt;
    private index = 0;
    private expanded = false;
    private moving = false;
    private boardWidth = 0;
    private boardHeight = 0;
    private closedY = 0;
    protected start(): void {
        if (!this.background || this.symbols.length < 3 || !this.node.parent?.getComponent(UITransform)) {
            error('PuzzleManager: 需要 Canvas 父节点、书页背景和三个符号'); return;
        }
        this.art = { background: this.background, images: {},
            symbols: { alpha_1: this.symbols[0], alpha_flower: this.symbols[1], alpha_fire: this.symbols[2] } };
        this.blocker = new Node('PuzzleInputBlocker'); this.blocker.layer = Layers.Enum.UI_2D;
        this.blocker.addComponent(UITransform); this.blocker.addComponent(BlockInputEvents);
        this.node.addChild(this.blocker); this.blocker.active = false;
        this.page = new Node('PuzzlePage'); this.page.layer = Layers.Enum.UI_2D;
        this.page.addComponent(UITransform); this.node.addChild(this.page);
        this.view = this.page.addComponent(PuzzleView); this.click = this.page.addComponent(PuzzleClick);
        this.resize();
    }
    protected onEnable(): void { input.on(Input.EventType.KEY_DOWN, this.keyDown, this); }
    protected onDisable(): void {
        input.off(Input.EventType.KEY_DOWN, this.keyDown, this);
        if (this.page) { Tween.stopAllByTarget(this.page); this.moving = false; this.expanded = false;
            this.blocker.active = false; this.page.setPosition(0, this.closedY); this.view.setExpanded(false); }
    }
    public open(): void { this.move(true); }
    public close(): void { this.move(false); }
    public turnPage(delta: number): void {
        if (!this.expanded || this.moving || !this.puzzles.length) return;
        this.index = (this.index + delta % this.puzzles.length + this.puzzles.length) % this.puzzles.length;
        this.render();
    }
    private keyDown(event: EventKeyboard): void {
        if (event.keyCode === KeyCode.KEY_A) this.turnPage(-1);
        else if (event.keyCode === KeyCode.KEY_D) this.turnPage(1);
        else if (event.keyCode === KeyCode.ESCAPE) this.close();
    }
    private move(expanded: boolean): void {
        if (!this.page || !this.puzzles.length || this.moving || this.expanded === expanded) return;
        this.expanded = expanded; this.moving = true;
        this.node.setSiblingIndex(this.node.parent!.children.length - 1);
        this.blocker.active = true; this.view.setExpanded(expanded);
        tween(this.page).to(PUZZLE_MOTION.duration, { position: new Vec3(0, expanded ? 0 : this.closedY, 0) },
            { easing: 'quadInOut' }).call(() => { this.moving = false; this.blocker.active = this.expanded; }).start();
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
        Tween.stopAllByTarget(this.page); this.moving = false;
        this.render();
        const h = this.page.getComponent(UITransform)!.height;
        this.closedY = -board.height / 2 - h / 2 + h * PUZZLE_MOTION.peekRatio;
        this.page.setPosition(0, this.expanded ? 0 : this.closedY);
        this.blocker.active = this.expanded;
    }
    private render(): void {
        this.page.active = this.puzzles.length > 0;
        if (!this.puzzles.length) return;
        this.index = Math.min(this.index, this.puzzles.length - 1);
        const width = Math.max(1, Math.min(PUZZLE_LAYOUT.width, this.boardWidth * PUZZLE_LAYOUT.screenWidth,
            this.boardHeight * PUZZLE_LAYOUT.screenHeight * PUZZLE_LAYOUT.aspect));
        this.view.render(this.puzzles[this.index], this.art, width, this.index, this.puzzles.length);
        this.view.setExpanded(this.expanded);
        this.click.bind(this.view.quitNode, () => this.open(), () => this.close());
    }
}
