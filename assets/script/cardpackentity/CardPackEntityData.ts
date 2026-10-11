/**
 * 用途：集中声明CardPackEntity实体数据，方便后续替换内容。
 * 运行边界：纯数据，不挂节点、不加载图片、不推进事件；仅在本局内存使用。
 */
export interface CardPackEntityData {
    id: string;
    name: string;
    cardIds: string[];
}
export const INITIAL_CARD_PACK: CardPackEntityData = {
    id: 'opening-pack', name: '初始卡包', cardIds: ['visitor-001', 'herb-fire', 'herb-moon', 'herb-root'],
};
