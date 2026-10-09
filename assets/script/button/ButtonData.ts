/**
 * 用途：集中定义按钮的身份和布局，避免业务管理器散落按钮尺寸。
 * 运行边界：纯数据，不挂节点、不执行打开手册等业务；位置相对父 UI 的右下角。
 */
export interface ButtonData { id: string; width: number; height: number; margin: number; hoverScale: number; }
export const BOOK_BUTTON: ButtonData = { id: 'OpenHandbook', width: 64, height: 64, margin: 24, hoverScale: 1.06 };
