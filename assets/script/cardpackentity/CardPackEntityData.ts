/**
 * 用途：定义 header 卡包的事件数据，供 EventManager 区分各入口。
 * 运行边界：纯数据，不挂载节点；ID/名称/描述由对应 View 的 Inspector 配置。
 * 当前不包含购买费用和掉落规则。
 */
export interface CardPackEntityData {
    id: string;
    name: string;
    description: string;
}
