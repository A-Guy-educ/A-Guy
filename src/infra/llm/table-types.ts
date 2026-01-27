
export interface TableCell {
  content: string;
  direction: 'rtl' | 'ltr' | 'auto';
  containsMath: boolean;
}

export interface TableModel {
  headers: TableCell[];
  rows: TableCell[][];
}
