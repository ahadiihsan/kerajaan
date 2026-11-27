import { cnv, fr, line, pixelize } from '../utils/canvas';

export type ItemIcon = 'axe' | 'bow' | 'blueprint' | 'wood' | 'meat' | 'bag' | 'rod' | 'fish';

export function itemIcon(item: ItemIcon): HTMLCanvasElement {
  const [canvas, ctx] = cnv(16, 16);
  const rect = (color: string, x: number, y: number, width: number, height: number) =>
    fr(ctx, color, x, y, width, height);
  switch (item) {
    case 'axe':
      line(ctx, '#7e4828', 3, 13, 10, 4, 2);
      rect('#516471', 8, 3, 5, 5);
      rect('#9bacb3', 11, 2, 3, 6);
      rect('#dadfce', 13, 3, 1, 4);
      break;
    case 'bow':
      line(ctx, '#efe1b5', 4, 3, 12, 12);
      line(ctx, '#814320', 4, 3, 8, 2, 2);
      line(ctx, '#cb803f', 8, 2, 12, 6, 2);
      line(ctx, '#814320', 12, 6, 12, 12, 2);
      line(ctx, '#564431', 3, 12, 12, 3);
      rect('#cbc9ab', 11, 3, 3, 2);
      break;
    case 'blueprint':
      rect('#294d68', 3, 3, 10, 11);
      rect('#417d99', 4, 2, 10, 11);
      line(ctx, '#dae5d9', 6, 8, 9, 5);
      line(ctx, '#dae5d9', 9, 5, 12, 8);
      rect('#dae5d9', 7, 9, 5, 3);
      rect('#417d99', 9, 9, 1, 3);
      break;
    case 'wood':
      line(ctx, '#724124', 4, 10, 11, 4, 4);
      line(ctx, '#a35d31', 5, 9, 11, 4, 2);
      rect('#d69a50', 3, 10, 4, 4);
      rect('#9b5a30', 4, 11, 2, 2);
      break;
    case 'meat':
      line(ctx, '#eddbb2', 7, 8, 13, 12, 2);
      rect('#eddbb2', 12, 11, 2, 4);
      rect('#9b392c', 3, 4, 7, 6);
      rect('#c85d43', 4, 3, 5, 5);
      rect('#e99a72', 5, 4, 3, 1);
      break;
    case 'rod':
      line(ctx, '#8a4d25', 3, 14, 11, 2, 2);
      line(ctx, '#f1d5a3', 11, 2, 12, 10);
      rect('#ae443b', 11, 10, 3, 3);
      break;
    case 'fish':
      rect('#4b7e83', 3, 6, 8, 5);
      rect('#7ca7a3', 4, 5, 5, 2);
      rect('#7ca7a3', 11, 5, 3, 6);
      rect('#362b23', 4, 7, 1, 1);
      break;
    case 'bag':
      rect('#643e29', 6, 2, 4, 2);
      rect('#633c26', 3, 6, 10, 8);
      rect('#986039', 4, 4, 8, 5);
      rect('#bd8150', 5, 5, 6, 3);
      rect('#cfa253', 7, 8, 2, 3);
      rect('#845235', 5, 11, 6, 2);
      break;
  }
  pixelize(ctx, 16, 16, '#3a2318');
  canvas.setAttribute('aria-hidden', 'true');
  return canvas;
}
