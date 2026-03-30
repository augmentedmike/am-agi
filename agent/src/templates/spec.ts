export interface ColumnSpec {
  id: string;
  label: string;
}

export interface TransitionSpec {
  from: string;
  to: string;
  gates: string[];
}

export interface FieldSpec {
  id: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'textarea';
  required?: boolean;
  options?: string[];
}

export interface CardTypeSpec {
  id: string;
  label: string;
  fields: FieldSpec[];
}

export interface TemplateSpec {
  type: string;
  displayName: string;
  description: string;
  pipeline: {
    columns: ColumnSpec[];
    transitions: TransitionSpec[];
  };
  cardTypes: CardTypeSpec[];
  fields: FieldSpec[];
}
