import { Routes } from '@angular/router';

import { UserRouteAccessService } from 'app/core/auth/user-route-access.service';
import { ResponseGroupListComponent } from '../list/list.component';
import { ResponseGroupDetailComponent } from '../detail/response-group-detail.component';
import { ResponseGroupUpdateComponent } from '../update/response-group-update.component';
import { ResponseGroupRoutingResolveService } from '../route/response-groupe-routing-resolve.service.component';

const responseGroupRoute: Routes = [
  {
    path: '',
    component: ResponseGroupListComponent,
    canActivate: [UserRouteAccessService],
  },
  {
    path: ':id/view',
    component: ResponseGroupDetailComponent,
    resolve: {
      responseGroup: ResponseGroupRoutingResolveService,
    },
    canActivate: [UserRouteAccessService],
  },
  {
    path: 'new',
    component: ResponseGroupUpdateComponent,
    resolve: {
      responseGroup: ResponseGroupRoutingResolveService,
    },
    canActivate: [UserRouteAccessService],
  },
  {
    path: ':id/edit',
    component: ResponseGroupUpdateComponent,
    resolve: {
      responseGroup: ResponseGroupRoutingResolveService,
    },
    canActivate: [UserRouteAccessService],
  },
];

export class ResponseGroupRoutingModule {}
