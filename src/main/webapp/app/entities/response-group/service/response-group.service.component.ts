import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IResponseGroupe } from '../response-group.model';
import { createRequestOption } from 'app/core/request/request-util';
import { ApplicationConfigService } from 'app/core/config/application-config.service';
import { getResponseGroupIdentifier } from '../response-group.model';

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
}
