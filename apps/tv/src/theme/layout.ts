import {Dimensions} from 'react-native';

const DESIGN_WIDTH = 1920;
const scale = Dimensions.get('window').width / DESIGN_WIDTH;

/** Converts a 1920×1080 design pixel to a layout unit on this screen. */
export const px = (n: number) => n * scale;

export const safe = {horizontal: px(96), vertical: px(54)};

export const radius = {surface: px(20), photo: px(16), pill: 999};

export const focus = {gap: px(6), ring: px(3), scale: 1.04};
