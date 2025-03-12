import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IResponseGroupe } from 'app/entities/response-group/response-group.model';
import { createRequestOption } from 'app/core/request/request-util';
import { ApplicationConfigService } from 'app/core/config/application-config.service';
import { getResponseGroupIdentifier } from 'app/entities/response-group/response-group.model';

export type EntityResponseType = HttpResponse<IResponseGroupe>;
export type EntityArrayResponseType = HttpResponse<IResponseGroupe[]>;

@Injectable({ providedIn: 'root' })
export class ResponseGroupService {
  protected resourceUrl = 'api/responsegroups';

  constructor(
    protected http: HttpClient,
    protected applicationConfigService: ApplicationConfigService,
  ) {
    this.resourceUrl = this.applicationConfigService.getEndpointFor('api/responsegroups');
  }

  create(responseGroup: IResponseGroupe): Observable<EntityResponseType> {
    return this.http.post<IResponseGroupe>(this.resourceUrl, responseGroup, { observe: 'response' });
  }

  update(responseGroup: IResponseGroupe): Observable<EntityResponseType> {
    return this.http.put<IResponseGroupe>(this.resourceUrl, responseGroup, {
      observe: 'response',
    });
  }

  partialUpdate(responseGroup: IResponseGroupe): Observable<EntityResponseType> {
    return this.http.patch<IResponseGroupe>(`${this.resourceUrl}/${getResponseGroupIdentifier(responseGroup) as number}`, responseGroup, {
      observe: 'response',
    });
  }

  find(id: number): Observable<EntityResponseType> {
    return this.http.get<IResponseGroupe>(`${this.resourceUrl}/${id}`, { observe: 'response' });
  }

  query(req?: any): Observable<EntityArrayResponseType> {
    const options = createRequestOption(req);
    return this.http.get<IResponseGroupe[]>(this.resourceUrl, { params: options, observe: 'response' });
  }

  delete(id: number): Observable<HttpResponse<any>> {
    return this.http.delete(`${this.resourceUrl}/${id}`, { observe: 'response' });
  }

  deleteByQuestionId(questionId: number): Observable<HttpResponse<any>> {
    return this.http.delete(`${this.resourceUrl}/question/${questionId}`, { observe: 'response' });
  }

  findByQuestionId(questionId: number): Observable<EntityResponseType> {
    return this.http.get(`${this.resourceUrl}/question/${questionId}`, { observe: 'response' });
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

  //To redo properly wth the methods we wish
  updateAverageEmbedding(responseGroup: IResponseGroupe, predictionEmbedding: number[]): void {
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
}
