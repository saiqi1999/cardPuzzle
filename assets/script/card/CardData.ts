/** Game meaning is independent of image filenames and player translations. */
export interface CardData {
    id: string;
    type: 'npc' | 'material' | 'facility';
    name: string;
    demandSymbols: string[];
    translation?: string;
}
export const DEMO_CARD: CardData = {
    id: 'visitor-001', type: 'npc', name: '陌生旅人',
    demandSymbols: ['alpha_1', 'alpha_flower', 'alpha_fire'],
};
