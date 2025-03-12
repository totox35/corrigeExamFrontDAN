export interface IResponseGroup {
  id?: number;
  questionId?: number;
  predictionIds?: number[];
  averageEmbedding?: number[];
}

export class ResponseGroup implements IResponseGroup {
  constructor(
    public id?: number,
    public questionId?: number,
    public predictionIds?: number[],
    public averageEmbedding?: number[],
  ) {}
}

export function getResponseGroupIdentifier(responseGroup: IResponseGroup): number | undefined {
  return responseGroup.id;
}
