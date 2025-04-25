export interface IHybridGradedComment {
  id: number;
  text?: string | null;
  description?: string | null;
  grade?: number | null;
  relative?: boolean | null;
  step?: number | null;
  questionId?: number | null;
  shortcut?: string | string[];
  generated?: boolean;
}

export interface IHybridGradedCommentWithStepValue {
  id: number;
  text?: string | null;
  description?: string | null;
  grade?: number | null;
  relative?: boolean | null;
  step?: number | null;
  questionId?: number | null;
  shortcut?: string | string[];
  stepValue?: number | null;
  generated?: boolean;
}

export type NewHybridGradedComment = Omit<IHybridGradedComment, 'id'> & { id: null };
