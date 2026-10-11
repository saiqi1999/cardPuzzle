/**
 * 用途：集中声明Box实体数据，方便后续替换内容。
 * 运行边界：纯数据，不挂节点、不加载图片、不推进事件；仅在本局内存使用。
 */
export interface BoxData {
    id: string;
    name: string;
    description: string;
}
export const INITIAL_BOX: BoxData = {
    id: 'opening-box', name: '炼金箱', description: '一个神秘的箱子。可以拖动，收纳功能尚未开启。',
};
