import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { IResponseGroup } from 'app/entities/response-group/response-group.model';
import { createRequestOption } from 'app/core/request/request-util';
import { ApplicationConfigService } from 'app/core/config/application-config.service';
import { getResponseGroupIdentifier } from 'app/entities/response-group/response-group.model';
import { PredictionService } from 'app/entities/prediction/service/prediction.service';
import { EmbeddingService } from 'app/scanexam/embedding/embedding.service';

export type EntityResponseType = HttpResponse<IResponseGroup>;
export type EntityArrayResponseType = HttpResponse<IResponseGroup[]>;

@Injectable({ providedIn: 'root' })
export class ResponseGroupService {
  protected resourceUrl = 'api/responseGroups';

  constructor(
    protected http: HttpClient,
    protected applicationConfigService: ApplicationConfigService,
    public predictionService: PredictionService,
    private embeddingService: EmbeddingService,
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
    return this.http.get<IResponseGroup>(`${this.resourceUrl}/prediction/${predictionId}`, { observe: 'response' });
  }

  async assignPredictionToResponseGroup(predictionId: number, questionId: number): Promise<void> {
    const responseGroupResponse = await firstValueFrom(this.findByPredictionId(predictionId));
    if (responseGroupResponse.body?.id !== undefined) {
      // eslint-disable-next-line no-console
      console.log('There was already a group', responseGroupResponse.body?.predictionIds);
      return;
    } else {
      const responseGroupsResponse = await firstValueFrom(this.findByQuestionId(questionId));
      const predictionEmbedding = await this.calculatePredictionEmbedding(predictionId);
      let maxSimilarity = 0;
      let bestResponseGroup: IResponseGroup | null = null;
      for (const responseGroup of responseGroupsResponse.body!) {
        const similarity = this.calculateSimilarity(responseGroup.averageEmbedding!, predictionEmbedding);
        if (maxSimilarity < similarity && similarity > 0.5) {
          maxSimilarity = similarity;
          bestResponseGroup = responseGroup;
        }
      }
      if (bestResponseGroup) {
        bestResponseGroup.predictionIds?.push(predictionId);
        this.updateAverageEmbedding(bestResponseGroup, predictionEmbedding);
        await firstValueFrom(this.update(bestResponseGroup));
        // eslint-disable-next-line no-console
        console.log('I updated the group', bestResponseGroup);
      } else {
        const newResponseGroup: IResponseGroup = {
          questionId,
          predictionIds: [predictionId],
          averageEmbedding: predictionEmbedding,
        };
        const returnObject = await firstValueFrom(this.create(newResponseGroup));
        // eslint-disable-next-line no-console
        console.log('I created the group', returnObject.body);
      }
    }
  }

  private calculateSimilarity(groupEmbedding: number[], predictionEmbedding: number[]): number {
    if (!groupEmbedding || !predictionEmbedding || groupEmbedding.length === 0 || predictionEmbedding.length === 0) {
      return 0;
    }

    // Checking if the arrys have the same length
    if (groupEmbedding.length !== predictionEmbedding.length) {
      throw new Error('Embeddings must be of the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < groupEmbedding.length; i++) {
      dotProduct += groupEmbedding[i] * predictionEmbedding[i];
      normA += Math.pow(groupEmbedding[i], 2);
      normB += Math.pow(predictionEmbedding[i], 2);
    }

    if (normA === 0 || normB === 0 || dotProduct === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private updateAverageEmbedding(responseGroup: IResponseGroup, predictionEmbedding: number[]): void {
    if (!predictionEmbedding || predictionEmbedding.length === 0) {
      return;
    }

    // Initialization
    if (!responseGroup.averageEmbedding || responseGroup.averageEmbedding.length === 0) {
      responseGroup.averageEmbedding = [...predictionEmbedding];
      return;
    }

    // Checking if the arrys have the same length
    if (responseGroup.averageEmbedding.length !== predictionEmbedding.length) {
      throw new Error('Embeddings must be of the same length');
    }

    const dimension = responseGroup.averageEmbedding.length;
    let count = responseGroup.predictionIds?.length;
    if (!count) {
      count = 1;
    }
    const newAverage: number[] = [];

    // Calculate weighted average
    for (let i = 0; i < dimension; i++) {
      const avgValue = (responseGroup.averageEmbedding[i] * count + predictionEmbedding[i]) / (count + 1);
      newAverage.push(avgValue);
    }

    responseGroup.averageEmbedding = newAverage;
  }

  private async calculatePredictionEmbedding(predictionId: number): Promise<number[]> {
    try {
      const predictionResponse = await firstValueFrom(this.predictionService.find(predictionId));
      const predictionText = predictionResponse.body?.text;

      if (!predictionText) {
        console.error(`No text found for prediction with ID: ${predictionId}`);
        return [];
      }

      const embedding = await this.embeddingService.executeEmbeddingFromText(predictionText);
      if (embedding) {
        return Array.from(embedding); // Convert Float32Array to regular array
      }
      return [];
    } catch (error) {
      console.error('Error calculating prediction embedding:', error);
      return [];
    }
  }

  gradeAnswer(payload: { question: string; student_answer: string; max_grade: number; step: number }) {
    return this.http.post<any>('http://localhost:8000/api/grade', payload);
  }
}
