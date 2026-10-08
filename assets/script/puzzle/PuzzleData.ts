/**
 * 用途：将解谜书页内容与 UI、翻页输入解耦，沿用 CardData 的数据驱动方式。
 * 职责：描述标题、炼金符号、说明和可选图片键；示例列表由 PuzzleManager 持有。
 * 运行边界：纯数据，不挂载节点，不自动确认词义；图片键为空时保留空图片位置。
 */
export interface PuzzleData {
    id: string;
    title: string;
    symbols: string[];
    description: string;
    imageKey?: string;
}
