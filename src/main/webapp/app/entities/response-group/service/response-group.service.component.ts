import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { IResponseGroup, ResponseGroup } from 'app/entities/response-group/response-group.model';
import { createRequestOption } from 'app/core/request/request-util';
import { ApplicationConfigService } from 'app/core/config/application-config.service';
import { getResponseGroupIdentifier } from 'app/entities/response-group/response-group.model';
import { PredictionService } from 'app/entities/prediction/service/prediction.service';

export type EntityResponseType = HttpResponse<IResponseGroup>;
export type EntityArrayResponseType = HttpResponse<IResponseGroup[]>;

@Injectable({ providedIn: 'root' })
export class ResponseGroupService {
  protected resourceUrl = 'api/responseGroups';

  constructor(
    protected http: HttpClient,
    protected applicationConfigService: ApplicationConfigService,
    public predictionService: PredictionService,
  ) {
    this.resourceUrl = this.applicationConfigService.getEndpointFor('api/responseGroups');
  }

  create(responseGroup: IResponseGroup): Observable<EntityResponseType> {
    return this.http.post<IResponseGroup>(this.resourceUrl, responseGroup, { observe: 'response' });
  }

  update(responseGroup: IResponseGroup): Observable<EntityResponseType> {
    return this.http.put<IResponseGroup>(this.resourceUrl, responseGroup, {
      observe: 'response',
    });
  }

  partialUpdate(responseGroup: IResponseGroup): Observable<EntityResponseType> {
    return this.http.patch<IResponseGroup>(`${this.resourceUrl}/${getResponseGroupIdentifier(responseGroup) as number}`, responseGroup, {
      observe: 'response',
    });
  }

  find(id: number): Observable<EntityResponseType> {
    return this.http.get<IResponseGroup>(`${this.resourceUrl}/${id}`, { observe: 'response' });
  }

  query(req?: any): Observable<EntityArrayResponseType> {
    const options = createRequestOption(req);
    return this.http.get<IResponseGroup[]>(this.resourceUrl, { params: options, observe: 'response' });
  }

  delete(id: number): Observable<HttpResponse<any>> {
    return this.http.delete(`${this.resourceUrl}/${id}`, { observe: 'response' });
  }

  deleteByQuestionId(questionId: number): Observable<HttpResponse<any>> {
    return this.http.delete(`${this.resourceUrl}/question/${questionId}`, { observe: 'response' });
  }

  findByQuestionId(questionId: number): Observable<EntityArrayResponseType> {
    return this.http.get<IResponseGroup[]>(`${this.resourceUrl}/question/${questionId}`, { observe: 'response' });
  }

  findByPredictionId(predictionId: number): Observable<EntityResponseType> {
    return this.http.get(`${this.resourceUrl}/prediction/${predictionId}`, { observe: 'response' });
  }

  //To redo properly with our methods
  calculateSimilarity(groupEmbedding: number[], predictionEmbedding: number[]): number {
    if (!groupEmbedding || !predictionEmbedding || groupEmbedding.length === 0 || predictionEmbedding.length === 0) {
      return 0;
    }
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    const dimension = Math.min(groupEmbedding.length, predictionEmbedding.length);

    for (let i = 0; i < dimension; i++) {
      dotProduct += groupEmbedding[i] * predictionEmbedding[i];
      normA += Math.pow(groupEmbedding[i], 2);
      normB += Math.pow(predictionEmbedding[i], 2);
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  //To redo properly with the methods we wish
  updateAverageEmbedding(responseGroup: IResponseGroup, predictionEmbedding: number[]): void {
    if (!predictionEmbedding || predictionEmbedding.length === 0) {
      return;
    }
    if (!responseGroup.averageEmbedding || responseGroup.averageEmbedding.length === 0) {
      responseGroup.averageEmbedding = [...predictionEmbedding];
      return;
    }
    const dimension = Math.min(responseGroup.averageEmbedding.length, predictionEmbedding.length);
    const newAverage: number[] = [];
    for (let i = 0; i < dimension; i++) {
      const avgValue = (responseGroup.averageEmbedding[i] + predictionEmbedding[i]) / 2;
      newAverage.push(avgValue);
    }

    responseGroup.averageEmbedding = newAverage;
  }

  async calculatePredictionEmbedding(predictionId: number): Promise<number[]> {
    const predictionText = (await firstValueFrom(this.predictionService.find(predictionId))).body?.text;

    //Calculate the embedding

    //Example to make function work
    const predictionEmbedding = [1, 2, 3];
    return predictionEmbedding;
  }

  //This will be the function that uses other service functions to put prediction in a response group
  async assignPredictionToResponseGroup(predictionId: number, questionId: number) {
    const responseGroup = await firstValueFrom(this.findByPredictionId(predictionId));
    if (responseGroup) {
      //To redo properly
      return;
    } else {
      let responseGroups = (await firstValueFrom(this.findByQuestionId(questionId))).body;
      const predictionEmbedding = this.calculatePredictionEmbedding(predictionId);
      let maxSimilarity = 0;
      let bestResponseGroup = null;
      for (const responseGroup of responseGroups!) {
        let similarity = this.calculateSimilarity(responseGroup.averageEmbedding!, await predictionEmbedding);
        // 0.5 to be changed
        if (maxSimilarity < similarity && similarity > 0.5) {
          maxSimilarity = similarity;
          bestResponseGroup = responseGroup;
        }
      }
      if (bestResponseGroup) {
        bestResponseGroup?.predictionIds?.push(predictionId);
        this.updateAverageEmbedding(bestResponseGroup, await predictionEmbedding);
        this.update(bestResponseGroup);
      } else {
        const newResponseGroup = new ResponseGroup(undefined, questionId, [predictionId], await predictionEmbedding);
        this.create(newResponseGroup);
      }
    }
  }
}
