import { Injectable } from '@angular/core';
import { HttpResponse } from '@angular/common/http';
import { Resolve, ActivatedRouteSnapshot, Router } from '@angular/router';
import { Observable, of, EMPTY } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import { IResponseGroupe } from '../response-group.model';
import { ResponseGroupService } from '../service/response-group.service.component';

@Injectable({ providedIn: 'root' })
export class ResponseGroupRoutingResolveService implements Resolve<IResponseGroupe | null> {
  constructor(
    protected service: ResponseGroupService,
    protected router: Router,
  ) {}

  resolve(route: ActivatedRouteSnapshot): Observable<IResponseGroupe | null> {
    const id = route.params['id'];
    if (id) {
      return this.service.find(id).pipe(
        mergeMap((responseGroup: HttpResponse<IResponseGroupe>) => {
          if (responseGroup.body) {
            return of(responseGroup.body);
          } else {
            this.router.navigate(['404']);
            return EMPTY;
          }
        }),
      );
    }
    return of(null);
  }
}
