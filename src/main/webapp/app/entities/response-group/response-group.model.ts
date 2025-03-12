import { group } from 'console';
import { response } from 'express';

export interface IResponseGroupe {
  id?: number;
  questionId?: number;
  predictionIds?: number[];
  averageEmbedding?: number[];
}

export class ResponseGroup implements IResponseGroupe {
  constructor(
    public id?: number,
    public questionId?: number,
    public predictionIds?: number[],
    public averageEmbedding?: number[],
  ) {}
}

export function getResponseGroupIdentifier(responseGroup: IResponseGroupe): number | undefined {
  return responseGroup.id;
}
